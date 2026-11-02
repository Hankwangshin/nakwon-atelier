// Design Ref: §5 — 상품 안내 문서(data/products.json)의 상품 1개 구조
export interface Product {
  id: string; // 상품 구분용 번호 (예: "p01")
  name: string; // 상품명
  image: string; // 일러스트 경로 또는 업로드한 사진 주소
  category: string; // 진열 분류 (lib/categories.ts)
  price: number; // 가격(원)
  stock: number; // 재고 수량
  shipping: string; // 배송 안내
  features: string; // 특징
  recommendedFor: string[]; // 추천 대상
  basisDate: string; // 기준일 (YYYY-MM-DD)
}

// Design Ref: §5 — 쇼핑몰 이용 안내 문서 1개
export interface Guide {
  id: string;
  title: string;
  content: string;
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

// Design Ref: §5 — AI가 고르는 답변 종류와 받는 사람 값
export const AI_KINDS = [
  "answer",
  "question",
  "recommendation",
  "cannot_answer",
  "refusal",
] as const;

export const RECIPIENTS = [
  "학생",
  "직장 동료",
  "선생님",
  "부모님",
  "친구",
  "아이",
  "기타",
] as const;

// Design Ref: §5 — AI가 돌려주는 양식
export interface AiReply {
  kind: (typeof AI_KINDS)[number];
  message: string;
  sourceProductIds: string[];
  mentionsStock: boolean;
  budget: number | null;
  budgetType: "total" | "perPerson" | null;
  recipientCount: number | null;
  recipient: (typeof RECIPIENTS)[number] | null;
  recommendations: { productId: string; reason: string }[];
}

// Design Ref: §5 — 서버가 화면으로 보내는 상품 표의 한 줄
export interface ProductCardData {
  id: string;
  name: string;
  image: string;
  price: number;
  shipping: string;
  features: string; // 문서의 상품 설명
  reason: string; // 추천 이유. 상품 문의 표에서는 빈 문자열
  isSoldOut: boolean;
}

// Design Ref: §5 — 서버가 화면으로 보내는 성공 응답
export interface ChatResponse {
  kind: ChatKind;
  message: string;
  notices: string[];
  products: ProductCardData[];
}

// Design Ref: §5 — 브라우저가 보내는 대화 기록 1개
export interface HistoryItem {
  role: "user" | "assistant";
  content: string;
  kind?: ChatKind; // assistant 항목만. 되묻기 횟수를 세는 데 쓴다
}
