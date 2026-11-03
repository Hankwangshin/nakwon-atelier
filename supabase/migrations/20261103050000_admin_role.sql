-- 회원 관리 권한을 네 가지 구분(시스템관리자·일반·휴면·탈퇴)으로만 나눈다.
-- 영역별 관리 권한(admin_scopes)은 더 쓰지 않는다. 칸은 바로 지우지 않고 비워 둔 채 막는다.
update public.profiles set admin_scopes = '{}' where admin_scopes <> '{}';

alter table public.profiles
  add constraint profiles_admin_scopes_unused check (admin_scopes = '{}');

comment on column public.profiles.admin_scopes is
  '사용하지 않음: 관리 메뉴는 시스템관리자(is_admin)만 쓴다.';

-- 마지막 남은 시스템관리자를 다른 구분으로 바꾸거나 지우지 못하게 막는다.
create function public.keep_last_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_admin and (tg_op = 'DELETE' or not new.is_admin) and not exists (
    select 1 from public.profiles where is_admin and id <> old.id
  ) then
    raise exception 'last system admin' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger keep_last_admin
  before update of is_admin or delete on public.profiles
  for each row execute function public.keep_last_admin();

-- 관리자가 회원의 비밀번호를 바꾼 뒤 그 회원의 기존 로그인을 모두 끊는다.
-- 서버(service role)만 부른다.
create function public.revoke_user_sessions(target uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.refresh_tokens where user_id = target::text;
  delete from auth.sessions where user_id = target;
$$;

revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
