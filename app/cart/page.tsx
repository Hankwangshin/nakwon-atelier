"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { callApi, formatPrice } from "@/lib/client-api";
import type { CartSummary } from "@/lib/cart";
import { MAX_CART_QUANTITY, isOrderable } from "@/lib/cart";

export default function CartPage() {
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    callApi<CartSummary>("/api/cart").then((result) => {
      setNeedsLogin(result.status === 401);
      setCart(result.data);
    });
  }, []);

  async function change(method: string, body: unknown) {
    setError("");
    const result = await callApi<CartSummary>("/api/cart", method, body);
    if (result.ok) {
      setCart(result.data);
    } else {
      setError(result.errorMessage);
    }
  }

  if (needsLogin) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6 text-sm">
        <h1 className="text-xl font-semibold">장바구니</h1>
        <p className="mt-4">
          장바구니는 <Link href="/login" className="underline">로그인</Link> 후 사용할 수 있습니다.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 text-sm">
      <h1 className="text-xl font-semibold">장바구니</h1>
      {!cart && <p className="mt-4">불러오는 중</p>}
      {cart?.lines.length === 0 && (
        <p className="mt-4">
          장바구니가 비어 있습니다. <Link href="/products" className="underline">상품 보러 가기</Link>
        </p>
      )}
      {cart && cart.lines.length > 0 && (
        <>
          <ul className="mt-4 flex flex-col gap-3">
            {cart.lines.map((line) => (
              <li
                key={line.productId}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"
              >
                <Image
                  src={line.image}
                  alt={`${line.name} 그림`}
                  width={56}
                  height={56}
                  unoptimized
                  className="h-14 w-14 rounded-lg object-cover"
                />
                <div className="min-w-40 flex-1">
                  <p className="font-semibold">{line.name}</p>
                  <p>{formatPrice(line.price)}</p>
                  {line.stock === 0 && (
                    <p className="text-xs text-red-600 dark:text-red-400">품절</p>
                  )}
                </div>
                <label className="flex items-center gap-2">
                  수량
                  <input
                    type="number"
                    min={1}
                    max={Math.min(line.stock, MAX_CART_QUANTITY)}
                    value={line.quantity}
                    onChange={(event) =>
                      change("PATCH", {
                        productId: line.productId,
                        quantity: Number(event.target.value),
                      })
                    }
                    className="w-16 rounded-lg border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => change("DELETE", { productId: line.productId })}
                  className="text-xs text-zinc-600 underline dark:text-zinc-400"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>

          {error && (
            <p role="alert" className="mt-3 text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900">
            <dt>상품 금액</dt>
            <dd className="text-right">{formatPrice(cart.itemsAmount)}</dd>
            <dt>배송비 (묶음 배송)</dt>
            <dd className="text-right">{formatPrice(cart.shippingFee)}</dd>
            <dt className="font-semibold">결제 금액</dt>
            <dd className="text-right font-semibold">{formatPrice(cart.amount)}</dd>
          </dl>

          {isOrderable(cart.lines) ? (
            <Link
              href="/checkout"
              className="mt-4 block rounded-lg bg-blue-600 px-4 py-2 text-center font-medium text-white"
            >
              주문하기
            </Link>
          ) : (
            <p className="mt-4 text-red-600 dark:text-red-400">
              품절 상품을 삭제하거나 수량을 줄여야 주문할 수 있습니다.
            </p>
          )}
        </>
      )}
    </main>
  );
}
