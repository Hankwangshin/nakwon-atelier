import { createAdminClient } from "@/lib/supabase";

// 이 파일은 서버 전용 키를 쓰므로 서버 쪽 코드에서만 가져온다.

// 본인 탈퇴와 관리자의 탈퇴 처리가 함께 쓴다. 이메일, 탈퇴 상태, 탈퇴 날짜만 남기고
// 이름·연락처·주소·장바구니·등급·권한은 지운다. 주문은 회원 연결만 끊어 보관한다.
// 로그인은 서버의 회원 구분 확인(로그인 API, getCurrentUser)과 데이터베이스 RLS가 막는다.
// Supabase의 계정 정지(ban)는 비밀번호가 틀려도 정지 사실을 알려 주므로 쓰지 않는다.
// 처리했으면 true, 이미 탈퇴했거나 시스템관리자라서 하지 않았으면 false.
export async function withdrawMember(id: string): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("withdraw_member", { target: id });
  if (error) {
    throw new Error(`withdraw failed: ${error.code}`);
  }
  return data === true;
}
