// 화면과 서버가 함께 쓰는 관리 권한 범위 목록이다. 브라우저에 포함돼도 된다.
export const ADMIN_SCOPES = [
  { id: "products", label: "상품 관리", href: "/admin/products" },
  { id: "members", label: "회원 관리", href: "/admin/members" },
  { id: "requests", label: "요청 관리", href: "/admin/requests" },
] as const;

export type AdminScope = (typeof ADMIN_SCOPES)[number]["id"];

export const ALL_ADMIN_SCOPES: AdminScope[] = ADMIN_SCOPES.map(({ id }) => id);

export function isAdminScope(value: unknown): value is AdminScope {
  return ALL_ADMIN_SCOPES.includes(value as AdminScope);
}
