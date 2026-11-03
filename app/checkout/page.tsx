"use client";

import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import type { TossPaymentsWidgets } from "@tosspayments/tosspayments-sdk";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import TextField from "@/components/TextField";
import { callApi, formatPrice } from "@/lib/client-api";

interface CreatedOrder {
  orderNumber: string;
  orderName: string;
  amount: number;
  discountAmount: number;
  customerKey: string;
  customerEmail?: string;
}

interface Me {
  user: { name?: string; phone?: string; address?: string; shippingAddress?: string } | null;
}

const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY as string;

export default function CheckoutPage() {
  const router = useRouter();
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [address, setAddress] = useState("");
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState("");
  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);

  useEffect(() => {
    callApi<Me>("/api/auth/me").then(({ data }) => {
      if (!data?.user) {
        router.replace("/login");
        return;
      }
      setReceiverName(data.user.name ?? "");
      setReceiverPhone(data.user.phone ?? "");
      // 내 정보의 배송지를 먼저 채우고, 없으면 주소지를 쓴다. 이번 주문만 바꿔도 저장된 값은 그대로다.
      setAddress(data.user.shippingAddress || data.user.address || "");
    });
  }, [router]);

  // 주문이 만들어지면 결제대행사의 결제 화면을 불러온다.
  useEffect(() => {
    if (!order) {
      return;
    }

    async function renderWidgets(created: CreatedOrder) {
      try {
        const tossPayments = await loadTossPayments(CLIENT_KEY);
        const widgets = tossPayments.widgets({ customerKey: created.customerKey });
        await widgets.setAmount({ currency: "KRW", value: created.amount });
        await Promise.all([
          widgets.renderPaymentMethods({ selector: "#payment-method" }),
          widgets.renderAgreement({ selector: "#agreement" }),
        ]);
        widgetsRef.current = widgets;
        setIsReady(true);
      } catch {
        setError("결제 화면을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    }

    renderWidgets(order);
  }, [order]);

  async function handleOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const result = await callApi<CreatedOrder>("/api/orders", "POST", {
      receiverName,
      receiverPhone,
      address,
    });
    if (result.ok) {
      setOrder(result.data);
    } else {
      setError(result.errorMessage);
    }
  }

  async function handlePay() {
    if (!order || !widgetsRef.current) {
      return;
    }

    try {
      await widgetsRef.current.requestPayment({
        orderId: order.orderNumber,
        orderName: order.orderName,
        customerEmail: order.customerEmail,
        customerName: receiverName,
        successUrl: `${window.location.origin}/checkout/success`,
        failUrl: `${window.location.origin}/checkout/fail`,
      });
    } catch {
      setError("결제를 시작하지 못했습니다. 결제 수단과 약관 동의를 확인해 주세요.");
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6 text-sm">
      <h1 className="text-xl font-semibold">주문서</h1>

      {!order && (
        <form onSubmit={handleOrder} className="mt-4 flex flex-col gap-3">
          <TextField label="받는 사람" value={receiverName} onChange={setReceiverName} autoComplete="name" />
          <TextField label="휴대폰 번호" type="tel" value={receiverPhone} onChange={setReceiverPhone} autoComplete="tel" placeholder="010-0000-0000" />
          <TextField label="배송지 주소" value={address} onChange={setAddress} autoComplete="shipping street-address" />
          <p className="-mt-2 text-xs text-zinc-600 dark:text-zinc-400">
            내 정보의 배송지가 미리 채워집니다. 여기서 바꾸면 이번 주문에만 적용됩니다.
          </p>
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white">
            결제 단계로 가기
          </button>
        </form>
      )}

      {order && (
        <>
          <p className="mt-4">
            {order.orderName} · <span className="font-semibold">{formatPrice(order.amount)}</span>
          </p>
          {order.discountAmount > 0 && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              등급 할인 {formatPrice(order.discountAmount)} 적용
            </p>
          )}
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            테스트 결제입니다. 실제 금액이 빠져나가지 않습니다.
          </p>
          <div id="payment-method" className="mt-3" />
          <div id="agreement" />
          <button
            type="button"
            onClick={handlePay}
            disabled={!isReady}
            className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {isReady ? `${formatPrice(order.amount)} 결제하기` : "결제 화면을 불러오는 중"}
          </button>
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </main>
  );
}
