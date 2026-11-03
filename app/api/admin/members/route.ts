import type { NextRequest } from "next/server";
import { denyUnlessAllowed } from "@/lib/admin";
import { errorResponse, logFailure, serverFailedResponse } from "@/lib/http";
import {
  findAccountProblem,
  findAddressesProblem,
  findProfileProblem,
} from "@/lib/member-input";
import { findSearchProblem, matchesMemberSearch } from "@/lib/member-search";
import type { MemberSearchField } from "@/lib/member-search";
import { roleOf } from "@/lib/member-status";
import type { MemberStatus } from "@/lib/member-status";
import { createAdminClient, getCurrentUser } from "@/lib/supabase";

const MEMBERS_PER_PAGE = 1000;

// 회원 관리 화면의 표와 상세 정보에 쓸 회원 목록을 돌려준다.
// ?field=all|email|name&q=검색어 로 아이디(로그인 이메일)나 성명을 찾고,
// &role=all|admin|active|dormant|withdrawn 으로 회원 구분을 골라 본다.
export async function GET(request: NextRequest) {
  const denied = await denyUnlessAllowed("members");
  if (denied) {
    return denied;
  }

  const searchParams = request.nextUrl.searchParams;
  const field = searchParams.get("field") ?? "all";
  const query = (searchParams.get("q") ?? "").trim();
  const role = searchParams.get("role") ?? "all";
  const problem = findSearchProblem(field, query, role);
  if (problem) {
    return errorResponse("INVALID_INPUT", problem, 400);
  }

  const admin = createAdminClient();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select(
      "id, name, phone, address, shipping_address, is_admin, status, withdrawn_at, tier_id, admin_scopes, created_at",
    )
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
    // 탈퇴회원은 이름과 연락처가 지워져 있다.
    name: profile.name ?? "",
    email: emails.get(profile.id) ?? "",
    phone: profile.phone ?? "",
    address: profile.address ?? "",
    shippingAddress: profile.shipping_address ?? "",
    isAdmin: profile.is_admin,
    status: profile.status as MemberStatus,
    withdrawnAt: profile.withdrawn_at,
    isSelf: profile.id === currentUser?.id,
    tierId: profile.tier_id,
    adminScopes: profile.admin_scopes,
    joinedAt: profile.created_at,
  }));

  return Response.json({
    members: members.filter(
      (member) =>
        (role === "all" || roleOf(member) === role) &&
        matchesMemberSearch(member, field as MemberSearchField, query),
    ),
  });
}

// 관리자가 회원을 대신 등록한다. 회원가입과 같은 기준으로 입력을 검사하고,
// 회원 본인에게 동의를 받았다는 관리자 확인이 있어야 저장한다.
// 새 회원은 기본 등급이고 관리 권한은 없다.
export async function POST(request: Request) {
  const denied = await denyUnlessAllowed("members");
  if (denied) {
    return denied;
  }

  const body = await request.json().catch(() => null);
  const { email, password, name, phone, address, shippingAddress, consentConfirmed } =
    body ?? {};
  const problem =
    findAccountProblem(email, password) ??
    findProfileProblem(name, phone) ??
    findAddressesProblem(address, shippingAddress);
  if (problem) {
    return errorResponse("INVALID_INPUT", problem, 400);
  }
  if (consentConfirmed !== true) {
    return errorResponse(
      "CONSENT_REQUIRED",
      "회원 본인의 만 14세 이상 확인과 약관·개인정보 동의를 받았는지 체크해 주세요.",
      400,
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error?.code === "email_exists" || error?.code === "user_already_exists") {
    return errorResponse("EMAIL_TAKEN", "이미 가입된 이메일입니다.", 409);
  }
  if (error || !data.user) {
    logFailure("member create failed", error);
    return serverFailedResponse();
  }

  const agreedAt = new Date().toISOString();
  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    name: name.trim(),
    phone,
    address: address.trim(),
    shipping_address: shippingAddress.trim(),
    agreed_terms_at: agreedAt,
    agreed_privacy_at: agreedAt,
  });

  if (profileError) {
    // 회원 정보 없이 계정만 남지 않게 되돌린다.
    logFailure("member profile create failed", profileError);
    await admin.auth.admin.deleteUser(data.user.id);
    return serverFailedResponse();
  }

  return Response.json({ id: data.user.id }, { status: 201 });
}
