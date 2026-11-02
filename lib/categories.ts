import type { Product } from "./types";

// 상품 그림 종류로 진열 분류를 나눈다.
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
  images: readonly string[],
): Product[] {
  return products.filter(({ image }) =>
    images.some((name) => image === `/products/${name}.svg`),
  );
}
