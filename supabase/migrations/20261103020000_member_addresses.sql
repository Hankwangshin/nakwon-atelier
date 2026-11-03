-- 회원 본인 주소(주소지)와 주문할 때 기본으로 쓸 배송지를 회원 정보에 더한다.
-- 배송지는 회원마다 하나만 두므로 별도 표 없이 칸으로 둔다.
-- 이미 가입한 회원은 값이 없을 수 있어 비워 둘 수 있게 한다.
alter table public.profiles
  add column address text check (char_length(address) between 1 and 200),
  add column shipping_address text check (char_length(shipping_address) between 1 and 200);

notify pgrst, 'reload schema';
