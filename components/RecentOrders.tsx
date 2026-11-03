"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ReorderButton from "@/components/ReorderButton";
import { callApi, formatPrice } from "@/lib/client-api";

const RECENT_COUNT = 5;

interface RecentOrder {
  order_number: string;
  order_name: string;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  order_items: { name: string; quantity: number }[];
}

// 내 정보 화면의 최근 주문 목록. 전체는 주문 내역 메뉴에서 본다.
export default function RecentOrders() {
  const [orders, setOrders] = useState<RecentOrder[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    callApi<{ orders: RecentOrder[] }>("/api/orders").then((result) => {
      setOrders(result.data?.orders ?? []);
      setError(result.ok ? "" : result.errorMessage);
    });
  }, []);

  return (
    <section aria-labelledby="recent-orders" className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 id="recent-orders" className="text-base font-semibold">
          지난 주문
        </h2>
        <Link href="/orders" className="text-zinc-600 underline dark:text-zinc-400">
          주문 내역 전체 보기
        </Link>
      </div>
      {!orders && <p className="mt-3">주문을 불러오는 중</p>}
      {error && (
        <p role="alert" className="mt-3 text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {orders?.length === 0 && !error && <p className="mt-3">아직 결제한 주문이 없습니다.</p>}
      <ul className="mt-3 flex flex-col gap-3">
        {orders?.slice(0, RECENT_COUNT).map((order) => (
          <li
            key={order.order_number}
            className="flex flex-col gap-1 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"
          >
            <p className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="font-medium">{order.order_name}</span>
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                {new Date(order.paid_at ?? order.created_at).toLocaleDateString("ko-KR")}
              </span>
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {order.order_items.map(({ name, quantity }) => `${name} ${quantity}개`).join(", ")}
            </p>
            <p>
              결제 금액 {formatPrice(order.amount)}
              {order.status === "cancelled" && (
                <span className="ml-2 text-xs text-red-600 dark:text-red-400">결제 취소됨</span>
              )}
            </p>
            <ReorderButton orderNumber={order.order_number} />
          </li>
        ))}
      </ul>
    </section>
  );
}
