-- 구매자의 상품 교환 신청과 결제 취소 요청, 관리자의 승인 기록
alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'paid', 'failed', 'cancelled'));
alter table public.orders add column cancelled_at timestamptz;

create table public.order_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  type text not null check (type in ('exchange', 'cancel')),
  reason text not null check (char_length(reason) between 1 and 500),
  -- processing은 결제 취소를 진행하는 동안만 쓴다. 중복 승인을 막기 위한 상태다.
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index order_requests_order_id_idx on public.order_requests (order_id);

-- 한 주문에는 처리 중인 요청을 하나만 둔다.
create unique index order_requests_open_idx on public.order_requests (order_id)
  where status in ('pending', 'processing');

alter table public.order_requests enable row level security;

-- 회원은 자기 요청만 볼 수 있고, 저장은 서버(service role)만 한다.
create policy "본인 요청 조회" on public.order_requests
  for select using (auth.uid() = user_id);

notify pgrst, 'reload schema';
