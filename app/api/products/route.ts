import { randomUUID } from "node:crypto";
import { denyUnlessAllowed } from "@/lib/admin";
import { errorResponse, logFailure, serverFailedResponse } from "@/lib/http";
import { getProducts, parseProductInput, toProductRow } from "@/lib/products";
import { createAdminClient } from "@/lib/supabase";

export async function GET() {
  try {
    return Response.json({ products: await getProducts() });
  } catch {
    return serverFailedResponse();
  }
}

export async function POST(request: Request) {
  const denied = await denyUnlessAllowed("products");
  if (denied) {
    return denied;
  }

  const input = parseProductInput(await request.json().catch(() => null));
  if (typeof input === "string") {
    return errorResponse("INVALID_INPUT", input, 400);
  }

  const id = `p_${randomUUID()}`;
  const { error } = await createAdminClient()
    .from("products")
    .insert({ id, ...toProductRow(input) });

  if (error) {
    logFailure("product add failed", error);
    return serverFailedResponse();
  }
  return Response.json({ id }, { status: 201 });
}
