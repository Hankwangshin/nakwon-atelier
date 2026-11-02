"use client";

import { useEffect, useRef, useState } from "react";
import MessageBubble from "@/components/MessageBubble";
import { MAX_QUESTION_LENGTH } from "@/lib/limits";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
}

const WELCOME_MESSAGE =
  "상품을 묻거나, 예산과 받는 사람을 알려 주시면 선물을 추천해요.";

// 작업 7번에서 서버 쪽 API를 연결하면 실제 답변으로 바뀐다.
const PLACEHOLDER_REPLY = "아직 연습용 화면이에요. 곧 실제 답변을 드릴게요.";

// Design Ref: §2 — 대화는 브라우저 메모리에만 두므로 새로고침하면 사라진다.
export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, role: "assistant", content: WELCOME_MESSAGE },
  ]);
  const [input, setInput] = useState("");
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  // 초과해도 입력한 내용은 자르지 않고, 보내기만 막는다.
  const question = input.trim();
  const isTooLong = question.length > MAX_QUESTION_LENGTH;
  const canSend = question !== "" && !isTooLong;

  // 새 말풍선이 생기면 대화 영역의 맨 아래를 보여 준다.
  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [messages]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSend) {
      return;
    }

    const userId = nextId.current++;
    const replyId = nextId.current++;
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", content: question },
      { id: replyId, role: "assistant", content: PLACEHOLDER_REPLY },
    ]);
    setInput("");
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            role={message.role}
            content={message.content}
          />
        ))}
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
