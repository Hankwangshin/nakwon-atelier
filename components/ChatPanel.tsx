"use client";

import { useEffect, useRef, useState } from "react";
import MessageBubble from "@/components/MessageBubble";
import {
  MAX_ASSISTANT_LENGTH,
  MAX_HISTORY_ITEMS,
  MAX_QUESTION_LENGTH,
} from "@/lib/limits";
import type { ChatKind, HistoryItem } from "@/lib/types";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  kind?: ChatKind;
  notices?: string[]; // 기준일, 재고 확인 문구 같은 부가 안내
  isLocal?: boolean; // 첫 안내처럼 서버로 보내지 않는 말풍선
}

// 실패한 질문을 그대로 다시 보낼 수 있도록 함께 기억한다.
interface FailedRequest {
  question: string;
  history: HistoryItem[];
  message: string;
  canRetry: boolean;
}

const WELCOME_MESSAGE =
  "상품을 묻거나, 예산과 받는 사람을 알려 주시면 선물을 추천해요.";

const DEFAULT_FAILURE_MESSAGE =
  "답변을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.";
const NETWORK_FAILURE_MESSAGE =
  "서버에 연결하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.";

// Design Ref: §6 — 서버 제한을 넘지 않도록 최근 말풍선만 골라 보낸다.
function toHistory(messages: ChatMessage[]): HistoryItem[] {
  return messages
    .filter((message) => !message.isLocal)
    .slice(-MAX_HISTORY_ITEMS)
    .map(({ role, content, kind }) => ({
      role,
      content: content.slice(0, MAX_ASSISTANT_LENGTH),
      kind,
    }));
}

// Design Ref: §2 — 대화는 브라우저 메모리에만 두므로 새로고침하면 사라진다.
export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, role: "assistant", content: WELCOME_MESSAGE, isLocal: true },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [failedRequest, setFailedRequest] = useState<FailedRequest | null>(null);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 초과해도 입력한 내용은 자르지 않고, 보내기만 막는다.
  const question = input.trim();
  const isTooLong = question.length > MAX_QUESTION_LENGTH;
  const canSend = question !== "" && !isTooLong && !isLoading;

  // 새 말풍선이 생기면 대화 영역의 맨 아래를 보여 준다.
  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [messages, isLoading, failedRequest]);

  function addMessage(message: Omit<ChatMessage, "id">) {
    const id = nextId.current++;
    setMessages((current) => [...current, { ...message, id }]);
  }

  // Design Ref: §7 — 입력 오류를 뺀 나머지는 "다시 시도"로 같은 질문을 보낼 수 있다.
  async function sendQuestion(text: string, history: HistoryItem[]) {
    setFailedRequest(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const reply = await response.json().catch(() => null);

      if (!response.ok || !reply) {
        setFailedRequest({
          question: text,
          history,
          message: reply?.error?.message ?? DEFAULT_FAILURE_MESSAGE,
          canRetry: reply?.error?.code !== "INVALID_INPUT",
        });
        return;
      }

      addMessage({
        role: "assistant",
        content: reply.message,
        kind: reply.kind,
        notices: reply.notices,
      });
    } catch {
      setFailedRequest({
        question: text,
        history,
        message: NETWORK_FAILURE_MESSAGE,
        canRetry: true,
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSend) {
      return;
    }

    const history = toHistory(messages);
    addMessage({ role: "user", content: question });
    setInput("");
    sendQuestion(question, history);
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.map((message) => (
          <div key={message.id} className="flex flex-col gap-1">
            <MessageBubble role={message.role} content={message.content} />
            {message.notices?.map((notice) => (
              <p
                key={notice}
                className="px-1 text-xs text-zinc-600 dark:text-zinc-400"
              >
                {notice}
              </p>
            ))}
          </div>
        ))}
        {isLoading && (
          <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
            답변을 만드는 중
          </p>
        )}
        {failedRequest && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 text-sm text-red-600 dark:text-red-400"
          >
            <p>{failedRequest.message}</p>
            {failedRequest.canRetry && (
              <button
                type="button"
                onClick={() =>
                  sendQuestion(failedRequest.question, failedRequest.history)
                }
                className="rounded-lg border border-red-600 px-3 py-1 font-medium dark:border-red-400"
              >
                다시 시도
              </button>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800"
      >
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          개인정보를 입력하지 마세요
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="질문을 입력해 주세요"
            aria-label="질문 입력"
            aria-invalid={isTooLong}
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            보내기
          </button>
        </div>
        <div className="flex justify-between gap-2 text-xs" aria-live="polite">
          <span className="text-red-600 dark:text-red-400">
            {isTooLong && `${MAX_QUESTION_LENGTH}자 이내로 줄여 주세요`}
          </span>
          <span
            className={
              isTooLong
                ? "text-red-600 dark:text-red-400"
                : "text-zinc-600 dark:text-zinc-400"
            }
          >
            {question.length}/{MAX_QUESTION_LENGTH}
          </span>
        </div>
      </form>
    </>
  );
}
