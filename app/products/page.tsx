import type { Metadata } from "next";
import Image from "next/image";
import AddToCartButton from "@/components/AddToCartButton";
import { formatPrice } from "@/lib/client-api";
import { products } from "@/lib/products";

export const metadata: Metadata = { title: "상품 | 문구 만물" };

export default function ProductsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="text-xl font-semibold">상품</h1>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {products.map((product) => (
          <li
            key={product.id}
            className="flex gap-3 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-700"
          >
            <Image
              src={product.image}
              alt={`${product.name} 그림`}
              width={64}
              height={64}
              unoptimized
              className="h-16 w-16 shrink-0 rounded-lg"
            />
            <div className="min-w-0">
              <h2 className="font-semibold">{product.name}</h2>
              <p className="mt-1">{formatPrice(product.price)}</p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {product.shipping}
              </p>
              <p className="mt-1 leading-6">{product.features}</p>
              <AddToCartButton
                productId={product.id}
                isSoldOut={product.stock === 0}
              />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
