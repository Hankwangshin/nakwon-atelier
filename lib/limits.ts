// 화면과 서버가 같은 값을 쓰도록 한곳에 모은다.
// AI 지시문이 들어갈 lib/chat-prompt.ts와 달리, 이 파일은 브라우저에 포함돼도 된다.
export const MAX_QUESTION_LENGTH = 500; // PRD 7번 — 고객 문장 글자 수
export const MAX_ASSISTANT_LENGTH = 1000; // Design Ref: §6 — 챗봇 답변 글자 수
export const MAX_HISTORY_ITEMS = 10; // Design Ref: §6 — 현재 질문을 뺀 말풍선 수
