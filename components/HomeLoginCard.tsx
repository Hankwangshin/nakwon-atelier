"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import LoginForm from "@/components/LoginForm";
import { callApi, LOGOUT_EVENT } from "@/lib/client-api";

interface Me {
  user: { name?: string } | null;
}

// 로그인 전에는 입력 칸을, 로그인 뒤에는 인사와 바로가기를 보여 준다.
export default function HomeLoginCard() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    callApi<Me>("/api/auth/me").then(({ data }) => {
      setMe(data ?? { user: null });
    });

    function handleLogout() {
      setMe({ user: null });
    }
    window.addEventListener(LOGOUT_EVENT, handleLogout);
    return () => window.removeEventListener(LOGOUT_EVENT, handleLogout);
  }, []);

  return (
    <section
      aria-label="로그인"
      className="min-h-80 rounded-3xl border border-stone-200 p-5 dark:border-stone-700"
    >
      {me?.user && (
        <>
          <h2 className="text-lg font-semibold">
            {me.user.name ? `${me.user.name}님, 반가워요` : "반가워요"}
          </h2>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <Link href="/orders" className="underline">주문 내역</Link>
            <Link href="/account" className="underline">내 정보</Link>
          </div>
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
