import { getAdminUser } from "@/lib/admin";
import { ALL_ADMIN_SCOPES } from "@/lib/admin-scopes";
import {
  errorResponse,
  logFailure,
  loginRequiredResponse,
  serverFailedResponse,
} from "@/lib/http";
import { findProfileProblem } from "@/lib/member-input";
import {
  createAdminClient,
  createUserClient,
  getCurrentUser,
  isPasswordCorrect,
} from "@/lib/supabase";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ user: null });
  }

  const supabase = await createUserClient();
  const { data } = await supabase
    .from("profiles")
    .select("name, phone, is_admin, admin_scopes")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = data?.is_admin === true;
  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      name: data?.name,
      phone: data?.phone,
      isAdmin,
      adminScopes: isAdmin ? ALL_ADMIN_SCOPES : (data?.admin_scopes ?? []),
    },
  });
}

// 내 정보 수정. 비밀번호가 맞을 때만 저장하고, 이메일은 바꾸지 않는다.
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user?.email) {
    return loginRequiredResponse();
  }

  const body = await request.json().catch(() => null);
  const { name, phone, password } = body ?? {};
  const problem = findProfileProblem(name, phone);
  if (problem) {
    return errorResponse("INVALID_INPUT", problem, 400);
  }
  if (typeof password !== "string" || password === "") {
    return errorResponse("INVALID_INPUT", "비밀번호를 입력해 주세요.", 400);
  }
  if (!(await isPasswordCorrect(user.email, password))) {
    return errorResponse("WRONG_PASSWORD", "비밀번호가 맞지 않습니다.", 403);
  }

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ name: name.trim(), phone })
    .eq("id", user.id);

  if (error) {
    logFailure("profile update failed", error);
    return serverFailedResponse();
  }
  return Response.json({ ok: true });
}

// 회원 탈퇴. 회원 정보와 장바구니는 파기하고, 주문 기록은 법정 보관을 위해
// 회원 연결만 끊어 남긴다.
export async function DELETE() {
  const { user, isAdmin } = await getAdminUser();
  if (!user) {
    return loginRequiredResponse();
  }
  // 관리자가 모두 사라지면 관리 기능을 쓸 수 없게 되므로 막는다.
  if (isAdmin) {
    return errorResponse("ADMIN_PROTECTED", "관리자 계정은 탈퇴할 수 없습니다.", 409);
  }

  const supabase = await createUserClient();
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) {
    logFailure("withdraw failed", error);
    return serverFailedResponse();
  }

  await supabase.auth.signOut({ scope: "local" });
  return Response.json({ ok: true });
}
