import type { Product } from "./types";

// 홈과 상품 관리에서 쓰는 진열 분류. images는 처음 샘플 상품을 나눌 때만 쓴다.
export const CATEGORIES = [
  { id: "plush", label: "캐릭터 인형", images: ["plush"] },
  { id: "squishy", label: "말랑이", images: ["squishy"] },
  { id: "deco", label: "다이어리 꾸미기", images: ["sticker", "tape"] },
  { id: "pen", label: "필기구", images: ["pen"] },
  { id: "note", label: "노트·다이어리", images: ["note"] },
  { id: "desk", label: "필통·데스크", images: ["pouch", "desk"] },
  { id: "gift", label: "선물·편지", images: ["gift", "letter"] },
] as const;

export function productsInCategory(
  products: Product[],
  categoryId: string,
): Product[] {
  return products.filter(({ category }) => category === categoryId);
}
