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
        ...(body ? { "Content-Type": "application/json" } : {}),
        Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      },
      body: body ? JSON.stringify(body) : undefined,
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
  const fake = await confirm(userA, { paymentKey: "fake", orderId: orderNumber, amount });
  check("가짜 결제 키는 결제대행사가 거절", fake.body?.error?.code === "PAYMENT_FAILED");
  check("실패한 주문은 다시 승인 불가", (await confirm(userA, { paymentKey: "fake", orderId: orderNumber, amount })).status === 409);
  check("실패한 주문은 주문 내역에 없음", (await userA("/api/orders")).body.orders.length === 0);
  check("결제 실패 시 장바구니 유지", (await userA("/api/cart")).body.lines.length === 1);

  // 탈퇴
  check("로그아웃 후 정보 없음", await (async () => {
    await userB("/api/auth/logout", "POST");
    return (await userB("/api/auth/me")).body.user === null;
  })());
  check("회원 탈퇴", (await userA("/api/auth/me", "DELETE")).status === 200);
  const { data: profile } = await admin.from("profiles").select("id").eq("id", me.id);
  check("탈퇴 시 회원 정보 삭제", profile.length === 0);
  const { data: cart } = await admin.from("cart_items").select("product_id").eq("user_id", me.id);
  check("탈퇴 시 장바구니 삭제", cart.length === 0);
  const { data: kept } = await admin.from("orders").select("user_id").eq("order_number", orderNumber).single();
  check("탈퇴해도 주문은 보관, 회원 연결만 끊김", kept.user_id === null);
} finally {
  // 시험 데이터 정리
  await admin.from("orders").delete().like("receiver_name", "시험 회원");
  for (const id of createdIds) {
    await admin.auth.admin.deleteUser(id).catch(() => null);
  }
}

console.log(failures === 0 ? "모두 통과" : `실패 ${failures}개`);
process.exit(failures === 0 ? 0 : 1);
