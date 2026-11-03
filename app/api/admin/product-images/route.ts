import { randomUUID } from "node:crypto";
import { denyUnlessAdmin } from "@/lib/admin";
import { errorResponse, logFailure, serverFailedResponse } from "@/lib/http";
import {
  IMAGE_BUCKET,
  MAX_IMAGE_BYTES,
  detectImageType,
  removeUploadedImage,
} from "@/lib/product-images";
import { createAdminClient } from "@/lib/supabase";

// 관리자의 상품 사진 올리기. JPG, PNG, WEBP만 받는다.
export async function POST(request: Request) {
  const denied = await denyUnlessAdmin();
  if (denied) {
    return denied;
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return errorResponse("INVALID_INPUT", "사진 파일을 선택해 주세요.", 400);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return errorResponse("IMAGE_TOO_LARGE", "사진은 5MB 이하만 올릴 수 있습니다.", 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) {
    return errorResponse("INVALID_IMAGE", "JPG, PNG, WEBP 사진만 올릴 수 있습니다.", 400);
  }

  const name = `${randomUUID()}.${type.extension}`;
  const storage = createAdminClient().storage.from(IMAGE_BUCKET);
  const { error } = await storage.upload(name, bytes, {
    contentType: type.contentType,
    cacheControl: "3600",
  });

  if (error) {
    logFailure("image upload failed", { code: error.name });
    return serverFailedResponse();
  }
  return Response.json({ url: storage.getPublicUrl(name).data.publicUrl }, { status: 201 });
}

// 저장하지 않고 취소한 사진을 지운다.
export async function DELETE(request: Request) {
  const denied = await denyUnlessAdmin();
  if (denied) {
    return denied;
  }

  const body = await request.json().catch(() => null);
  await removeUploadedImage(body?.url);
  return Response.json({ ok: true });
}
