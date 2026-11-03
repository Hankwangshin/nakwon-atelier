"use client";

import { useState } from "react";
import AddressFields from "@/components/AddressFields";
import TextField from "@/components/TextField";
import { callApi } from "@/lib/client-api";
import { MIN_PASSWORD_LENGTH } from "@/lib/member-input";

interface MemberCreateFormProps {
  onCreated: (id: string, name: string) => Promise<void>;
  onCancel: () => void;
}

// 관리자가 회원을 대신 등록하는 칸. 서버가 회원가입과 같은 기준으로 다시 검사한다.
export default function MemberCreateForm({ onCreated, onCancel }: MemberCreateFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [isSameAsAddress, setIsSameAsAddress] = useState(true);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    const result = await callApi<{ id: string }>("/api/admin/members", "POST", {
      email,
      password,
      name,
      phone,
      address,
      shippingAddress: isSameAsAddress ? address : shippingAddress,
      consentConfirmed,
    });
    setIsSaving(false);
    if (!result.ok || !result.data) {
      setError(result.errorMessage);
      return;
    }
    await onCreated(result.data.id, name.trim());
  }

  return (
    <section
      aria-labelledby="member-create-title"
      className="mt-4 rounded-xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/80"
    >
      <h2 id="member-create-title" className="font-semibold">
        회원 추가
      </h2>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        새 회원은 기본 등급이고 관리 권한이 없습니다. 첫 비밀번호는 회원에게 따로 알려 주세요.
        저장한 뒤에는 다시 볼 수 없습니다.
      </p>
      <form onSubmit={handleSubmit} className="mt-3">
        <fieldset disabled={isSaving} className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">새 회원 정보</legend>
          <TextField label="아이디 (로그인 이메일)" type="email" value={email} onChange={setEmail} autoComplete="off" />
          <TextField
            label={`첫 비밀번호 (${MIN_PASSWORD_LENGTH}자 이상)`}
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <TextField label="성명" value={name} onChange={setName} autoComplete="off" />
          <TextField label="휴대폰 번호" type="tel" value={phone} onChange={setPhone} autoComplete="off" placeholder="010-0000-0000" />
          <div className="flex flex-col gap-3 sm:col-span-2">
            <AddressFields
              address={address}
              onAddressChange={setAddress}
              shippingAddress={shippingAddress}
              onShippingAddressChange={setShippingAddress}
              isSameAsAddress={isSameAsAddress}
              onSameAsAddressChange={setIsSameAsAddress}
            />
          </div>
          <label className="flex items-start gap-2 rounded-lg border border-zinc-200 p-3 sm:col-span-2 dark:border-zinc-700">
            <input
              type="checkbox"
              required
              checked={consentConfirmed}
              onChange={(event) => setConsentConfirmed(event.target.checked)}
              className="mt-1"
            />
            회원 본인에게 만 14세 이상임을 확인하고, 이용약관과 개인정보 수집·이용 동의를 받았습니다. (필수)
          </label>
        </fieldset>

        {error && (
          <p role="alert" className="mt-3 text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {isSaving ? "등록하는 중" : "회원 등록"}
          </button>
          <button type="button" onClick={onCancel} disabled={isSaving} className="underline disabled:opacity-50">
            닫기
          </button>
        </div>
      </form>
    </section>
  );
}
