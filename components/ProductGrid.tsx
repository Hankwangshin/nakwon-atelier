import Image from "next/image";
import AddToCartButton from "@/components/AddToCartButton";
import { formatPrice } from "@/lib/client-api";
import type { Product } from "@/lib/types";

interface ProductGridProps {
  products: Product[];
}

export default function ProductGrid({ products }: ProductGridProps) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4">
      {products.map((product) => (
        <li key={product.id} className="min-w-0 text-sm">
          <Image
            src={product.image}
            alt={`${product.name} 그림`}
            width={240}
            height={240}
            unoptimized
            className="aspect-square w-full rounded-2xl object-cover"
          />
          <h3 className="mt-2 font-medium leading-5">{product.name}</h3>
          <p className="mt-1 font-semibold">{formatPrice(product.price)}</p>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            {product.shipping}
          </p>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            재고 {product.stock.toLocaleString("ko-KR")}개
          </p>
          <AddToCartButton
            productId={product.id}
            isSoldOut={product.stock === 0}
          />
        </li>
      ))}
    </ul>
  );
}
