import { MAX_ADDRESS_LENGTH } from "@/lib/limits";

const PHONE_PATTERN = /^01\d-?\d{3,4}-?\d{4}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;

// 회원가입과 관리자의 회원 추가가 같은 기준으로 이메일과 비밀번호를 검사한다.
export function findAccountProblem(email: unknown, password: unknown): string | null {
  if (typeof email !== "string" || !EMAIL_PATTERN.test(email)) {
    return "이메일 형식을 확인해 주세요.";
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`;
  }
  return null;
}

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

// 주소지, 배송지, 주문서의 배송지 주소를 같은 기준으로 검사한다.
export function findAddressProblem(address: unknown, label: string): string | null {
  if (typeof address !== "string" || address.trim() === "") {
    return `${label}를 입력해 주세요.`;
  }
  if (address.trim().length > MAX_ADDRESS_LENGTH) {
    return `${label}는 ${MAX_ADDRESS_LENGTH}자 이하로 입력해 주세요.`;
  }
  return null;
}

// 주소지와 배송지를 함께 검사한다. 첫 번째 문제만 알려 준다.
export function findAddressesProblem(address: unknown, shippingAddress: unknown): string | null {
  return findAddressProblem(address, "주소지") ?? findAddressProblem(shippingAddress, "배송지");
}

// 관리자가 회원 정보를 고칠 때 쓴다. 주소 칸이 생기기 전에 가입한 회원이 있어
// 주소지와 배송지는 비워 둘 수 있고, 적었다면 같은 기준으로 검사한다.
export function findOptionalAddressProblem(address: unknown, label: string): string | null {
  if (address === "" || (typeof address === "string" && address.trim() === "")) {
    return null;
  }
  return findAddressProblem(address, label);
}
