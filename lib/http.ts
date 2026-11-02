export function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export function loginRequiredResponse() {
  return errorResponse("LOGIN_REQUIRED", "로그인이 필요합니다.", 401);
}

export function serverFailedResponse() {
  return errorResponse(
    "SERVER_FAILED",
    "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    500,
  );
}

// Design Ref: §8 — 오류 기록에는 개인정보가 없는 코드만 남긴다.
export function logFailure(label: string, error: { code?: string; status?: number } | null) {
  console.error(`${label}:`, error?.code ?? error?.status ?? "unknown");
}
