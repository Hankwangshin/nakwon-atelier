import { logFailure } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase";

// 이 파일은 서버 전용 키를 쓰므로 서버 쪽 코드에서만 가져온다.

export const IMAGE_BUCKET = "product-images";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function bucketUrl(): string {
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/`;
}

function hasBytes(bytes: Uint8Array, offset: number, expected: number[]): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

// 파일 이름이나 브라우저가 보낸 형식을 믿지 않고 파일 앞부분으로 종류를 판단한다.
export function detectImageType(bytes: Uint8Array) {
  if (hasBytes(bytes, 0, [0xff, 0xd8, 0xff])) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (hasBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: "image/png", extension: "png" };
  }
  if (
    hasBytes(bytes, 0, [0x52, 0x49, 0x46, 0x46]) &&
    hasBytes(bytes, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}

// 우리 저장소에 올린 사진 주소만 인정한다.
export function isUploadedImage(url: unknown): url is string {
  return (
    typeof url === "string" &&
    url.startsWith(bucketUrl()) &&
    /^[\w-]+\.(jpg|png|webp)$/.test(url.slice(bucketUrl().length))
  );
}

// 바뀌거나 삭제된 상품의 사진을 저장소에서 지운다. 일러스트는 지우지 않는다.
export async function removeUploadedImage(url: string | null | undefined) {
  if (!isUploadedImage(url)) {
    return;
  }

  const name = url.slice(bucketUrl().length);
  const { error } = await createAdminClient().storage.from(IMAGE_BUCKET).remove([name]);
  if (error) {
    logFailure("image remove failed", { code: error.name });
  }
}
