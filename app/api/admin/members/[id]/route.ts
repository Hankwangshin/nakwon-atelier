import { denyUnlessAdmin } from "@/lib/admin";
import { errorResponse, logFailure, serverFailedResponse } from "@/lib/http";
import {
  MIN_PASSWORD_LENGTH,
  findOptionalAddressProblem,
  findProfileProblem,
} from "@/lib/member-input";
import { isChangeableRole } from "@/lib/member-status";
import { withdrawMember } from "@/lib/member-withdraw";
import { createAdminClient, getCurrentUser } from "@/lib/supabase";

// 새 비밀번호 칸을 비워 두면 바꾸지 않는다. 비밀번호 값은 기록하거나 돌려주지 않는다.
function findPasswordProblem(password: unknown, passwordConfirm: unknown): string | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`;
  }
  if (password !== passwordConfirm) {
    return "새 비밀번호와 확인 값이 같지 않습니다.";
  }
  return null;
}

// 시스템관리자가 회원의 구분(시스템관리자·일반·휴면), 등급, 성명, 휴대폰, 주소지,
// 배송지, 비밀번호를 바꾼다. 등급은 일반회원에게만 지정한다.
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/members/[id]">,
) {
  const denied = await denyUnlessAdmin();
  if (denied) {
    return denied;
  }

  const body = await request.json().catch(() => null);
  const { tierId, role, name, phone, address, shippingAddress, password, passwordConfirm } =
    body ?? {};
  if (tierId !== undefined && typeof tierId !== "string") {
    return errorResponse("INVALID_INPUT", "등급을 확인해 주세요.", 400);
  }
  if (role !== undefined && !isChangeableRole(role)) {
    return errorResponse(
      "INVALID_INPUT",
      "회원 구분은 시스템관리자, 일반회원, 휴면회원 중에서 골라 주세요.",
      400,
    );
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
  const hasPassword = password !== undefined && password !== "";
  if (hasPassword) {
    const problem = findPasswordProblem(password, passwordConfirm);
    if (problem) {
      return errorResponse("INVALID_INPUT", problem, 400);
    }
  }

  const { id } = await context.params;
  const currentUser = await getCurrentUser();
  // 자기 구분, 할인율, 비밀번호를 여기서 바꾸지 못하게 막는다. 본인 정보는 내 정보 메뉴에서 고친다.
  if (id === currentUser?.id) {
    return errorResponse(
      "SELF_CHANGE",
      "본인 계정은 여기서 바꿀 수 없습니다. 내 정보 메뉴를 이용해 주세요.",
      403,
    );
  }

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("profiles")
    .select("is_admin, status")
    .eq("id", id)
    .maybeSingle();

  if (!member) {
    return errorResponse("NOT_FOUND", "없는 회원입니다.", 404);
  }
  if (member.status === "withdrawn") {
    return errorResponse("WITHDRAWN", "탈퇴한 회원의 정보는 바꿀 수 없습니다.", 409);
  }

  const currentRole = member.is_admin ? "admin" : member.status;
  const nextRole = role ?? currentRole;
  if (tierId !== undefined && nextRole !== "active") {
    return errorResponse("TIER_ACTIVE_ONLY", "등급은 일반회원에게만 지정할 수 있습니다.", 409);
  }
  // 데이터베이스도 막지만, 이유를 쉬운 말로 알려 주려고 먼저 확인한다.
  if (member.is_admin && nextRole !== "admin") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_admin", true)
      .neq("id", id);
    if (!count) {
      return errorResponse(
        "LAST_ADMIN",
        "마지막 남은 시스템관리자는 다른 구분으로 바꿀 수 없습니다.",
        409,
      );
    }
  }

  if (tierId !== undefined) {
    const { data: tier } = await admin
      .from("membership_tiers")
      .select("id")
      .eq("id", tierId)
      .maybeSingle();

    if (!tier) {
      return errorResponse("NOT_FOUND", "없는 등급입니다.", 404);
    }
  }

  if (hasPassword) {
    const { error: passwordError } = await admin.auth.admin.updateUserById(id, { password });
    if (passwordError) {
      logFailure("member password update failed", passwordError);
      return serverFailedResponse();
    }
    // 바뀐 비밀번호를 모르는 기존 로그인은 모두 끊는다.
    const { error: revokeError } = await admin.rpc("revoke_user_sessions", { target: id });
    if (revokeError) {
      logFailure("member session revoke failed", revokeError);
      return serverFailedResponse();
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({
      is_admin: nextRole === "admin",
      status: nextRole === "dormant" ? "dormant" : "active",
      ...(tierId !== undefined && { tier_id: tierId }),
      ...(hasProfile && {
        name: name.trim(),
        phone,
        // 빈 주소는 DB 규칙(1~200자)에 맞게 값 없음으로 저장한다.
        address: address.trim() || null,
        shipping_address: shippingAddress.trim() || null,
      }),
    })
    .eq("id", id);

  if (error?.code === "P0001") {
    return errorResponse(
      "LAST_ADMIN",
      "마지막 남은 시스템관리자는 다른 구분으로 바꿀 수 없습니다.",
      409,
    );
  }
  if (error) {
    logFailure("member update failed", error);
    return serverFailedResponse();
  }
  return Response.json({ ok: true });
}

// 시스템관리자가 회원을 탈퇴 처리한다. 이메일, 탈퇴 상태, 탈퇴 날짜만 남기고 회원 정보와
// 장바구니는 지운다. 주문 기록은 법정 보관을 위해 회원 연결만 끊어 남긴다.
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
    .select("is_admin, status")
    .eq("id", id)
    .maybeSingle();

  if (!member) {
    return errorResponse("NOT_FOUND", "없는 회원입니다.", 404);
  }
  // 관리자가 모두 사라지면 관리 기능을 쓸 수 없게 되므로, 먼저 다른 구분으로 바꾸게 한다.
  if (member.is_admin) {
    return errorResponse(
      "ADMIN_PROTECTED",
      "시스템관리자는 탈퇴 처리할 수 없습니다. 먼저 다른 구분으로 바꿔 주세요.",
      409,
    );
  }
  if (member.status === "withdrawn") {
    return errorResponse("WITHDRAWN", "이미 탈퇴한 회원입니다.", 409);
  }

  try {
    await withdrawMember(id);
  } catch (error) {
    logFailure("member withdraw failed", error as { code?: string });
    return serverFailedResponse();
  }
  return Response.json({ ok: true });
}
