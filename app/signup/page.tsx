"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import TextField from "@/components/TextField";
import { callApi } from "@/lib/client-api";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isOver14, setIsOver14] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  const canSubmit = isOver14 && agreeTerms && agreePrivacy && !isSending;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSending(true);

    const result = await callApi("/api/auth/signup", "POST", {
      email,
      password,
      name,
      phone,
      isOver14,
      agreeTerms,
      agreePrivacy,
    });
    setIsSending(false);

    if (result.ok) {
      router.push("/products");
    } else {
      setError(result.errorMessage);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="text-xl font-semibold">회원가입</h1>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <TextField label="이메일" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <TextField label="비밀번호 (8자 이상)" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
        <TextField label="이름" value={name} onChange={setName} autoComplete="name" />
        <TextField label="휴대폰 번호" type="tel" value={phone} onChange={setPhone} autoComplete="tel" placeholder="010-0000-0000" />

        <fieldset className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-700">
          <legend className="px-1 font-medium">필수 동의</legend>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={isOver14} onChange={(event) => setIsOver14(event.target.checked)} className="mt-1" />
            만 14세 이상입니다.
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={agreeTerms} onChange={(event) => setAgreeTerms(event.target.checked)} className="mt-1" />
            이용약관에 동의합니다.
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={agreePrivacy} onChange={(event) => setAgreePrivacy(event.target.checked)} className="mt-1" />
            <span>
              개인정보 수집·이용에 동의합니다.
              <span className="mt-1 block text-xs text-zinc-600 dark:text-zinc-400">
                수집 항목: 이메일, 이름, 휴대폰 번호, 배송지 주소. 이용 목적: 회원 관리, 주문 처리, 배송, 문의 응대.
                보유 기간: 회원 탈퇴 시까지. 다만 거래 기록은 전자상거래법에 따라 보관합니다.
                동의를 거부할 수 있으나, 거부하면 회원가입을 할 수 없습니다.
              </span>
            </span>
          </label>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          가입하기
        </button>
      </form>
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        이미 회원이신가요? <Link href="/login" className="underline">로그인</Link>
      </p>
    </main>
  );
}
