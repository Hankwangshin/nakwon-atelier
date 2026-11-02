"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { callApi } from "@/lib/client-api";

function PaymentResult() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<"confirming" | "done" | "failed">("confirming");
  const [error, setError] = useState("");
  const hasConfirmed = useRef(false);

  // 결제대행사가 돌려보낸 뒤 서버에서 결제를 최종 승인한다.
  useEffect(() => {
    if (hasConfirmed.current) {
      return;
    }
    hasConfirmed.current = true;

    callApi("/api/payments/confirm", "POST", {
      paymentKey: searchParams.get("paymentKey"),
      orderId: searchParams.get("orderId"),
      amount: Number(searchParams.get("amount")),
    }).then((result) => {
      setState(result.ok ? "done" : "failed");
      setError(result.errorMessage);
    });
  }, [searchParams]);

  if (state === "confirming") {
    return <p className="mt-4">결제를 확인하고 있습니다.</p>;
  }
  if (state === "failed") {
    return (
      <p role="alert" className="mt-4 text-red-600 dark:text-red-400">
        {error}
      </p>
    );
  }
  return (
    <p className="mt-4">
      결제가 완료되었습니다. <Link href="/orders" className="underline">주문 내역 보기</Link>
    </p>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6 text-sm">
      <h1 className="text-xl font-semibold">결제 결과</h1>
      <Suspense fallback={<p className="mt-4">결제를 확인하고 있습니다.</p>}>
        <PaymentResult />
      </Suspense>
    </main>
  );
}
