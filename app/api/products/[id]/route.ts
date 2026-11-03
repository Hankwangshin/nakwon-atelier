import { denyUnlessAdmin } from "@/lib/admin";
import { errorResponse, logFailure, serverFailedResponse } from "@/lib/http";
import { removeUploadedImage } from "@/lib/product-images";
import { parseProductInput, toProductRow } from "@/lib/products";
import { createAdminClient } from "@/lib/supabase";

export async function PATCH(request: Request, context: RouteContext<"/api/products/[id]">) {
  const denied = await denyUnlessAdmin();
  if (denied) {
    return denied;
  }

  const input = parseProductInput(await request.json().catch(() => null));
  if (typeof input === "string") {
    return errorResponse("INVALID_INPUT", input, 400);
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: before } = await admin
    .from("products")
    .select("image")
    .eq("id", id)
    .maybeSingle();
  const { data, error } = await admin
    .from("products")
    .update(toProductRow(input))
    .eq("id", id)
    .select("id");

  if (error) {
    logFailure("product update failed", error);
    return serverFailedResponse();
  }
  if (data.length === 0) {
    return errorResponse("NOT_FOUND", "없는 상품입니다.", 404);
  }

  // 사진을 바꾸면 이전 사진은 저장소에서 지운다.
  if (before?.image !== input.image) {
    await removeUploadedImage(before?.image);
  }
  return Response.json({ ok: true });
}

// 지난 주문은 주문 당시 상품명과 가격을 따로 저장해 두었으므로 그대로 남는다.
export async function DELETE(_request: Request, context: RouteContext<"/api/products/[id]">) {
  const denied = await denyUnlessAdmin();
  if (denied) {
    return denied;
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("products")
    .delete()
    .eq("id", id)
    .select("id, image");

  if (error) {
    logFailure("product delete failed", error);
    return serverFailedResponse();
  }
  if (data.length === 0) {
    return errorResponse("NOT_FOUND", "없는 상품입니다.", 404);
  }

  await admin.from("cart_items").delete().eq("product_id", id);
  await removeUploadedImage(data[0].image);
  return Response.json({ ok: true });
}
