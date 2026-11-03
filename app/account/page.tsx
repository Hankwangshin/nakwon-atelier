"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AddressFields from "@/components/AddressFields";
import TextField from "@/components/TextField";
import { callApi } from "@/lib/client-api";

interface User {
  email?: string;
  name?: string;
  phone?: string;
  address?: string;
  shippingAddress?: string;
}

type EditableUser = Required<Pick<User, "name" | "phone" | "address" | "shippingAddress">>;

interface Me {
  user: User | null;
}

interface AccountEditFormProps {
  user: User;
  onSaved: (saved: EditableUser) => void;
  onCancel: () => void;
}

// 수정 버튼을 누르면 비밀번호를 묻고, 서버가 맞다고 확인해야 저장된다.
function AccountEditForm({ user, onSaved, onCancel }: AccountEditFormProps) {
  const [name, setName] = useState(user.name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [address, setAddress] = useState(user.address ?? "");
  const [shippingAddress, setShippingAddress] = useState(user.shippingAddress ?? "");
  const [isSameAsAddress, setIsSameAsAddress] = useState(
    (user.shippingAddress ?? "") === (user.address ?? ""),
  );
  const [password, setPassword] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    setError("");
    setIsSending(true);
    const saved = {
      name: name.trim(),
      phone,
      address: address.trim(),
      shippingAddress: (isSameAsAddress ? address : shippingAddress).trim(),
    };
    const result = await callApi("/api/auth/me", "PATCH", { ...saved, password });
    setIsSending(false);
    setPassword("");

    if (result.ok) {
      onSaved(saved);
    } else {
      setError(result.errorMessage);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
      <p>이메일 {user.email} (바꿀 수 없습니다)</p>
      <TextField label="이름" value={name} onChange={setName} autoComplete="name" />
      <TextField label="휴대폰 번호" type="tel" value={phone} onChange={setPhone} autoComplete="tel" placeholder="010-0000-0000" />
      <AddressFields
        address={address}
        onAddressChange={setAddress}
        shippingAddress={shippingAddress}
        onShippingAddressChange={setShippingAddress}
        isSameAsAddress={isSameAsAddress}
        onSameAsAddressChange={setIsSameAsAddress}
      />
      {isConfirming && (
        <TextField label="비밀번호를 한 번 더 입력해 주세요" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
      )}
      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSending}
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {isConfirming ? "비밀번호 확인 후 저장" : "수정"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700"
        >
          취소
        </button>
      </div>
    </form>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState("");
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
      "탈퇴하면 이메일과 탈퇴 날짜만 남기고 회원 정보와 장바구니가 삭제되며, 다시 로그인할 수 없습니다. 주문 기록은 법에 따라 보관됩니다. 탈퇴할까요?",
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
      {user && isEditing && (
        <AccountEditForm
          user={user}
          onSaved={(saved) => {
            setUser({ ...user, ...saved });
            setIsEditing(false);
            setMessage("내 정보를 수정했습니다.");
          }}
          onCancel={() => setIsEditing(false)}
        />
      )}
      {user && !isEditing && (
        <dl className="mt-4 grid grid-cols-[6rem_1fr] gap-1">
          <dt className="text-zinc-600 dark:text-zinc-400">이메일</dt>
          <dd>{user.email}</dd>
          <dt className="text-zinc-600 dark:text-zinc-400">이름</dt>
          <dd>{user.name}</dd>
          <dt className="text-zinc-600 dark:text-zinc-400">휴대폰 번호</dt>
          <dd>{user.phone}</dd>
          <dt className="text-zinc-600 dark:text-zinc-400">주소지</dt>
          <dd>{user.address || "아직 없습니다"}</dd>
          <dt className="text-zinc-600 dark:text-zinc-400">배송지</dt>
          <dd>
            {user.shippingAddress || "아직 없습니다"}
            {user.shippingAddress && user.shippingAddress === user.address && (
              <span className="text-zinc-600 dark:text-zinc-400"> (주소지와 같음)</span>
            )}
          </dd>
        </dl>
      )}
      {user && !isEditing && (
        <button
          type="button"
          onClick={() => {
            setMessage("");
            setIsEditing(true);
          }}
          className="mt-4 rounded-lg border border-zinc-300 px-3 py-1 dark:border-zinc-700"
        >
          정보 수정
        </button>
      )}
      {message && (
        <p role="status" className="mt-3 text-green-700 dark:text-green-400">
          {message}
        </p>
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
