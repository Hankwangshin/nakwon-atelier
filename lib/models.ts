// 고객이 고를 수 있는 AI 모델 목록. 서버도 이 목록에 있는 모델만 호출한다.
// 화면과 서버가 함께 쓰므로 비밀 값을 넣지 않는다.
export const MODELS = [
  // gpt-4o-mini는 2027-01-14 종료 예정이며, OpenAI가 안내한 대체 모델은 gpt-6-luna다.
  { id: "gpt-4o-mini", label: "GPT-4o mini" },
  { id: "gpt-6-luna", label: "GPT-6 Luna" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export const DEFAULT_MODEL: ModelId = "gpt-4o-mini";

export function isModelId(value: unknown): value is ModelId {
  return MODELS.some(({ id }) => id === value);
}
