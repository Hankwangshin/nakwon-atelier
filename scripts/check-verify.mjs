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

// 양식 검사
check("JSON이 아니면 null", parseAiReply("not json") === null);
check("빈 답변이면 null", parseAiReply(null) === null);
check("없는 종류면 null", parseAiReply(JSON.stringify(reply({ kind: "fake" }))) === null);
check("정상 양식은 통과", parseAiReply(JSON.stringify(reply({}))) !== null);

console.log(failures === 0 ? "모두 통과" : `실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
