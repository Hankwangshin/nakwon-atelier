"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { callApi, formatPrice } from "@/lib/client-api";

interface Order {
  order_number: string;
  order_name: string;
  amount: number;
  paid_at: string;
  order_items: { name: string; price: number; quantity: number }[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    callApi<{ orders: Order[] }>("/api/orders").then((result) => {
      setNeedsLogin(result.status === 401);
      setOrders(result.data?.orders ?? null);
      setError(result.ok || result.status === 401 ? "" : result.errorMessage);
    });
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 text-sm">
      <h1 className="text-xl font-semibold">주문 내역</h1>
      {needsLogin && (
        <p className="mt-4">
          주문 내역은 <Link href="/login" className="underline">로그인</Link> 후 볼 수 있습니다.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {orders?.length === 0 && <p className="mt-4">결제한 주문이 없습니다.</p>}
      <ul className="mt-4 flex flex-col gap-3">
        {orders?.map((order) => (
          <li
            key={order.order_number}
            className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"
          >
            <p className="font-semibold">{order.order_name}</p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {new Date(order.paid_at).toLocaleString("ko-KR")} 결제
            </p>
            <ul className="mt-2">
              {order.order_items.map((item) => (
                <li key={item.name}>
                  {item.name} {item.quantity}개 · {formatPrice(item.price * item.quantity)}
                </li>
              ))}
            </ul>
            <p className="mt-2 font-semibold">결제 금액 {formatPrice(order.amount)}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
