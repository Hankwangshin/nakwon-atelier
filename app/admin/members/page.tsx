"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import MemberCreateForm from "@/components/MemberCreateForm";
import MemberDetail, { formatJoinedAt } from "@/components/MemberDetail";
import type { Member, MemberChanges } from "@/components/MemberDetail";
import TierManager from "@/components/TierManager";
import type { Tier } from "@/components/TierManager";
import { ADMIN_SCOPES } from "@/lib/admin-scopes";
import { callApi } from "@/lib/client-api";
import type { ApiResult } from "@/lib/client-api";
import { MAX_MEMBER_SEARCH_LENGTH } from "@/lib/limits";
import { MEMBER_SEARCH_FIELDS } from "@/lib/member-search";
import type { MemberSearchField } from "@/lib/member-search";

interface Search {
  field: MemberSearchField;
  query: string;
}

const EMPTY_SEARCH: Search = { field: "all", query: "" };

const INPUT_CLASS =
  "rounded-lg border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700";

function membersUrl({ field, query }: Search) {
  const params = new URLSearchParams({ field, q: query.trim() });
  return `/api/admin/members?${params}`;
}

export default function AdminMembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  // 입력 중인 검색 조건과 실제로 조회한 검색 조건을 따로 둔다.
  const [draft, setDraft] = useState<Search>(EMPTY_SEARCH);
  const [search, setSearch] = useState<Search>(EMPTY_SEARCH);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 저장할 때마다 늘려 상세 입력칸을 저장된 값으로 다시 채운다.
  const [savedCount, setSavedCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const showMembers = useCallback(
    (result: ApiResult<{ members: Member[] }>) => {
      if (result.status === 401 || result.status === 403) {
        router.replace("/");
        return;
      }
      setError(result.ok ? "" : result.errorMessage);
      if (result.ok) {
        setMembers(result.data?.members ?? []);
      } else {
        setMembers((current) => current ?? []);
      }
    },
    [router],
  );

  const loadMembers = useCallback(
    async (target: Search) => {
      showMembers(await callApi<{ members: Member[] }>(membersUrl(target)));
    },
    [showMembers],
  );

  const loadTiers = useCallback(async () => {
    const result = await callApi<{ tiers: Tier[] }>("/api/admin/tiers");
    setTiers(result.data?.tiers ?? []);
  }, []);

  useEffect(() => {
    callApi<{ members: Member[] }>(membersUrl(EMPTY_SEARCH)).then(showMembers);
    callApi<{ tiers: Tier[] }>("/api/admin/tiers").then((result) => {
      setTiers(result.data?.tiers ?? []);
    });
  }, [showMembers]);

  // 등급을 지정받지 않은 회원은 기본 등급으로 보여 준다.
  const tierIdOf = (member: Member) =>
    member.tierId ?? tiers.find(({ isDefault }) => isDefault)?.id ?? "";
  const tierNameOf = (member: Member) =>
    tiers.find(({ id }) => id === tierIdOf(member))?.name ?? "-";
  const scopesOf = (member: Member) =>
    member.isAdmin
      ? "전체"
      : ADMIN_SCOPES.filter(({ id }) => member.adminScopes.includes(id))
          .map(({ label }) => label)
          .join(", ") || "-";

  const selected = members?.find(({ id }) => id === selectedId) ?? null;

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSearch(draft);
    await loadMembers(draft);
  }

  async function handleReset() {
    setMessage("");
    setDraft(EMPTY_SEARCH);
    setSearch(EMPTY_SEARCH);
    await loadMembers(EMPTY_SEARCH);
  }

  function selectMember(member: Member) {
    setSelectedId(member.id);
    setMessage("");
    setError("");
  }

  // Enter나 스페이스로 고르고, 위·아래 화살표로 다음 행으로 옮겨 간다.
  function handleRowKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>, member: Member) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectMember(member);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const row = event.currentTarget;
      const next = event.key === "ArrowDown" ? row.nextElementSibling : row.previousElementSibling;
      (next as HTMLElement | null)?.focus();
    }
  }

  async function handleSave(member: Member, changes: MemberChanges) {
    setMessage("");
    setIsSaving(true);
    const result = await callApi(`/api/admin/members/${member.id}`, "PATCH", changes);
    setIsSaving(false);
    if (!result.ok) {
      setError(result.errorMessage);
      return;
    }
    setError("");
    await loadMembers(search);
    setSavedCount((count) => count + 1);
    setMessage(`${changes.name.trim()} 회원의 정보를 저장했습니다.`);
  }

  // 새 회원이 바로 보이도록 검색을 풀고 다시 불러온 뒤 그 회원을 고른다.
  async function handleCreated(id: string, name: string) {
    setIsCreating(false);
    setDraft(EMPTY_SEARCH);
    setSearch(EMPTY_SEARCH);
    await loadMembers(EMPTY_SEARCH);
    setSelectedId(id);
    setSavedCount((count) => count + 1);
    setMessage(`${name} 회원을 등록했습니다.`);
    // 화면이 그려진 뒤 아래 상세 정보가 보이게 내린다.
    requestAnimationFrame(() => {
      document.getElementById("member-detail-title")?.scrollIntoView({ block: "start" });
    });
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
    setSelectedId(null);
    setMessage("탈퇴 처리했습니다.");
    await loadMembers(search);
  }

  if (!members) {
    return <main className="px-4 py-6 text-sm">권한을 확인하는 중</main>;
  }

  const isSearching = search.query.trim() !== "";
  // 회원을 골랐으면 상세 정보 안에, 아니면 표 위에 안내를 보여 준다.
  const notice = (
    <>
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
    </>
  );

  return (
    <main className="mx-auto w-full page-wide px-4 py-6 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">회원 관리</h1>
        {!isCreating && (
          <button
            type="button"
            onClick={() => {
              setIsCreating(true);
              setMessage("");
            }}
            className="rounded-lg bg-zinc-900 px-4 py-1.5 text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            회원 추가
          </button>
        )}
      </div>

      {isCreating && (
        <MemberCreateForm onCreated={handleCreated} onCancel={() => setIsCreating(false)} />
      )}

      <TierManager tiers={tiers} onChanged={loadTiers} />

      <form
        role="search"
        onSubmit={handleSearch}
        className="mt-4 flex flex-wrap items-end gap-2"
      >
        <label className="flex flex-col gap-1">
          검색 조건
          <select
            value={draft.field}
            onChange={(event) =>
              setDraft({ ...draft, field: event.target.value as MemberSearchField })
            }
            className={INPUT_CLASS}
          >
            {MEMBER_SEARCH_FIELDS.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1 sm:max-w-sm">
          검색어
          <input
            type="search"
            maxLength={MAX_MEMBER_SEARCH_LENGTH}
            value={draft.query}
            onChange={(event) => setDraft({ ...draft, query: event.target.value })}
            placeholder="아이디(이메일)나 성명"
            className={INPUT_CLASS}
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-1.5 text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          검색
        </button>
        {isSearching && (
          <button type="button" onClick={handleReset} className="px-2 py-1.5 underline">
            전체 보기
          </button>
        )}
      </form>

      <p className="mt-3 text-zinc-600 dark:text-zinc-400" aria-live="polite">
        {isSearching ? `검색 결과 ${members.length}명` : `회원 ${members.length}명`}
        {members.length > 0 && " · 행을 누르면 아래에 상세 정보가 나옵니다."}
      </p>

      {!selected && notice}

      {/* 휴대폰처럼 좁은 화면에서는 표만 가로로 밀어서 본다. */}
      <div className="mt-3 max-h-[28rem] overflow-auto rounded-xl border border-zinc-200 bg-white/80 dark:border-zinc-700 dark:bg-zinc-900/80">
        <table className="w-full min-w-[44rem] border-collapse text-left">
          <caption className="sr-only">회원 목록. 행을 고르면 아래에 상세 정보가 나옵니다.</caption>
          <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800">
            <tr>
              {["아이디", "성명", "휴대폰", "등급", "관리 권한", "가입일"].map((title) => (
                <th key={title} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-600 dark:text-zinc-400">
                  {isSearching ? "검색어에 맞는 회원이 없습니다." : "회원이 없습니다."}
                </td>
              </tr>
            )}
            {members.map((member) => {
              const isSelected = member.id === selectedId;
              return (
                <tr
                  key={member.id}
                  tabIndex={0}
                  aria-current={isSelected ? "true" : undefined}
                  onClick={() => selectMember(member)}
                  onKeyDown={(event) => handleRowKeyDown(event, member)}
                  className={`cursor-pointer border-t border-zinc-200 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:border-zinc-700 ${
                    isSelected
                      ? "bg-blue-100 font-medium dark:bg-blue-900/60"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <td className="px-3 py-2 break-all">{member.email}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {member.name}
                    {member.isSelf && <span className="ml-1 text-xs text-zinc-500">(나)</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{member.phone}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{tierNameOf(member)}</td>
                  <td className="px-3 py-2">{scopesOf(member)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatJoinedAt(member.joinedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected ? (
        <MemberDetail
          key={`${selected.id}-${savedCount}`}
          member={selected}
          tierId={tierIdOf(selected)}
          tiers={tiers}
          isSaving={isSaving}
          notice={notice}
          onSave={(changes) => handleSave(selected, changes)}
          onWithdraw={() => handleWithdraw(selected)}
        />
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-white/60 p-4 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
          {selectedId
            ? "고른 회원이 지금 목록에 없습니다. 다른 회원을 골라 주세요."
            : "표에서 회원을 고르면 여기에 상세 정보가 나옵니다."}
        </p>
      )}
    </main>
  );
}
