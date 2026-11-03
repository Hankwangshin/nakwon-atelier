const PHONE_PATTERN = /^01\d-?\d{3,4}-?\d{4}$/;

// 회원가입과 내 정보 수정이 같은 기준으로 검사하도록 한곳에 둔다.
export function findProfileProblem(name: unknown, phone: unknown): string | null {
  if (typeof name !== "string" || name.trim() === "") {
    return "이름을 입력해 주세요.";
  }
  if (typeof phone !== "string" || !PHONE_PATTERN.test(phone)) {
    return "휴대폰 번호 형식을 확인해 주세요.";
  }
  return null;
}
