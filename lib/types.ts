// Design Ref: §5 — 상품 안내 문서(data/products.json)의 상품 1개 구조
export interface Product {
  id: string; // 상품 구분용 번호 (예: "p01")
  name: string; // 상품명
  price: number; // 가격(원)
  stock: number; // 재고 수량
  shipping: string; // 배송 안내
  features: string; // 특징
  recommendedFor: string[]; // 추천 대상
  basisDate: string; // 기준일 (YYYY-MM-DD)
}
