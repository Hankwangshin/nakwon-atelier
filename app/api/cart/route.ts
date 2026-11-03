import { MAX_CART_QUANTITY, summarizeCart } from "@/lib/cart";
import {
  errorResponse,
  logFailure,
  loginRequiredResponse,
  serverFailedResponse,
} from "@/lib/http";
import { getMemberDiscount } from "@/lib/member-tiers";
import { getProducts } from "@/lib/products";
import type { Product } from "@/lib/types";
import { createUserClient, getCurrentUser } from "@/lib/supabase";

async function readCart(userId: string) {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("cart_items")
    .select("product_id, quantity")
    .eq("user_id", userId)
    .order("created_at");

  if (error) {
    logFailure("cart read failed", error);
    return serverFailedResponse();
  }
  return Response.json(
    summarizeCart(data, await getProducts(), await getMemberDiscount(userId)),
  );
}

function findQuantityProblem(
  products: Product[],
  productId: unknown,
  quantity: unknown,
) {
  const product = products.find(({ id }) => id === productId);

  if (!product) {
    return errorResponse("INVALID_INPUT", "없는 상품입니다.", 400);
  }
  if (product.stock === 0) {
    return errorResponse("SOLD_OUT", "품절된 상품입니다.", 409);
  }
  if (
    !Number.isInteger(quantity) ||
    (quantity as number) < 1 ||
    (quantity as number) > Math.min(product.stock, MAX_CART_QUANTITY)
  ) {
    return errorResponse("INVALID_QUANTITY", "주문 가능한 수량을 확인해 주세요.", 400);
  }
  return null;
}

export async function GET() {
  const user = await getCurrentUser();
  return user ? readCart(user.id) : loginRequiredResponse();
}

// 장바구니 담기. 이미 있는 상품이면 수량을 더한다.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return loginRequiredResponse();
  }

  const body = await request.json().catch(() => null);
  const productId = body?.productId;
  const added = body?.quantity ?? 1;
  const supabase = await createUserClient();

  const { data: existing } = await supabase
    .from("cart_items")
    .select("quantity")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  const quantity = (existing?.quantity ?? 0) + added;
  const problem = findQuantityProblem(await getProducts(), productId, quantity);
  if (problem) {
    return problem;
  }

  const { error } = await supabase
    .from("cart_items")
    .upsert({ user_id: user.id, product_id: productId, quantity });

  if (error) {
    logFailure("cart add failed", error);
    return serverFailedResponse();
  }
  return readCart(user.id);
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return loginRequiredResponse();
  }

  const body = await request.json().catch(() => null);
  const problem = findQuantityProblem(
    await getProducts(),
    body?.productId,
    body?.quantity,
  );
  if (problem) {
    return problem;
  }

  const supabase = await createUserClient();
  const { error } = await supabase
    .from("cart_items")
    .update({ quantity: body.quantity })
    .eq("user_id", user.id)
    .eq("product_id", body.productId);

  if (error) {
    logFailure("cart update failed", error);
    return serverFailedResponse();
  }
  return readCart(user.id);
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return loginRequiredResponse();
  }

  const body = await request.json().catch(() => null);
  const supabase = await createUserClient();
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("user_id", user.id)
    .eq("product_id", body?.productId);

  if (error) {
    logFailure("cart delete failed", error);
    return serverFailedResponse();
  }
  return readCart(user.id);
}
