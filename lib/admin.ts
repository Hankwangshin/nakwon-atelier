import { ALL_ADMIN_SCOPES } from "@/lib/admin-scopes";
import type { AdminScope } from "@/lib/admin-scopes";
import { errorResponse, loginRequiredResponse } from "@/lib/http";
import { createAdminClient, getCurrentUser } from "@/lib/supabase";

// 이 파일은 서버 전용 키를 쓰므로 서버 쪽 코드에서만 가져온다.

// 관리 권한은 회원이 바꿀 수 없는 서버 쪽 값으로만 판단한다.
// isAdmin은 시스템관리자 계정이고, 모든 권한 범위를 가진다.
export async function getAdminUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, isAdmin: false, scopes: [] as AdminScope[] };
  }

  const { data } = await createAdminClient()
    .from("profiles")
    .select("is_admin, admin_scopes")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = data?.is_admin === true;
  const scopes: AdminScope[] = isAdmin ? ALL_ADMIN_SCOPES : (data?.admin_scopes ?? []);
  return { user, isAdmin, scopes };
}

export async function denyUnlessAllowed(scope: AdminScope) {
  const { user, scopes } = await getAdminUser();
  if (!user) {
    return loginRequiredResponse();
  }
  return scopes.includes(scope)
    ? null
    : errorResponse("FORBIDDEN", "이 메뉴를 사용할 권한이 없습니다.", 403);
}
