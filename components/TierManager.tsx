"use client";

import { useState } from "react";
import { callApi } from "@/lib/client-api";
import { MAX_DISCOUNT_PERCENT, MAX_TIER_NAME_LENGTH } from "@/lib/limits";

export interface Tier {
  id: string;
  name: string;
  discountPercent: number;
  isDefault: boolean;
}

interface TierManagerProps {
  tiers: Tier[];
  onChanged: () => Promise<void>;
}

const INPUT_CLASS =
  "rounded-lg border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700";

interface TierFieldsProps {
  name: string;
  percent: string;
  onName: (value: string) => void;
  onPercent: (value: string) => void;
}

function TierFields({ name, percent, onName, onPercent }: TierFieldsProps) {
  return (
    <>
      <label className="flex items-center gap-1">
        이름
        <input
          required
          maxLength={MAX_TIER_NAME_LENGTH}
          value={name}
          onChange={(event) => onName(event.target.value)}
          className={`w-28 ${INPUT_CLASS}`}
        />
      </label>
      <label className="flex items-center gap-1">
        할인율(%)
        <input
          required
          type="number"
          min={0}
          max={MAX_DISCOUNT_PERCENT}
          value={percent}
          onChange={(event) => onPercent(event.target.value)}
          className={`w-20 ${INPUT_CLASS}`}
        />
      </label>
    </>
  );
}

interface TierRowProps {
  tier: Tier;
  onSave: (name: string, percent: string) => void;
  onDelete: () => void;
}

function TierRow({ tier, onSave, onDelete }: TierRowProps) {
  const [name, setName] = useState(tier.name);
  const [percent, setPercent] = useState(String(tier.discountPercent));

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(name, percent);
  }

  return (
    <li>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3 py-2">
        <TierFields name={name} percent={percent} onName={setName} onPercent={setPercent} />
        <button type="submit" className="underline">저장</button>
        {tier.isDefault ? (
          <span className="text-xs text-zinc-600 dark:text-zinc-400">기본 등급</span>
        ) : (
          <button type="button" onClick={onDelete} className="text-red-600 underline dark:text-red-400">
            삭제
          </button>
        )}
      </form>
    </li>
  );
}

// 회원 등급의 이름과 할인율을 추가, 수정, 삭제한다.
export default function TierManager({ tiers, onChanged }: TierManagerProps) {
  const [name, setName] = useState("");
  const [percent, setPercent] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function run(request: Promise<{ ok: boolean; errorMessage: string }>, done: string) {
    setMessage("");
    const result = await request;
    if (!result.ok) {
      setError(result.errorMessage);
      return false;
    }
    setError("");
    setMessage(done);
    await onChanged();
    return true;
  }

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const isAdded = await run(
      callApi("/api/admin/tiers", "POST", { name, discountPercent: Number(percent) }),
      "등급을 추가했습니다.",
    );
    if (isAdded) {
      setName("");
      setPercent("");
    }
  }

  function handleDelete(tier: Tier) {
    if (window.confirm(`"${tier.name}" 등급을 삭제할까요? 이 등급의 회원은 기본 등급이 됩니다.`)) {
      run(callApi(`/api/admin/tiers/${tier.id}`, "DELETE"), "등급을 삭제했습니다.");
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
      <h2 className="font-semibold">회원 등급과 할인율</h2>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        할인은 상품 금액에만 적용되고, 할인율은 0~{MAX_DISCOUNT_PERCENT}%까지 입력할 수 있습니다.
      </p>
      <ul className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-700">
        {tiers.map((tier) => (
          <TierRow
            key={`${tier.id}-${tier.name}-${tier.discountPercent}`}
            tier={tier}
            onSave={(newName, newPercent) =>
              run(
                callApi(`/api/admin/tiers/${tier.id}`, "PATCH", {
                  name: newName,
                  discountPercent: Number(newPercent),
                }),
                "등급을 수정했습니다.",
              )
            }
            onDelete={() => handleDelete(tier)}
          />
        ))}
      </ul>
      <form onSubmit={handleAdd} className="mt-3 flex flex-wrap items-center gap-3">
        <TierFields name={name} percent={percent} onName={setName} onPercent={setPercent} />
        <button type="submit" className="rounded-lg bg-blue-600 px-3 py-1 font-medium text-white">
          등급 추가
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-2 text-green-700 dark:text-green-400">
          {message}
        </p>
      )}
    </section>
  );
}
