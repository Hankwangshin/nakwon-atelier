// 이 파일은 시크릿 키를 쓰므로 서버 쪽 코드에서만 가져온다.

const TOSS_TIMEOUT_MS = 20000;

export interface TossResult {
  ok: boolean;
  code?: string;
  message?: string;
  isUnknown: boolean; // 시간 초과처럼 처리 결과를 알 수 없는 경우
}

// requestId를 멱등 키로 보내, 다시 시도해도 결제가 두 번 취소되지 않게 한다.
export async function cancelPayment(
  paymentKey: string,
  reason: string,
  requestId: string,
): Promise<TossResult> {
  const credentials = Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString("base64");

  try {
    const response = await fetch(
      `https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
          "Idempotency-Key": requestId,
        },
        body: JSON.stringify({ cancelReason: reason }),
        signal: AbortSignal.timeout(TOSS_TIMEOUT_MS),
      },
    );
    const result = await response.json().catch(() => null);

    return {
      ok: response.ok,
      code: result?.code,
      message: result?.message,
      isUnknown: false,
    };
  } catch {
    return { ok: false, isUnknown: true };
  }
}
