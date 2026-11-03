"use client"; // 오류 화면은 브라우저에서 동작해야 한다.

import Link from "next/link";

// 화면을 그리다 예상하지 못한 오류가 나면 머리글은 그대로 두고 이 안내를 보여 준다.
// 오류 내용에는 개인정보가 섞일 수 있으므로 화면에 그대로 보여 주지 않는다.
export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">잠시 문제가 생겼어요</h1>
      <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-400">
        화면을 불러오지 못했습니다. 다시 시도해도 계속되면 help@example.com으로 알려 주세요.
      </p>
      <div className="mt-6 flex justify-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-full bg-stone-900 px-5 py-2 font-medium text-white dark:bg-orange-100 dark:text-stone-900"
        >
          다시 시도
        </button>
        <Link href="/" className="rounded-full border border-stone-900 px-5 py-2 font-medium dark:border-orange-100">
          메인으로
        </Link>
      </div>
    </main>
  );
}
