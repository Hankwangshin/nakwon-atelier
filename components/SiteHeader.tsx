"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ADMIN_SCOPES } from "@/lib/admin-scopes";
import type { AdminScope } from "@/lib/admin-scopes";
import { callApi, LOGOUT_EVENT } from "@/lib/client-api";

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
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminScopes, setAdminScopes] = useState<AdminScope[]>([]);

  // 페이지를 옮길 때마다 로그인 상태를 다시 확인한다.
  useEffect(() => {
    callApi<Me>("/api/auth/me").then(({ data }) => {
      setIsLoggedIn(Boolean(data?.user));
      setAdminScopes(data?.user?.adminScopes ?? []);
    });
  }, [pathname]);

  async function handleLogout() {
    await callApi("/api/auth/logout", "POST");
    setIsLoggedIn(false);
    setAdminScopes([]);
    // 메인 페이지에서는 주소가 그대로라, 로그인 칸에 따로 알려 준다.
    window.dispatchEvent(new Event(LOGOUT_EVENT));
    router.push("/");
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
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
            className={
              pathname === href
                ? "font-medium text-blue-600 dark:text-blue-400"
                : "text-zinc-600 dark:text-zinc-400"
            }
          >
            {label}
          </Link>
        ))}
        <span className="ml-auto flex gap-3">
          {isLoggedIn ? (
            <>
              {ADMIN_SCOPES.filter(({ id }) => adminScopes.includes(id)).map(({ href, label }) => (
                <Link key={href} href={href} className="text-zinc-600 dark:text-zinc-400">
                  {label}
                </Link>
              ))}
              <Link href="/account" className="text-zinc-600 dark:text-zinc-400">
                내 정보
              </Link>
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
              <Link href="/login" className="text-zinc-600 dark:text-zinc-400">
                로그인
              </Link>
              <Link href="/signup" className="text-zinc-600 dark:text-zinc-400">
                회원가입
              </Link>
            </>
          )}
        </span>
      </nav>
    </header>
  );
}
