import OpenAI, { APIConnectionTimeoutError } from "openai";
import {
  MAX_ASSISTANT_LENGTH,
  MAX_HISTORY_ITEMS,
  MAX_QUESTION_LENGTH,
} from "@/lib/limits";
import { CHAT_KINDS } from "@/lib/types";
import type { ChatKind } from "@/lib/types";

// 모델을 바꿀 때는 이 값만 고치면 된다.
const MODEL = "gpt-6-luna";

// Design Ref: §7 — OpenAI가 20초 안에 답하지 않으면 오류로 처리한다.
const AI_TIMEOUT_MS = 20000;

// 작업 9번에서 상품 문서와 AI 규칙(lib/chat-prompt.ts)으로 바꾼다.
const SYSTEM_PROMPT = "당신은 문구 쇼핑몰의 챗봇입니다. 한국어로 3문장 이내로 답하세요.";

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

function isValidHistoryItem(item: unknown): boolean {
  if (typeof item !== "object" || item === null) {
    return false;
  }

  const { role, content, kind } = item as Record<string, unknown>;
  if (typeof content !== "string") {
    return false;
  }
  if (role === "user") {
    return content.length <= MAX_QUESTION_LENGTH && kind === undefined;
  }
  if (role === "assistant") {
    return (
      content.length <= MAX_ASSISTANT_LENGTH &&
      (kind === undefined || CHAT_KINDS.includes(kind as ChatKind))
    );
  }
  // Design Ref: §6 — system 등 다른 역할로 AI 규칙을 바꾸지 못하게 막는다.
  return false;
}

function isValidHistory(history: unknown): boolean {
  return (
    Array.isArray(history) &&
    history.length <= MAX_HISTORY_ITEMS &&
    history.every(isValidHistoryItem)
  );
}

// Design Ref: §6 — OpenAI를 호출하기 전에 거절해 비용이 들지 않게 한다.
// 대화 기록은 작업 7번에서 AI에게 함께 보낸다.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const message: unknown = body?.message;

  if (typeof message !== "string" || message.trim() === "") {
    return errorResponse("INVALID_INPUT", "질문을 입력해 주세요.", 400);
  }
  if (message.trim().length > MAX_QUESTION_LENGTH) {
    return errorResponse(
      "INVALID_INPUT",
      `질문은 ${MAX_QUESTION_LENGTH}자 이내로 입력해 주세요.`,
      400,
    );
  }
  if (!isValidHistory(body?.history ?? [])) {
    return errorResponse(
      "INVALID_INPUT",
      "대화 기록 형식이 올바르지 않습니다.",
      400,
    );
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
