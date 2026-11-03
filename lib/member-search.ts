import { MAX_MEMBER_SEARCH_LENGTH } from "@/lib/limits";
import { isMemberRole } from "@/lib/member-status";

// 회원 관리 검색 조건. 화면과 서버가 같은 목록을 쓴다. 아이디는 로그인 이메일이다.
export const MEMBER_SEARCH_FIELDS = [
  { id: "all", label: "전체" },
  { id: "email", label: "아이디" },
  { id: "name", label: "성명" },
] as const;

export type MemberSearchField = (typeof MEMBER_SEARCH_FIELDS)[number]["id"];

export function isMemberSearchField(value: unknown): value is MemberSearchField {
  return MEMBER_SEARCH_FIELDS.some(({ id }) => id === value);
}

export function findSearchProblem(field: unknown, query: string, role: unknown): string | null {
  if (!isMemberSearchField(field)) {
    return "검색 조건을 확인해 주세요.";
  }
  if (role !== "all" && !isMemberRole(role)) {
    return "회원 구분을 확인해 주세요.";
  }
  if (query.length > MAX_MEMBER_SEARCH_LENGTH) {
    return `검색어는 ${MAX_MEMBER_SEARCH_LENGTH}자 이하로 입력해 주세요.`;
  }
  return null;
}

// 대소문자와 앞뒤 공백을 무시하고 검색어가 들어 있는지 본다.
export function matchesMemberSearch(
  member: { email: string; name: string },
  field: MemberSearchField,
  query: string,
): boolean {
  const keyword = query.trim().toLowerCase();
  if (keyword === "") {
    return true;
  }
  const inEmail = member.email.toLowerCase().includes(keyword);
  const inName = member.name.toLowerCase().includes(keyword);
  if (field === "email") {
    return inEmail;
  }
  if (field === "name") {
    return inName;
  }
  return inEmail || inName;
}
