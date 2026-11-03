-- 일반회원에게 주는 기본 등급 4개와 할인율을 정한다.
-- 기본 등급 '일반'은 GENERAL(0%)로 이름을 바꾸고, 나머지 세 등급을 더한다.
update public.membership_tiers
set name = 'GENERAL', discount_percent = 0
where is_default;

insert into public.membership_tiers (name, discount_percent, is_default)
values
  ('VVIP', 20, false),
  ('VIP', 15, false),
  ('BEST', 10, false)
on conflict (name) do update set discount_percent = excluded.discount_percent;
