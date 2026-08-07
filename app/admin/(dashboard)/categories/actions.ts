"use server";

/**
 * Category mutations.
 *
 * Same rule as the item actions: `await requireAdmin()` is the FIRST statement
 * of every exported action, before any input is read or any query runs, and
 * every successful write calls revalidateMenu().
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-auth";
import { destroyImageByUrl } from "@/lib/cloudinary";
import {
  categoryCreateSchema,
  categoryDeleteSchema,
  categoryMoveSchema,
  categoryRenameSchema,
  fieldErrors,
  slugify,
} from "@/lib/admin-schemas";
import { revalidateMenu } from "@/lib/menu-data";
import { prisma } from "@/lib/prisma";

const ADMIN_CATEGORIES = "/admin/categories";

export type CategoryFormState = {
  ok: boolean;
  message: string | null;
  errors: Record<string, string>;
};

/**
 * A slug that is not taken yet.
 *
 * `slug` is unique in the schema, so two categories whose names fold to the
 * same slug ("القهوة" and "القهوه") would collide. Suffix rather than fail —
 * the owner named a real section and should not have to fight a URL detail.
 */
async function uniqueSlug(name: string, exceptId?: string): Promise<string> {
  const base = slugify(name);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const clash = await prisma.category.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash || clash.id === exceptId) return candidate;
  }
  // Practically unreachable; still better than looping forever.
  return `${base}-${Date.now()}`;
}

/* --------------------------------------------------------------------------
   Create
   -------------------------------------------------------------------------- */

export async function createCategoryAction(
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdmin();

  const parsed = categoryCreateSchema.safeParse({ name: formData.get("name") ?? "" });
  if (!parsed.success) {
    return { ok: false, message: null, errors: fieldErrors(parsed.error) };
  }

  const last = await prisma.category.aggregate({ _max: { sortOrder: true } });

  await prisma.category.create({
    data: {
      name: parsed.data.name,
      slug: await uniqueSlug(parsed.data.name),
      sortOrder: (last._max.sortOrder ?? -1) + 1,
    },
  });

  revalidateMenu();
  revalidatePath(ADMIN_CATEGORIES);
  return { ok: true, message: `تمت إضافة قسم "${parsed.data.name}".`, errors: {} };
}

/* --------------------------------------------------------------------------
   Rename
   -------------------------------------------------------------------------- */

/**
 * Rename a category.
 *
 * The SLUG IS NOT REGENERATED. It is the category's stable public id — it is
 * what the seeded data uses, what the public page's `#cat-…` anchors point at,
 * and what a customer may have bookmarked. A typo fix in the display name must
 * not silently break those.
 */
export async function renameCategoryAction(
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdmin();

  const parsed = categoryRenameSchema.safeParse({
    id: formData.get("id") ?? "",
    name: formData.get("name") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: null, errors: fieldErrors(parsed.error) };
  }

  const existing = await prisma.category.findUnique({
    where: { id: parsed.data.id },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false, message: "القسم غير موجود.", errors: {} };
  }

  await prisma.category.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name },
  });

  revalidateMenu();
  revalidatePath(ADMIN_CATEGORIES);
  return { ok: true, message: `تم تعديل الاسم إلى "${parsed.data.name}".`, errors: {} };
}

/* --------------------------------------------------------------------------
   Delete
   -------------------------------------------------------------------------- */

/**
 * Delete a category.
 *
 * SAFETY MODEL — blocked by default.
 * The schema cascades, so deleting a category would silently take its items
 * with it; for القهوة العربية والتركية that is twelve items gone on one click.
 * So:
 *
 *   - an EMPTY category deletes straight away;
 *   - a category WITH items is refused unless the caller echoes back the exact
 *     number of items it is about to destroy, in `confirmItemCount`.
 *
 * The UI only sends that number after a confirm dialog that names it out loud.
 * Because the check is against the LIVE count, a stale page cannot authorise a
 * bigger deletion than the owner was shown — if someone added an item in the
 * meantime, the count no longer matches and the delete is refused.
 */
