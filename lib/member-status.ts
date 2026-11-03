// 회원 구분. 화면과 서버가 함께 쓰며 브라우저에 포함돼도 된다.
// 시스템관리자는 is_admin 계정이고, 나머지는 profiles.status 값으로 나눈다.
export const MEMBER_ROLES = [
  { id: "admin", label: "시스템관리자" },
  { id: "active", label: "일반회원" },
  { id: "dormant", label: "휴면회원" },
  { id: "withdrawn", label: "탈퇴회원" },
] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number]["id"];
export type MemberStatus = Exclude<MemberRole, "admin">;

// 관리자가 회원 관리에서 직접 바꿀 수 있는 상태. 탈퇴는 탈퇴 처리 버튼으로만 한다.
export const CHANGEABLE_STATUSES: MemberStatus[] = ["active", "dormant"];

export function isChangeableStatus(value: unknown): value is MemberStatus {
  return CHANGEABLE_STATUSES.includes(value as MemberStatus);
}

export function isMemberRole(value: unknown): value is MemberRole {
  return MEMBER_ROLES.some(({ id }) => id === value);
}

export function roleOf(member: { isAdmin: boolean; status: MemberStatus }): MemberRole {
  return member.isAdmin ? "admin" : member.status;
}

export function roleLabel(role: MemberRole): string {
  return MEMBER_ROLES.find(({ id }) => id === role)?.label ?? "";
}

export const DORMANT_LOGIN_MESSAGE =
  "휴면회원으로 바뀐 계정이라 로그인할 수 없습니다. 다시 이용하려면 help@example.com으로 문의해 주세요.";
export const WITHDRAWN_LOGIN_MESSAGE = "탈퇴한 계정이라 로그인할 수 없습니다.";
