interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
}

// Design Ref: §1 — 고객 말풍선은 오른쪽, 챗봇 말풍선은 왼쪽에 표시한다.
// Design Ref: §8 — 답변은 글자로만 표시해 답변 안의 코드가 실행되지 않게 한다.
export default function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm leading-6 ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
        }`}
      >
        {content}
      </p>
    </div>
  );
}
