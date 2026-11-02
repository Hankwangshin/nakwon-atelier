import { denyUnlessAdmin } from "@/lib/admin";
import { errorResponse, logFailure, serverFailedResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

// 관리자가 회원을 탈퇴 처리한다. 회원 정보와 장바구니는 삭제하고,
// 주문 기록은 법정 보관을 위해 회원 연결만 끊어 남긴다.
export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/admin/members/[id]">,
) {
  const denied = await denyUnlessAdmin();
  if (denied) {
    return denied;
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", id)
    .maybeSingle();

  if (!member) {
    return errorResponse("NOT_FOUND", "없는 회원입니다.", 404);
  }
  // 관리자가 모두 사라지면 관리 기능을 쓸 수 없게 되므로 막는다.
  if (member.is_admin) {
    return errorResponse("ADMIN_PROTECTED", "관리자 계정은 탈퇴 처리할 수 없습니다.", 409);
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    logFailure("member withdraw failed", error);
    return serverFailedResponse();
  }
  return Response.json({ ok: true });
}
