import { logFailure, loginRequiredResponse, serverFailedResponse } from "@/lib/http";
import { createAdminClient, createUserClient, getCurrentUser } from "@/lib/supabase";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ user: null });
  }

  const supabase = await createUserClient();
  const { data } = await supabase
    .from("profiles")
    .select("name, phone")
    .eq("id", user.id)
    .maybeSingle();

  return Response.json({
    user: { id: user.id, email: user.email, name: data?.name, phone: data?.phone },
  });
}

// 회원 탈퇴. 회원 정보와 장바구니는 파기하고, 주문 기록은 법정 보관을 위해
// 회원 연결만 끊어 남긴다.
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return loginRequiredResponse();
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
