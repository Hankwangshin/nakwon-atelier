// data/products.json의 샘플 상품을 Supabase products 표에 넣는다.
// 관리자가 화면에서 고친 같은 번호의 상품은 샘플 값으로 되돌아가므로 처음 한 번만 실행한다.
// 실행: node scripts/seed-products.mjs
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { CATEGORIES } from "../lib/categories.ts";

process.loadEnvFile(new URL("../.env", import.meta.url));
const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const products = JSON.parse(
  readFileSync(new URL("../data/products.json", import.meta.url), "utf8"),
);

const { error } = await admin.from("products").upsert(
  products.map(({ recommendedFor, basisDate, ...product }) => ({
    ...product,
    on_hand: product.stock,
    category: CATEGORIES.find(({ images }) =>
      images.some((name) => product.image === `/products/${name}.svg`),
    ).id,
    recommended_for: recommendedFor,
    basis_date: basisDate,
  })),
);

console.log(error ? `실패: ${error.message}` : `${products.length}개를 넣었습니다.`);
process.exitCode = error ? 1 : 0;
