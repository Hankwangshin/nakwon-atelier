import {
  errorResponse,
  logFailure,
  loginRequiredResponse,
  serverFailedResponse,
} from "@/lib/http";
import { MIN_PASSWORD_LENGTH } from "@/lib/member-input";
import {
  createUserClient,
  getCurrentUser,
  isPasswordCorrect,
} from "@/lib/supabase";

function findPasswordProblem(body: Record<string, unknown>): string | null {
  const { currentPassword, newPassword, newPasswordConfirm } = body;

  if (typeof currentPassword !== "string" || currentPassword === "") {
    return "지금 비밀번호를 입력해 주세요.";
  }
  if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
    return `새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`;
  }
  if (newPassword !== newPasswordConfirm) {
    return "새 비밀번호와 확인이 서로 다릅니다.";
  }
  if (newPassword === currentPassword) {
    return "새 비밀번호를 지금 비밀번호와 다르게 정해 주세요.";
  }
  return null;
}

// 내 정보에서 본인 비밀번호를 바꾼다. 지금 비밀번호가 맞아야 바꾸며,
// 비밀번호는 기록이나 응답에 남기지 않는다.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.email) {
    return loginRequiredResponse();
  }

  const body = await request.json().catch(() => null);
  const problem = findPasswordProblem(body ?? {});
  if (problem) {
    return errorResponse("INVALID_INPUT", problem, 400);
  }
  if (!(await isPasswordCorrect(user.email, body.currentPassword))) {
    return errorResponse("WRONG_PASSWORD", "지금 비밀번호가 맞지 않습니다.", 403);
  }

  // 관리자 키로 바꾸면 지금 기기까지 모두 로그아웃되므로, 본인 로그인으로 바꾼다.
  const supabase = await createUserClient();
  const { error } = await supabase.auth.updateUser({ password: body.newPassword });
  if (error) {
    logFailure("password change failed", error);
    return serverFailedResponse();
  }

  // 다른 기기에 남은 로그인은 끊고, 지금 쓰는 기기는 그대로 둔다.
  await supabase.auth.signOut({ scope: "others" });
  return Response.json({ ok: true });
}
