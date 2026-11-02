import type { Metadata } from "next";
import ProductGrid from "@/components/ProductGrid";
import { products } from "@/lib/products";

export const metadata: Metadata = { title: "상품 | 낙원 아뜰리에" };

export default function ProductsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">전체 상품</h1>
      <ProductGrid products={products} />
    </main>
  );
}
