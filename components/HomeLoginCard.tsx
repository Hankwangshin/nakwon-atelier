"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import LoginForm from "@/components/LoginForm";
import { callApi, logout } from "@/lib/client-api";

interface Me {
  user: { name?: string; email?: string } | null;
}

const SHORTCUTS = [
  { href: "/cart", label: "장바구니" },
  { href: "/orders", label: "주문 내역" },
  { href: "/account", label: "내 정보" },
];

// 로그인 전에는 입력 칸을, 로그인 뒤에는 누구로 로그인했는지와 바로가기, 로그아웃 버튼을 보여 준다.
export default function HomeLoginCard() {
  const [me, setMe] = useState<Me | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    // 숨겨졌다 다시 보일 때마다 다시 확인해, 다른 화면에서 로그인했어도 맞게 보인다.
    callApi<Me>("/api/auth/me").then(({ data }) => {
      setMe(data ?? { user: null });
    });
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);
    await logout();
  }

  return (
    <section
      aria-label="로그인"
      className="flex min-h-80 flex-col rounded-3xl border border-stone-200 p-5 dark:border-stone-700"
    >
      {!me && <p className="text-sm text-stone-500 dark:text-stone-400">로그인 상태를 확인하는 중</p>}
      {me?.user && (
        <>
          <h2 className="text-lg font-semibold">로그인됨</h2>
          <p className="mt-3 text-base">
            {me.user.name ? `${me.user.name}님, 반가워요` : "반가워요"}
          </p>
          {me.user.email && (
            <p className="mt-1 break-all text-sm text-stone-500 dark:text-stone-400">{me.user.email}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {SHORTCUTS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="whitespace-nowrap rounded-lg border border-stone-300 px-3 py-2 text-center dark:border-stone-700"
              >
                {label}
              </Link>
            ))}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="mt-auto rounded-lg border border-stone-900 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-stone-200"
          >
            로그아웃
          </button>
        </>
      )}
      {me && !me.user && (
        <>
          <h2 className="text-lg font-semibold">로그인</h2>
          <LoginForm />
        </>
      )}
    </section>
  );
}
