-- 회원 등급과 등급별 할인율, 회원별 관리 권한 범위를 추가한다.
create table public.membership_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 20),
  discount_percent integer not null default 0 check (discount_percent between 0 and 50),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- 기본 등급은 하나만 둔다. 등급이 없는 회원은 기본 등급으로 본다.
create unique index membership_tiers_default_idx on public.membership_tiers (is_default)
  where is_default;

insert into public.membership_tiers (name, discount_percent, is_default)
values ('일반', 0, true);

-- 등급은 서버(service role)만 읽고 쓴다.
alter table public.membership_tiers enable row level security;

-- 등급을 지우면 그 회원은 기본 등급으로 돌아간다.
alter table public.profiles
  add column tier_id uuid references public.membership_tiers (id) on delete set null,
  add column admin_scopes text[] not null default '{}'
    check (admin_scopes <@ array['products', 'members', 'requests']);

-- 주문 당시 할인을 저장해, 나중에 등급이 바뀌어도 지난 주문은 그대로 남긴다.
alter table public.orders
  add column tier_name text,
  add column discount_percent integer not null default 0 check (discount_percent between 0 and 50),
  add column discount_amount integer not null default 0 check (discount_amount >= 0);

notify pgrst, 'reload schema';
