"use client";

import Link from "next/link";
import HomeLoginCard from "@/components/HomeLoginCard";
import MonthCalendar from "@/components/MonthCalendar";
import ProductGrid from "@/components/ProductGrid";
import { useProducts } from "@/components/useProducts";
import { CATEGORIES, productsInCategory } from "@/lib/categories";

// 6개면 휴대폰 2칸, 태블릿 3칸, PC 6칸에서 모두 줄이 딱 맞는다.
const FEATURED_COUNT = 6;
// 새로 들어온 상품은 PC에서 두 줄을 채운다.
const NEW_COUNT = 12;

export default function Home() {
  const { products, error } = useProducts();
  // 상품 API는 등록 순서(오래된 것부터)로 주므로, 뒤집어 최신 등록 상품부터 보여 준다.
  const newestFirst = [...(products ?? [])].reverse();
  const sections = CATEGORIES.map((category) => ({
    ...category,
    products: productsInCategory(newestFirst, category.id),
  })).filter((section) => section.products.length > 0);

  return (
    <main className="mx-auto w-full page-wide px-4 pb-12">
      {/* PC에서는 소개, 로그인, 달력을 한 줄에 놓아 첫 화면에 모두 보이게 한다. */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <section className="flex flex-col justify-center rounded-3xl bg-orange-100 px-6 py-12 text-stone-900 sm:px-10 sm:col-span-2 sm:py-16 lg:py-10 dark:bg-stone-800 dark:text-stone-100">
          <p className="text-sm font-medium tracking-widest">NAKWON ATELIER</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-5xl">
            낙원 아뜰리에
          </h1>
          <p className="mt-3 max-w-md leading-7">
            하루를 채우는 문구와 작은 소품을 모았어요.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/products"
              className="rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white dark:bg-orange-100 dark:text-stone-900"
            >
              전체 상품 보기
            </Link>
            <Link
              href="/chat"
              className="rounded-full border border-stone-900 px-5 py-2 text-sm font-medium dark:border-orange-100"
            >
              챗봇에게 선물 추천받기
            </Link>
          </div>
        </section>
        <HomeLoginCard />
        <MonthCalendar />
      </div>

      {!products && <p className="mt-6 text-sm">상품을 불러오는 중</p>}
      {error && (
        <p role="alert" className="mt-6 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {newestFirst.length > 0 && (
        <section aria-labelledby="new-arrivals" className="mt-8">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 id="new-arrivals" className="text-lg font-semibold">
              새로 들어온 상품
            </h2>
            <Link href="/products" className="text-sm text-stone-500 dark:text-stone-400">
              전체 보기
            </Link>
          </div>
          <ProductGrid products={newestFirst.slice(0, NEW_COUNT)} />
        </section>
      )}

      <nav
        aria-label="상품 분류"
        className="mt-6 flex gap-2 overflow-x-auto pb-1"
      >
        {sections.map(({ id, label }) => (
          <a
            key={id}
            href={`#${id}`}
            className="shrink-0 rounded-full border border-stone-300 px-4 py-1.5 text-sm dark:border-stone-700"
          >
            {label}
          </a>
        ))}
      </nav>

      {sections.map(({ id, label, products: items }) => (
        <section key={id} id={id} className="mt-10 scroll-mt-4">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">{label}</h2>
            <Link href="/products" className="text-sm text-stone-500 dark:text-stone-400">
              전체 보기
            </Link>
          </div>
          <ProductGrid products={items.slice(0, FEATURED_COUNT)} />
        </section>
      ))}
    </main>
  );
}
