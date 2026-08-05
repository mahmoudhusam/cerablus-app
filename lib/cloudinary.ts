/**
 * SERVER ONLY — Cloudinary configuration, upload signing, and asset deletion.
 *
 * WHY SIGNED DIRECT UPLOAD (and not "post the file to a server action")
 * --------------------------------------------------------------------
 * Both keep the API secret server-side, so that is not the deciding factor.
 * What decides it is the file itself: on Vercel a serverless function's request
 * body is capped around 4.5 MB, and a photo straight off the owner's phone is
 * routinely 3–8 MB. Routing the file through our own action would mean the
 * platform rejecting the request with an opaque 413 BEFORE any of our code ran
 * — no Arabic message, no way to explain it.
 *
 * So: this module signs a short-lived upload, the browser sends the bytes
 * straight to Cloudinary, and Cloudinary hands back a signed result that we
 * verify here before saving anything.
 *
 * That still leaves validation genuinely server-side:
 *   - `allowed_formats` is part of the SIGNED parameters, so Cloudinary — not
 *     the browser — decides whether the bytes are really a jpeg/png/webp. A
 *     renamed .exe is rejected at Cloudinary, and the client cannot loosen the
 *     rule without invalidating the signature.
 *   - the upload response is itself signed; verifyUploadSignature() proves the
 *     result came from Cloudinary and was not fabricated by the browser.
 *   - the reported byte size is re-checked against MAX_IMAGE_BYTES before the
 *     URL is stored, and an oversized asset is destroyed again.
 *
 * And the client never supplies a URL: buildSecureUrl() reconstructs it from
 * our own cloud name plus the verified public_id, exactly as CLAUDE.md requires
 * ("Never accept an arbitrary URL from the client as the image").
 */
import { v2 as cloudinary } from "cloudinary";

/** Every menu photo lives here, so the café's assets are one tidy folder. */
export const MENU_IMAGE_FOLDER = "cerablus/menu";

/** Formats Cloudinary will accept. Enforced by Cloudinary, not by the browser. */
export const ALLOWED_FORMATS = ["jpg", "jpeg", "png", "webp"] as const;

/** Ceiling on a stored photo. Generous for a phone camera, mean to an abuser. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/** How long a signed upload stays usable. */
const SIGNATURE_TTL_SECONDS = 10 * 60;

export type UploadTicket = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  allowedFormats: string;
};

function readConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? "";
  const apiKey = process.env.CLOUDINARY_API_KEY ?? "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET ?? "";
  return { cloudName, apiKey, apiSecret };
}

/** True when all three variables are present. */
export function cloudinaryConfigured(): boolean {
  const { cloudName, apiKey, apiSecret } = readConfig();
  return Boolean(cloudName && apiKey && apiSecret);
}

/** Configure the SDK lazily, so importing this file never throws. */
function configured() {
  const { cloudName, apiKey, apiSecret } = readConfig();
  if (!cloudName || !apiKey || !apiSecret) {
    // Names only — never the values.
    throw new Error(
      "Cloudinary is not configured: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
    );
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  return { cloudName, apiKey, apiSecret };
}

/**
 * A short-lived ticket the browser can use to upload ONE image.
 *
 * The signature covers the folder and the allowed formats, so the browser
 * cannot redirect the upload elsewhere or widen what counts as an image.
 * The API SECRET is never part of what is returned.
 */
export function createUploadTicket(): UploadTicket {
  const { cloudName, apiKey, apiSecret } = configured();
  const timestamp = Math.round(Date.now() / 1000);
  const allowedFormats = ALLOWED_FORMATS.join(",");

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder: MENU_IMAGE_FOLDER, allowed_formats: allowedFormats },
    apiSecret,
  );

  return {
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder: MENU_IMAGE_FOLDER,
    allowedFormats,
  };
}

/**
 * Prove an upload result really came from Cloudinary.
 *
 * Cloudinary signs every upload response over `public_id` + `version`. Checking
 * it here is what stops a signed-in client from POSTing a made-up public_id and
 * pointing a menu item at someone else's asset.
 */
export function verifyUploadSignature(result: {
  publicId: string;
  version: number;
  signature: string;
}): boolean {
  const { apiSecret } = configured();
  const expected = cloudinary.utils.api_sign_request(
    { public_id: result.publicId, version: result.version },
    apiSecret,
  );
  return expected === result.signature;
}

/** Reject an upload that landed outside our folder. */
export function isInMenuFolder(publicId: string): boolean {
  return publicId.startsWith(`${MENU_IMAGE_FOLDER}/`);
}

/**
 * Build the canonical delivery URL ourselves, from our own cloud name and the
 * verified public_id — never from anything the client sent.
 *
 * Stored WITHOUT transformations: the stored value stays the original asset,
 * and lib/cloudinary-url.ts injects the right transformation per surface at
 * render time. One asset, many sizes, nothing baked in.
 */
export function buildSecureUrl(publicId: string, version: number, format: string): string {
  const { cloudName } = configured();
  return `https://res.cloudinary.com/${cloudName}/image/upload/v${version}/${publicId}.${format}`;
}

/**
 * The public_id inside a stored Cloudinary URL, or null if it is not one of
 * ours. Used to delete the previous asset when a photo is replaced or removed,
 * which is why the schema needs no extra column to track it.
 */
export function publicIdFromUrl(url: string): string | null {
  const match = /\/image\/upload\/(?:[^/]+\/)*?v\d+\/(.+)\.[a-z0-9]+$/i.exec(url);
  if (!match) return null;
  const publicId = match[1];
  return isInMenuFolder(publicId) ? publicId : null;
}

/**
 * Delete an asset, best effort.
 *
 * Never throws: a failed cleanup must not fail the owner's edit. The worst case
 * is one orphaned file in Cloudinary, which is a storage nuisance, not a bug in
 * the menu.
 */
export async function destroyImage(publicId: string): Promise<void> {
  try {
    configured();
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
  } catch (error) {
    console.error(
      "[cerablus] could not delete the old Cloudinary asset; it is orphaned but harmless.",
      error instanceof Error ? error.message : error,
    );
  }
}

/** Delete the asset a stored URL points at, if it is one of ours. */
export async function destroyImageByUrl(url: string): Promise<void> {
  const publicId = publicIdFromUrl(url);
  if (publicId) await destroyImage(publicId);
}

export { SIGNATURE_TTL_SECONDS };
