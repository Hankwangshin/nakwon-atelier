// 시스템관리자에게만 보여 주는 관리 메뉴. 브라우저에 포함돼도 된다.
// 메뉴를 쓸 수 있는지는 서버가 시스템관리자인지로 다시 확인한다.
export const ADMIN_MENUS = [
  { label: "상품 관리", href: "/admin/products" },
  { label: "회원 관리", href: "/admin/members" },
  { label: "요청 관리", href: "/admin/requests" },
] as const;
