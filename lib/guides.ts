import guideData from "@/data/guides.json";
import type { Guide } from "@/lib/types";

function isFilledText(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}

// lib/products.ts처럼, 안내 문서에 문제가 있으면 빌드와 앱 시작을 멈춘다.
export function validateGuides(data: unknown): Guide[] {
  const isValid =
    Array.isArray(data) &&
    data.length > 0 &&
    data.every(
      (guide) =>
        isFilledText(guide?.id) &&
        isFilledText(guide?.title) &&
        isFilledText(guide?.content),
    );

  if (!isValid) {
    throw new Error("안내 문서 오류: id, title, content를 확인해 주세요.");
  }
  return data as Guide[];
}

export const guides = validateGuides(guideData);
