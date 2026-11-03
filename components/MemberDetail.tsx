"use client";

import { useState } from "react";
import type { Tier } from "@/components/TierManager";
import { ADMIN_SCOPES } from "@/lib/admin-scopes";
import type { AdminScope } from "@/lib/admin-scopes";
import { MAX_ADDRESS_LENGTH } from "@/lib/limits";

export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  shippingAddress: string;
  isAdmin: boolean;
  isSelf: boolean;
  tierId: string | null;
  adminScopes: AdminScope[];
  joinedAt: string;
}

export interface MemberChanges {
  name: string;
  phone: string;
  address: string;
  shippingAddress: string;
  tierId: string;
  adminScopes: AdminScope[];
}

interface MemberDetailProps {
  member: Member;
  tierId: string;
  tiers: Tier[];
  isSaving: boolean;
  // 저장 결과 안내. 저장 버튼 가까이에 보여 준다.
  notice: React.ReactNode;
  onSave: (changes: MemberChanges) => void;
  onWithdraw: () => void;
}

const INPUT_CLASS =
  "rounded-lg border border-zinc-300 bg-transparent px-2 py-1 disabled:opacity-60 dark:border-zinc-700";

export function formatJoinedAt(joinedAt: string) {
  return new Date(joinedAt).toLocaleDateString("ko-KR");
}

// 표에서 고른 회원의 상세 정보. 부모가 회원이 바뀌거나 저장될 때 key를 바꿔
// 입력칸을 새 값으로 다시 채운다.
export default function MemberDetail({
  member,
  tierId,
  tiers,
  isSaving,
  notice,
  onSave,
  onWithdraw,
}: MemberDetailProps) {
  const [form, setForm] = useState<MemberChanges>({
    name: member.name,
    phone: member.phone,
    address: member.address,
    shippingAddress: member.shippingAddress,
    tierId,
    adminScopes: member.adminScopes,
  });
  // 전체 관리자와 본인 계정은 서버에서도 막으므로 화면에서도 고칠 수 없게 둔다.
  const isLocked = member.isAdmin || member.isSelf;

  function toggleScope(scope: AdminScope) {
    setForm({
      ...form,
      adminScopes: form.adminScopes.includes(scope)
        ? form.adminScopes.filter((item) => item !== scope)
        : [...form.adminScopes, scope],
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <section
      aria-labelledby="member-detail-title"
      className="mt-4 rounded-xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/80"
    >
      <h2 id="member-detail-title" className="font-semibold">
        회원 상세 정보 · {member.name}
        {member.isAdmin && (
          <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">전체 관리자</span>
        )}
      </h2>
      {isLocked && (
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          {member.isAdmin
            ? "전체 관리자 계정은 바꿀 수 없습니다."
            : "본인 계정은 여기서 바꿀 수 없습니다. 이름과 연락처는 내 정보 메뉴에서 고칠 수 있습니다."}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-3">
        <fieldset disabled={isLocked || isSaving} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <legend className="sr-only">{member.name} 회원 정보 수정</legend>
          <p className="flex flex-col gap-1">
            <span>아이디 (로그인 이메일, 바꿀 수 없음)</span>
            <span className="break-all py-1">{member.email}</span>
          </p>
          <p className="flex flex-col gap-1">
            <span>가입일</span>
            <span className="py-1">{formatJoinedAt(member.joinedAt)}</span>
          </p>
          <label className="flex flex-col gap-1">
            성명
            <input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className={INPUT_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1">
            휴대폰 (예: 010-1234-5678)
            <input
              required
              type="tel"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              className={INPUT_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1">
            등급
            <select
              value={form.tierId}
              onChange={(event) => setForm({ ...form, tierId: event.target.value })}
              className={INPUT_CLASS}
            >
              {tiers.map(({ id, name, discountPercent }) => (
                <option key={id} value={id}>
                  {name} ({discountPercent}%)
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2 xl:col-span-3">
            주소지
            <input
              maxLength={MAX_ADDRESS_LENGTH}
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              className={INPUT_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2 xl:col-span-3">
            배송지
            <input
              maxLength={MAX_ADDRESS_LENGTH}
              value={form.shippingAddress}
              onChange={(event) => setForm({ ...form, shippingAddress: event.target.value })}
              className={INPUT_CLASS}
            />
          </label>
          {member.isAdmin ? (
            <p className="sm:col-span-2 xl:col-span-3">관리 권한: 모든 관리 권한이 있습니다.</p>
          ) : (
            <fieldset className="flex flex-wrap gap-3 sm:col-span-2 xl:col-span-3">
              <legend className="mb-1">관리 권한</legend>
              {ADMIN_SCOPES.map(({ id, label }) => (
                <label key={id} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={form.adminScopes.includes(id)}
                    onChange={() => toggleScope(id)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          )}
        </fieldset>

        {!isLocked && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {isSaving ? "저장하는 중" : "저장"}
            </button>
            <button
              type="button"
              onClick={onWithdraw}
              disabled={isSaving}
              className="text-red-600 underline disabled:opacity-50 dark:text-red-400"
            >
              탈퇴 처리
            </button>
          </div>
        )}
        {notice}
      </form>
    </section>
  );
}
