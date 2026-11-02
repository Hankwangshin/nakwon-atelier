import ChatPanel from "@/components/ChatPanel";

export default function Home() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col bg-white dark:bg-zinc-950">
        <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h1 className="text-lg font-semibold">문구 만물</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            상품 문의와 문구 선물 추천 챗봇
          </p>
        </header>
        <ChatPanel />
      </main>
    </div>
  );
}
