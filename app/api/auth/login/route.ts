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

  // 탈퇴회원은 Supabase에서 로그인이 막혀 있다(비밀번호가 맞을 때만 이 코드가 온다).
  if (error?.code === "user_banned") {
    return errorResponse("WITHDRAWN", WITHDRAWN_LOGIN_MESSAGE, 403);
  }
  if (error || !data.user) {
    return errorResponse(
      "LOGIN_FAILED",
      "이메일 또는 비밀번호를 확인해 주세요.",
      401,
    );
  }

  // 비밀번호가 맞아도 휴면·탈퇴 회원이면 바로 로그아웃시키고 이유를 알려 준다.
  const status = await getMemberStatus(data.user.id);
  if (status === "dormant" || status === "withdrawn") {
    await supabase.auth.signOut({ scope: "local" });
    return status === "dormant"
      ? errorResponse("DORMANT", DORMANT_LOGIN_MESSAGE, 403)
      : errorResponse("WITHDRAWN", WITHDRAWN_LOGIN_MESSAGE, 403);
  }
  return Response.json({ ok: true });
}
