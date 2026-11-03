import { denyUnlessAllowed } from "@/lib/admin";
import { isAdminScope } from "@/lib/admin-scopes";
import { errorResponse, logFailure, serverFailedResponse } from "@/lib/http";
import { findOptionalAddressProblem, findProfileProblem } from "@/lib/member-input";
import { createAdminClient, getCurrentUser } from "@/lib/supabase";

// 회원의 등급과 관리 권한 범위를 바꾼다. 성명이 함께 오면 성명, 휴대폰,
// 주소지, 배송지도 회원가입과 같은 기준으로 검사해 함께 바꾼다.
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/members/[id]">,
) {
  const denied = await denyUnlessAllowed("members");
  if (denied) {
    return denied;
  }

  const body = await request.json().catch(() => null);
  const { tierId, adminScopes, name, phone, address, shippingAddress } = body ?? {};
  if (
    typeof tierId !== "string" ||
    !Array.isArray(adminScopes) ||
    !adminScopes.every(isAdminScope)
  ) {
    return errorResponse("INVALID_INPUT", "등급과 권한을 확인해 주세요.", 400);
  }
  const hasProfile = name !== undefined;
  if (hasProfile) {
    const problem =
      findProfileProblem(name, phone) ??
      findOptionalAddressProblem(address, "주소지") ??
      findOptionalAddressProblem(shippingAddress, "배송지");
    if (problem) {
      return errorResponse("INVALID_INPUT", problem, 400);
    }
  }

  const { id } = await context.params;
  const currentUser = await getCurrentUser();
  // 자기 할인율이나 권한을 스스로 올리지 못하게 막는다.
  if (id === currentUser?.id) {
    return errorResponse("SELF_CHANGE", "본인의 등급과 권한은 직접 바꿀 수 없습니다.", 403);
  }

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", id)
    .maybeSingle();

  if (!member) {
    return errorResponse("NOT_FOUND", "없는 회원입니다.", 404);
  }
  if (member.is_admin) {
    return errorResponse("ADMIN_PROTECTED", "전체 관리자 계정은 바꿀 수 없습니다.", 409);
  }

  const { data: tier } = await admin
    .from("membership_tiers")
    .select("id")
    .eq("id", tierId)
    .maybeSingle();

  if (!tier) {
    return errorResponse("NOT_FOUND", "없는 등급입니다.", 404);
  }

  const { error } = await admin
    .from("profiles")
    .update({
      tier_id: tier.id,
      admin_scopes: [...new Set(adminScopes)],
      ...(hasProfile && {
        name: name.trim(),
        phone,
        // 빈 주소는 DB 규칙(1~200자)에 맞게 값 없음으로 저장한다.
        address: address.trim() || null,
        shipping_address: shippingAddress.trim() || null,
      }),
    })
    .eq("id", id);

  if (error) {
    logFailure("member update failed", error);
    return serverFailedResponse();
  }
  return Response.json({ ok: true });
}

// 관리자가 회원을 탈퇴 처리한다. 회원 정보와 장바구니는 삭제하고,
// 주문 기록은 법정 보관을 위해 회원 연결만 끊어 남긴다.
export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/admin/members/[id]">,
) {
  const denied = await denyUnlessAllowed("members");
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
