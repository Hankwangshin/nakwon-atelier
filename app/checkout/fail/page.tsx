import Link from "next/link";

export default function CheckoutFailPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6 text-sm">
      <h1 className="text-xl font-semibold">결제 실패</h1>
      <p className="mt-4">
        결제가 완료되지 않았습니다. 금액은 빠져나가지 않았습니다.{" "}
        <Link href="/cart" className="underline">
          장바구니로 돌아가기
        </Link>
      </p>
    </main>
  );
}
