"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { callApi, formatPrice } from "@/lib/client-api";
import type { ApiResult } from "@/lib/client-api";
import { REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS } from "@/lib/order-requests";
import type { RequestType } from "@/lib/order-requests";

interface AdminRequest {
  id: string;
  type: RequestType;
  reason: string;
  status: string;
  created_at: string;
  orders: {
    order_name: string;
    amount: number;
    receiver_name: string;
  };
}

export default function AdminRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<AdminRequest[] | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const showRequests = useCallback(
    (result: ApiResult<{ requests: AdminRequest[] }>) => {
      if (result.status === 401 || result.status === 403) {
        router.replace("/");
        return;
      }
      setRequests(result.data?.requests ?? []);
      setError(result.ok ? "" : result.errorMessage);
    },
    [router],
  );

  useEffect(() => {
    callApi<{ requests: AdminRequest[] }>("/api/admin/requests").then(showRequests);
  }, [showRequests]);

  async function decide(request: AdminRequest, decision: "approve" | "reject") {
    const label = REQUEST_TYPE_LABELS[request.type];
    const action = decision === "approve" ? "승인" : "거절";
    const warning =
      decision === "approve" && request.type === "cancel"
        ? " 결제가 취소되며 되돌릴 수 없습니다."
        : "";
    if (!window.confirm(`${label} 요청을 ${action}할까요?${warning}`)) {
      return;
    }

    setMessage("");
    const result = await callApi(`/api/admin/requests/${request.id}`, "PATCH", { decision });
    const refreshed = await callApi<{ requests: AdminRequest[] }>("/api/admin/requests");
    showRequests(refreshed);

    if (result.ok) {
      setError("");
      setMessage(`${action}했습니다.`);
    } else {
      setError(result.errorMessage);
    }
  }

  if (!requests) {
    return <main className="px-4 py-6 text-sm">권한을 확인하는 중</main>;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 text-sm">
      <h1 className="text-xl font-semibold">교환·취소 요청</h1>
      {error && (
        <p role="alert" className="mt-3 text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-green-700 dark:text-green-400">
          {message}
        </p>
      )}
      {requests.length === 0 && <p className="mt-4">요청이 없습니다.</p>}
      <ul className="mt-3 flex flex-col gap-3">
        {requests.map((request) => (
          <li
            key={request.id}
            className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"
          >
            <p className="font-semibold">
              {REQUEST_TYPE_LABELS[request.type]} · {REQUEST_STATUS_LABELS[request.status]}
            </p>
            <p className="mt-1">
              {request.orders.order_name} · {formatPrice(request.orders.amount)} ·{" "}
              {request.orders.receiver_name}
            </p>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              사유: {request.reason}
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {new Date(request.created_at).toLocaleString("ko-KR")} 요청
            </p>
            {request.status === "pending" && (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => decide(request, "approve")}
                  className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white"
                >
                  승인
                </button>
                <button
                  type="button"
                  onClick={() => decide(request, "reject")}
                  className="rounded-lg border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
                >
                  거절
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
