"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { callApi } from "@/lib/client-api";
import type { ApiResult } from "@/lib/client-api";

interface Member {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  joinedAt: string;
}

export default function AdminMembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const showMembers = useCallback(
    (result: ApiResult<{ members: Member[] }>) => {
      if (result.status === 401 || result.status === 403) {
        router.replace("/");
        return;
      }
      setMembers(result.data?.members ?? []);
      setError(result.ok ? "" : result.errorMessage);
    },
    [router],
  );

  useEffect(() => {
    callApi<{ members: Member[] }>("/api/admin/members").then(showMembers);
  }, [showMembers]);

  async function handleWithdraw(member: Member) {
    const isConfirmed = window.confirm(
      `${member.name}(${member.email}) 회원을 탈퇴 처리할까요? 회원 정보와 장바구니가 삭제되고 되돌릴 수 없습니다. 주문 기록은 법에 따라 보관됩니다.`,
    );
    if (!isConfirmed) {
      return;
    }

    setMessage("");
    const result = await callApi(`/api/admin/members/${member.id}`, "DELETE");
    if (!result.ok) {
      setError(result.errorMessage);
      return;
    }
    setError("");
    setMessage("탈퇴 처리했습니다.");
    showMembers(await callApi<{ members: Member[] }>("/api/admin/members"));
  }

  if (!members) {
    return <main className="px-4 py-6 text-sm">권한을 확인하는 중</main>;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 text-sm">
      <h1 className="text-xl font-semibold">회원 관리</h1>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">회원 {members.length}명</p>

      {error && (
        <p role="alert" className="mt-3 text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-green-700 dark:text-green-400">
          {message}
        </p>
      )}

      <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-700">
        {members.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center gap-3 py-2">
            <div className="min-w-48 flex-1">
              <p className="font-medium">
                {member.name}
                {member.isAdmin && (
                  <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">관리자</span>
                )}
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {member.email} · {new Date(member.joinedAt).toLocaleDateString("ko-KR")} 가입
              </p>
            </div>
            {!member.isAdmin && (
              <button
                type="button"
                onClick={() => handleWithdraw(member)}
                className="text-red-600 underline dark:text-red-400"
              >
                탈퇴 처리
              </button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
