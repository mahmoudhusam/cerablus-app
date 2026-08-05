"use client";

import { useRef, useState, useTransition } from "react";

import {
  attachItemImageAction,
  removeItemImageAction,
} from "@/app/admin/(dashboard)/items/image-actions";
import { adminThumbUrl } from "@/lib/cloudinary-url";

/** Mirrors the server's rules, for instant feedback. The server re-checks all of it. */
const ACCEPT = "image/jpeg,image/png,image/webp";
const CLIENT_MAX_BYTES = 5 * 1024 * 1024;

type Ticket = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  allowedFormats: string;
};

/**
 * Per-item photo: preview, pick, upload, remove.
 *
 * The file goes straight from the browser to Cloudinary using a signed ticket
 * this component asks our server for — the API secret never comes near here.
 * What comes back is handed to a guarded server action, which verifies it and
 * saves the URL. See lib/cloudinary.ts for why the bytes do not travel through
 * our own server.
 *
 * Deliberately NOT a <form>: it renders inside the item editor's form, and
 * nesting forms is invalid HTML. Everything here is buttons plus fetch.
 */
export function ImageField({
  itemId,
  imageUrl,
  itemName,
}: {
  itemId: string;
  imageUrl: string;
  itemName: string;
}) {
  const [current, setCurrent] = useState(imageUrl);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const working = busy || pending;

  function pick(selected: File | null) {
    setMessage(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!ACCEPT.split(",").includes(selected.type)) {
      setFile(null);
      setMessage({ ok: false, text: "نوع الصورة غير مسموح. استخدم JPG أو PNG أو WEBP." });
      return;
    }
    if (selected.size > CLIENT_MAX_BYTES) {
      setFile(null);
      setMessage({ ok: false, text: "الصورة أكبر من 5 ميغابايت. جرّب صورة أصغر." });
      return;
    }
    setFile(selected);
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setMessage(null);

    try {
      // 1. A signed, short-lived ticket from our own guarded endpoint.
      const ticketResponse = await fetch("/api/admin/cloudinary-signature", { method: "POST" });
      if (!ticketResponse.ok) {
        const body = await ticketResponse.json().catch(() => ({}));
        throw new Error(body.error ?? "تعذّر بدء الرفع. سجّل دخولك مرة تانية وجرّب.");
      }
      const ticket: Ticket = await ticketResponse.json();

      // 2. The bytes go straight to Cloudinary, not through our server.
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", ticket.apiKey);
      form.append("timestamp", String(ticket.timestamp));
      form.append("signature", ticket.signature);
      form.append("folder", ticket.folder);
      form.append("allowed_formats", ticket.allowedFormats);

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${ticket.cloudName}/image/upload`,
        { method: "POST", body: form },
      );
      const uploaded = await uploadResponse.json();
      if (!uploadResponse.ok) {
        // Cloudinary rejected it — most often a format that is not really an image.
        throw new Error(uploaded?.error?.message ?? "Cloudinary رفض الصورة.");
      }

      // 3. Our server verifies the signed result and saves the URL it builds itself.
      const result = await attachItemImageAction({
        itemId,
        publicId: uploaded.public_id,
        version: uploaded.version,
        signature: uploaded.signature,
        format: uploaded.format,
        bytes: uploaded.bytes,
      });

      setMessage({ ok: result.ok, text: result.message });
      if (result.ok && result.imageUrl !== undefined) {
        setCurrent(result.imageUrl);
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "صار خطأ أثناء الرفع.",
      });
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (!window.confirm(`حذف صورة "${itemName}"؟ بترجع البطاقة لشعار Cerablus.`)) return;
    startTransition(async () => {
      const result = await removeItemImageAction({ itemId });
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) setCurrent("");
    });
  }

  return (
    <div className="admin-image-field">
      <div className="admin-image-preview">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={adminThumbUrl(current)} alt={`صورة ${itemName}`} />
        ) : (
          <span className="admin-image-empty" aria-hidden="true" />
        )}
      </div>

      <div className="admin-image-controls">
        <label className="admin-field">
          <span className="sr-only">اختر صورة</span>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            disabled={working}
            onChange={(event) => pick(event.target.files?.[0] ?? null)}
          />
        </label>

        <div className="admin-form-actions">
          <button
            type="button"
            className="admin-btn"
            disabled={!file || working}
            onClick={upload}
          >
            {busy ? "جاري الرفع…" : "ارفع الصورة"}
          </button>

          {current ? (
            <button
              type="button"
              className="admin-btn admin-btn-danger"
              disabled={working}
              onClick={remove}
            >
              {pending ? "جاري الحذف…" : "احذف الصورة"}
            </button>
          ) : null}
        </div>

        {message ? (
          <p
            className={message.ok ? "admin-field-ok" : "admin-field-error"}
            role={message.ok ? "status" : "alert"}
          >
            {message.text}
          </p>
        ) : null}

        <p className="admin-hint">
          JPG أو PNG أو WEBP، أقصى ٥ ميغابايت. منصغّرها ومنقصّها تلقائيًا لتناسب البطاقة — ما
          في داعي تعدّلها بنفسك.
        </p>
      </div>
    </div>
  );
}
