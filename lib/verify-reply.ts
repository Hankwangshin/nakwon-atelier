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

const MAX_RECOMMENDATIONS = 3; // PRD 5번 — 추천은 최대 3개
const MAX_CLARIFICATIONS = 2; // PRD 5번 — 추가 질문은 최대 2번

// Design Ref: §6 — 고정 문구
export const FIXED_MESSAGES = {
  recommendation: "조건에 맞는 상품을 골랐어요.",
  noMatch: "조건에 맞는 상품이 없습니다.",
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

// Design Ref: §6 — 마지막 추천이나 조건 입력 안내 뒤에 나온 되묻기만 센다.
function countClarifications(history: HistoryItem[]): number {
  let count = 0;
  for (const { kind } of [...history].reverse()) {
    if (kind === "recommendation" || kind === "no_match" || kind === "guide") {
      break;
    }
    if (kind === "question") {
      count += 1;
    }
  }
  return count;
}

function askOrGuide(message: string, history: HistoryItem[]): ChatResponse {
  return countClarifications(history) >= MAX_CLARIFICATIONS
    ? respond("guide", FIXED_MESSAGES.guide)
    : respond("question", message);
}

function findMissingConditions(reply: AiReply): string[] {
  const missing: string[] = [];
  if (reply.budget === null || reply.budget <= 0) {
    missing.push("예산이 얼마인지 알려 주세요.");
  }
  if (reply.recipient === null) {
    missing.push("선물 받으실 분이 누구인지 알려 주세요.");
  }
  if ((reply.recipientCount ?? 1) >= 2 && reply.budgetType === null) {
    missing.push("예산이 총액인가요, 1인당 금액인가요?");
  }
  return missing;
}

// Design Ref: §6 — 표의 순서대로 확인한다. 문장은 고정 문구를 써서
// 서버가 뺀 상품이 말풍선에 남지 않게 한다.
function verifyRecommendation(
  reply: AiReply,
  products: Product[],
  history: HistoryItem[],
): ChatResponse {
  if (reply.recipient === "기타") {
    return respond("no_match", FIXED_MESSAGES.noMatch);
  }

  const missing = findMissingConditions(reply);
  if (missing.length > 0) {
    return askOrGuide(missing.join(" "), history);
  }

  const budget = reply.budget as number;
  const recipient = reply.recipient as string;
  const recipientCount = reply.recipientCount ?? 1;
  const priceLimit =
    reply.budgetType === "total" && recipientCount >= 2
      ? Math.floor(budget / recipientCount)
      : budget;
  const isEligible = (product: Product) =>
    product.stock > 0 &&
    product.price <= priceLimit &&
    product.recommendedFor.includes(recipient);

  const chosen = new Map<string, { product: Product; reason: string }>();
  for (const { productId, reason } of reply.recommendations) {
    const product = products.find((item) => item.id === productId);
    if (product && isEligible(product) && !chosen.has(productId)) {
      chosen.set(productId, { product, reason });
    }
  }

  // AI가 추천을 비우거나 조건에 맞지 않는 상품만 골라도, 문서에 맞는 상품이 있으면
  // 서버가 채운다. 추천 이유는 문서의 특징 문장을 그대로 쓴다.
  if (chosen.size === 0) {
    for (const product of products.filter(isEligible)) {
      chosen.set(product.id, { product, reason: product.features });
    }
  }

  const final = [...chosen.values()].slice(0, MAX_RECOMMENDATIONS);
  if (final.length === 0) {
    return respond("no_match", FIXED_MESSAGES.noMatch);
  }

  // 상품명, 가격, 배송은 AI 답변이 아닌 문서의 값을 쓴다.
  const cards = final.map(({ product, reason }) => ({
    name: product.name,
    price: product.price,
    shipping: product.shipping,
    reason,
  }));
  return respond(
    "recommendation",
    FIXED_MESSAGES.recommendation,
    oldestBasisDateNotice(final.map(({ product }) => product)),
    cards,
  );
}

// Design Ref: §6 — AI 답변을 그대로 믿지 않고 규칙을 코드로 다시 확인한다.
export function verifyReply(
  reply: AiReply,
  products: Product[],
  history: HistoryItem[],
): ChatResponse {
  switch (reply.kind) {
    case "answer":
      return verifyAnswer(reply, products);
    case "question":
      // 조건을 모두 받고도 더 물으면 고객이 같은 말을 반복하게 되므로 바로 추천한다.
      return reply.recipient !== null && findMissingConditions(reply).length === 0
        ? verifyRecommendation(reply, products, history)
        : askOrGuide(reply.message, history);
    case "recommendation":
      return verifyRecommendation(reply, products, history);
    case "cannot_answer":
      return respond("cannot_answer", FIXED_MESSAGES.cannotAnswer);
    case "refusal":
      return respond("refusal", FIXED_MESSAGES.refusal);
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
