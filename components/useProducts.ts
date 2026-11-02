"use client";

import { useEffect, useState } from "react";
import { callApi } from "@/lib/client-api";
import type { Product } from "@/lib/types";

// 관리자가 바꾼 상품이 바로 보이도록 페이지를 열 때마다 서버에서 읽는다.
export function useProducts() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    callApi<{ products: Product[] }>("/api/products").then((result) => {
      setProducts(result.data?.products ?? []);
      setError(result.ok ? "" : result.errorMessage);
    });
  }, []);

  return { products, error };
}
