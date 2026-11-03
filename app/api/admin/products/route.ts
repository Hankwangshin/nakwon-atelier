import { denyUnlessAdmin } from "@/lib/admin";
import { serverFailedResponse } from "@/lib/http";
import { getAdminProducts } from "@/lib/products";

// 보유수량까지 포함한 상품 목록. 공개 상품 목록(/api/products)에는 보유수량이 없다.
export async function GET() {
  const denied = await denyUnlessAdmin();
  if (denied) {
    return denied;
  }

  try {
    return Response.json({ products: await getAdminProducts() });
  } catch {
    return serverFailedResponse();
  }
}
