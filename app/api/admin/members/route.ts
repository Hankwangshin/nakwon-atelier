import type { NextRequest } from "next/server";
import { denyUnlessAllowed } from "@/lib/admin";
import { errorResponse, logFailure, serverFailedResponse } from "@/lib/http";
import { findSearchProblem, matchesMemberSearch } from "@/lib/member-search";
import type { MemberSearchField } from "@/lib/member-search";
import { createAdminClient, getCurrentUser } from "@/lib/supabase";

const MEMBERS_PER_PAGE = 1000;

// 회원 관리 화면의 표와 상세 정보에 쓸 회원 목록을 돌려준다.
// ?field=all|email|name&q=검색어 로 아이디(로그인 이메일)나 성명을 찾는다.
export async function GET(request: NextRequest) {
  const denied = await denyUnlessAllowed("members");
  if (denied) {
    return denied;
  }

  const searchParams = request.nextUrl.searchParams;
  const field = searchParams.get("field") ?? "all";
  const query = (searchParams.get("q") ?? "").trim();
  const problem = findSearchProblem(field, query);
  if (problem) {
    return errorResponse("INVALID_INPUT", problem, 400);
  }

  const admin = createAdminClient();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, name, phone, address, shipping_address, is_admin, tier_id, admin_scopes, created_at")
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

  const currentUser = await getCurrentUser();
  const emails = new Map(users.users.map(({ id, email }) => [id, email]));
  const members = profiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    email: emails.get(profile.id) ?? "",
    phone: profile.phone,
    address: profile.address ?? "",
    shippingAddress: profile.shipping_address ?? "",
    isAdmin: profile.is_admin,
    isSelf: profile.id === currentUser?.id,
    tierId: profile.tier_id,
    adminScopes: profile.admin_scopes,
    joinedAt: profile.created_at,
  }));

  return Response.json({
    members: members.filter((member) =>
      matchesMemberSearch(member, field as MemberSearchField, query),
    ),
  });
}
