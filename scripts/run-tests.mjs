// 개발 서버로 테스트 질문을 보내고 결과를 test-results.md에 기록한다.
// OpenAI를 실제로 호출하므로 소액의 비용이 든다.
// 실행: npm run dev를 켠 뒤 node scripts/run-tests.mjs accuracy gift rules flows
import { readFileSync, writeFileSync } from "node:fs";

const API_URL = "http://localhost:3000/api/chat";
const FAST_LIMIT_MS = 10000;

const read = (path) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const cases = read("./test-cases.json");
const products = read("../data/products.json");

async function ask(message, history = []) {
  const startedAt = Date.now();
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  const body = await response.json();
  return { status: response.status, body, ms: Date.now() - startedAt };
}

// 사람이 읽고 판정하기 쉽도록 답변 전체를 한 줄로 만든다.
function summarize({ body }) {
  const text = body.message ?? body.error?.code ?? "";
  const cards = (body.products ?? []).map(
    ({ name, price }) => `${name} ${price}원`,
  );
  return [text, ...cards, ...(body.notices ?? [])]
    .join(" / ")
    .replaceAll("|", "\\|");
}

function checkAnswer(testCase, result) {
  const { body } = result;
  const text = body.message ?? "";
  const problems = [];

  if (testCase.kind && body.kind !== testCase.kind) {
    problems.push(`종류 ${body.kind}`);
  }
  if (testCase.anyOf && !testCase.anyOf.some((word) => text.includes(word))) {
    problems.push("필요한 내용 없음");
  }
  for (const word of testCase.excludes ?? []) {
    if (text.includes(word)) {
      problems.push(`금지 문구 ${word}`);
    }
  }
  if (testCase.notInMessage && text.includes(testCase.notInMessage)) {
    problems.push("문장 안에서 추천함");
  }
  if (
    testCase.noticeIncludes &&
    !(body.notices ?? []).some((n) => n.includes(testCase.noticeIncludes))
  ) {
    problems.push("부가 안내 없음");
  }
  return problems;
}

function checkGift(testCase, result) {
  const problems = checkAnswer(testCase, result);
  const cards = result.body.products ?? [];

  if (testCase.kind === "recommendation" && cards.length === 0) {
    problems.push("추천 없음");
  }
  if (cards.length > 3) {
    problems.push("추천 3개 초과");
  }
  for (const card of cards) {
    const product = products.find(({ name }) => name === card.name);
    if (!product) {
      problems.push(`없는 상품 ${card.name}`);
    } else if (card.price > testCase.limit) {
      problems.push(`예산 초과 ${card.name}`);
    } else if (product.stock === 0) {
      problems.push(`품절 ${card.name}`);
    } else if (!product.recommendedFor.includes(testCase.recipient)) {
      problems.push(`대상 불일치 ${card.name}`);
    }
  }
  return problems;
}

async function runList(list, check) {
  const rows = [];
  for (const testCase of list) {
    const result = await ask(testCase.message);
    const problems = check(testCase, result);
    rows.push({ testCase, result, problems });
    console.log(problems.length === 0 ? "OK  " : "CHECK", result.ms, testCase.message, problems.join(", "));
  }
  return rows;
}

async function runFlow(flow) {
  const history = [];
  let result;
  const transcript = [];
  for (const turn of flow.turns) {
    result = await ask(turn, history.slice(-10));
    transcript.push(`${turn} → (${result.body.kind}) ${summarize(result)}`);
    history.push({ role: "user", content: turn });
    const names = (result.body.products ?? []).map(({ name }) => name);
    const suffix = names.length ? ` 추천 상품: ${names.join(", ")}` : "";
    history.push({
      role: "assistant",
      content: `${result.body.message ?? ""}${suffix}`.slice(0, 1000),
      kind: result.body.kind,
    });
  }
  const problems = result.body.kind === flow.lastKind ? [] : [`마지막 종류 ${result.body.kind}`];
  console.log(problems.length === 0 ? "OK  " : "CHECK", flow.name, problems.join(", "));
  return { flow, transcript, problems };
}

function table(rows) {
  const lines = ["| 결과 | 시간(ms) | 질문 | 답변 | 확인 필요 |", "|---|---|---|---|---|"];
  for (const { testCase, result, problems } of rows) {
    const mark = problems.length === 0 ? "통과" : "확인";
    lines.push(`| ${mark} | ${result.ms} | ${testCase.message} | ${summarize(result)} | ${problems.join(", ")} |`);
  }
  return lines.join("\n");
}

const groups = process.argv.slice(2);
const report = [
  "# 테스트 결과",
  "",
  `- 측정일: ${new Date().toISOString().slice(0, 10)}`,
  "- 자동 표시는 참고용이며, 답변 내용은 사람이 표를 보고 최종 판정한다.",
  "",
];
const allRows = [];

// Design Ref: §9 — 개발 서버의 준비 시간이 섞이지 않게 첫 호출은 결과에서 뺀다.
await ask("워밍업");

for (const group of groups) {
  if (group === "flows") {
    const flows = [];
    for (const flow of cases.flows) {
      flows.push(await runFlow(flow));
    }
    report.push("## 여러 번 주고받는 대화", "");
    for (const { flow, transcript, problems } of flows) {
      report.push(`### ${flow.name}: ${problems.length === 0 ? "통과" : "확인"}`, "");
      report.push(...transcript.map((line) => `- ${line}`), "");
    }
    continue;
  }

  const rows = await runList(cases[group], group === "gift" ? checkGift : checkAnswer);
  allRows.push(...rows);
  const passed = rows.filter(({ problems }) => problems.length === 0).length;
  report.push(`## ${group}: ${passed}/${rows.length} 자동 통과`, "", table(rows), "");
}

const timed = allRows.slice(0, 20);
if (timed.length > 0) {
  const fast = timed.filter(({ result }) => result.ms <= FAST_LIMIT_MS).length;
  const slowest = Math.max(...allRows.map(({ result }) => result.ms));
  report.push(`## 응답 시간`, "", `- 앞의 ${timed.length}회 중 ${fast}회가 10초 이내`, `- 전체 ${allRows.length}회 중 가장 느린 응답: ${slowest}ms`, "");
}

writeFileSync(new URL("../test-results.md", import.meta.url), report.join("\n"));
console.log("test-results.md에 기록했습니다.");
