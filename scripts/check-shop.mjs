// 회원가입, 장바구니, 주문, 결제 승인, 권한을 실제 서버로 점검한다.
// 시험 계정은 무작위로 만들고 끝나면 지운다. OpenAI는 호출하지 않는다.
// 실행: npm run dev를 켠 뒤 node scripts/check-shop.mjs
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { summarizeCart } from "../lib/cart.ts";

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
  address: "샘플 주소지 1",
  shippingAddress: "샘플 배송지 1",
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
const tierName = `점검${randomBytes(3).toString("hex")}`;

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

  // 회원 등급과 할인
  const tierUrl = "/api/admin/tiers";
  check("비회원 등급 조회 거절", (await guest(tierUrl)).status === 401);
  check("일반 회원 등급 조회 거절", (await userA(tierUrl)).status === 403);
  check("일반 회원 등급 추가 거절", (await userA(tierUrl, "POST", { name: tierName, discountPercent: 10 })).status === 403);
  check("할인율 51% 거절", (await manager(tierUrl, "POST", { name: tierName, discountPercent: 51 })).status === 400);
  check("소수 할인율 거절", (await manager(tierUrl, "POST", { name: tierName, discountPercent: 1.5 })).status === 400);
  check("빈 등급 이름 거절", (await manager(tierUrl, "POST", { name: " ", discountPercent: 10 })).status === 400);
  check("등급 추가", (await manager(tierUrl, "POST", { name: tierName, discountPercent: 10 })).status === 201);
  check("같은 등급 이름 거절", (await manager(tierUrl, "POST", { name: tierName, discountPercent: 5 })).status === 409);
  const tierList = (await manager(tierUrl)).body.tiers;
  const defaultTier = tierList.find(({ isDefault }) => isDefault);
  const newTier = tierList.find(({ name }) => name === tierName);
  check("기본 등급 삭제 거절", (await manager(`${tierUrl}/${defaultTier.id}`, "DELETE")).status === 409);

  const memberUrl = (id) => `/api/admin/members/${id}`;
  check("일반 회원 등급 지정 거절", (await userA(memberUrl(me.id), "PATCH", { tierId: newTier.id })).status === 403);
  check("없는 구분 거절", (await manager(memberUrl(me.id), "PATCH", { tierId: newTier.id, role: "owner" })).status === 400);
  check("없는 등급 거절", (await manager(memberUrl(me.id), "PATCH", { tierId: "00000000-0000-0000-0000-000000000000" })).status === 404);
  check("없는 회원 거절", (await manager(memberUrl("00000000-0000-0000-0000-000000000000"), "PATCH", { tierId: newTier.id })).status === 404);
  check("본인 등급 변경 거절", (await manager(memberUrl(tempAdmin.user.id), "PATCH", { tierId: newTier.id })).status === 403);
  check("할인 전 금액", (await userA("/api/cart")).body.amount === 12000);
  check("관리자가 등급 지정", (await manager(memberUrl(me.id), "PATCH", { tierId: newTier.id })).status === 200);
  const discounted = (await userA("/api/cart")).body;
  check("할인은 상품 금액에만 적용", discounted.discountAmount === 900 && discounted.shippingFee === 3000 && discounted.amount === 11100);
  check("1원 미만은 할인액에서 버림", summarizeCart([{ product_id: "x", quantity: 1 }], [{ id: "x", price: 999, shipping: "무료" }], { tierName: "t", percent: 15 }).discountAmount === 149);
  const discountedOrder = await userA("/api/orders", "POST", shipping);
  check("주문 금액에 할인 적용", discountedOrder.body.amount === 11100 && discountedOrder.body.discountAmount === 900);
  check("할인율 수정", (await manager(`${tierUrl}/${newTier.id}`, "PATCH", { name: tierName, discountPercent: 20 })).status === 200);
  check("수정한 할인율이 장바구니에 바로 반영", (await userA("/api/cart")).body.amount === 10200);
  const { data: savedOrder } = await admin.from("orders").select("amount, tier_name, discount_percent, discount_amount").eq("order_number", discountedOrder.body.orderNumber).single();
  check("지난 주문의 할인은 그대로", savedOrder.amount === 11100 && savedOrder.discount_percent === 10 && savedOrder.discount_amount === 900 && savedOrder.tier_name === tierName);
  const { data: tierRows } = await anon.from("membership_tiers").select("*");
  check("공개 키로 등급을 볼 수 없음", (tierRows ?? []).length === 0);
  await signedIn.from("profiles").update({ tier_id: newTier.id, is_admin: true }).eq("id", meB.id);
  const { data: selfRaised } = await admin.from("profiles").select("tier_id, is_admin").eq("id", meB.id).single();
  check("회원이 스스로 등급을 올리거나 시스템관리자가 될 수 없음", selfRaised.tier_id === null && selfRaised.is_admin === false);
  check("등급 삭제", (await manager(`${tierUrl}/${newTier.id}`, "DELETE")).status === 200);
  check("등급을 지우면 기본 등급으로 계산", (await userA("/api/cart")).body.amount === 12000);

  // 관리 권한 범위
  check("일반회원은 상품 관리 거절", (await userA("/api/admin/products")).status === 403);
  check("일반회원은 회원 관리 거절", (await userA("/api/admin/members")).status === 403);
  check("일반회원은 구분을 바꿀 수 없음", (await userA(memberUrl(tempAdmin.user.id), "PATCH", { role: "active" })).status === 403);
  check("시스템관리자로 지정하며 등급 지정 거절", (await manager(memberUrl(me.id), "PATCH", { role: "admin", tierId: defaultTier.id })).body?.error?.code === "TIER_ACTIVE_ONLY");
  check("시스템관리자로 지정", (await manager(memberUrl(me.id), "PATCH", { role: "admin" })).status === 200);
  check("지정되면 내 정보에 시스템관리자 표시", (await userA("/api/auth/me")).body.user.isAdmin === true);
  check("시스템관리자는 상품·회원·요청 관리 가능", (await userA("/api/admin/products")).status === 200 && (await userA("/api/admin/members")).status === 200 && (await userA("/api/admin/requests")).status === 200);
  check("본인 구분은 스스로 못 바꿈", (await userA(memberUrl(me.id), "PATCH", { role: "active" })).status === 403);
  check("시스템관리자 해제", (await manager(memberUrl(me.id), "PATCH", { role: "active" })).status === 200);
  check("해제하면 바로 관리 메뉴 거절", (await userA("/api/admin/products")).status === 403 && (await userA("/api/auth/me")).body.user.isAdmin === false);
  check("시스템관리자 표시", (await manager("/api/auth/me")).body.user.isAdmin === true);
  check("내 정보에 영역 권한을 보내지 않음", !("adminScopes" in (await manager("/api/auth/me")).body.user));

  // 회원 관리
  check("비회원 회원 목록 거절", (await guest("/api/admin/members")).status === 401);
  check("일반 회원 회원 목록 거절", (await userB("/api/admin/members")).status === 403);
  check("일반 회원의 탈퇴 처리 거절", (await userB(`/api/admin/members/${me.id}`, "DELETE")).status === 403);
  const memberList = await manager("/api/admin/members");
  const listedA = memberList.body?.members?.find(({ id }) => id === me.id);
  check("관리자는 회원 목록을 봄", listedA?.email === accountA.email);
  check("회원 목록에 상세 정보 포함", listedA?.phone === accountA.phone && listedA.shippingAddress === accountA.shippingAddress);
  const searchNames = async (field, q) => (await manager(`/api/admin/members?${new URLSearchParams({ field, q })}`)).body?.members?.map(({ id }) => id) ?? [];
  const emailPart = accountA.email.slice(0, 20).toUpperCase();
  check("아이디 검색(대소문자 무시)", (await searchNames("email", emailPart)).join() === me.id);
  check("성명 검색에는 아이디가 안 걸림", !(await searchNames("name", emailPart)).includes(me.id));
  check("전체 검색은 아이디도 찾음", (await searchNames("all", emailPart)).includes(me.id));
  check("성명 검색", (await searchNames("name", "임시 관리자")).includes(tempAdmin.user.id));
  check("없는 검색 조건 거절", (await manager("/api/admin/members?field=phone&q=010")).status === 400);
  check("51자 검색어 거절", (await manager(`/api/admin/members?field=all&q=${"가".repeat(51)}`)).status === 400);
  check("일반 회원 검색 거절", (await userB("/api/admin/members?field=all&q=a")).status === 403);
  // 관리자의 회원 추가
  const created = { ...newAccount(), name: "추가한 회원", consentConfirmed: true };
  check("일반 회원 회원 추가 거절", (await userB("/api/admin/members", "POST", created)).status === 403);
  check("비회원 회원 추가 거절", (await guest("/api/admin/members", "POST", created)).status === 401);
  check("동의 확인 없으면 추가 거절", (await manager("/api/admin/members", "POST", { ...created, consentConfirmed: false })).body?.error?.code === "CONSENT_REQUIRED");
  check("짧은 첫 비밀번호 거절", (await manager("/api/admin/members", "POST", { ...created, password: "short" })).status === 400);
  check("이메일 형식 거절", (await manager("/api/admin/members", "POST", { ...created, email: "not-email" })).status === 400);
  check("휴대폰 형식 거절(추가)", (await manager("/api/admin/members", "POST", { ...created, phone: "1234" })).status === 400);
  check("빈 주소지 거절(추가)", (await manager("/api/admin/members", "POST", { ...created, address: " " })).status === 400);
  check("이미 가입한 이메일 거절", (await manager("/api/admin/members", "POST", { ...created, email: accountA.email })).status === 409);
  const createdRes = await manager("/api/admin/members", "POST", { ...created, isAdmin: true });
  check("관리자가 회원 추가", createdRes.status === 201 && Boolean(createdRes.body?.id));
  if (createdRes.body?.id) createdIds.push(createdRes.body.id);
  const createdRow = (await admin.from("profiles").select("name, is_admin, tier_id, agreed_terms_at, agreed_privacy_at").eq("id", createdRes.body?.id).single()).data;
  check("추가한 회원은 기본 등급의 일반회원·동의 시각 저장", createdRow?.is_admin === false && createdRow.tier_id === null && Boolean(createdRow.agreed_terms_at && createdRow.agreed_privacy_at));
  check("추가한 회원이 목록에 보임", (await searchNames("email", created.email)).includes(createdRes.body?.id));
  check("추가한 회원이 첫 비밀번호로 로그인", (await createBrowser()("/api/auth/login", "POST", { email: created.email, password: created.password })).status === 200);

  const memberEdit = { tierId: defaultTier.id, name: "관리자가 고친 이름", phone: "010-3333-4444", address: "고친 주소지", shippingAddress: "" };
  check("관리자 수정 시 휴대폰 형식 거절", (await manager(memberUrl(me.id), "PATCH", { ...memberEdit, phone: "1234" })).status === 400);
  check("관리자 수정 시 빈 성명 거절", (await manager(memberUrl(me.id), "PATCH", { ...memberEdit, name: " " })).status === 400);
  check("관리자 수정 시 긴 주소 거절", (await manager(memberUrl(me.id), "PATCH", { ...memberEdit, address: "가".repeat(201) })).status === 400);
  check("관리자가 회원 정보 수정", (await manager(memberUrl(me.id), "PATCH", memberEdit)).status === 200);
  const editedByAdmin = (await manager("/api/admin/members?field=name&q=관리자가 고친")).body.members.find(({ id }) => id === me.id);
  check("수정한 값이 목록에 반영, 빈 배송지는 비움", editedByAdmin?.phone === "010-3333-4444" && editedByAdmin.address === "고친 주소지" && editedByAdmin.shippingAddress === "");
  check("본인 정보는 회원 관리에서 수정 거절", (await manager(memberUrl(tempAdmin.user.id), "PATCH", memberEdit)).status === 403);
  await manager(memberUrl(me.id), "PATCH", { ...memberEdit, name: "시험 회원" });
  const adminMember = memberList.body.members.find(({ id }) => id === tempAdmin.user.id);
  check("시스템관리자는 탈퇴 처리 불가", (await manager(`/api/admin/members/${adminMember.id}`, "DELETE")).status === 409);
  check("관리자 계정은 스스로 탈퇴 불가", (await manager("/api/auth/me", "DELETE")).status === 409);
  check("없는 회원 탈퇴 처리는 404", (await manager("/api/admin/members/00000000-0000-0000-0000-000000000000", "DELETE")).status === 404);
  await userB("/api/cart", "POST", { productId: "p01", quantity: 1 });

  // 회원 구분: 휴면
  const listRole = async (role) => (await manager(`/api/admin/members?${new URLSearchParams({ field: "all", q: "", role })}`)).body?.members?.map(({ id }) => id) ?? [];
  check("시스템관리자 구분 필터", (await listRole("admin")).includes(tempAdmin.user.id) && !(await listRole("active")).includes(tempAdmin.user.id));
  check("없는 구분 거절", (await manager("/api/admin/members?role=vip")).status === 400);
  check("휴면으로 바꾸며 등급 지정 거절", (await manager(memberUrl(meB.id), "PATCH", { role: "dormant", tierId: defaultTier.id })).body?.error?.code === "TIER_ACTIVE_ONLY");
  check("구분을 탈퇴로 바꾸기 거절(탈퇴 처리로만)", (await manager(memberUrl(meB.id), "PATCH", { role: "withdrawn" })).status === 400);
  check("일반회원은 시스템관리자를 휴면으로 못 바꿈", (await userA(memberUrl(tempAdmin.user.id), "PATCH", { role: "dormant" })).status === 403);
  check("관리자가 휴면으로 바꿈", (await manager(memberUrl(meB.id), "PATCH", { role: "dormant" })).status === 200);
  check("휴면 구분 필터", (await listRole("dormant")).includes(meB.id) && !(await listRole("active")).includes(meB.id));
  check("휴면회원은 로그인 쿠키가 있어도 로그아웃 상태", (await userB("/api/auth/me")).body.user === null);
  check("휴면회원 장바구니 서버 요청 거절", (await userB("/api/cart")).status === 401);
  const { data: dormantCart } = await signedIn.from("cart_items").select("product_id");
  check("휴면회원은 공개 키로도 자기 장바구니를 못 봄", (dormantCart ?? []).length === 0);
  const dormantLogin = await createBrowser()("/api/auth/login", "POST", { email: accountB.email, password: accountB.password });
  check("휴면회원 로그인 거절과 이유 안내", dormantLogin.status === 403 && dormantLogin.body?.error?.code === "DORMANT");
  check("휴면회원 등급 지정 거절", (await manager(memberUrl(meB.id), "PATCH", { tierId: defaultTier.id })).status === 409);
  check("일반회원으로 되돌림", (await manager(memberUrl(meB.id), "PATCH", { role: "active" })).status === 200);
  check("되돌리면 다시 로그인", (await createBrowser()("/api/auth/login", "POST", { email: accountB.email, password: accountB.password })).status === 200);
  check("되돌리면 기존 로그인도 다시 사용", (await userB("/api/auth/me")).body.user?.id === meB.id);
  // 관리자의 비밀번호 재설정
  const newPassword = randomBytes(12).toString("hex");
  check("짧은 새 비밀번호 거절", (await manager(memberUrl(meB.id), "PATCH", { password: "short", passwordConfirm: "short" })).status === 400);
  check("새 비밀번호 확인 불일치 거절", (await manager(memberUrl(meB.id), "PATCH", { password: newPassword, passwordConfirm: newPassword + "x" })).status === 400);
  check("일반회원은 남의 비밀번호를 못 바꿈", (await userA(memberUrl(meB.id), "PATCH", { password: newPassword, passwordConfirm: newPassword })).status === 403);
  check("본인 비밀번호는 회원 관리에서 못 바꿈", (await manager(memberUrl(tempAdmin.user.id), "PATCH", { password: newPassword, passwordConfirm: newPassword })).status === 403);
  const passwordRes = await manager(memberUrl(meB.id), "PATCH", { password: newPassword, passwordConfirm: newPassword });
  check("시스템관리자가 비밀번호 재설정", passwordRes.status === 200 && !JSON.stringify(passwordRes.body).includes(newPassword));
  check("재설정하면 그 회원의 기존 로그인이 끊김", (await userB("/api/auth/me")).body.user === null);
  check("예전 비밀번호로 로그인 불가", (await createBrowser()("/api/auth/login", "POST", { email: accountB.email, password: accountB.password })).status === 401);
  accountB.password = newPassword;
  check("새 비밀번호로 로그인", (await userB("/api/auth/login", "POST", { email: accountB.email, password: newPassword })).status === 200);
  // 등급 할인은 일반회원만
  const vvip = tierList.find(({ name }) => name === "VVIP") ?? newTier;
  await admin.from("profiles").update({ tier_id: vvip?.id ?? null }).eq("id", tempAdmin.user.id);
  await manager("/api/cart", "POST", { productId: "p01", quantity: 1 });
  check("시스템관리자는 등급이 있어도 할인 0원", (await manager("/api/cart")).body?.discountAmount === 0);

  check("관리자가 회원 탈퇴 처리", (await manager(`/api/admin/members/${meB.id}`, "DELETE")).status === 200);
  check("탈퇴 처리된 회원은 바로 로그아웃 상태", (await userB("/api/auth/me")).body.user === null);
  const withdrawnLogin = await createBrowser()("/api/auth/login", "POST", { email: accountB.email, password: accountB.password });
  check("탈퇴 처리된 회원은 로그인 불가, 이유 안내", withdrawnLogin.status === 403 && withdrawnLogin.body?.error?.code === "WITHDRAWN");
  check("탈퇴회원 로그인 실패 시 비밀번호가 틀리면 일반 안내", (await createBrowser()("/api/auth/login", "POST", { email: accountB.email, password: "wrong-password" })).status === 401);
  const { data: bProfile } = await admin.from("profiles").select("status, withdrawn_at, name, phone, address, shipping_address, tier_id, admin_scopes").eq("id", meB.id).single();
  const { data: bCart } = await admin.from("cart_items").select("product_id").eq("user_id", meB.id);
  check("탈퇴 처리 시 이메일·상태·날짜만 남고 장바구니 삭제", bProfile.status === "withdrawn" && Boolean(bProfile.withdrawn_at) && bProfile.name === null && bProfile.phone === null && bProfile.address === null && bProfile.shipping_address === null && bProfile.tier_id === null && bProfile.admin_scopes.length === 0 && bCart.length === 0);
  const withdrawnRow = (await manager(`/api/admin/members?${new URLSearchParams({ field: "email", q: accountB.email, role: "withdrawn" })}`)).body?.members?.[0];
  check("탈퇴회원은 이메일과 탈퇴일로 목록에 남음", withdrawnRow?.id === meB.id && withdrawnRow.email === accountB.email && Boolean(withdrawnRow.withdrawnAt) && withdrawnRow.name === "");
  check("탈퇴회원 비밀번호 재설정 거절", (await manager(memberUrl(meB.id), "PATCH", { password: newPassword, passwordConfirm: newPassword })).status === 409);
  check("탈퇴회원 정보 수정 거절", (await manager(memberUrl(meB.id), "PATCH", { role: "active" })).status === 409);
  check("이미 탈퇴한 회원 탈퇴 처리 거절", (await manager(memberUrl(meB.id), "DELETE")).status === 409);
  check("탈퇴한 이메일로 다시 가입 불가", (await guest("/api/auth/signup", "POST", accountB)).status === 409);

  // 내 정보 수정
  const profileEdit = { name: "바뀐 이름", phone: "010-1111-2222", address: "바뀐 주소지", shippingAddress: "바뀐 배송지", password: accountA.password };
  const readProfile = async () => (await admin.from("profiles").select("name, phone").eq("id", me.id).single()).data;
  check("비회원 내 정보 수정 거절", (await guest("/api/auth/me", "PATCH", profileEdit)).status === 401);
  check("비밀번호 없으면 수정 거절", (await userA("/api/auth/me", "PATCH", { ...profileEdit, password: undefined })).status === 400);
  check("틀린 비밀번호면 수정 거절", (await userA("/api/auth/me", "PATCH", { ...profileEdit, password: "wrong-password" })).body?.error?.code === "WRONG_PASSWORD");
  check("틀린 비밀번호면 저장 안 됨", (await readProfile()).name === "시험 회원");
  check("휴대폰 번호 형식 거절", (await userA("/api/auth/me", "PATCH", { ...profileEdit, phone: "1234" })).status === 400);
  check("빈 이름 거절", (await userA("/api/auth/me", "PATCH", { ...profileEdit, name: " " })).status === 400);
  check("비밀번호가 맞으면 수정", (await userA("/api/auth/me", "PATCH", { ...profileEdit, email: "changed@example.com", isAdmin: true })).status === 200);
  const edited = (await userA("/api/auth/me")).body.user;
  check("수정해도 로그인 유지, 이름과 번호 반영", edited?.name === "바뀐 이름" && edited.phone === "010-1111-2222");
  check("이메일과 권한은 함께 바뀌지 않음", edited.email === accountA.email && edited.isAdmin === false);
  await signedIn.from("profiles").update({ name: "직접 수정" }).eq("id", meB.id);
  check("공개 키로 회원 정보를 직접 고칠 수 없음", (await readProfile()).name === "바뀐 이름");

  // 탈퇴
  await userA("/api/auth/logout", "POST");
  check("로그아웃 후 정보 없음", (await userA("/api/auth/me")).body.user === null);
  check("다시 로그인", (await userA("/api/auth/login", "POST", { email: accountA.email, password: accountA.password })).status === 200);
  check("회원 탈퇴", (await userA("/api/auth/me", "DELETE")).status === 200);
  const { data: profile } = await admin.from("profiles").select("status, name, phone").eq("id", me.id).single();
  check("탈퇴 시 회원 정보 삭제, 탈퇴 상태만 남음", profile.status === "withdrawn" && profile.name === null && profile.phone === null);
  check("본인 탈퇴 후 로그인 불가", (await createBrowser()("/api/auth/login", "POST", { email: accountA.email, password: accountA.password })).body?.error?.code === "WITHDRAWN");
  const { data: cart } = await admin.from("cart_items").select("product_id").eq("user_id", me.id);
  check("탈퇴 시 장바구니 삭제", cart.length === 0);
  const { data: kept } = await admin.from("orders").select("user_id").eq("order_number", orderNumber).single();
  check("탈퇴해도 주문은 보관, 회원 연결만 끊김", kept.user_id === null);
} finally {
  // 시험 데이터 정리
  for (const id of createdProducts) {
    await admin.from("products").delete().eq("id", id);
  }
  await admin.from("membership_tiers").delete().eq("name", tierName);
  await admin.from("orders").delete().like("receiver_name", "시험 회원");
  for (const id of createdIds) {
    await admin.auth.admin.deleteUser(id).catch(() => null);
  }
}

console.log(failures === 0 ? "모두 통과" : `실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
