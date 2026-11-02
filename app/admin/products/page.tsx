"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { callApi, formatPrice } from "@/lib/client-api";
import { PRODUCT_IMAGES, PRODUCT_RECIPIENTS } from "@/lib/product-options";
import type { Product } from "@/lib/types";

interface FormState {
  name: string;
  image: string;
  price: string;
  stock: string;
  shipping: string;
  features: string;
  recommendedFor: string[];
}

const EMPTY_FORM: FormState = {
  name: "",
  image: PRODUCT_IMAGES[0].path,
  price: "",
  stock: "",
  shipping: "배송비 3,000원, 2~3일 소요",
  features: "",
  recommendedFor: [],
};

const INPUT_CLASS =
  "rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";

export default function AdminProductsPage() {
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadProducts = useCallback(async () => {
    const result = await callApi<{ products: Product[] }>("/api/products");
    setProducts(result.data?.products ?? []);
  }, []);

  useEffect(() => {
    callApi<{ user: { isAdmin?: boolean } | null }>("/api/auth/me").then(({ data }) => {
      if (!data?.user?.isAdmin) {
        router.replace("/");
        return;
      }
      setIsAllowed(true);
      loadProducts();
    });
  }, [router, loadProducts]);

  function startEdit(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      image: product.image,
      price: String(product.price),
      stock: String(product.stock),
      shipping: product.shipping,
      features: product.features,
      recommendedFor: product.recommendedFor,
    });
    setMessage("");
    setError("");
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function toggleRecipient(recipient: string) {
    setForm((current) => ({
      ...current,
      recommendedFor: current.recommendedFor.includes(recipient)
        ? current.recommendedFor.filter((item) => item !== recipient)
        : [...current.recommendedFor, recipient],
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const body = {
      ...form,
      price: Number(form.price),
      stock: Number(form.stock),
    };
    const result = editingId
      ? await callApi(`/api/products/${editingId}`, "PATCH", body)
      : await callApi("/api/products", "POST", body);

    if (!result.ok) {
      setError(result.errorMessage);
      return;
    }
    setMessage(editingId ? "상품을 수정했습니다." : "상품을 추가했습니다.");
    resetForm();
    await loadProducts();
  }

  async function handleDelete(product: Product) {
    if (!window.confirm(`"${product.name}"을(를) 삭제할까요? 되돌릴 수 없습니다.`)) {
      return;
    }

    const result = await callApi(`/api/products/${product.id}`, "DELETE");
    if (!result.ok) {
      setError(result.errorMessage);
      return;
    }
    setMessage("상품을 삭제했습니다.");
    if (editingId === product.id) {
      resetForm();
    }
    await loadProducts();
  }

  if (!isAllowed) {
    return <main className="px-4 py-6 text-sm">권한을 확인하는 중</main>;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 text-sm">
      <h1 className="text-xl font-semibold">상품 관리</h1>

      <form
        onSubmit={handleSubmit}
        className="mt-4 grid gap-3 rounded-xl border border-zinc-200 p-4 sm:grid-cols-2 dark:border-zinc-700"
      >
        <h2 className="font-semibold sm:col-span-2">
          {editingId ? "상품 수정" : "새 상품 추가"}
        </h2>
        <label className="flex flex-col gap-1">
          상품명
          <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1">
          그림
          <select value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} className={INPUT_CLASS}>
            {PRODUCT_IMAGES.map(({ path, label }) => (
              <option key={path} value={path}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          가격(원)
          <input required type="number" min={1} value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1">
          재고
          <input required type="number" min={0} value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          배송 안내
          <input required value={form.shipping} onChange={(event) => setForm({ ...form, shipping: event.target.value })} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          상품 설명
          <textarea required rows={3} value={form.features} onChange={(event) => setForm({ ...form, features: event.target.value })} className={INPUT_CLASS} />
        </label>
        <fieldset className="flex flex-wrap gap-3 sm:col-span-2">
          <legend className="mb-1">추천 대상</legend>
          {PRODUCT_RECIPIENTS.map((recipient) => (
            <label key={recipient} className="flex items-center gap-1">
              <input type="checkbox" checked={form.recommendedFor.includes(recipient)} onChange={() => toggleRecipient(recipient)} />
              {recipient}
            </label>
          ))}
        </fieldset>
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white">
            {editingId ? "수정 저장" : "상품 추가"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700">
              취소
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-red-600 sm:col-span-2 dark:text-red-400">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-green-700 sm:col-span-2 dark:text-green-400">
            {message}
          </p>
        )}
      </form>

      <h2 className="mt-6 font-semibold">상품 {products.length}개</h2>
      <ul className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-700">
        {products.map((product) => (
          <li key={product.id} className="flex flex-wrap items-center gap-3 py-2">
            <Image src={product.image} alt="" width={40} height={40} unoptimized className="h-10 w-10 rounded-lg" />
            <div className="min-w-40 flex-1">
              <p className="font-medium">{product.name}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {formatPrice(product.price)} · 재고 {product.stock}개
              </p>
            </div>
            <button type="button" onClick={() => startEdit(product)} className="underline">
              수정
            </button>
            <button type="button" onClick={() => handleDelete(product)} className="text-red-600 underline dark:text-red-400">
              삭제
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
