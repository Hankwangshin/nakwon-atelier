import OpenAI, { APIConnectionTimeoutError } from "openai";

// 작업 5번에서 모델을 정한다. 모델을 바꿀 때는 이 값만 고치면 된다.
const MODEL = "gpt-4o-mini";

// Design Ref: §7 — OpenAI가 20초 안에 답하지 않으면 오류로 처리한다.
const AI_TIMEOUT_MS = 20000;

// 작업 9번에서 상품 문서와 AI 규칙(lib/chat-prompt.ts)으로 바꾼다.
const SYSTEM_PROMPT = "당신은 문구 쇼핑몰의 챗봇입니다. 한국어로 3문장 이내로 답하세요.";

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

// Design Ref: §6 — 작업 5번은 질문 1개만 받는다. 작업 6번에서 입력 검사를 완성한다.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const message: unknown = body?.message;

  if (typeof message !== "string" || message.trim() === "") {
    return errorResponse("INVALID_INPUT", "질문을 입력해 주세요.", 400);
  }

  try {
    // 키가 없을 때도 AI_FAILED로 답할 수 있도록 요청 안에서 만든다.
    const openai = new OpenAI({ timeout: AI_TIMEOUT_MS, maxRetries: 0 });
    const completion = await openai.chat.completions.create({
      model: MODEL,
      store: false,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
    });

    return Response.json({
      kind: "answer",
      message: completion.choices[0]?.message.content ?? "",
      notices: [],
      products: [],
    });
  } catch (error) {
    // Design Ref: §8 — 오류 기록에는 상태 코드만 남기고 질문 내용은 남기지 않는다.
    console.error("chat failed:", (error as { status?: number }).status);

    if (error instanceof APIConnectionTimeoutError) {
      return errorResponse(
        "AI_TIMEOUT",
        "응답이 늦어지고 있습니다. 다시 시도해 주세요.",
        504,
      );
    }
    return errorResponse(
      "AI_FAILED",
      "답변을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.",
      502,
    );
  }
}
