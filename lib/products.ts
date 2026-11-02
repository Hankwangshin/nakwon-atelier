import productData from "@/data/products.json";
import type { Product } from "@/lib/types";

const TEXT_FIELDS = ["id", "name", "image", "shipping", "features"] as const;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isFilledText(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}

// 상품 1개의 문제를 찾아 문구 목록으로 돌려준다.
function findProductProblems(item: unknown, label: string): string[] {
  if (typeof item !== "object" || item === null) {
    return [`${label}: 상품 형식이 아닙니다.`];
  }

  const product = item as Record<string, unknown>;
  const problems: string[] = [];

  for (const field of TEXT_FIELDS) {
    if (!isFilledText(product[field])) {
      problems.push(`${label}: ${field} 항목이 비어 있습니다.`);
    }
  }
  if (!Number.isInteger(product.price) || (product.price as number) <= 0) {
    problems.push(`${label}: price는 1 이상의 정수여야 합니다.`);
  }
  if (!Number.isInteger(product.stock) || (product.stock as number) < 0) {
    problems.push(`${label}: stock은 0 이상의 정수여야 합니다.`);
  }
  if (
    !Array.isArray(product.recommendedFor) ||
    product.recommendedFor.length === 0 ||
    !product.recommendedFor.every(isFilledText)
  ) {
    problems.push(`${label}: recommendedFor에 추천 대상이 1개 이상 있어야 합니다.`);
  }
  if (
    typeof product.basisDate !== "string" ||
    !DATE_PATTERN.test(product.basisDate)
  ) {
    problems.push(`${label}: basisDate는 YYYY-MM-DD 형식이어야 합니다.`);
  }

  return problems;
}

// Design Ref: §5 — 서버가 가격과 재고를 믿고 쓸 수 있도록 문서를 먼저 검사한다.
// 문제가 있으면 한 번에 고칠 수 있게 모두 모아서 알려 준다.
export function validateProducts(data: unknown): Product[] {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("상품 문서 오류: 상품 목록이 비어 있거나 목록 형식이 아닙니다.");
  }

  const problems: string[] = [];
  const seenIds = new Set<unknown>();

  data.forEach((item, index) => {
    const label = `${index + 1}번째 상품`;
    problems.push(...findProductProblems(item, label));

    const id = (item as { id?: unknown } | null)?.id;
    if (id !== undefined && seenIds.has(id)) {
      problems.push(`${label}: id ${String(id)}가 중복되었습니다.`);
    }
    seenIds.add(id);
  });

  if (problems.length > 0) {
    throw new Error(`상품 문서 오류:\n${problems.join("\n")}`);
  }

  return data as Product[];
}

export const products = validateProducts(productData);
