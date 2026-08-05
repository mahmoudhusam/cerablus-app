"use server";

/**
 * Attach or remove an item's photo.
 *
 * Same rule as every other mutation: `await requireAdmin()` is the FIRST
 * statement, before any input is read or any query runs, and a successful write
 * ends with revalidateMenu() so the public card shows the new photo.
 *
 * The browser uploads straight to Cloudinary (see lib/cloudinary.ts for why),
 * then calls attachItemImageAction with what Cloudinary returned. Nothing in
 * that payload is trusted: the signature is verified, the folder and format are
 * re-checked, the byte size is re-checked, and the stored URL is REBUILT from
 * our own cloud name — the client never gets to supply a URL.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin-auth";
import {
  ALLOWED_FORMATS,
  MAX_IMAGE_BYTES,
  buildSecureUrl,
  destroyImage,
  destroyImageByUrl,
  isInMenuFolder,
  verifyUploadSignature,
} from "@/lib/cloudinary";
import { revalidateMenu } from "@/lib/menu-data";
import { prisma } from "@/lib/prisma";

export type ImageActionResult = { ok: boolean; message: string; imageUrl?: string };

/** Exactly the fields we need out of Cloudinary's upload response. */
const uploadResultSchema = z.object({
  itemId: z.string().trim().min(1).max(64),
  publicId: z.string().trim().min(1).max(300),
  version: z.number().int().positive(),
  signature: z.string().trim().min(1).max(200),
  format: z.string().trim().min(1).max(10),
  bytes: z.number().int().positive(),
});

export async function attachItemImageAction(payload: unknown): Promise<ImageActionResult> {
  await requireAdmin();

  const parsed = uploadResultSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: "بيانات الصورة غير صالحة." };
  }
  const result = parsed.data;

  // 1. Did this really come from Cloudinary? The response is signed with our
  //    secret, so a fabricated public_id cannot pass.
  if (!verifyUploadSignature(result)) {
    return { ok: false, message: "تعذّر التحقق من الصورة المرفوعة." };
  }

  // 2. Is it in OUR folder? Stops a valid signature being reused to point an
  //    item at some other asset in the same Cloudinary account.
  if (!isInMenuFolder(result.publicId)) {
    return { ok: false, message: "الصورة مرفوعة بمكان غير متوقع." };
  }

  // 3. Is it really one of the formats we allow? Cloudinary already enforced
  //    this from the signed allowed_formats; this is the belt to that braces.
  const format = result.format.toLowerCase();
  if (!(ALLOWED_FORMATS as readonly string[]).includes(format)) {
    await destroyImage(result.publicId);
    return { ok: false, message: "نوع الصورة غير مسموح. استخدم JPG أو PNG أو WEBP." };
  }

  // 4. Size is only knowable after the upload, so an oversized file is accepted
  //    by Cloudinary and then thrown away here rather than being stored.
  if (result.bytes > MAX_IMAGE_BYTES) {
    await destroyImage(result.publicId);
    const mb = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));
    return { ok: false, message: `الصورة أكبر من ${mb} ميغابايت. جرّب صورة أصغر.` };
  }

  const item = await prisma.item.findUnique({
    where: { id: result.itemId },
    select: { id: true, imageUrl: true },
  });
  if (!item) {
    await destroyImage(result.publicId);
    return { ok: false, message: "الصنف غير موجود." };
  }

  // Built here, from our cloud name and the verified public_id.
  const imageUrl = buildSecureUrl(result.publicId, result.version, format);

  await prisma.item.update({ where: { id: item.id }, data: { imageUrl } });

  /* Replacing a photo deletes the one it replaced, so the café's Cloudinary
     folder does not fill up with every version of every item. Best effort and
     after the save: a failed delete leaves one orphan, which is untidy, while a
     failed save would leave the item pointing at nothing. */
  if (item.imageUrl && item.imageUrl !== imageUrl) {
    await destroyImageByUrl(item.imageUrl);
  }

  revalidateMenu();
  revalidatePath("/admin");
  revalidatePath(`/admin/items/${item.id}`);

  return { ok: true, message: "تم رفع الصورة. المنيو العام تحدّث.", imageUrl };
}

const removeSchema = z.object({ itemId: z.string().trim().min(1).max(64) });

/** Clear the photo; the public card goes back to the branded placeholder. */
export async function removeItemImageAction(payload: unknown): Promise<ImageActionResult> {
  await requireAdmin();

  const parsed = removeSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "طلب غير صالح." };

  const item = await prisma.item.findUnique({
    where: { id: parsed.data.itemId },
    select: { id: true, imageUrl: true },
  });
  if (!item) return { ok: false, message: "الصنف غير موجود." };
  if (!item.imageUrl) return { ok: true, message: "ما في صورة أصلًا.", imageUrl: "" };

  await prisma.item.update({ where: { id: item.id }, data: { imageUrl: "" } });
  await destroyImageByUrl(item.imageUrl);

  revalidateMenu();
  revalidatePath("/admin");
  revalidatePath(`/admin/items/${item.id}`);

  return { ok: true, message: "تم حذف الصورة. رجعت البطاقة للشعار.", imageUrl: "" };
}
