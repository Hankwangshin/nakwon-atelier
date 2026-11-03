import { denyUnlessAllowed } from "@/lib/admin";
import { logFailure, serverFailedResponse } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

export async function GET() {
  const denied = await denyUnlessAllowed("requests");
  if (denied) {
    return denied;
  }

  const { data, error } = await createAdminClient()
    .from("order_requests")
    .select(
      "id, type, reason, status, created_at, decided_at, orders (order_number, order_name, amount, status, receiver_name)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    logFailure("requests read failed", error);
    return serverFailedResponse();
  }
  return Response.json({ requests: data });
}
