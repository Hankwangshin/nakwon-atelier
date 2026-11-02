"use client";

import ProductGrid from "@/components/ProductGrid";
import { useProducts } from "@/components/useProducts";

export default function ProductsPage() {
  const { products, error } = useProducts();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">전체 상품</h1>
      {!products && <p className="text-sm">상품을 불러오는 중</p>}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {products && <ProductGrid products={products} />}
    </main>
  );
}
