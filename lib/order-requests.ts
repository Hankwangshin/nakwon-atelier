// 화면에서 쓰는 요청 이름. 브라우저에 포함돼도 되는 값만 둔다.
export type RequestType = "exchange" | "cancel";

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  exchange: "상품 교환",
  cancel: "결제 취소",
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: "승인 대기",
  processing: "처리 중",
  approved: "승인 완료",
  rejected: "거절",
};
