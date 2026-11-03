import { MAX_CART_QUANTITY } from "@/lib/cart";
import {
  errorResponse,
  logFailure,
  loginRequiredResponse,
  serverFailedResponse,
} from "@/lib/http";
import { getProducts } from "@/lib/products";
import type { ReorderResult } from "@/lib/reorder";
import { createUserClient, getCurrentUser } from "@/lib/supabase";

// 지난 주문의 상품을 같은 수량으로 장바구니에 다시 담는다.
// 가격과 할인은 장바구니가 지금 값으로 다시 계산하므로 여기서는 수량만 정한다.
export async function POST(
  _request: Request,
  context: RouteContext<"/api/orders/[orderNumber]/reorder">,
) {
  const user = await getCurrentUser();
  if (!user) {
    return loginRequiredResponse();
  }

  const { orderNumber } = await context.params;
  const supabase = await createUserClient();
  // 본인 주문만 읽히도록 DB 규칙(RLS)과 user_id 조건을 함께 건다.
  const { data: order, error } = await supabase
    .from("orders")
    .select("order_items (product_id, name, quantity)")
    .eq("order_number", orderNumber)
    .eq("user_id", user.id)
    .in("status", ["paid", "cancelled"])
    .maybeSingle();

  if (error) {
    logFailure("reorder read failed", error);
    return serverFailedResponse();
  }
  if (!order) {
    return errorResponse("NOT_FOUND", "주문을 찾을 수 없습니다.", 404);
  }

  const { data: cartRows, error: cartError } = await supabase
    .from("cart_items")
    .select("product_id, quantity")
    .eq("user_id", user.id);
  if (cartError) {
    logFailure("reorder cart failed", cartError);
    return serverFailedResponse();
  }

  // 한 주문에 같은 상품이 여러 줄이면 합친다.
  const wanted = new Map<string, { name: string; quantity: number }>();
  for (const { product_id, name, quantity } of order.order_items) {
    const before = wanted.get(product_id);
    wanted.set(product_id, { name, quantity: (before?.quantity ?? 0) + quantity });
  }

  const products = await getProducts();
  const result: ReorderResult = { added: [], skipped: [] };
  const upserts: { user_id: string; product_id: string; quantity: number }[] = [];

  for (const [productId, { name, quantity }] of wanted) {
    const product = products.find(({ id }) => id === productId);
    if (!product) {
      result.skipped.push({ name, reason: "지금은 판매하지 않는 상품" });
      continue;
    }
    if (product.stock === 0) {
      result.skipped.push({ name: product.name, reason: "품절" });
      continue;
    }

    const inCart = cartRows.find(({ product_id }) => product_id === productId)?.quantity ?? 0;
    const limit = Math.min(product.stock, MAX_CART_QUANTITY);
    if (inCart >= limit) {
      result.skipped.push({ name: product.name, reason: "장바구니에 이미 담을 수 있는 만큼 있음" });
      continue;
    }

    const total = Math.min(inCart + quantity, limit);
    upserts.push({ user_id: user.id, product_id: productId, quantity: total });
    result.added.push({
      name: product.name,
      quantity: total - inCart,
      isReduced: total - inCart < quantity,
    });
  }

  if (upserts.length > 0) {
    const { error: upsertError } = await supabase.from("cart_items").upsert(upserts);
    if (upsertError) {
      logFailure("reorder cart add failed", upsertError);
      return serverFailedResponse();
    }
  }
  return Response.json(result);
}
