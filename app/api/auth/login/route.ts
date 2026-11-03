import { errorResponse } from "@/lib/http";
import { DORMANT_LOGIN_MESSAGE, WITHDRAWN_LOGIN_MESSAGE } from "@/lib/member-status";
import { createUserClient, getMemberStatus } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { email, password } = body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    return errorResponse("INVALID_INPUT", "이메일과 비밀번호를 입력해 주세요.", 400);
  }

  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return errorResponse(
      "LOGIN_FAILED",
      "이메일 또는 비밀번호를 확인해 주세요.",
      401,
    );
  }

  // 비밀번호가 맞아도 휴면·탈퇴 회원이면 바로 로그아웃시키고 이유를 알려 준다.
  // 비밀번호가 맞을 때만 알려 주므로 남이 이메일만으로 회원 구분을 알아낼 수 없다.
  const status = await getMemberStatus(data.user.id);
  if (status === "dormant" || status === "withdrawn") {
    await supabase.auth.signOut({ scope: "local" });
    return status === "dormant"
      ? errorResponse("DORMANT", DORMANT_LOGIN_MESSAGE, 403)
      : errorResponse("WITHDRAWN", WITHDRAWN_LOGIN_MESSAGE, 403);
  }
  return Response.json({ ok: true });
}
