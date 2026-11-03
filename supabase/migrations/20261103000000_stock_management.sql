-- 보유수량(입고 총량)과 결제 완료 시 재고 차감, 결제 취소 시 재고 복구를 추가한다.
alter table public.products add column on_hand integer;
update public.products set on_hand = stock;
alter table public.products alter column on_hand set not null;
alter table public.products add constraint products_on_hand_check
  check (on_hand >= 0 and stock <= on_hand);

-- 보유수량은 관리자 전용이다. 공개 조회에서는 이 칸만 빼고 읽을 수 있게 한다.
revoke select on public.products from anon, authenticated;
grant select (
  id, name, image, category, price, stock, shipping, features,
  recommended_for, basis_date, created_at
) on public.products to anon, authenticated;

-- 이 기능 전에 결제된 주문은 false로 남아, 취소해도 재고가 늘지 않는다.
alter table public.orders add column stock_deducted boolean not null default false;

-- 재고가 모자라면 아무것도 줄이지 않고 false를 돌려준다.
-- 같은 주문으로 다시 불러도 두 번 줄이지 않는다.
create function public.deduct_order_stock(target_order uuid)
returns boolean
language plpgsql
as $$
declare
  item record;
begin
  update public.orders set stock_deducted = true
    where id = target_order and not stock_deducted;
  if not found then
    return true;
  end if;

  for item in
    select product_id, quantity from public.order_items
    where order_id = target_order
    order by product_id
  loop
    update public.products
      set stock = stock - item.quantity, basis_date = current_date
      where id = item.product_id and stock >= item.quantity;
    if not found then
      raise exception 'out of stock' using errcode = 'NA001';
    end if;
  end loop;

  return true;
exception
  when sqlstate 'NA001' then
    return false;
end;
$$;

-- 차감한 주문만 되돌린다. 그사이 보유수량을 줄였다면 보유수량까지만 늘린다.
create function public.restore_order_stock(target_order uuid)
returns void
language plpgsql
as $$
begin
  update public.orders set stock_deducted = false
    where id = target_order and stock_deducted;
  if not found then
    return;
  end if;

  update public.products as product
    set stock = least(product.stock + item.quantity, product.on_hand),
        basis_date = current_date
    from public.order_items as item
    where item.order_id = target_order and item.product_id = product.id;
end;
$$;

-- 재고는 서버(service role)만 바꿀 수 있다.
revoke execute on function public.deduct_order_stock(uuid) from public, anon, authenticated;
revoke execute on function public.restore_order_stock(uuid) from public, anon, authenticated;
grant execute on function public.deduct_order_stock(uuid) to service_role;
grant execute on function public.restore_order_stock(uuid) to service_role;

notify pgrst, 'reload schema';
