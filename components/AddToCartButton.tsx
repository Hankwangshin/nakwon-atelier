"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { callApi } from "@/lib/client-api";

interface AddToCartButtonProps {
  productId: string;
  isSoldOut: boolean;
}

export default function AddToCartButton({
  productId,
  isSoldOut,
}: AddToCartButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function handleClick() {
    setIsSending(true);
    const result = await callApi("/api/cart", "POST", { productId, quantity: 1 });
    setIsSending(false);

    if (result.status === 401) {
      router.push("/login");
      return;
    }
    setStatus(result.ok ? "담았습니다" : result.errorMessage);
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isSoldOut || isSending}
        className="rounded-lg border border-blue-600 px-3 py-1 text-xs font-medium text-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-400 dark:text-blue-400"
      >
        {isSoldOut ? "품절" : "장바구니 담기"}
      </button>
      {status && (
        <p role="status" className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          {status}
        </p>
      )}
    </div>
  );
}
