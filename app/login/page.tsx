"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import TextField from "@/components/TextField";
import { callApi } from "@/lib/client-api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSending(true);

    const result = await callApi("/api/auth/login", "POST", { email, password });
    setIsSending(false);

    if (result.ok) {
      router.push("/products");
    } else {
      setError(result.errorMessage);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="text-xl font-semibold">로그인</h1>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <TextField label="이메일" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <TextField label="비밀번호" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isSending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          로그인
        </button>
      </form>
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        처음이신가요? <Link href="/signup" className="underline">회원가입</Link>
      </p>
    </main>
  );
}
