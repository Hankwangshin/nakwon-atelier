import { denyUnlessAdmin } from "@/lib/admin";
import { logFailure, serverFailedResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

const MEMBERS_PER_PAGE = 1000;

// 탈퇴 처리에 필요한 최소 정보만 돌려준다. 연락처는 보내지 않는다.
export async function GET() {
  const denied = await denyUnlessAdmin();
  if (denied) {
    return denied;
  }

  const admin = createAdminClient();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, name, is_admin, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    logFailure("members read failed", error);
    return serverFailedResponse();
  }

  const { data: users, error: usersError } = await admin.auth.admin.listUsers({
    perPage: MEMBERS_PER_PAGE,
  });
  if (usersError) {
    logFailure("members auth read failed", usersError);
    return serverFailedResponse();
  }

  const emails = new Map(users.users.map(({ id, email }) => [id, email]));
  return Response.json({
    members: profiles.map(({ id, name, is_admin, created_at }) => ({
      id,
      name,
      email: emails.get(id) ?? "",
      isAdmin: is_admin,
      joinedAt: created_at,
    })),
  });
}
