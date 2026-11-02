"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { callApi } from "@/lib/client-api";

interface Me {
  user: { email?: string; name?: string; phone?: string } | null;
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<Me["user"]>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    callApi<Me>("/api/auth/me").then(({ data }) => {
      if (!data?.user) {
        router.replace("/login");
        return;
      }
      setUser(data.user);
    });
  }, [router]);

  async function handleWithdraw() {
    const isConfirmed = window.confirm(
      "탈퇴하면 회원 정보와 장바구니가 삭제됩니다. 주문 기록은 법에 따라 보관됩니다. 탈퇴할까요?",
    );
    if (!isConfirmed) {
      return;
    }

    const result = await callApi("/api/auth/me", "DELETE");
    if (result.ok) {
      router.push("/");
    } else {
      setError(result.errorMessage);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6 text-sm">
      <h1 className="text-xl font-semibold">내 정보</h1>
      {user && (
        <dl className="mt-4 grid grid-cols-[6rem_1fr] gap-1">
          <dt className="text-zinc-600 dark:text-zinc-400">이메일</dt>
          <dd>{user.email}</dd>
          <dt className="text-zinc-600 dark:text-zinc-400">이름</dt>
          <dd>{user.name}</dd>
          <dt className="text-zinc-600 dark:text-zinc-400">휴대폰 번호</dt>
          <dd>{user.phone}</dd>
        </dl>
      )}
      <p className="mt-6 text-zinc-600 dark:text-zinc-400">
        개인정보 열람, 정정, 삭제, 처리 정지 요청은 help@example.com으로 문의해 주세요.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleWithdraw}
        className="mt-6 rounded-lg border border-red-600 px-3 py-1 text-red-600 dark:border-red-400 dark:text-red-400"
      >
        회원 탈퇴
      </button>
    </main>
  );
}
