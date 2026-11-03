import type { MemberDiscount } from "@/lib/cart";
import { MAX_DISCOUNT_PERCENT, MAX_TIER_NAME_LENGTH } from "@/lib/limits";
import { createAdminClient } from "@/lib/supabase";

// 이 파일은 서버 전용 키를 쓰므로 서버 쪽 코드에서만 가져온다.

export interface MembershipTier {
  id: string;
  name: string;
  discountPercent: number;
  isDefault: boolean;
}

export async function getTiers(): Promise<MembershipTier[]> {
  const { data, error } = await createAdminClient()
    .from("membership_tiers")
    .select("id, name, discount_percent, is_default")
    .order("discount_percent")
    .order("created_at");

  if (error) {
    throw new Error(`tiers read failed: ${error.code}`);
  }
  return data.map(({ id, name, discount_percent, is_default }) => ({
    id,
    name,
    discountPercent: discount_percent,
    isDefault: is_default,
  }));
}

// 등급을 지정받지 않은 회원은 기본 등급으로 계산한다.
// 등급은 일반회원에게만 주므로 시스템관리자 등 그 밖의 회원은 할인하지 않는다.
export async function getMemberDiscount(userId: string): Promise<MemberDiscount> {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("tier_id, is_admin, status")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`member tier read failed: ${error.code}`);
  }
  if (profile && (profile.is_admin || profile.status !== "active")) {
    return { tierName: "", percent: 0 };
  }

  const query = admin.from("membership_tiers").select("name, discount_percent");
  const { data: tier, error: tierError } = await (profile?.tier_id
    ? query.eq("id", profile.tier_id)
    : query.eq("is_default", true)
  ).maybeSingle();

  if (tierError) {
    throw new Error(`member tier read failed: ${tierError.code}`);
  }
  return { tierName: tier?.name ?? "", percent: tier?.discount_percent ?? 0 };
}

// 관리자 입력을 검사한다. 문제가 있으면 문구를, 없으면 저장할 값을 돌려준다.
export function parseTierInput(body: Record<string, unknown> | null) {
  const { name, discountPercent } = body ?? {};

  if (
    typeof name !== "string" ||
    name.trim() === "" ||
    name.trim().length > MAX_TIER_NAME_LENGTH
  ) {
    return `등급 이름은 ${MAX_TIER_NAME_LENGTH}자 이내로 입력해 주세요.`;
  }
  if (
    !Number.isInteger(discountPercent) ||
    (discountPercent as number) < 0 ||
    (discountPercent as number) > MAX_DISCOUNT_PERCENT
  ) {
    return `할인율은 0~${MAX_DISCOUNT_PERCENT} 사이의 정수로 입력해 주세요.`;
  }
  return { name: name.trim(), discount_percent: discountPercent as number };
}
