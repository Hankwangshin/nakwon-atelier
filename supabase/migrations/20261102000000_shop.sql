-- 회원 정보. 비밀번호는 Supabase Auth가 따로 관리한다.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  phone text not null,
  agreed_terms_at timestamptz not null,
  agreed_privacy_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.cart_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null,
  quantity integer not null check (quantity between 1 and 99),
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- 전자상거래법 보관 의무가 있어 회원이 탈퇴해도 주문은 남기고 user_id만 비운다.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references auth.users (id) on delete set null,
  order_name text not null,
  items_amount integer not null check (items_amount >= 0),
  shipping_fee integer not null check (shipping_fee >= 0),
  amount integer not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  payment_key text,
  receiver_name text not null,
  receiver_phone text not null,
  address text not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id text not null,
  name text not null,
  price integer not null check (price >= 0),
  quantity integer not null check (quantity > 0)
);

create index orders_user_id_idx on public.orders (user_id);
create index order_items_order_id_idx on public.order_items (order_id);

alter table public.profiles enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- 회원은 자기 데이터만 볼 수 있다. 주문과 회원 정보는 서버(service role)만 쓴다.
create policy "본인 회원 정보 조회" on public.profiles
  for select using (auth.uid() = id);

create policy "본인 장바구니 관리" on public.cart_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "본인 주문 조회" on public.orders
  for select using (auth.uid() = user_id);

create policy "본인 주문 상품 조회" on public.order_items
  for select using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id and orders.user_id = auth.uid()
    )
  );
