import {
  errorResponse,
  logFailure,
  loginRequiredResponse,
  serverFailedResponse,
} from "@/lib/http";
import { createAdminClient, getCurrentUser } from "@/lib/supabase";

const TOSS_CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm";
const TOSS_TIMEOUT_MS = 20000;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return loginRequiredResponse();
  }

  const body = await request.json().catch(() => null);
  const { paymentKey, orderId, amount } = body ?? {};
  if (
    typeof paymentKey !== "string" ||
    typeof orderId !== "string" ||
    typeof amount !== "number"
  ) {
    return errorResponse("INVALID_INPUT", "결제 정보를 확인해 주세요.", 400);
  }

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .select("id, amount, status, payment_key")
    .eq("order_number", orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    logFailure("confirm read failed", error);
    return serverFailedResponse();
  }
  if (!order) {
    return errorResponse("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다.", 404);
  }
  // 새로고침으로 다시 호출돼도 같은 결제를 두 번 승인하지 않는다.
  if (order.status === "paid" && order.payment_key === paymentKey) {
    return Response.json({ ok: true });
  }
  if (order.status !== "pending") {
    return errorResponse("ORDER_CLOSED", "이미 처리된 주문입니다.", 409);
  }
  // 브라우저에서 금액을 바꿔도 서버가 저장한 금액과 다르면 승인하지 않는다.
  if (order.amount !== amount) {
    return errorResponse("AMOUNT_MISMATCH", "결제 금액이 주문 금액과 다릅니다.", 400);
  }

  // 승인 전에 재고부터 줄여, 마지막 상품을 두 사람이 동시에 결제해도 한 명만 성공한다.
  const { data: hasStock, error: stockError } = await admin.rpc("deduct_order_stock", {
    target_order: order.id,
  });
  if (stockError) {
    logFailure("stock deduct failed", stockError);
    return serverFailedResponse();
  }
  if (!hasStock) {
    await admin.from("orders").update({ status: "failed" }).eq("id", order.id);
    return errorResponse(
      "OUT_OF_STOCK",
      "재고가 부족해 결제를 진행하지 않았습니다. 장바구니를 다시 확인해 주세요.",
      409,
    );
  }

  const credentials = Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString("base64");
  let response: Response;
  try {
    response = await fetch(TOSS_CONFIRM_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
      signal: AbortSignal.timeout(TOSS_TIMEOUT_MS),
    });
  } catch {
    // 승인 결과를 모르는 상태이므로 주문을 실패로 바꾸지 않는다.
    return errorResponse(
      "PAYMENT_TIMEOUT",
      "결제 확인이 늦어지고 있습니다. 주문 내역을 확인해 주세요.",
      504,
    );
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    logFailure("payment failed", { code: result?.code });
    await admin.from("orders").update({ status: "failed" }).eq("id", order.id);
    const { error: restoreError } = await admin.rpc("restore_order_stock", {
      target_order: order.id,
    });
    if (restoreError) {
      logFailure("stock restore failed", restoreError);
    }
    return errorResponse(
      "PAYMENT_FAILED",
      result?.message ?? "결제를 완료하지 못했습니다.",
      400,
    );
  }

  const { error: updateError } = await admin
    .from("orders")
    .update({
      status: "paid",
      payment_key: paymentKey,
      paid_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  if (updateError) {
    logFailure("order paid update failed", updateError);
    return serverFailedResponse();
  }

  await admin.from("cart_items").delete().eq("user_id", user.id);
  return Response.json({ ok: true });
}
