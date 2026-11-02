"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { callApi, formatPrice } from "@/lib/client-api";
import type { ApiResult } from "@/lib/client-api";
import { REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS } from "@/lib/order-requests";
import type { RequestType } from "@/lib/order-requests";

interface OrderRequest {
  type: RequestType;
  reason: string;
  status: string;
  created_at: string;
}

interface Order {
  order_number: string;
  order_name: string;
  amount: number;
  status: string;
  paid_at: string;
  order_items: { name: string; price: number; quantity: number }[];
  order_requests: OrderRequest[];
}

interface OpenForm {
  orderNumber: string;
  type: RequestType;
}

function hasOpenRequest(order: Order) {
  return order.order_requests.some(
    ({ status }) => status === "pending" || status === "processing",
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState("");
  const [openForm, setOpenForm] = useState<OpenForm | null>(null);
  const [reason, setReason] = useState("");

  const showOrders = useCallback((result: ApiResult<{ orders: Order[] }>) => {
    setNeedsLogin(result.status === 401);
    setOrders(result.data?.orders ?? null);
    setError(result.ok || result.status === 401 ? "" : result.errorMessage);
  }, []);

  useEffect(() => {
    callApi<{ orders: Order[] }>("/api/orders").then(showOrders);
  }, [showOrders]);

  function startRequest(orderNumber: string, type: RequestType) {
    setOpenForm({ orderNumber, type });
    setReason("");
    setError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!openForm) {
      return;
    }

    const result = await callApi(
      `/api/orders/${openForm.orderNumber}/requests`,
      "POST",
      { type: openForm.type, reason },
    );
    if (!result.ok) {
      setError(result.errorMessage);
      return;
    }
    setOpenForm(null);
    showOrders(await callApi<{ orders: Order[] }>("/api/orders"));
  }

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
            <p className="font-semibold">
              {order.order_name}
              {order.status === "cancelled" && (
                <span className="ml-2 text-xs text-red-600 dark:text-red-400">결제 취소됨</span>
              )}
            </p>
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

            {order.order_requests.length > 0 && (
              <ul className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                {order.order_requests.map((request) => (
                  <li key={request.created_at}>
                    {REQUEST_TYPE_LABELS[request.type]} 요청:{" "}
                    {REQUEST_STATUS_LABELS[request.status]}
                  </li>
                ))}
              </ul>
            )}

            {order.status === "paid" && !hasOpenRequest(order) && (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => startRequest(order.order_number, "exchange")}
                  className="rounded-lg border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
                >
                  상품 교환 신청
                </button>
                <button
                  type="button"
                  onClick={() => startRequest(order.order_number, "cancel")}
                  className="rounded-lg border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
                >
                  결제 취소 요청
                </button>
              </div>
            )}

            {openForm?.orderNumber === order.order_number && (
              <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-2">
                <label className="flex flex-col gap-1">
                  {REQUEST_TYPE_LABELS[openForm.type]} 사유
                  <textarea
                    required
                    maxLength={500}
                    rows={2}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
                  />
                </label>
                <div className="flex gap-2">
                  <button type="submit" className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white">
                    요청하기
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenForm(null)}
                    className="rounded-lg border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
                  >
                    닫기
                  </button>
                </div>
              </form>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