export async function deleteCategoryAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const parsed = categoryDeleteSchema.safeParse({
    id: formData.get("id") ?? "",
    confirmItemCount: formData.get("confirmItemCount") ?? "",
  });
  if (!parsed.success) {
    redirect(`${ADMIN_CATEGORIES}?error=${encodeURIComponent("طلب حذف غير صالح")}`);
  }

  /* One query, three jobs: the name for the flash, the live item count for the
     confirmation check below, and the photos of every item the cascade is about
     to take with it — collected BEFORE the delete, because afterwards there is
     no row left to tell us which Cloudinary assets belonged to this section.
     Only items that actually have a photo are selected. */
  const category = await prisma.category.findUnique({
    where: { id: parsed.data.id },
    select: {
      name: true,
      _count: { select: { items: true } },
      items: {
        where: { NOT: { imageUrl: "" } },
        select: { imageUrl: true },
      },
    },
  });
  if (!category) {
    redirect(`${ADMIN_CATEGORIES}?error=${encodeURIComponent("القسم محذوف أصلًا")}`);
  }

  const liveCount = category._count.items;

  if (liveCount !== parsed.data.confirmItemCount) {
    redirect(
      `${ADMIN_CATEGORIES}?error=${encodeURIComponent(
        `تغيّر عدد الأصناف بقسم "${category.name}" (صار ${liveCount}). حدّث الصفحة وأعد المحاولة.`,
      )}`,
    );
  }

  await prisma.category.delete({ where: { id: parsed.data.id } });

  /* The cascade removed the item rows; their photos are not in the database, so
     they have to be removed from Cloudinary explicitly or they stay there
     forever, publicly fetchable and billed for.

     AFTER the delete and BEST EFFORT, per asset: the owner's delete has already
     succeeded, and one failing image must neither abort the rest nor surface as
     an error on a section that is genuinely gone. Worst case is an orphan or
     two — no worse than before this cleanup existed. */
  for (const item of category.items) {
    try {
      await destroyImageByUrl(item.imageUrl);
    } catch (error) {
      console.warn(
        `[cerablus] category "${category.name}" was deleted but one of its Cloudinary photos could not be removed; it is orphaned but harmless.`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  revalidateMenu();
  revalidatePath(ADMIN_CATEGORIES);
  revalidatePath("/admin");
  redirect(
    `${ADMIN_CATEGORIES}?deleted=${encodeURIComponent(
      liveCount > 0 ? `${category.name} و${liveCount} صنف` : category.name,
    )}`,
  );
}

/* --------------------------------------------------------------------------
   Reorder
   -------------------------------------------------------------------------- */

/** Swap a category with its neighbour — this is the public menu's section order. */
export async function moveCategoryAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const parsed = categoryMoveSchema.safeParse({
    id: formData.get("id") ?? "",
    direction: formData.get("direction") ?? "",
  });
  if (!parsed.success) {
    redirect(`${ADMIN_CATEGORIES}?error=${encodeURIComponent("طلب ترتيب غير صالح")}`);
  }

  const category = await prisma.category.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, sortOrder: true },
  });
  if (!category) {
    redirect(`${ADMIN_CATEGORIES}?error=${encodeURIComponent("القسم غير موجود")}`);
  }

  const up = parsed.data.direction === "up";
  const neighbour = await prisma.category.findFirst({
    where: { sortOrder: up ? { lt: category.sortOrder } : { gt: category.sortOrder } },
    orderBy: { sortOrder: up ? "desc" : "asc" },
    select: { id: true, sortOrder: true },
  });

  if (neighbour) {
    await prisma.$transaction([
      prisma.category.update({
        where: { id: category.id },
        data: { sortOrder: neighbour.sortOrder },
      }),
      prisma.category.update({
        where: { id: neighbour.id },
        data: { sortOrder: category.sortOrder },
      }),
    ]);
    revalidateMenu();
  }

  revalidatePath(ADMIN_CATEGORIES);
  revalidatePath("/admin");
}
