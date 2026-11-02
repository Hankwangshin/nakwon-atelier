import type {
  AiReply,
  ChatKind,
  ChatResponse,
  HistoryItem,
  Product,
  ProductCardData,
} from "./types";

// scripts/check-verify.mjs가 OpenAI 없이 바로 실행할 수 있도록,
// 이 파일은 타입만 가져오고 값은 함수 인자로 받는 순수 함수로 둔다.

// Design Ref: §6 — 고정 문구
export const FIXED_MESSAGES = {
  cannotAnswer: "확인할 수 없습니다. 판매자에게 문의해 주세요: help@example.com",
  refusal: "죄송합니다. 상품, 배송, 선물 추천에 관한 내용만 도와드릴 수 있습니다.",
  guide:
    '예산과 받는 사람을 함께 알려 주세요. 예: "3만 원으로 친구 선물을 추천해 주세요."',
  stockCheck: "실제 재고는 판매자에게 확인해 주세요.",
} as const;

function respond(
  kind: ChatKind,
  message: string,
  notices: string[] = [],
  products: ProductCardData[] = [],
): ChatResponse {
  return { kind, message, notices, products };
}

function oldestBasisDateNotice(products: Product[]): string[] {
  if (products.length === 0) {
    return [];
  }
  const oldest = products.map((product) => product.basisDate).sort()[0];
  return [`기준일: ${oldest}`];
}

function findProducts(ids: string[], products: Product[]): Product[] {
  return [...new Set(ids)].flatMap((id) => {
    const product = products.find((item) => item.id === id);
    return product ? [product] : [];
  });
}

function verifyAnswer(reply: AiReply, products: Product[]): ChatResponse {
  const sources = findProducts(reply.sourceProductIds, products);
  const notices = oldestBasisDateNotice(sources);

  const isNameMissing =
    sources.length > 0 &&
    !sources.some((product) => reply.message.includes(product.name));
  if (isNameMissing) {
    notices.push(`근거 상품: ${sources.map(({ name }) => name).join(", ")}`);
  }

  // AI가 mentionsStock을 빠뜨려도 재고 확인 문구가 빠지지 않게 문장도 확인한다.
  if (reply.mentionsStock || reply.message.includes("재고")) {
    notices.push(FIXED_MESSAGES.stockCheck);
  }

  return respond("answer", reply.message, notices);
}

// Design Ref: §6 — AI 답변을 그대로 믿지 않고 규칙을 코드로 다시 확인한다.
export function verifyReply(
  reply: AiReply,
  products: Product[],
  _history: HistoryItem[],
): ChatResponse {
  switch (reply.kind) {
    case "answer":
      return verifyAnswer(reply, products);
    case "cannot_answer":
      return respond("cannot_answer", FIXED_MESSAGES.cannotAnswer);
    case "refusal":
      return respond("refusal", FIXED_MESSAGES.refusal);
    default:
      // 작업 13~14번에서 선물 추천을 처리한다.
      return respond("guide", FIXED_MESSAGES.guide);
  }
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNumberOrNull(value: unknown): boolean {
  return value === null || typeof value === "number";
}

// Design Ref: §6 — 양식에 맞지 않는 답변은 null을 돌려줘 AI_FAILED로 처리한다.
export function parseAiReply(content: string | null | undefined): AiReply | null {
  if (!content) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const reply = parsed as Record<string, unknown>;
  const isValid =
    typeof reply.kind === "string" &&
    ["answer", "question", "recommendation", "cannot_answer", "refusal"].includes(
      reply.kind,
    ) &&
    typeof reply.message === "string" &&
    isStringList(reply.sourceProductIds) &&
    typeof reply.mentionsStock === "boolean" &&
    isNumberOrNull(reply.budget) &&
    isNumberOrNull(reply.recipientCount) &&
    Array.isArray(reply.recommendations) &&
    reply.recommendations.every(
      (item) =>
        typeof item?.productId === "string" && typeof item?.reason === "string",
    );

  return isValid ? (parsed as AiReply) : null;
}
