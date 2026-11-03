import { errorResponse, logFailure, serverFailedResponse } from "@/lib/http";
import { findAddressesProblem, findProfileProblem } from "@/lib/member-input";
import { createAdminClient, createUserClient } from "@/lib/supabase";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function findInputProblem(body: Record<string, unknown>): string | null {
  const {
    email,
    password,
    name,
    phone,
    address,
    shippingAddress,
    isOver14,
    agreeTerms,
    agreePrivacy,
  } = body;

  if (typeof email !== "string" || !EMAIL_PATTERN.test(email)) {
    return "이메일 형식을 확인해 주세요.";
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`;
  }
  const profileProblem = findProfileProblem(name, phone);
  if (profileProblem) {
    return profileProblem;
  }
  const addressProblem = findAddressesProblem(address, shippingAddress);
  if (addressProblem) {
    return addressProblem;
  }
  if (isOver14 !== true) {
    return "만 14세 이상만 가입할 수 있습니다.";
  }
  if (agreeTerms !== true || agreePrivacy !== true) {
    return "필수 항목에 동의해 주세요.";
  }
  return null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const problem = findInputProblem(body ?? {});
  if (problem) {
    return errorResponse("INVALID_INPUT", problem, 400);
  }

  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.signUp({
    email: body.email,
    password: body.password,
  });

  if (error?.code === "user_already_exists") {
    return errorResponse("EMAIL_TAKEN", "이미 가입된 이메일입니다.", 409);
  }
  if (error || !data.user) {
    logFailure("signup failed", error);
    return serverFailedResponse();
  }

  const admin = createAdminClient();
  const agreedAt = new Date().toISOString();
  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    name: body.name.trim(),
    phone: body.phone,
    address: body.address.trim(),
    shipping_address: body.shippingAddress.trim(),
    agreed_terms_at: agreedAt,
    agreed_privacy_at: agreedAt,
  });

  if (profileError) {
    // 회원 정보 없이 계정만 남지 않게 되돌린다.
    logFailure("profile failed", profileError);
    await admin.auth.admin.deleteUser(data.user.id);
    return serverFailedResponse();
  }

  return Response.json({ ok: true }, { status: 201 });
}
