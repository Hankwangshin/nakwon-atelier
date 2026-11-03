import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// 이 파일에는 서버 전용 키가 쓰이므로 서버 쪽 코드에서만 가져온다.

// 로그인한 회원 권한으로 동작한다. 데이터베이스의 RLS 규칙이 적용된다.
export async function createUserClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (items) => {
          for (const { name, value, options } of items) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );
}

// 주문과 회원 정보 저장, 탈퇴 처리처럼 서버만 할 수 있는 일에 쓴다.
export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// 지금 로그인 상태(쿠키)를 건드리지 않도록 따로 연결해서 비밀번호만 확인한다.
export async function isPasswordCorrect(email: string, password: string) {
  const client = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_ANON_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await client.auth.signInWithPassword({ email, password });
  return !error;
}

export async function getCurrentUser() {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
