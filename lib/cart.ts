import type { Product } from "./types";

// scripts/check-shop.mjs가 바로 실행할 수 있도록 타입만 가져오는 순수 함수로 둔다.

export const MAX_CART_QUANTITY = 99;

export interface CartRow {
  product_id: string;
  quantity: number;
}

export interface CartLine {
  productId: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  shipping: string;
  stock: number;
}

export interface MemberDiscount {
  tierName: string;
  percent: number;
}

export interface CartSummary {
  lines: CartLine[];
  itemsAmount: number;
  discount: MemberDiscount;
  discountAmount: number;
  shippingFee: number;
  amount: number;
}

const NO_DISCOUNT: MemberDiscount = { tierName: "", percent: 0 };

// 상품 문서의 "배송비 3,000원, 2~3일 소요" 문장에서 배송비를 읽는다.
export function parseShippingFee(shipping: string): number {
  const matched = shipping.match(/배송비\s*([\d,]+)원/);
  return matched ? Number(matched[1].replaceAll(",", "")) : 0;
}

// 금액은 항상 서버가 상품 문서의 가격으로 계산한다.
// 함께 주문하면 묶음 배송으로 보고, 가장 비싼 배송비 1건만 받는다.
// 회원 등급 할인은 상품 금액에만 적용하고, 1원 미만은 할인액에서 버린다.
export function summarizeCart(
  rows: CartRow[],
  products: Product[],
  discount: MemberDiscount = NO_DISCOUNT,
): CartSummary {
  const lines = rows.flatMap(({ product_id, quantity }) => {
    const product = products.find(({ id }) => id === product_id);
    if (!product) {
      return [];
    }
    return [
      {
        productId: product.id,
        name: product.name,
        image: product.image,
        price: product.price,
        quantity,
        shipping: product.shipping,
        stock: product.stock,
      },
    ];
  });

  const itemsAmount = lines.reduce(
    (total, { price, quantity }) => total + price * quantity,
    0,
  );
  const shippingFee = Math.max(
    0,
    ...lines.map(({ shipping }) => parseShippingFee(shipping)),
  );

  const discountAmount = Math.floor((itemsAmount * discount.percent) / 100);

  return {
    lines,
    itemsAmount,
    discount,
    discountAmount,
    shippingFee,
    amount: itemsAmount - discountAmount + shippingFee,
  };
}

export function isOrderable(lines: CartLine[]): boolean {
  return (
    lines.length > 0 &&
    lines.every(({ quantity, stock }) => stock > 0 && quantity <= stock)
  );
}

export function makeOrderName(lines: CartLine[]): string {
  const [first, ...others] = lines;
  return others.length > 0 ? `${first.name} 외 ${others.length}건` : first.name;
}
