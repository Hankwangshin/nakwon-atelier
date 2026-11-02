import type { ProductCardData } from "@/lib/types";

// Design Ref: §1 — 추천 카드에는 상품명, 가격, 배송, 추천 이유를 보여 준다.
export default function ProductCard({
  name,
  price,
  shipping,
  reason,
}: ProductCardData) {
  return (
    <article className="max-w-[85%] rounded-xl border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-700">
      <h2 className="font-semibold">{name}</h2>
      <p className="mt-1">{price.toLocaleString("ko-KR")}원</p>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">{shipping}</p>
      <p className="mt-2 leading-6">{reason}</p>
    </article>
  );
}
