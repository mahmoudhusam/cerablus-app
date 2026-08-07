/**
 * TEMPORARY — DELETE THIS FILE ONCE THE UPLOAD PROBLEM IS SOLVED.
 *
 * Answers one question: what does the SERVER actually see in CLOUDINARY_URL?
 * It exists because "uploads are not enabled" looks identical whether the
 * variable is missing, blank, wrapped in quotes, or carrying a trailing
 * newline — and on Vercel you cannot read the value back to check.
 *
 * WHAT IT WILL NEVER RETURN
 * -------------------------
 * The URL, the API key, the API secret, or the cloud name. Only booleans, one
 * length as a number, and the single FIRST character (enough to catch a leading
 * quote, useless as a credential).
 *
 * Guarded by requireAdminApi() on its first line, exactly like the signature
 * route, and it sits under /api/admin/* so proxy.ts gates it too.
 *
 * NOTE ON THE PATH: this folder is deliberately NOT named `_cloudinary-debug`.
 * In the App Router a leading underscore marks a PRIVATE folder that is opted
 * out of routing entirely, so that name would produce a 404 rather than an
 * endpoint.
 */
import { requireAdminApi } from "@/lib/admin-auth";
import { cloudinaryConfigured } from "@/lib/cloudinary";
import { cloudinaryUrlSnapshot } from "@/lib/cloudinary-env";

export const runtime = "nodejs";

/** Never cached, never prerendered — it reports live process state. */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const guard = await requireAdminApi();
  if (guard instanceof Response) return guard;

  /* The snapshot is taken in lib/cloudinary-env.ts BEFORE that module trims or
     discards the variable. Reading process.env here instead would report
     "not present" for a malformed value that was actually set — the single most
     misleading answer this endpoint could give. */
  const snapshot = cloudinaryUrlSnapshot();

  const body = {
    // ---- the requested shape, describing the value as it ARRIVED ----
    cloudinaryUrlPresent: snapshot.present,
    startsWithScheme: snapshot.startsWithScheme,
    length: snapshot.length,
    firstChar: snapshot.firstChar,
    hasSurroundingQuotes: snapshot.hasSurroundingQuotes,
    matchesExpectedShape: snapshot.matchesExpectedShape,
    legacyVarsPresent: {
      cloudName: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
      apiKey: Boolean(process.env.CLOUDINARY_API_KEY),
      apiSecret: Boolean(process.env.CLOUDINARY_API_SECRET),
    },
    cloudinaryConfigured: cloudinaryConfigured(),

    // ---- extra, because the above cannot explain a rejection on its own ----
    /** The env guard threw the value away for being malformed. */
    droppedAsMalformed: snapshot.droppedAsMalformed,
    /** The value had leading/trailing whitespace (a pasted newline). */
    hadSurroundingWhitespace: snapshot.hadSurroundingWhitespace,
    /** What the Cloudinary SDK is left with after the guard ran. */
    visibleToSdk: Boolean((process.env.CLOUDINARY_URL ?? "").trim()),
  };

  return Response.json(body, {
    headers: { "cache-control": "no-store" },
  });
}
