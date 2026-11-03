// 회원가입, 장바구니, 주문, 결제 승인, 권한을 실제 서버로 점검한다.
// 시험 계정은 무작위로 만들고 끝나면 지운다. OpenAI는 호출하지 않는다.
// 실행: npm run dev를 켠 뒤 node scripts/check-shop.mjs
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";

process.loadEnvFile(new URL("../.env", import.meta.url));
const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");

const BASE = "http://localhost:3000";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let failures = 0;
function check(name, condition) {
  if (!condition) {
    failures += 1;
  }
  console.log(condition ? "OK  " : "FAIL", name);
}

// 브라우저처럼 쿠키를 기억하는 간단한 호출 도구
function createBrowser() {
  const cookies = new Map();
  return async (path, method = "GET", body) => {
    const response = await fetch(BASE + path, {
      method,
      headers: {
        ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const index = pair.indexOf("=");
      const name = pair.slice(0, index);
      const value = pair.slice(index + 1);
      if (value) {
        cookies.set(name, value);
      } else {
        cookies.delete(name);
      }
    }
    return { status: response.status, body: await response.json().catch(() => null) };
  };
}

const newAccount = () => ({
  email: `shop-check-${randomBytes(6).toString("hex")}@example.com`,
  password: randomBytes(12).toString("hex"),
  name: "시험 회원",
  phone: "010-0000-0000",
  isOver14: true,
  agreeTerms: true,
  agreePrivacy: true,
});

const userA = createBrowser();
const userB = createBrowser();
const guest = createBrowser();
const accountA = newAccount();
const accountB = newAccount();
const createdIds = [];
const createdProducts = [];

try {
  // 회원가입
  check("약한 비밀번호 거절", (await guest("/api/auth/signup", "POST", { ...accountA, password: "short" })).status === 400);
  check("만 14세 미만 거절", (await guest("/api/auth/signup", "POST", { ...accountA, isOver14: false })).status === 400);
  check("필수 동의 없으면 거절", (await guest("/api/auth/signup", "POST", { ...accountA, agreePrivacy: false })).status === 400);
  const signup = await userA("/api/auth/signup", "POST", accountA);
  check("정상 가입", signup.status === 201);
  check("중복 이메일 거절", (await guest("/api/auth/signup", "POST", accountA)).status === 409);
  check("가입 후 바로 로그인", (await userA("/api/auth/me")).body?.user?.name === "시험 회원");
  check("틀린 비밀번호 거절", (await guest("/api/auth/login", "POST", { email: accountA.email, password: "wrong-password" })).status === 401);
  check("두 번째 회원 가입", (await userB("/api/auth/signup", "POST", accountB)).status === 201);

  const me = (await userA("/api/auth/me")).body.user;
  const meB = (await userB("/api/auth/me")).body.user;
  createdIds.push(me.id, meB.id);

  // 장바구니
  check("비회원 장바구니 거절", (await guest("/api/cart")).status === 401);
  check("없는 상품 거절", (await userA("/api/cart", "POST", { productId: "p99" })).status === 400);
  check("품절 상품 거절", (await userA("/api/cart", "POST", { productId: "p04" })).status === 409);
  check("음수 수량 거절", (await userA("/api/cart", "POST", { productId: "p01", quantity: -5 })).status === 400);
  check("재고 초과 거절", (await userA("/api/cart", "POST", { productId: "p12", quantity: 4 })).status === 400);
  await userA("/api/cart", "POST", { productId: "p01", quantity: 1 });
  const added = await userA("/api/cart", "POST", { productId: "p01", quantity: 1 });
  check("같은 상품은 수량이 더해짐", added.body?.lines?.[0]?.quantity === 2);
  const two = await userA("/api/cart", "POST", { productId: "p02", quantity: 1 });
  check("금액은 문서 가격과 묶음 배송비로 계산", two.body.itemsAmount === 37000 && two.body.shippingFee === 3000 && two.body.amount === 40000);
  const changed = await userA("/api/cart", "PATCH", { productId: "p02", quantity: 2 });
  check("수량 변경", changed.body.itemsAmount === 65000);
  const removed = await userA("/api/cart", "DELETE", { productId: "p02" });
  check("상품 삭제", removed.body.lines.length === 1);
  check("다른 회원 장바구니는 비어 있음", (await userB("/api/cart")).body.lines.length === 0);

  // 데이터베이스 권한(RLS)
  const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: anonCart } = await anon.from("cart_items").select("*");
  check("공개 키로 장바구니를 볼 수 없음", (anonCart ?? []).length === 0);
  const { data: anonProfiles } = await anon.from("profiles").select("*");
  check("공개 키로 회원 정보를 볼 수 없음", (anonProfiles ?? []).length === 0);
  const { error: anonInsert } = await anon.from("orders").insert({ order_number: "hack", order_name: "x", items_amount: 0, shipping_fee: 0, amount: 1, receiver_name: "x", receiver_phone: "x", address: "x" });
  check("공개 키로 주문을 만들 수 없음", Boolean(anonInsert));

  const signedIn = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await signedIn.auth.signInWithPassword({ email: accountB.email, password: accountB.password });
  const { data: otherCart } = await signedIn.from("cart_items").select("*").eq("user_id", me.id);
  check("회원 B가 회원 A의 장바구니를 볼 수 없음", (otherCart ?? []).length === 0);

  // 주문과 결제
  const shipping = { receiverName: "시험 회원", receiverPhone: "010-0000-0000", address: "샘플 주소 1" };
  check("비회원 주문 거절", (await guest("/api/orders", "POST", shipping)).status === 401);
  check("배송 정보 없으면 거절", (await userA("/api/orders", "POST", {})).status === 400);
  check("빈 장바구니 주문 거절", (await userB("/api/orders", "POST", shipping)).status === 409);
  const order = await userA("/api/orders", "POST", shipping);
  check("주문 생성, 금액은 서버 계산", order.status === 201 && order.body.amount === 12000);
  const { orderNumber, amount } = order.body;

  const confirm = (browser, body) => browser("/api/payments/confirm", "POST", body);
  check("다른 회원은 승인 불가", (await confirm(userB, { paymentKey: "fake", orderId: orderNumber, amount })).status === 404);
  check("금액을 바꾸면 승인 거절", (await confirm(userA, { paymentKey: "fake", orderId: orderNumber, amount: 100 })).body?.error?.code === "AMOUNT_MISMATCH");
  const stockOf = async (id) => (await admin.from("products").select("stock, on_hand").eq("id", id).single()).data;
  const stockBeforeFailure = (await stockOf("p01")).stock;
  const fake = await confirm(userA, { paymentKey: "fake", orderId: orderNumber, amount });
  check("가짜 결제 키는 결제대행사가 거절", fake.body?.error?.code === "PAYMENT_FAILED");
  check("결제 실패 시 재고가 그대로", (await stockOf("p01")).stock === stockBeforeFailure);
  check("실패한 주문은 다시 승인 불가", (await confirm(userA, { paymentKey: "fake", orderId: orderNumber, amount })).status === 409);
  check("실패한 주문은 주문 내역에 없음", (await userA("/api/orders")).body.orders.length === 0);
  check("결제 실패 시 장바구니 유지", (await userA("/api/cart")).body.lines.length === 1);

  // 상품 관리
  const sample = { name: "점검용 상품", image: "/products/pen.svg", category: "pen", price: 1234, onHand: 5, stock: 5, shipping: "배송비 3,000원, 2~3일 소요", features: "점검용 설명입니다.", recommendedFor: ["친구"] };
  check("비회원 상품 추가 거절", (await guest("/api/products", "POST", sample)).status === 401);
  check("일반 회원 상품 추가 거절", (await userA("/api/products", "POST", sample)).status === 403);
  check("일반 회원 상품 수정 거절", (await userA("/api/products/p01", "PATCH", sample)).status === 403);
  check("일반 회원 상품 삭제 거절", (await userA("/api/products/p01", "DELETE")).status === 403);
  const { error: anonProduct } = await anon.from("products").insert({ id: "hack", name: "x", image: "x", price: 1, stock: 1, shipping: "x", features: "x", recommended_for: ["친구"] });
  check("공개 키로 상품을 추가할 수 없음", Boolean(anonProduct));
  const { error: selfAdmin } = await signedIn.from("profiles").update({ is_admin: true }).eq("id", meB.id).select();
  const { data: stillUser } = await admin.from("profiles").select("is_admin").eq("id", meB.id).single();
  check("회원이 스스로 관리자가 될 수 없음", stillUser.is_admin === false || Boolean(selfAdmin));

  // 실제 관리자 비밀번호를 쓰지 않도록 임시 관리자를 만들어 시험하고 지운다.
  const manager = createBrowser();
  const accountM = newAccount();
  const { data: tempAdmin } = await admin.auth.admin.createUser({ email: accountM.email, password: accountM.password, email_confirm: true });
  createdIds.push(tempAdmin.user.id);
  await admin.from("profiles").insert({ id: tempAdmin.user.id, name: "임시 관리자", phone: "010-0000-0000", agreed_terms_at: new Date().toISOString(), agreed_privacy_at: new Date().toISOString(), is_admin: true });
  check("관리자 로그인", (await manager("/api/auth/login", "POST", { email: accountM.email, password: accountM.password })).status === 200);
  check("관리자 표시", (await manager("/api/auth/me")).body?.user?.isAdmin === true);
  check("가격 0 거절", (await manager("/api/products", "POST", { ...sample, price: 0 })).status === 400);
  check("없는 그림 거절", (await manager("/api/products", "POST", { ...sample, image: "https://example.com/x.png" })).status === 400);
  check("없는 추천 대상 거절", (await manager("/api/products", "POST", { ...sample, recommendedFor: ["기타"] })).status === 400);
  check("배송 안내 형식 거절", (await manager("/api/products", "POST", { ...sample, shipping: "빠른 배송" })).status === 400);
  const addedProduct = await manager("/api/products", "POST", sample);
  check("상품 추가", addedProduct.status === 201);
  const newId = addedProduct.body.id;
  createdProducts.push(newId);
  const listed = (await guest("/api/products")).body.products.find(({ id }) => id === newId);
  check("추가한 상품이 공개 목록에 보임", listed?.price === 1234);
  // 상품 사진
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const fileForm = (bytes, type, name) => {
    const form = new FormData();
    form.append("file", new Blob([bytes], { type }), name);
    return form;
  };
  const uploadUrl = "/api/admin/product-images";
  // 공개 주소는 CDN 캐시가 남을 수 있어 저장소 목록으로 삭제를 확인한다.
  const isStored = async (url) => {
    const name = url.split("/").pop();
    const { data } = await admin.storage.from("product-images").list("", { search: name });
    return data.some((item) => item.name === name);
  };
  check("비회원 사진 업로드 거절", (await guest(uploadUrl, "POST", fileForm(png, "image/png", "a.png"))).status === 401);
  check("일반 회원 사진 업로드 거절", (await userA(uploadUrl, "POST", fileForm(png, "image/png", "a.png"))).status === 403);
  check("파일 없으면 거절", (await manager(uploadUrl, "POST", new FormData())).status === 400);
  check("이름만 png인 글자 파일 거절", (await manager(uploadUrl, "POST", fileForm(Buffer.from("not image"), "image/png", "a.png"))).status === 400);
  check("SVG 파일 거절", (await manager(uploadUrl, "POST", fileForm(Buffer.from("<svg onload='alert(1)'></svg>"), "image/svg+xml", "a.svg"))).status === 400);
  check("5MB 초과 거절", (await manager(uploadUrl, "POST", fileForm(Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]), "image/png", "a.png"))).body?.error?.code === "IMAGE_TOO_LARGE");
  const upload = async () => (await manager(uploadUrl, "POST", fileForm(png, "image/png", "photo.png"))).body.url;
  const firstPhoto = await upload();
  check("관리자 사진 업로드", Boolean(firstPhoto));
  check("올린 사진을 누구나 볼 수 있음", (await fetch(firstPhoto)).status === 200);
  check("외부 사진 주소 거절", (await manager(`/api/products/${newId}`, "PATCH", { ...sample, image: "https://example.com/a.png" })).status === 400);
  check("상품에 사진 저장", (await manager(`/api/products/${newId}`, "PATCH", { ...sample, image: firstPhoto })).status === 200);
  const secondPhoto = await upload();
  check("사진 교체", (await manager(`/api/products/${newId}`, "PATCH", { ...sample, image: secondPhoto })).status === 200);
  check("교체한 사진이 목록에 보임", (await guest("/api/products")).body.products.find(({ id }) => id === newId).image === secondPhoto);
  check("이전 사진은 저장소에서 삭제", !(await isStored(firstPhoto)));
  check("새 사진은 저장소에 남음", await isStored(secondPhoto));
  const discardPhoto = await upload();
  check("일반 회원 사진 삭제 거절", (await userA(uploadUrl, "DELETE", { url: discardPhoto })).status === 403);
  await manager(uploadUrl, "DELETE", { url: discardPhoto });
  check("취소한 사진 삭제", !(await isStored(discardPhoto)));
  check("저장소 밖 주소는 지우지 않음", (await manager(uploadUrl, "DELETE", { url: "/products/pen.svg" })).status === 200);

  await userB("/api/auth/login", "POST", { email: accountB.email, password: accountB.password });
  await userB("/api/cart", "POST", { productId: newId, quantity: 1 });
  check("수정 전 가격으로 장바구니 계산", (await userB("/api/cart")).body.itemsAmount === 1234);
  check("상품 수정", (await manager(`/api/products/${newId}`, "PATCH", { ...sample, image: secondPhoto, price: 2000, features: "수정한 설명입니다." })).status === 200);
  check("수정한 가격이 장바구니에 바로 반영", (await userB("/api/cart")).body.itemsAmount === 2000);
  check("없는 상품 수정은 404", (await manager("/api/products/nope", "PATCH", sample)).status === 404);

  // 재고 관리
  const stockInput = { ...sample, image: secondPhoto, price: 2000 };
  check("재고수량이 보유수량보다 크면 거절", (await manager(`/api/products/${newId}`, "PATCH", { ...stockInput, stock: 6 })).status === 400);
  check("보유수량 없으면 거절", (await manager(`/api/products/${newId}`, "PATCH", { ...stockInput, onHand: undefined })).status === 400);
  check("공개 목록에 보유수량이 없음", !("onHand" in (await guest("/api/products")).body.products[0]));
  check("비회원 보유수량 조회 거절", (await guest("/api/admin/products")).status === 401);
  check("일반 회원 보유수량 조회 거절", (await userB("/api/admin/products")).status === 403);
  check("관리자는 보유수량을 봄", (await manager("/api/admin/products")).body?.products?.find(({ id }) => id === newId)?.onHand === 5);
  const { error: anonOnHand } = await anon.from("products").select("on_hand").limit(1);
  check("공개 키로 보유수량을 볼 수 없음", Boolean(anonOnHand));

  const makeStockOrder = async (quantity) => {
    const { data } = await admin.from("orders").insert({ order_number: `order_check_${randomBytes(6).toString("hex")}`, user_id: meB.id, order_name: "재고 점검", items_amount: 1000, shipping_fee: 0, amount: 1000, receiver_name: "시험 회원", receiver_phone: "010-0000-0000", address: "샘플 주소" }).select("id").single();
    await admin.from("order_items").insert({ order_id: data.id, product_id: newId, name: "점검용 상품", price: 1000, quantity });
    return data.id;
  };
  const deduct = (id, client = admin) => client.rpc("deduct_order_stock", { target_order: id });
  const restore = (id) => admin.rpc("restore_order_stock", { target_order: id });

  const stockOrder = await makeStockOrder(2);
  check("공개 키로 재고를 줄일 수 없음", Boolean((await deduct(stockOrder, anon)).error));
  check("공개 키로 재고가 줄지 않음", (await stockOf(newId)).stock === 5);
  check("결제 시 재고 차감", (await deduct(stockOrder)).data === true && (await stockOf(newId)).stock === 3);
  await deduct(stockOrder);
  check("같은 주문은 두 번 차감하지 않음", (await stockOf(newId)).stock === 3);
  const tooMany = await makeStockOrder(4);
  check("재고보다 많으면 차감 거절", (await deduct(tooMany)).data === false);
  const { data: untouched } = await admin.from("orders").select("stock_deducted").eq("id", tooMany).single();
  check("차감 거절 시 아무것도 바뀌지 않음", (await stockOf(newId)).stock === 3 && untouched.stock_deducted === false);
  await restore(tooMany);
  check("차감하지 않은 주문은 복구하지 않음", (await stockOf(newId)).stock === 3);
  await restore(stockOrder);
  check("취소 시 재고 복구", (await stockOf(newId)).stock === 5);
  await restore(stockOrder);
  check("같은 주문은 두 번 복구하지 않음", (await stockOf(newId)).stock === 5);
  await deduct(stockOrder);
  check("보유수량을 줄임", (await manager(`/api/products/${newId}`, "PATCH", { ...stockInput, onHand: 4, stock: 3 })).status === 200);
  await restore(stockOrder);
  check("복구는 보유수량을 넘지 않음", (await stockOf(newId)).stock === 4);

  const raced = await userB("/api/orders", "POST", shipping);
  await admin.from("products").update({ stock: 0 }).eq("id", newId);
  const soldOut = await confirm(userB, { paymentKey: "fake", orderId: raced.body.orderNumber, amount: raced.body.amount });
  check("승인 직전 품절이면 결제 진행 안 함", soldOut.body?.error?.code === "OUT_OF_STOCK");
  const { data: racedOrder } = await admin.from("orders").select("status").eq("order_number", raced.body.orderNumber).single();
  check("재고 부족 주문은 실패 처리", racedOrder.status === "failed");

  check("상품 삭제", (await manager(`/api/products/${newId}`, "DELETE")).status === 200);
  check("삭제한 상품의 사진도 저장소에서 삭제", !(await isStored(secondPhoto)));
  check("삭제한 상품은 공개 목록에서 사라짐", !(await guest("/api/products")).body.products.some(({ id }) => id === newId));
  check("삭제한 상품은 장바구니에서도 사라짐", (await userB("/api/cart")).body.lines.length === 0);

  // 상품 교환, 결제 취소
  const makePaidOrder = async (userId, key) => {
    const number = `order_check_${randomBytes(6).toString("hex")}`;
    await admin.from("orders").insert({ order_number: number, user_id: userId, order_name: "점검 주문", items_amount: 1000, shipping_fee: 0, amount: 1000, status: "paid", payment_key: key, receiver_name: "시험 회원", receiver_phone: "010-0000-0000", address: "샘플 주소", paid_at: new Date().toISOString() });
    return number;
  };
  const paid = await makePaidOrder(meB.id, "fake-payment-key");
  const requestUrl = `/api/orders/${paid}/requests`;
  const readRequests = async () => (await manager("/api/admin/requests")).body.requests.filter(({ orders }) => orders.order_number === paid);
  const decide = (browser, id, decision) => browser(`/api/admin/requests/${id}`, "PATCH", { decision });

  check("비회원 교환 신청 거절", (await guest(requestUrl, "POST", { type: "exchange", reason: "사유" })).status === 401);
  check("다른 회원 주문에 요청 불가", (await manager(requestUrl, "POST", { type: "exchange", reason: "사유" })).status === 404);
  check("사유 없으면 거절", (await userB(requestUrl, "POST", { type: "exchange", reason: "  " })).status === 400);
  check("없는 요청 종류 거절", (await userB(requestUrl, "POST", { type: "refund", reason: "사유" })).status === 400);
  check("상품 교환 신청", (await userB(requestUrl, "POST", { type: "exchange", reason: "색상을 바꾸고 싶어요" })).status === 201);
  check("처리 중이면 중복 요청 거절", (await userB(requestUrl, "POST", { type: "cancel", reason: "사유" })).status === 409);
  const listedOrder = (await userB("/api/orders")).body.orders.find(({ order_number }) => order_number === paid);
  check("주문 내역에 요청 상태 표시", listedOrder?.order_requests?.[0]?.status === "pending");
  check("일반 회원 요청 목록 거절", (await userB("/api/admin/requests")).status === 403);
  const [exchange] = await readRequests();
  check("일반 회원 승인 거절", (await decide(userB, exchange.id, "approve")).status === 403);
  check("비회원 승인 거절", (await decide(guest, exchange.id, "approve")).status === 401);
  check("잘못된 처리 방법 거절", (await decide(manager, exchange.id, "maybe")).status === 400);
  check("관리자 교환 승인", (await decide(manager, exchange.id, "approve")).status === 200);
  check("처리된 요청은 다시 승인 불가", (await decide(manager, exchange.id, "approve")).status === 409);

  check("결제 취소 요청", (await userB(requestUrl, "POST", { type: "cancel", reason: "마음이 바뀌었어요" })).status === 201);
  const cancelRequest = (await readRequests()).find(({ type }) => type === "cancel");
  check("관리자 거절", (await decide(manager, cancelRequest.id, "reject")).status === 200);
  check("거절 후 다시 요청 가능", (await userB(requestUrl, "POST", { type: "cancel", reason: "다시 요청합니다" })).status === 201);
  const reopened = (await readRequests()).find(({ status }) => status === "pending");
  const failedCancel = await decide(manager, reopened.id, "approve");
  check("결제대행사가 거절하면 취소 실패", failedCancel.body?.error?.code === "CANCEL_FAILED");
  const { data: stillPaid } = await admin.from("orders").select("status").eq("order_number", paid).single();
  check("취소 실패 시 주문은 결제 완료 유지", stillPaid.status === "paid");
  check("취소 실패 시 요청은 대기로 복구", (await readRequests()).some(({ id, status }) => id === reopened.id && status === "pending"));
  const { error: anonRequest } = await signedIn.from("order_requests").update({ status: "approved" }).eq("id", reopened.id).select();
  const { data: unchanged } = await admin.from("order_requests").select("status").eq("id", reopened.id).single();
  check("회원이 직접 요청을 승인할 수 없음", unchanged.status === "pending" || Boolean(anonRequest));
  check("대기 주문에는 요청 불가", (await userA(`/api/orders/${orderNumber}/requests`, "POST", { type: "cancel", reason: "사유" })).status === 409);

  // 회원 관리
  check("비회원 회원 목록 거절", (await guest("/api/admin/members")).status === 401);
  check("일반 회원 회원 목록 거절", (await userB("/api/admin/members")).status === 403);
  check("일반 회원의 탈퇴 처리 거절", (await userB(`/api/admin/members/${me.id}`, "DELETE")).status === 403);
  const memberList = await manager("/api/admin/members");
  const listedA = memberList.body?.members?.find(({ id }) => id === me.id);
  check("관리자는 회원 목록을 봄", listedA?.email === accountA.email);
  check("회원 목록에 연락처를 보내지 않음", listedA && !("phone" in listedA));
  const adminMember = memberList.body.members.find(({ id }) => id === tempAdmin.user.id);
  check("관리자 계정은 탈퇴 처리 불가", (await manager(`/api/admin/members/${adminMember.id}`, "DELETE")).status === 409);
  check("관리자 계정은 스스로 탈퇴 불가", (await manager("/api/auth/me", "DELETE")).status === 409);
  check("없는 회원 탈퇴 처리는 404", (await manager("/api/admin/members/00000000-0000-0000-0000-000000000000", "DELETE")).status === 404);
  await userB("/api/cart", "POST", { productId: "p01", quantity: 1 });
  check("관리자가 회원 탈퇴 처리", (await manager(`/api/admin/members/${meB.id}`, "DELETE")).status === 200);
  check("탈퇴 처리된 회원은 바로 로그아웃 상태", (await userB("/api/auth/me")).body.user === null);
  check("탈퇴 처리된 회원은 로그인 불가", (await guest("/api/auth/login", "POST", { email: accountB.email, password: accountB.password })).status === 401);
  const { data: bProfile } = await admin.from("profiles").select("id").eq("id", meB.id);
  const { data: bCart } = await admin.from("cart_items").select("product_id").eq("user_id", meB.id);
  check("탈퇴 처리 시 회원 정보와 장바구니 삭제", bProfile.length === 0 && bCart.length === 0);

  // 탈퇴
  await userA("/api/auth/logout", "POST");
  check("로그아웃 후 정보 없음", (await userA("/api/auth/me")).body.user === null);
  check("다시 로그인", (await userA("/api/auth/login", "POST", { email: accountA.email, password: accountA.password })).status === 200);
  check("회원 탈퇴", (await userA("/api/auth/me", "DELETE")).status === 200);
  const { data: profile } = await admin.from("profiles").select("id").eq("id", me.id);
  check("탈퇴 시 회원 정보 삭제", profile.length === 0);
  const { data: cart } = await admin.from("cart_items").select("product_id").eq("user_id", me.id);
  check("탈퇴 시 장바구니 삭제", cart.length === 0);
  const { data: kept } = await admin.from("orders").select("user_id").eq("order_number", orderNumber).single();
  check("탈퇴해도 주문은 보관, 회원 연결만 끊김", kept.user_id === null);
} finally {
  // 시험 데이터 정리
  for (const id of createdProducts) {
    await admin.from("products").delete().eq("id", id);
  }
  await admin.from("orders").delete().like("receiver_name", "시험 회원");
  for (const id of createdIds) {
    await admin.auth.admin.deleteUser(id).catch(() => null);
  }
}

console.log(failures === 0 ? "모두 통과" : `실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
