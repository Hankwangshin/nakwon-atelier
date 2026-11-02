import { PRODUCT_IMAGES, PRODUCT_RECIPIENTS } from "@/lib/product-options";
import { createAdminClient, getCurrentUser } from "@/lib/supabase";
import type { Product } from "@/lib/types";

// 이 파일은 서버 전용 키를 쓰므로 서버 쪽 코드에서만 가져온다.

const MAX_PRICE = 10000000;
const MAX_STOCK = 99999;
const MAX_NAME_LENGTH = 100;
const MAX_SHIPPING_LENGTH = 100;
const MAX_FEATURES_LENGTH = 500;
const SHIPPING_PATTERN = /무료|배송비\s*[\d,]+원/;

export type ProductInput = Omit<Product, "id" | "basisDate">;

interface ProductRow {
  id: string;
  name: string;
  image: string;
  price: number;
  stock: number;
  shipping: string;
  features: string;
  recommended_for: string[];
  basis_date: string;
}

function toProduct(row: ProductRow): Product {
  const { recommended_for, basis_date, ...rest } = row;
  return { ...rest, recommendedFor: recommended_for, basisDate: basis_date };
}

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await createAdminClient()
    .from("products")
    .select("id, name, image, price, stock, shipping, features, recommended_for, basis_date")
    .order("created_at")
    .order("id");

  if (error) {
    throw new Error(`products read failed: ${error.code}`);
  }
  return data.map(toProduct);
}

function isTextWithin(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    value.length <= maxLength
  );
}

// 관리자 입력을 검사한다. 문제가 있으면 문구를, 없으면 저장할 값을 돌려준다.
export function parseProductInput(
  body: Record<string, unknown> | null,
): ProductInput | string {
  const { name, image, price, stock, shipping, features, recommendedFor } = body ?? {};

  if (!isTextWithin(name, MAX_NAME_LENGTH)) {
    return `상품명은 ${MAX_NAME_LENGTH}자 이내로 입력해 주세요.`;
  }
  if (!PRODUCT_IMAGES.some(({ path }) => path === image)) {
    return "상품 그림을 선택해 주세요.";
  }
  if (!Number.isInteger(price) || (price as number) < 1 || (price as number) > MAX_PRICE) {
    return "가격은 1원 이상의 정수로 입력해 주세요.";
  }
  if (!Number.isInteger(stock) || (stock as number) < 0 || (stock as number) > MAX_STOCK) {
    return "재고는 0 이상의 정수로 입력해 주세요.";
  }
  if (!isTextWithin(shipping, MAX_SHIPPING_LENGTH) || !SHIPPING_PATTERN.test(shipping)) {
    return '배송 안내에는 "배송비 3,000원" 또는 "무료"를 넣어 주세요.';
  }
  if (!isTextWithin(features, MAX_FEATURES_LENGTH)) {
    return `상품 설명은 ${MAX_FEATURES_LENGTH}자 이내로 입력해 주세요.`;
  }
  if (
    !Array.isArray(recommendedFor) ||
    recommendedFor.length === 0 ||
    !recommendedFor.every((item) => PRODUCT_RECIPIENTS.includes(item))
  ) {
    return "추천 대상을 1개 이상 선택해 주세요.";
  }

  return {
    name: name.trim(),
    image: image as string,
    price: price as number,
    stock: stock as number,
    shipping: shipping.trim(),
    features: features.trim(),
    recommendedFor,
  };
}

export function toProductRow(input: ProductInput) {
  const { recommendedFor, ...rest } = input;
  return {
    ...rest,
    recommended_for: recommendedFor,
    basis_date: new Date().toISOString().slice(0, 10),
  };
}

// 관리자 여부는 회원이 바꿀 수 없는 서버 쪽 값으로만 판단한다.
export async function getAdminUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, isAdmin: false };
  }

  const { data } = await createAdminClient()
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  return { user, isAdmin: data?.is_admin === true };
}
