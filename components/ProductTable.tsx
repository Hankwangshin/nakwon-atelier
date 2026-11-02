import Image from "next/image";
import type { ProductCardData } from "@/lib/types";

interface ProductTableProps {
  products: ProductCardData[];
}

// Design Ref: §1 — 여러 상품은 그림, 상품 정보, 설명을 표로 보여 준다.
// 작은 화면에서는 표 안에서만 가로로 움직이게 한다.
export default function ProductTable({ products }: ProductTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
      <table className="w-full min-w-[20rem] text-left text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              사진
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              상품
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              설명
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {products.map((product) => (
            <tr key={product.name} className="align-top">
              <td className="px-3 py-3">
                <Image
                  src={product.image}
                  alt={`${product.name} 그림`}
                  width={64}
                  height={64}
                  unoptimized
                  className="h-14 w-14 max-w-none rounded-lg sm:h-16 sm:w-16"
                />
              </td>
              <td className="min-w-28 px-3 py-3">
                <p className="font-semibold">{product.name}</p>
                <p className="mt-1">{product.price.toLocaleString("ko-KR")}원</p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {product.shipping}
                </p>
                {product.isSoldOut && (
                  <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                    품절
                  </p>
                )}
              </td>
              <td className="min-w-36 px-3 py-3 leading-6">
                <p>{product.features}</p>
                {product.reason && (
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                    추천 이유: {product.reason}
                  </p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
