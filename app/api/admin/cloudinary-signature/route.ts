/**
 * Hands the admin a short-lived, signed ticket for ONE direct upload.
 *
 * Under /api/admin/*, so proxy.ts gates it too — but that is layer 1, and this
 * handler does its own check first, exactly like every other mutation. An
 * unauthenticated POST gets a 401 here even if the route were somehow reached
 * without passing the edge gate.
 *
 * Node runtime: the Cloudinary SDK signs with node crypto.
 */
import { requireAdminApi } from "@/lib/admin-auth";
import { MAX_IMAGE_BYTES, createUploadTicket, cloudinaryConfigured } from "@/lib/cloudinary";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  const guard = await requireAdminApi();
  if (guard instanceof Response) return guard;

  if (!cloudinaryConfigured()) {
    // Names the missing configuration, never any value — CLOUDINARY_URL
    // contains the API secret.
    console.error(
      "[cerablus] image upload attempted but Cloudinary is not configured — set CLOUDINARY_URL to cloudinary://<api_key>:<api_secret>@<cloud_name>.",
    );
    return Response.json(
      { error: "رفع الصور مش مفعّل على هذا الخادم. راجع إعدادات Cloudinary." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const ticket = createUploadTicket();

  // The ticket carries the public api_key and a signature — never the secret.
  return Response.json(
    { ...ticket, maxBytes: MAX_IMAGE_BYTES },
    { headers: { "cache-control": "no-store" } },
  );
}
