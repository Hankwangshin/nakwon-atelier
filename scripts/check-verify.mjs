// lib/verify-reply.ts에 일부러 틀린 가짜 AI 답변을 넣어 재확인 코드를 점검한다.
// OpenAI를 호출하지 않으므로 비용이 들지 않는다.
// 실행: node scripts/check-verify.mjs
import { readFileSync } from "node:fs";
import { FIXED_MESSAGES, parseAiReply, verifyReply } from "../lib/verify-reply.ts";

const products = JSON.parse(
  readFileSync(new URL("../data/products.json", import.meta.url), "utf8"),
);

const reply = (overrides) => ({
  kind: "answer",
  message: "답변입니다.",
  sourceProductIds: [],
  mentionsStock: false,
  budget: null,
  budgetType: null,
  recipientCount: null,
  recipient: null,
  recommendations: [],
  ...overrides,
});

let failures = 0;
function check(name, condition) {
  if (!condition) {
    failures += 1;
  }
  console.log(condition ? "OK  " : "FAIL", name);
}

// 상품 문의
const stock = verifyReply(reply({ message: "재고는 120개입니다." }), products, []);
check("재고를 말했지만 mentionsStock이 거짓이면 재고 확인 문구", stock.notices.includes(FIXED_MESSAGES.stockCheck));

const dates = [
  { ...products[0], basisDate: "2026-11-01" },
  { ...products[1], basisDate: "2026-10-01" },
];
const twoDates = verifyReply(
  reply({ sourceProductIds: ["p01", "p02"] }),
  dates,
  [],
);
check("기준일이 다른 상품 2개면 가장 오래된 날짜 1개", twoDates.notices[0] === "기준일: 2026-10-01");

const unknownId = verifyReply(reply({ sourceProductIds: ["p99"] }), products, []);
check("없는 근거 id는 버리고 기준일 생략", unknownId.notices.length === 0);

const noName = verifyReply(reply({ sourceProductIds: ["p01"] }), products, []);
check("문장에 상품명이 없으면 근거 상품 안내", noName.notices.some((n) => n.startsWith("근거 상품: ")));

const withName = verifyReply(
  reply({ message: `${products[0].name}입니다.`, sourceProductIds: ["p01"] }),
  products,
  [],
);
check("문장에 상품명이 있으면 근거 상품 안내 없음", !withName.notices.some((n) => n.startsWith("근거 상품: ")));

const cannot = verifyReply(reply({ kind: "cannot_answer", message: "지어낸 말" }), products, []);
check("cannot_answer는 고정 문구", cannot.message === FIXED_MESSAGES.cannotAnswer);

const refusal = verifyReply(reply({ kind: "refusal", message: "지어낸 말" }), products, []);
check("refusal은 고정 문구", refusal.message === FIXED_MESSAGES.refusal);

// 선물 추천 (친구에게 3만 원 조건을 기본으로 틀린 답변을 넣는다)
const gift = (recommendations, overrides = {}) =>
  reply({
    kind: "recommendation",
    message: "AI가 쓴 문장 p02 p18",
    budget: 30000,
    budgetType: "perPerson",
    recipientCount: 1,
    recipient: "친구",
    recommendations: recommendations.map((productId) => ({ productId, reason: "이유" })),
    ...overrides,
  });
const asked = { role: "assistant", content: "예산은요?", kind: "question" };
const names = (result) => result.products.map(({ name }) => name);
const nameOf = (id) => products.find((item) => item.id === id).name;

const missingProduct = verifyReply(gift(["p03", "p99"]), products, []);
check("1. 없는 상품은 제외", names(missingProduct).join() === nameOf("p03"));

const soldOut = verifyReply(gift(["p04", "p16", "p03"], { recipient: "학생" }), products, []);
check("2. 재고 0인 p04, p16 제외", names(soldOut).join() === nameOf("p03"));

const overBudget = verifyReply(gift(["p18", "p03"]), products, []);
check("3. 예산 초과 제외, 문장은 고정 문구", names(overBudget).join() === nameOf("p03") && overBudget.message === FIXED_MESSAGES.recommendation);

const perPersonLimit = verifyReply(
  gift(["p02", "p03"], { recipient: "친구", budgetType: "total", recipientCount: 3 }),
  products,
  [],
);
check("4. 총액 3만 원, 3명이면 1만 원 상한", names(perPersonLimit).join() === nameOf("p03"));

const four = verifyReply(gift(["p03", "p07", "p08", "p09"]), products, []);
check("5. 추천 4개면 3개만", four.products.length === 3);

const duplicate = verifyReply(gift(["p03", "p03"]), products, []);
check("6. 같은 상품은 1개만", duplicate.products.length === 1);

const wrongTarget = verifyReply(gift(["p13", "p03"]), products, []);
check("7. 추천 대상이 다른 상품 제외", names(wrongTarget).join() === nameOf("p03"));

const emptied = verifyReply(gift(["p18"]), products, []);
check("8. 모든 상품이 빠지면 no_match", emptied.kind === "no_match" && emptied.products.length === 0);

const noBudget = verifyReply(gift(["p03"], { budget: null }), products, []);
check("9-1. 예산이 없으면 question", noBudget.kind === "question" && noBudget.products.length === 0);

const noBudgetLate = verifyReply(gift(["p03"], { budget: null }), products, [asked, asked]);
check("9-2. 되묻기 2번 뒤에는 guide", noBudgetLate.kind === "guide");

const noRecipient = verifyReply(gift(["p03"], { recipient: null }), products, []);
check("9-3. 받는 사람이 없으면 question", noRecipient.kind === "question");

const noBudgetType = verifyReply(gift(["p03"], { recipientCount: 3, budgetType: null }), products, []);
check("9-4. 여러 명인데 총액·1인당 구분이 없으면 question", noBudgetType.kind === "question");

const third = verifyReply(reply({ kind: "question", message: "또 물어요" }), products, [asked, asked]);
check("10. 3번째 되묻기는 guide", third.kind === "guide" && third.message === FIXED_MESSAGES.guide);

const second = verifyReply(reply({ kind: "question", message: "또 물어요" }), products, [asked]);
check("10-1. 2번째 되묻기는 그대로 question", second.kind === "question");

const restarted = verifyReply(reply({ kind: "question", message: "새로 물어요" }), products, [
  asked,
  asked,
  { role: "assistant", content: "추천", kind: "recommendation" },
]);
check("11. 추천 뒤에는 횟수가 0부터 다시 시작", restarted.kind === "question");

const other = verifyReply(gift(["p03"], { recipient: "기타" }), products, []);
check("받는 사람이 기타면 no_match", other.kind === "no_match");

const realPrice = verifyReply(gift(["p03"]), products, []);
check("카드 가격은 문서 값", realPrice.products[0].price === products.find((p) => p.id === "p03").price);
check("추천에 기준일 표시", realPrice.notices.includes("기준일: 2026-11-01"));

// 양식 검사
check("JSON이 아니면 null", parseAiReply("not json") === null);
check("빈 답변이면 null", parseAiReply(null) === null);
check("없는 종류면 null", parseAiReply(JSON.stringify(reply({ kind: "fake" }))) === null);
check("정상 양식은 통과", parseAiReply(JSON.stringify(reply({}))) !== null);

console.log(failures === 0 ? "모두 통과" : `실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
