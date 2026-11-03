-- 회원 구분: 시스템관리자(is_admin), 일반회원(active), 휴면회원(dormant), 탈퇴회원(withdrawn).
-- 탈퇴회원은 이메일(auth.users), 탈퇴 상태, 탈퇴 날짜만 남기고 나머지 회원 정보는 지운다.
alter table public.profiles
  alter column name drop not null,
  alter column phone drop not null,
  add column status text not null default 'active'
    check (status in ('active', 'dormant', 'withdrawn')),
  add column withdrawn_at timestamptz;

-- 탈퇴회원에게 개인정보가 남지 않고, 그 밖의 회원은 이름과 연락처가 꼭 있게 한다.
alter table public.profiles
  add constraint profiles_status_fields check (
    (status = 'withdrawn' and withdrawn_at is not null
      and name is null and phone is null and address is null and shipping_address is null
      and tier_id is null and admin_scopes = '{}')
    or (status <> 'withdrawn' and withdrawn_at is null and name is not null and phone is not null)
  ),
  -- 시스템관리자는 휴면·탈퇴로 바꿀 수 없다.
  add constraint profiles_admin_active check (not is_admin or status = 'active');

-- 지금 로그인한 회원이 이용 가능한 상태(휴면·탈퇴가 아님)인지 본다.
-- RLS 안에서 profiles를 다시 읽어도 규칙이 되풀이되지 않도록 security definer로 둔다.
create function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

-- 휴면·탈퇴 회원은 남아 있는 로그인 토큰으로도 자기 데이터에 접근하지 못한다.
drop policy "본인 회원 정보 조회" on public.profiles;
create policy "본인 회원 정보 조회" on public.profiles
  for select using (auth.uid() = id and public.is_active_member());

drop policy "본인 장바구니 관리" on public.cart_items;
create policy "본인 장바구니 관리" on public.cart_items
  for all using (auth.uid() = user_id and public.is_active_member())
  with check (auth.uid() = user_id and public.is_active_member());

drop policy "본인 주문 조회" on public.orders;
create policy "본인 주문 조회" on public.orders
  for select using (auth.uid() = user_id and public.is_active_member());

drop policy "본인 주문 상품 조회" on public.order_items;
create policy "본인 주문 상품 조회" on public.order_items
  for select using (
    public.is_active_member() and exists (
      select 1 from public.orders
      where orders.id = order_items.order_id and orders.user_id = auth.uid()
    )
  );

drop policy "본인 요청 조회" on public.order_requests;
create policy "본인 요청 조회" on public.order_requests
  for select using (auth.uid() = user_id and public.is_active_member());

-- 탈퇴를 한 번에 처리한다. 장바구니를 지우고, 주문과 요청은 법정 보관을 위해
-- 회원 연결만 끊어 남기고, 회원 정보는 이메일 외 모두 지운다. 서버(service role)만 부른다.
create function public.withdraw_member(target uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set status = 'withdrawn', withdrawn_at = now(),
      name = null, phone = null, address = null, shipping_address = null,
      tier_id = null, admin_scopes = '{}'
  where id = target and not is_admin and status <> 'withdrawn';

  if not found then
    return false;
  end if;

  delete from public.cart_items where user_id = target;
  update public.orders set user_id = null where user_id = target;
  update public.order_requests set user_id = null where user_id = target;
  return true;
end;
$$;

revoke all on function public.withdraw_member(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
