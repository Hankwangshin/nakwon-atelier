import { errorResponse } from "@/lib/http";
import { createUserClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { email, password } = body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    return errorResponse("INVALID_INPUT", "이메일과 비밀번호를 입력해 주세요.", 400);
  }

  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return errorResponse(
      "LOGIN_FAILED",
      "이메일 또는 비밀번호를 확인해 주세요.",
      401,
    );
  }
  return Response.json({ ok: true });
}
