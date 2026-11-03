import { logFailure } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

// 이 파일은 서버 전용 키를 쓰므로 서버 쪽 코드에서만 가져온다.

// 약 100년. 탈퇴회원은 되돌리지 않으므로 사실상 영구히 로그인을 막는다.
const WITHDRAWN_BAN = "876000h";

// 본인 탈퇴와 관리자의 탈퇴 처리가 함께 쓴다. 이메일, 탈퇴 상태, 탈퇴 날짜만 남기고
// 이름·연락처·주소·장바구니·등급·권한은 지운다. 주문은 회원 연결만 끊어 보관한다.
// 처리했으면 true, 이미 탈퇴했거나 시스템관리자라서 하지 않았으면 false.
export async function withdrawMember(id: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("withdraw_member", { target: id });
  if (error) {
    throw new Error(`withdraw failed: ${error.code}`);
  }
  if (data !== true) {
    return false;
  }

  // 로그인 자체도 막는다. 실패해도 서버가 회원 구분으로 한 번 더 막으므로 기록만 남긴다.
  const { error: banError } = await admin.auth.admin.updateUserById(id, {
    ban_duration: WITHDRAWN_BAN,
  });
  if (banError) {
    logFailure("withdraw ban failed", banError);
  }
  return true;
}
