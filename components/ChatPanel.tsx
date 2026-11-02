"use client";

import { useEffect, useRef, useState } from "react";
import MessageBubble from "@/components/MessageBubble";

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

  // 새 말풍선이 생기면 대화 영역의 맨 아래를 보여 준다.
  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [messages]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const question = input.trim();
    if (question === "") {
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
        className="flex gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800"
      >
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="질문을 입력해 주세요"
          aria-label="질문 입력"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={input.trim() === ""}
          className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          보내기
        </button>
      </form>
    </>
  );
}
