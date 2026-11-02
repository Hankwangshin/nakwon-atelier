import { errorResponse, loginRequiredResponse } from "@/lib/http";
import { createAdminClient, getCurrentUser } from "@/lib/supabase";

// 이 파일은 서버 전용 키를 쓰므로 서버 쪽 코드에서만 가져온다.

// 관리자 여부는 회원이 바꿀 수 없는 서버 쪽 값으로만 판단한다.
export async function getAdminUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, isAdmin: false };
  }

  const { data } = await createAdminClient()
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  return { user, isAdmin: data?.is_admin === true };
}

export async function denyUnlessAdmin() {
  const { user, isAdmin } = await getAdminUser();
  if (!user) {
    return loginRequiredResponse();
  }
  return isAdmin
    ? null
    : errorResponse("FORBIDDEN", "관리자만 사용할 수 있습니다.", 403);
}
