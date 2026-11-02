-- 상품을 화면에서 관리할 수 있도록 파일에서 데이터베이스로 옮긴다.
create table public.products (
  id text primary key,
  name text not null,
  image text not null,
  price integer not null check (price > 0),
  stock integer not null check (stock >= 0),
  shipping text not null,
  features text not null,
  recommended_for text[] not null check (cardinality(recommended_for) > 0),
  basis_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

-- 상품은 누구나 볼 수 있고, 추가·수정·삭제는 서버(service role)만 한다.
create policy "상품 공개 조회" on public.products
  for select using (true);

-- 관리자 여부는 서버만 바꿀 수 있다. profiles에는 회원 수정 권한이 없다.
alter table public.profiles add column is_admin boolean not null default false;
