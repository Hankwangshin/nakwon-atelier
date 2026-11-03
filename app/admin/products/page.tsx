"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { callApi, formatPrice } from "@/lib/client-api";
import { PRODUCT_IMAGES, PRODUCT_RECIPIENTS } from "@/lib/product-options";
import type { AdminProduct } from "@/lib/types";

interface FormState {
  name: string;
  image: string;
  category: string;
  price: string;
  onHand: string;
  stock: string;
  shipping: string;
  features: string;
  recommendedFor: string[];
}

const EMPTY_FORM: FormState = {
  name: "",
  image: PRODUCT_IMAGES[0].path,
  category: CATEGORIES[0].id,
  price: "",
  onHand: "",
  stock: "",
  shipping: "배송비 3,000원, 2~3일 소요",
  features: "",
  recommendedFor: [],
};

const isIllustration = (image: string) =>
  PRODUCT_IMAGES.some(({ path }) => path === image);

const INPUT_CLASS =
  "rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";

export default function AdminProductsPage() {
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState(false);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [newUpload, setNewUpload] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    const result = await callApi<{ products: AdminProduct[] }>("/api/admin/products");
    setProducts(result.data?.products ?? []);
  }, []);

  useEffect(() => {
    callApi<{ user: { adminScopes?: string[] } | null }>("/api/auth/me").then(({ data }) => {
      if (!data?.user?.adminScopes?.includes("products")) {
        router.replace("/");
        return;
      }
      setIsAllowed(true);
      loadProducts();
    });
  }, [router, loadProducts]);

  function startEdit(product: AdminProduct) {
    discardUpload(newUpload);
    setNewUpload(null);
    setEditingId(product.id);
    setForm({
      name: product.name,
      image: product.image,
      category: product.category,
      price: String(product.price),
      onHand: String(product.onHand),
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
    setNewUpload(null);
  }

  // 저장하지 않고 버린 사진이 저장소에 남지 않게 지운다.
  function discardUpload(url: string | null) {
    if (url) {
      callApi("/api/admin/product-images", "DELETE", { url });
    }
  }

  function handleCancel() {
    discardUpload(newUpload);
    resetForm();
  }

  function chooseIllustration(path: string) {
    discardUpload(newUpload);
    setNewUpload(null);
    setForm((current) => ({ ...current, image: path }));
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setError("");
    setIsUploading(true);
    const body = new FormData();
    body.append("file", file);
    const result = await callApi<{ url: string }>("/api/admin/product-images", "POST", body);
    setIsUploading(false);

    if (!result.data) {
      setError(result.errorMessage);
      return;
    }
    discardUpload(newUpload);
    setNewUpload(result.data.url);
    setForm((current) => ({ ...current, image: result.data?.url ?? current.image }));
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
      onHand: Number(form.onHand),
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

  async function handleDelete(product: AdminProduct) {
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
          분류
          <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className={INPUT_CLASS}>
            {CATEGORIES.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-3 sm:col-span-2">
          <Image src={form.image} alt="상품 사진 미리보기" width={96} height={96} unoptimized className="h-24 w-24 shrink-0 rounded-lg object-cover" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <label className="flex flex-col gap-1">
              사진 올리기 (JPG, PNG, WEBP, 5MB 이하)
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} disabled={isUploading} />
            </label>
            {isUploading && <p role="status">사진을 올리는 중</p>}
            <label className="flex flex-col gap-1">
              또는 일러스트 선택
              <select value={isIllustration(form.image) ? form.image : ""} onChange={(event) => chooseIllustration(event.target.value)} className={INPUT_CLASS}>
                {!isIllustration(form.image) && <option value="">올린 사진 사용 중</option>}
                {PRODUCT_IMAGES.map(({ path, label }) => (
                  <option key={path} value={path}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <label className="flex flex-col gap-1 sm:col-span-2">
          가격(원)
          <input required type="number" min={1} value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1">
          보유수량 (입고 총량)
          <input required type="number" min={0} value={form.onHand} onChange={(event) => setForm({ ...form, onHand: event.target.value })} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1">
          재고수량 (판매 가능, 결제되면 자동으로 줄어듦)
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
          <button type="submit" disabled={isUploading} className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50">
            {editingId ? "수정 저장" : "상품 추가"}
          </button>
          {(editingId || newUpload) && (
            <button type="button" onClick={handleCancel} className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-700">
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
            <Image src={product.image} alt="" width={40} height={40} unoptimized className="h-10 w-10 rounded-lg object-cover" />
            <div className="min-w-40 flex-1">
              <p className="font-medium">{product.name}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {formatPrice(product.price)} · 보유 {product.onHand}개 · 재고 {product.stock}개
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
