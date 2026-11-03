"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import TierManager from "@/components/TierManager";
import type { Tier } from "@/components/TierManager";
import { ADMIN_SCOPES } from "@/lib/admin-scopes";
import type { AdminScope } from "@/lib/admin-scopes";
import { callApi } from "@/lib/client-api";
import type { ApiResult } from "@/lib/client-api";

interface Member {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isSelf: boolean;
  tierId: string | null;
  adminScopes: AdminScope[];
  joinedAt: string;
}

export default function AdminMembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
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

  const loadMembers = useCallback(async () => {
    showMembers(await callApi<{ members: Member[] }>("/api/admin/members"));
  }, [showMembers]);

  const loadTiers = useCallback(async () => {
    const result = await callApi<{ tiers: Tier[] }>("/api/admin/tiers");
    setTiers(result.data?.tiers ?? []);
  }, []);

  useEffect(() => {
    callApi<{ members: Member[] }>("/api/admin/members").then(showMembers);
    callApi<{ tiers: Tier[] }>("/api/admin/tiers").then((result) => {
      setTiers(result.data?.tiers ?? []);
    });
  }, [showMembers]);

  // 등급을 지정받지 않은 회원은 기본 등급으로 보여 준다.
  const tierIdOf = (member: Member) =>
    member.tierId ?? tiers.find(({ isDefault }) => isDefault)?.id ?? "";

  async function updateMember(
    member: Member,
    changes: { tierId?: string; adminScopes?: AdminScope[] },
  ) {
    setMessage("");
    const result = await callApi(`/api/admin/members/${member.id}`, "PATCH", {
      tierId: tierIdOf(member),
      adminScopes: member.adminScopes,
      ...changes,
    });
    if (!result.ok) {
      setError(result.errorMessage);
      return;
    }
    await loadMembers();
    setMessage(`${member.name} 회원의 정보를 바꿨습니다.`);
  }

  function toggleScope(member: Member, scope: AdminScope) {
    const adminScopes = member.adminScopes.includes(scope)
      ? member.adminScopes.filter((item) => item !== scope)
      : [...member.adminScopes, scope];
    updateMember(member, { adminScopes });
  }

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
    await loadMembers();
  }

  if (!members) {
    return <main className="px-4 py-6 text-sm">권한을 확인하는 중</main>;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 text-sm">
      <h1 className="text-xl font-semibold">회원 관리</h1>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">회원 {members.length}명</p>

      <TierManager tiers={tiers} onChanged={loadTiers} />

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
        {members.map((member) => {
          const isLocked = member.isAdmin || member.isSelf;
          return (
            <li key={member.id} className="flex flex-col gap-2 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-48 flex-1">
                  <p className="font-medium">
                    {member.name}
                    {member.isAdmin && (
                      <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">전체 관리자</span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    {member.email} · {new Date(member.joinedAt).toLocaleDateString("ko-KR")} 가입
                  </p>
                </div>
                <label className="flex items-center gap-1">
                  등급
                  <select
                    value={tierIdOf(member)}
                    disabled={isLocked}
                    onChange={(event) => updateMember(member, { tierId: event.target.value })}
                    className="rounded-lg border border-zinc-300 bg-transparent px-2 py-1 disabled:opacity-50 dark:border-zinc-700"
                  >
                    {tiers.map(({ id, name, discountPercent }) => (
                      <option key={id} value={id}>
                        {name} ({discountPercent}%)
                      </option>
                    ))}
                  </select>
                </label>
                {!member.isAdmin && !member.isSelf && (
                  <button
                    type="button"
                    onClick={() => handleWithdraw(member)}
                    className="text-red-600 underline dark:text-red-400"
                  >
                    탈퇴 처리
                  </button>
                )}
              </div>
              {member.isAdmin ? (
                <p className="text-xs text-zinc-600 dark:text-zinc-400">모든 관리 권한이 있습니다.</p>
              ) : (
                <fieldset className="flex flex-wrap gap-3 text-xs">
                  <legend className="sr-only">{member.name} 관리 권한</legend>
                  {ADMIN_SCOPES.map(({ id, label }) => (
                    <label key={id} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={member.adminScopes.includes(id)}
                        disabled={isLocked}
                        onChange={() => toggleScope(member, id)}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
