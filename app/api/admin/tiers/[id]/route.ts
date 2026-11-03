import { denyUnlessAllowed } from "@/lib/admin";
import { errorResponse, logFailure, serverFailedResponse } from "@/lib/http";
import { parseTierInput } from "@/lib/member-tiers";
import { createAdminClient } from "@/lib/supabase";

const UNIQUE_VIOLATION = "23505";

export async function PATCH(request: Request, context: RouteContext<"/api/admin/tiers/[id]">) {
  const denied = await denyUnlessAllowed("members");
  if (denied) {
    return denied;
  }

  const input = parseTierInput(await request.json().catch(() => null));
  if (typeof input === "string") {
    return errorResponse("INVALID_INPUT", input, 400);
  }

  const { id } = await context.params;
  const { data, error } = await createAdminClient()
    .from("membership_tiers")
    .update(input)
    .eq("id", id)
    .select("id");

  if (error?.code === UNIQUE_VIOLATION) {
    return errorResponse("TIER_NAME_TAKEN", "이미 있는 등급 이름입니다.", 409);
  }
  if (error) {
    logFailure("tier update failed", error);
    return serverFailedResponse();
  }
  if (data.length === 0) {
    return errorResponse("NOT_FOUND", "없는 등급입니다.", 404);
  }
  return Response.json({ ok: true });
}

// 등급을 지우면 그 회원들은 데이터베이스 규칙에 따라 기본 등급으로 돌아간다.
export async function DELETE(_request: Request, context: RouteContext<"/api/admin/tiers/[id]">) {
  const denied = await denyUnlessAllowed("members");
  if (denied) {
    return denied;
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: tier } = await admin
    .from("membership_tiers")
    .select("is_default")
    .eq("id", id)
    .maybeSingle();

  if (!tier) {
    return errorResponse("NOT_FOUND", "없는 등급입니다.", 404);
  }
  if (tier.is_default) {
    return errorResponse("DEFAULT_TIER", "기본 등급은 삭제할 수 없습니다.", 409);
  }

  const { error } = await admin.from("membership_tiers").delete().eq("id", id);
  if (error) {
    logFailure("tier delete failed", error);
    return serverFailedResponse();
  }
  return Response.json({ ok: true });
}
