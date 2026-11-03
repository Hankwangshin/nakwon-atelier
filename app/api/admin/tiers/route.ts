import { denyUnlessAdmin } from "@/lib/admin";
import { errorResponse, logFailure, serverFailedResponse } from "@/lib/http";
import { getTiers, parseTierInput } from "@/lib/member-tiers";
import { createAdminClient } from "@/lib/supabase";

const UNIQUE_VIOLATION = "23505";

export async function GET() {
  const denied = await denyUnlessAdmin();
  if (denied) {
    return denied;
  }

  try {
    return Response.json({ tiers: await getTiers() });
  } catch {
    return serverFailedResponse();
  }
}

export async function POST(request: Request) {
  const denied = await denyUnlessAdmin();
  if (denied) {
    return denied;
  }

  const input = parseTierInput(await request.json().catch(() => null));
  if (typeof input === "string") {
    return errorResponse("INVALID_INPUT", input, 400);
  }

  const { error } = await createAdminClient().from("membership_tiers").insert(input);
  if (error?.code === UNIQUE_VIOLATION) {
    return errorResponse("TIER_NAME_TAKEN", "이미 있는 등급 이름입니다.", 409);
  }
  if (error) {
    logFailure("tier add failed", error);
    return serverFailedResponse();
  }
  return Response.json({ ok: true }, { status: 201 });
}
