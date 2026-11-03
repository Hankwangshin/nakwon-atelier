import { denyUnlessAdmin } from "@/lib/admin";
import { errorResponse, logFailure, serverFailedResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";
import { cancelPayment } from "@/lib/toss";

type Admin = ReturnType<typeof createAdminClient>;

function finishRequest(admin: Admin, id: string, status: "approved" | "rejected") {
  return admin
    .from("order_requests")
    .update({ status, decided_at: new Date().toISOString() })
    .eq("id", id);
}

// 동시에 두 번 눌러도 한 번만 처리되도록 먼저 processing으로 바꾼다.
async function claimRequest(admin: Admin, id: string) {
  const { data } = await admin
    .from("order_requests")
    .update({ status: "processing" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id, type, reason, order_id")
    .maybeSingle();
  return data;
}

async function approveCancel(
  admin: Admin,
  request: { id: string; reason: string; order_id: string },
) {
  const { data: order } = await admin
    .from("orders")
    .select("id, status, payment_key")
    .eq("id", request.order_id)
    .single();

  if (order?.status !== "paid" || !order.payment_key) {
    await admin.from("order_requests").update({ status: "pending" }).eq("id", request.id);
    return errorResponse("NOT_CANCELABLE", "취소할 수 있는 결제가 아닙니다.", 409);
  }

  const result = await cancelPayment(order.payment_key, request.reason, request.id);

  if (result.isUnknown) {
    // 취소됐는지 알 수 없으므로 processing으로 남겨 다시 승인되지 않게 한다.
    return errorResponse(
      "CANCEL_UNKNOWN",
      "결제 취소 결과를 확인하지 못했습니다. 결제대행사 관리 화면을 확인해 주세요.",
      504,
    );
  }
  if (!result.ok) {
    logFailure("payment cancel failed", { code: result.code });
    await admin.from("order_requests").update({ status: "pending" }).eq("id", request.id);
    return errorResponse(
      "CANCEL_FAILED",
      result.message ?? "결제를 취소하지 못했습니다.",
      502,
    );
  }

  const { error } = await admin
    .from("orders")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", order.id);

  if (error) {
    logFailure("order cancel update failed", error);
    return serverFailedResponse();
  }

  // 결제는 이미 취소됐으므로 재고 복구가 실패해도 승인은 끝낸다. 재고는 상품 관리에서 고칠 수 있다.
  const { error: restoreError } = await admin.rpc("restore_order_stock", {
    target_order: order.id,
  });
  if (restoreError) {
    logFailure("stock restore failed", restoreError);
  }

  await finishRequest(admin, request.id, "approved");
  return Response.json({ ok: true });
}

// 관리자의 교환 승인, 결제 취소 승인, 거절
export async function PATCH(
  httpRequest: Request,
  context: RouteContext<"/api/admin/requests/[id]">,
) {
  const denied = await denyUnlessAdmin();
  if (denied) {
    return denied;
  }

  const body = await httpRequest.json().catch(() => null);
  const decision = body?.decision;
  if (decision !== "approve" && decision !== "reject") {
    return errorResponse("INVALID_INPUT", "처리 방법을 확인해 주세요.", 400);
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const request = await claimRequest(admin, id);
  if (!request) {
    return errorResponse("REQUEST_CLOSED", "대기 중인 요청이 아닙니다.", 409);
  }

  if (decision === "approve" && request.type === "cancel") {
    return approveCancel(admin, request);
  }

  const { error } = await finishRequest(
    admin,
    id,
    decision === "approve" ? "approved" : "rejected",
  );
  if (error) {
    logFailure("request decide failed", error);
    return serverFailedResponse();
  }
  return Response.json({ ok: true });
}
