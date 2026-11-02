import {
  errorResponse,
  logFailure,
  loginRequiredResponse,
  serverFailedResponse,
} from "@/lib/http";
import { createAdminClient, getCurrentUser } from "@/lib/supabase";

const MAX_REASON_LENGTH = 500;
const UNIQUE_VIOLATION = "23505";

// 구매자의 상품 교환 신청, 결제 취소 요청
export async function POST(
  request: Request,
  context: RouteContext<"/api/orders/[orderNumber]/requests">,
) {
  const user = await getCurrentUser();
  if (!user) {
    return loginRequiredResponse();
  }

  const body = await request.json().catch(() => null);
  const type = body?.type;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (type !== "exchange" && type !== "cancel") {
    return errorResponse("INVALID_INPUT", "요청 종류를 확인해 주세요.", 400);
  }
  if (reason === "" || reason.length > MAX_REASON_LENGTH) {
    return errorResponse(
      "INVALID_INPUT",
      `사유를 ${MAX_REASON_LENGTH}자 이내로 입력해 주세요.`,
      400,
    );
  }

  const { orderNumber } = await context.params;
  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, status")
    .eq("order_number", orderNumber)
    .eq("user_id", user.id)
    .maybeSingle();

  if (orderError) {
    logFailure("request order read failed", orderError);
    return serverFailedResponse();
  }
  if (!order) {
    return errorResponse("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다.", 404);
  }
  if (order.status !== "paid") {
    return errorResponse("NOT_REQUESTABLE", "결제 완료된 주문만 요청할 수 있습니다.", 409);
  }

  const { error } = await admin
    .from("order_requests")
    .insert({ order_id: order.id, user_id: user.id, type, reason });

  if (error?.code === UNIQUE_VIOLATION) {
    return errorResponse("REQUEST_OPEN", "이미 처리 중인 요청이 있습니다.", 409);
  }
  if (error) {
    logFailure("request add failed", error);
    return serverFailedResponse();
  }
  return Response.json({ ok: true }, { status: 201 });
}
