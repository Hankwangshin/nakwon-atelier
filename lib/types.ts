// Design Ref: §5 — 상품 안내 문서(data/products.json)의 상품 1개 구조
export interface Product {
  id: string; // 상품 구분용 번호 (예: "p01")
  name: string; // 상품명
  price: number; // 가격(원)
  stock: number; // 재고 수량
  shipping: string; // 배송 안내
  features: string; // 특징
  recommendedFor: string[]; // 추천 대상
  basisDate: string; // 기준일 (YYYY-MM-DD)
}

// Design Ref: §5 — 서버가 화면으로 보내는 최종 답변 종류
export const CHAT_KINDS = [
  "answer",
  "question",
  "recommendation",
  "no_match",
  "guide",
  "cannot_answer",
  "refusal",
] as const;

export type ChatKind = (typeof CHAT_KINDS)[number];

// Design Ref: §5 — 브라우저가 보내는 대화 기록 1개
export interface HistoryItem {
  role: "user" | "assistant";
  content: string;
  kind?: ChatKind; // assistant 항목만. 되묻기 횟수를 세는 데 쓴다
}
