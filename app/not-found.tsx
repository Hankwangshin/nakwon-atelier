import Link from "next/link";

// 없는 주소로 들어왔을 때 보여 준다. 기본 영어 안내 대신 한국어로 길을 알려 준다.
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-16 text-center">
      <p className="text-sm font-medium tracking-widest text-stone-500 dark:text-stone-400">404</p>
      <h1 className="mt-2 text-2xl font-semibold">페이지를 찾을 수 없어요</h1>
      <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-400">
        주소가 바뀌었거나 없는 페이지입니다. 아래에서 다시 찾아보세요.
      </p>
      <div className="mt-6 flex justify-center gap-2 text-sm">
        <Link href="/" className="rounded-full bg-stone-900 px-5 py-2 font-medium text-white dark:bg-orange-100 dark:text-stone-900">
          메인으로
        </Link>
        <Link href="/products" className="rounded-full border border-stone-900 px-5 py-2 font-medium dark:border-orange-100">
          전체 상품 보기
        </Link>
      </div>
    </main>
  );
}
