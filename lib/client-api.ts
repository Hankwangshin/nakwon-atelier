// 화면에서 서버 쪽 API를 부를 때 쓴다. 연결 실패도 같은 모양의 결과로 돌려준다.
export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  errorMessage: string;
}

const NETWORK_FAILURE = "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
const DEFAULT_FAILURE = "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";

export async function callApi<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => null);

    return {
      ok: response.ok,
      status: response.status,
      data: response.ok ? data : null,
      errorMessage: data?.error?.message ?? DEFAULT_FAILURE,
    };
  } catch {
    return { ok: false, status: 0, data: null, errorMessage: NETWORK_FAILURE };
  }
}

export function formatPrice(price: number): string {
  return `${price.toLocaleString("ko-KR")}원`;
}
