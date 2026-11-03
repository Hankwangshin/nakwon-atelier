// 재구매 결과. 화면과 서버가 함께 쓰며, 브라우저에 포함돼도 된다.
export interface ReorderResult {
  added: { name: string; quantity: number; isReduced: boolean }[];
  skipped: { name: string; reason: string }[];
}

// 재구매 결과를 화면에 보여 줄 한두 문장으로 바꾼다.
export function describeReorder({ added, skipped }: ReorderResult): string {
  const parts: string[] = [];
  if (added.length > 0) {
    const names = added
      .map(({ name, quantity, isReduced }) => `${name} ${quantity}개${isReduced ? "(재고에 맞춰 줄임)" : ""}`)
      .join(", ");
    parts.push(`장바구니에 담았습니다: ${names}.`);
  }
  if (skipped.length > 0) {
    const names = skipped.map(({ name, reason }) => `${name}(${reason})`).join(", ");
    parts.push(`담지 못한 상품: ${names}.`);
  }
  return parts.join(" ");
}
