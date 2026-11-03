"use client";

import { useState } from "react";
import type { Tier } from "@/components/TierManager";
import { MAX_ADDRESS_LENGTH } from "@/lib/limits";
import { MIN_PASSWORD_LENGTH } from "@/lib/member-input";
import { CHANGEABLE_ROLES, roleLabel, roleOf } from "@/lib/member-status";
import type { MemberRole, MemberStatus } from "@/lib/member-status";

export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  shippingAddress: string;
  isAdmin: boolean;
  status: MemberStatus;
  withdrawnAt: string | null;
  isSelf: boolean;
  tierId: string | null;
  joinedAt: string;
}

export interface MemberChanges {
  name: string;
  phone: string;
  address: string;
  shippingAddress: string;
  role: MemberRole;
  tierId: string;
  // 비워 두면 비밀번호는 바꾸지 않는다.
  password: string;
  passwordConfirm: string;
}

interface MemberDetailProps {
  member: Member;
  tierId: string;
  tiers: Tier[];
  isSaving: boolean;
  // 저장 결과 안내. 저장 버튼 가까이에 보여 준다.
  notice: React.ReactNode;
  // 수정 중인지 부모에게 알려, 다른 행을 고를 때 확인을 받게 한다.
  onEditingChange: (isEditing: boolean) => void;
  onSave: (changes: MemberChanges) => void;
  onWithdraw: () => void;
}

const INPUT_CLASS =
  "rounded-lg border border-zinc-300 bg-transparent px-2 py-1 disabled:opacity-60 dark:border-zinc-700";
const BUTTON_CLASS =
  "rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";

export function formatJoinedAt(joinedAt: string) {
  return new Date(joinedAt).toLocaleDateString("ko-KR");
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 ${wide ? "sm:col-span-2 xl:col-span-3" : ""}`}>
      <dt className="text-zinc-600 dark:text-zinc-400">{label}</dt>
      <dd className="break-all">{value || "-"}</dd>
    </div>
  );
}

// 표에서 고른 회원의 상세 정보. 처음에는 값만 보여 주고, 수정 버튼을 누르면
// 입력칸이 열린다. 부모가 회원이 바뀌거나 저장될 때 key를 바꿔 처음 상태로 되돌린다.
export default function MemberDetail({
  member,
  tierId,
  tiers,
  isSaving,
  notice,
  onEditingChange,
  onSave,
  onWithdraw,
}: MemberDetailProps) {
  const saved: MemberChanges = {
    name: member.name,
    phone: member.phone,
    address: member.address,
    shippingAddress: member.shippingAddress,
    role: roleOf(member),
    tierId,
    password: "",
    passwordConfirm: "",
  };
  const [form, setForm] = useState<MemberChanges>(saved);
  const [isEditing, setIsEditing] = useState(false);
  const role = roleOf(member);
  const isWithdrawn = member.status === "withdrawn";
  // 본인과 탈퇴회원은 서버에서도 막으므로 화면에서도 고칠 수 없게 둔다.
  const isLocked = member.isSelf || isWithdrawn;
  const lockReason = isWithdrawn
    ? "탈퇴한 회원은 이메일과 탈퇴 날짜만 남아 있으며 바꿀 수 없습니다."
    : "본인 계정은 여기서 바꿀 수 없습니다. 이름, 연락처, 비밀번호는 내 정보 메뉴에서 고칠 수 있습니다.";
  const isPasswordMismatch = form.password !== form.passwordConfirm;

  // 등급은 일반회원에게만 있다.
  const tierLabel = (id: string) => {
    if (role !== "active") {
      return "-";
    }
    const tier = tiers.find((item) => item.id === id);
    return tier ? `${tier.name} (${tier.discountPercent}%)` : "-";
  };

  function changeEditing(next: boolean) {
    setIsEditing(next);
    onEditingChange(next);
  }

  function handleCancel() {
    setForm(saved);
    changeEditing(false);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPasswordMismatch) {
      return;
    }
    onSave(form);
  }

  return (
    <section
      aria-labelledby="member-detail-title"
      className="mt-4 rounded-xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/80"
    >
      <h2 id="member-detail-title" className="font-semibold">
        회원 상세 정보 · {member.name || member.email}
        {isEditing && <span className="ml-2 text-xs text-orange-600 dark:text-orange-400">수정 중</span>}
      </h2>
      {isLocked && <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{lockReason}</p>}

      {!isEditing ? (
        <>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="아이디 (로그인 이메일)" value={member.email} />
            <Field label="가입일" value={formatJoinedAt(member.joinedAt)} />
            <Field label="회원 구분" value={roleLabel(role)} />
            {member.withdrawnAt && (
              <Field label="탈퇴일" value={formatJoinedAt(member.withdrawnAt)} />
            )}
            <Field label="성명" value={member.name} />
            <Field label="휴대폰" value={member.phone} />
            <Field label="등급" value={tierLabel(tierId)} />
            <Field label="주소지" value={member.address} wide />
            <Field label="배송지" value={member.shippingAddress} wide />
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => changeEditing(true)}
              disabled={isLocked}
              className={BUTTON_CLASS}
            >
              수정
            </button>
            {/* 시스템관리자는 먼저 다른 구분으로 바꿔야 탈퇴 처리할 수 있다. */}
            {!isLocked && !member.isAdmin && (
              <button
                type="button"
                onClick={onWithdraw}
                className="text-red-600 underline dark:text-red-400"
              >
                탈퇴 처리
              </button>
            )}
          </div>
          {notice}
        </>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3">
          <fieldset disabled={isSaving} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                autoFocus
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
              회원 구분
              <select
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value as MemberRole })}
                className={INPUT_CLASS}
              >
                {CHANGEABLE_ROLES.map((item) => (
                  <option key={item} value={item}>
                    {roleLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              {form.role === "active" ? "등급" : "등급 (일반회원만 지정)"}
              <select
                value={form.tierId}
                disabled={form.role !== "active"}
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
            <fieldset className="grid gap-3 rounded-lg border border-zinc-200 p-3 sm:col-span-2 sm:grid-cols-2 xl:col-span-3 dark:border-zinc-700">
              <legend className="px-1">비밀번호 바꾸기 (바꾸지 않으려면 비워 두세요)</legend>
              <p className="text-xs text-zinc-600 sm:col-span-2 dark:text-zinc-400">
                기존 비밀번호는 볼 수 없습니다. 바꾸면 이 회원의 기존 로그인이 모두 끊기니 새
                비밀번호를 회원에게 따로 알려 주세요.
              </p>
              <label className="flex flex-col gap-1">
                새 비밀번호 ({MIN_PASSWORD_LENGTH}자 이상)
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  className={INPUT_CLASS}
                />
              </label>
              <label className="flex flex-col gap-1">
                새 비밀번호 확인
                <input
                  type="password"
                  autoComplete="new-password"
                  required={form.password !== ""}
                  value={form.passwordConfirm}
                  onChange={(event) => setForm({ ...form, passwordConfirm: event.target.value })}
                  className={INPUT_CLASS}
                />
              </label>
              {isPasswordMismatch && form.passwordConfirm !== "" && (
                <p role="alert" className="text-xs text-red-600 sm:col-span-2 dark:text-red-400">
                  새 비밀번호와 확인 값이 같지 않습니다.
                </p>
              )}
            </fieldset>
          </fieldset>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={isSaving} className={BUTTON_CLASS}>
              {isSaving ? "저장하는 중" : "저장"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="underline disabled:opacity-50"
            >
              취소
            </button>
          </div>
          {notice}
        </form>
      )}
    </section>
  );
}
