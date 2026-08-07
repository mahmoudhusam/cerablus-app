/**
 * SERVER ONLY — makes CLOUDINARY_URL safe for the SDK to read.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The Cloudinary SDK reads CLOUDINARY_URL out of the environment the first time
 * its config is touched — and it THROWS if the value does not begin with
 * `cloudinary://`. That throw happens while the `cloudinary` package is being
 * imported, which is earlier than any try/catch inside lib/cloudinary.ts can
 * reach.
 *
 * That matters because lib/cloudinary.ts is imported by more than the upload
 * path: the item and category DELETE actions pull `destroyImageByUrl` from it.
 * So a single typo in one environment variable — a missing prefix, a stray
 * quote, a trailing newline that leaves only whitespace — would take out the
 * admin's delete buttons, not merely disable photo uploads.
 *
 * So this module runs FIRST and leaves the SDK only two possibilities: a
 * well-formed URL, or none at all. A malformed value is dropped and reported by
 * name; `cloudinaryConfigured()` then returns false and the owner gets the
 * ordinary Arabic "uploads are not enabled" message instead of a 500.
 *
 * It must stay ABOVE the `cloudinary` import in lib/cloudinary.ts — that is the
 * whole mechanism. ES module imports evaluate in source order, so being first is
 * what makes this work.
 */

/**
 * `cloudinary://<api_key>:<api_secret>@<cloud_name>`
 *
 * Shape only. Whether the credentials are CORRECT is Cloudinary's business —
 * this just has to be strict enough that the SDK will not reject it outright.
 */
const CLOUDINARY_URL_SHAPE = /^cloudinary:\/\/[^:@\s]+:[^@\s]+@[^@/\s]+/i;

/**
 * What CLOUDINARY_URL looked like BEFORE this module touched it.
 *
 * Diagnostics only, and deliberately metadata-only: booleans, a length, and the
 * single first character. The value itself carries the API secret and is never
 * captured here.
 *
 * This snapshot exists because the scrub below is destructive — it trims the
 * variable and DELETES it outright when malformed. Anything reading
 * `process.env.CLOUDINARY_URL` afterwards therefore cannot tell "never set"
 * apart from "set, but rejected", which is exactly the distinction you need
 * when uploads say "not enabled" on one host and work on another.
 */
export type CloudinaryUrlSnapshot = {
  /** The variable existed and was not blank/whitespace. */
  present: boolean;
  /** Length of the TRIMMED value. A number cannot reveal the secret. */
  length: number;
  /** First character only — catches a leading quote from a pasted value. */
  firstChar: string;
  /** Wrapped in " or ' — the classic dashboard copy-paste mistake. */
  hasSurroundingQuotes: boolean;
  startsWithScheme: boolean;
  matchesExpectedShape: boolean;
  /** True when the scrub rejected it, so the SDK never saw it. */
  droppedAsMalformed: boolean;
  /** True when trimming actually changed the value (stray whitespace/newline). */
  hadSurroundingWhitespace: boolean;
};

const snapshot: CloudinaryUrlSnapshot = {
  present: false,
  length: 0,
  firstChar: "",
  hasSurroundingQuotes: false,
  startsWithScheme: false,
  matchesExpectedShape: false,
  droppedAsMalformed: false,
  hadSurroundingWhitespace: false,
};

/** The pre-scrub snapshot. Safe to serialise: it holds no secret material. */
export function cloudinaryUrlSnapshot(): Readonly<CloudinaryUrlSnapshot> {
  return { ...snapshot };
}

function scrubCloudinaryUrl(): void {
  const raw = process.env.CLOUDINARY_URL;
  if (raw === undefined) return;

  /* Trim before anything else: a value pasted into a dashboard often carries a
     trailing newline, which would otherwise become part of the API secret and
     fail signing with no clue why. */
  const trimmed = raw.trim();

  /* Record what arrived, before any of it is changed or discarded. Metadata
     only — see CloudinaryUrlSnapshot. */
  snapshot.present = trimmed !== "";
  snapshot.length = trimmed.length;
  snapshot.firstChar = trimmed.slice(0, 1);
  snapshot.hasSurroundingQuotes =
    /^["']/.test(trimmed) || /["']$/.test(trimmed);
  snapshot.startsWithScheme = trimmed.toLowerCase().startsWith("cloudinary://");
  snapshot.matchesExpectedShape = CLOUDINARY_URL_SHAPE.test(trimmed);
  snapshot.hadSurroundingWhitespace = raw !== trimmed;

  // Set-but-empty is the same as unset, and must not reach the SDK as "".
  if (trimmed === "") {
    delete process.env.CLOUDINARY_URL;
    return;
  }

  if (!CLOUDINARY_URL_SHAPE.test(trimmed)) {
    snapshot.droppedAsMalformed = true;
    /* The NAME and the expected shape only. The real value carries the API
       secret and is never logged, not even in part. */
    console.error(
      "[cerablus] CLOUDINARY_URL is set but malformed — expected " +
        "cloudinary://<api_key>:<api_secret>@<cloud_name>. Ignoring it; photo uploads are disabled " +
        "until it is fixed. Copy it from Cloudinary: Settings -> API Keys -> API environment variable.",
    );
    delete process.env.CLOUDINARY_URL;
    return;
  }

  // Hand the SDK the cleaned value, so whitespace can never corrupt the secret.
  process.env.CLOUDINARY_URL = trimmed;
}

scrubCloudinaryUrl();

export {};
