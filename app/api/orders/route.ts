import { randomUUID } from "node:crypto";
import { isOrderable, makeOrderName, summarizeCart } from "@/lib/cart";
import {
  errorResponse,
  logFailure,
  loginRequiredResponse,
  serverFailedResponse,
} from "@/lib/http";
import { findAddressProblem } from "@/lib/member-input";
import { getMemberDiscount } from "@/lib/member-tiers";
import { getProducts } from "@/lib/products";
import { createAdminClient, createUserClient, getCurrentUser } from "@/lib/supabase";

const PHONE_PATTERN = /^01\d-?\d{3,4}-?\d{4}$/;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return loginRequiredResponse();
  }

  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "order_number, order_name, amount, tier_name, discount_percent, discount_amount, status, created_at, paid_at, order_items (name, price, quantity), order_requests (type, reason, status, created_at)",
    )
    .eq("user_id", user.id)
    .in("status", ["paid", "cancelled"])
    .order("created_at", { ascending: false });

  if (error) {
    logFailure("orders read failed", error);
    return serverFailedResponse();
  }
  return Response.json({ orders: data });
}

// 결제 전에 주문을 먼저 만든다. 금액은 브라우저 값이 아닌 서버 계산 값을 저장해
// 결제 승인 때 대조한다.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return loginRequiredResponse();
  }

  const body = await request.json().catch(() => null);
  const { receiverName, receiverPhone, address } = body ?? {};
  if (
    typeof receiverName !== "string" ||
    receiverName.trim() === "" ||
    typeof receiverPhone !== "string" ||
    !PHONE_PATTERN.test(receiverPhone) ||
    findAddressProblem(address, "배송지 주소")
  ) {
    return errorResponse("INVALID_INPUT", "배송 정보를 확인해 주세요.", 400);
  }

  const supabase = await createUserClient();
  const { data: rows, error: cartError } = await supabase
    .from("cart_items")
    .select("product_id, quantity")
    .eq("user_id", user.id)
    .order("created_at");

  if (cartError) {
    logFailure("order cart failed", cartError);
    return serverFailedResponse();
  }

  const cart = summarizeCart(
    rows,
    await getProducts(),
    await getMemberDiscount(user.id),
  );
  if (!isOrderable(cart.lines)) {
    return errorResponse(
      "NOT_ORDERABLE",
      "장바구니가 비어 있거나 품절된 상품이 있습니다.",
      409,
    );
  }

  const admin = createAdminClient();
  const orderNumber = `order_${randomUUID()}`;
  const orderName = makeOrderName(cart.lines);
  const { data: order, error } = await admin
    .from("orders")
    .insert({
      order_number: orderNumber,
      user_id: user.id,
      order_name: orderName,
      items_amount: cart.itemsAmount,
      tier_name: cart.discount.tierName,
      discount_percent: cart.discount.percent,
      discount_amount: cart.discountAmount,
      shipping_fee: cart.shippingFee,
      amount: cart.amount,
      receiver_name: receiverName.trim(),
      receiver_phone: receiverPhone,
      address: address.trim(),
    })
    .select("id")
    .single();

  if (error) {
    logFailure("order failed", error);
    return serverFailedResponse();
  }

  const { error: itemsError } = await admin.from("order_items").insert(
    cart.lines.map(({ productId, name, price, quantity }) => ({
      order_id: order.id,
      product_id: productId,
      name,
      price,
      quantity,
    })),
  );

  if (itemsError) {
    logFailure("order items failed", itemsError);
    await admin.from("orders").delete().eq("id", order.id);
    return serverFailedResponse();
  }

  return Response.json(
    {
      orderNumber,
      orderName,
      amount: cart.amount,
      discountAmount: cart.discountAmount,
      customerKey: user.id,
      customerEmail: user.email,
    },
    { status: 201 },
  );
}
