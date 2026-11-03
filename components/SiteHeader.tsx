"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ADMIN_SCOPES } from "@/lib/admin-scopes";
import type { AdminScope } from "@/lib/admin-scopes";
import NavLink from "@/components/NavLink";
import { callApi } from "@/lib/client-api";

const LINKS = [
  { href: "/products", label: "상품" },
  { href: "/cart", label: "장바구니" },
  { href: "/orders", label: "주문 내역" },
  { href: "/chat", label: "챗봇" },
];

interface Me {
  user: { name?: string; adminScopes?: AdminScope[] } | null;
}

export default function SiteHeader() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminScopes, setAdminScopes] = useState<AdminScope[]>([]);

  // 페이지를 옮길 때마다 로그인 상태를 다시 확인한다.
  // 빠르게 여러 번 옮기면 늦게 온 예전 답이 새 답을 덮지 않도록 마지막 확인만 반영한다.
  useEffect(() => {
    let isLatest = true;
    callApi<Me>("/api/auth/me").then(({ data }) => {
      if (!isLatest) {
        return;
      }
      setIsLoggedIn(Boolean(data?.user));
      setAdminScopes(data?.user?.adminScopes ?? []);
    });
    return () => {
      isLatest = false;
    };
  }, [pathname]);

  async function handleLogout() {
    await callApi("/api/auth/logout", "POST");
    // 이 Next.js는 떠난 화면을 숨겨 두고 다시 보여 주므로, 페이지를 새로 불러
    // 앞 사람의 장바구니·입력값 같은 화면 내용이 남지 않게 모두 비운다.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- 일부러 새로 불러온다(Next 문서 권장 방식)
    window.location.href = "/";
  }

  return (
    <header className="shrink-0 border-b border-zinc-200 dark:border-zinc-800">
      <p className="bg-amber-100 px-4 py-1 text-center text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        실습용 샘플 쇼핑몰입니다. 실제 개인정보를 입력하지 마세요. 결제는 테스트로만 진행됩니다.
      </p>
      <nav className="mx-auto flex page-wide flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm">
        <Link href="/" className="font-semibold">
          낙원 아뜰리에
        </Link>
        {LINKS.map(({ href, label }) => (
          <NavLink key={href} href={href}>
            {label}
          </NavLink>
        ))}
        <span className="ml-auto flex gap-3">
          {isLoggedIn ? (
            <>
              {ADMIN_SCOPES.filter(({ id }) => adminScopes.includes(id)).map(({ href, label }) => (
                <NavLink key={href} href={href}>
                  {label}
                </NavLink>
              ))}
              <NavLink href="/account">내 정보</NavLink>
              <button
                type="button"
                onClick={handleLogout}
                className="text-zinc-600 dark:text-zinc-400"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <NavLink href="/login">로그인</NavLink>
              <NavLink href="/signup">회원가입</NavLink>
            </>
          )}
        </span>
      </nav>
    </header>
  );
}
