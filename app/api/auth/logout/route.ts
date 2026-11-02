import { createUserClient } from "@/lib/supabase";

export async function POST() {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  return Response.json({ ok: true });
}
