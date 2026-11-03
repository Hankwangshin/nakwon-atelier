"use client";

import Link from "next/link";
import { useState } from "react";
import { callApi } from "@/lib/client-api";
import { describeReorder } from "@/lib/reorder";
import type { ReorderResult } from "@/lib/reorder";

interface ReorderButtonProps {
  orderNumber: string;
}

// 지난 주문의 상품을 장바구니에 다시 담는다. 결제는 장바구니에서 평소처럼 한다.
export default function ReorderButton({ orderNumber }: ReorderButtonProps) {
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ text: string; hasAdded: boolean } | null>(null);
  const [error, setError] = useState("");

  async function handleClick() {
    setIsSending(true);
    setError("");
    setResult(null);
    const response = await callApi<ReorderResult>(
      `/api/orders/${encodeURIComponent(orderNumber)}/reorder`,
      "POST",
    );
    setIsSending(false);

    if (response.ok && response.data) {
      setResult({ text: describeReorder(response.data), hasAdded: response.data.added.length > 0 });
    } else {
      setError(response.errorMessage);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isSending}
        className="self-start rounded-lg border border-blue-600 px-3 py-1 text-xs font-medium text-blue-600 disabled:opacity-50 dark:border-blue-400 dark:text-blue-400"
      >
        {isSending ? "담는 중" : "재구매"}
      </button>
      {result && (
        <p role="status" className="text-xs">
          {result.text}{" "}
          {result.hasAdded && (
            <Link href="/cart" className="font-medium text-blue-600 underline dark:text-blue-400">
              장바구니로 가기
            </Link>
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
