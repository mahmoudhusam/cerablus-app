"use server";

/**
 * Item mutations.
 *
 * EVERY exported action begins with `await requireAdmin()`, before it reads a
 * single field or touches the database. The proxy gate and the dashboard layout
 * protect PAGES; a server action is its own POST endpoint and is reachable
 * without ever rendering one, so the guard has to be here. See lib/admin-auth.ts.
 *
 * Every successful write ends with `revalidateMenu()`, so the public / and /menu
 * show the change on the next request without a redeploy.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-auth";
import { destroyImageByUrl } from "@/lib/cloudinary";
import {
  fieldErrors,
  itemDeleteSchema,
  itemMoveSchema,
  itemSchema,
  itemUpdateSchema,
  readVariants,
} from "@/lib/admin-schemas";
import { revalidateMenu } from "@/lib/menu-data";
import { prisma } from "@/lib/prisma";

const ADMIN_ITEMS = "/admin";

export type ItemFormState = {
  ok: boolean;
  message: string | null;
  errors: Record<string, string>;
};

/** Parse a submitted item form into validated, storable values. */
function parseItemForm(formData: FormData) {
  return itemSchema.safeParse({
    name: formData.get("name") ?? "",
    desc: formData.get("desc") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    pricingMode: formData.get("pricingMode") ?? "single",
    price: formData.get("price") ?? "",
    variants: readVariants(formData),
    available: formData.get("available"),
    featured: formData.get("featured"),
    offer: formData.get("offer"),
    oldPrice: formData.get("oldPrice") ?? "",
  });
}

/** Refuse a categoryId that is not a real category, rather than letting Prisma throw. */
async function categoryExists(categoryId: string): Promise<boolean> {
  const found = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  return found !== null;
}

/* --------------------------------------------------------------------------
   Create
   -------------------------------------------------------------------------- */

export async function createItemAction(
  _previous: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  await requireAdmin();

  const parsed = parseItemForm(formData);
  if (!parsed.success) {
    return { ok: false, message: "في أخطاء بالنموذج — صلّحها وجرّب مرة تانية.", errors: fieldErrors(parsed.error) };
  }
  const input = parsed.data;

  if (!(await categoryExists(input.categoryId))) {
    return { ok: false, message: null, errors: { categoryId: "القسم غير موجود" } };
  }

  // New items go to the end of their category.
  const last = await prisma.item.aggregate({
    where: { categoryId: input.categoryId },
    _max: { sortOrder: true },
  });

  await prisma.item.create({
    data: {
      name: input.name,
      desc: input.desc,
      categoryId: input.categoryId,
      price: input.price,
      available: input.available,
      featured: input.featured,
      offer: input.offer,
      oldPrice: input.oldPrice,
      sortOrder: (last._max.sortOrder ?? -1) + 1,
      // imageUrl deliberately left at its "" default — Step 6 owns photos, and
      // an image URL is never accepted from the client.
      variants: {
        create: input.variants.map((variant, index) => ({
          label: variant.label,
          price: variant.price,
          sortOrder: index,
        })),
      },
    },
  });

  revalidateMenu();
  revalidatePath(ADMIN_ITEMS);
  redirect(`${ADMIN_ITEMS}?saved=${encodeURIComponent(input.name)}`);
}

/* --------------------------------------------------------------------------
   Update
   -------------------------------------------------------------------------- */

export async function updateItemAction(
  _previous: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  await requireAdmin();

  const id = itemUpdateSchema.safeParse({ id: formData.get("id") ?? "" });
  if (!id.success) {
    return { ok: false, message: "الصنف غير موجود.", errors: {} };
  }

  const parsed = parseItemForm(formData);
  if (!parsed.success) {
    return { ok: false, message: "في أخطاء بالنموذج — صلّحها وجرّب مرة تانية.", errors: fieldErrors(parsed.error) };
  }
  const input = parsed.data;

  const existing = await prisma.item.findUnique({
    where: { id: id.data.id },
    select: { id: true, categoryId: true },
  });
  if (!existing) {
    return { ok: false, message: "الصنف انحذف من مكان تاني.", errors: {} };
  }

  if (!(await categoryExists(input.categoryId))) {
    return { ok: false, message: null, errors: { categoryId: "القسم غير موجود" } };
  }

  // Moving to another category puts the item at the end of the new one, so it
  // cannot collide with an existing sortOrder there.
  const movedCategory = existing.categoryId !== input.categoryId;
  const last = movedCategory
    ? await prisma.item.aggregate({
        where: { categoryId: input.categoryId },
        _max: { sortOrder: true },
      })
    : null;

  /* One transaction: replacing the variants is a delete plus a create, and a
     failure between them would leave the item with no prices at all. */
  await prisma.$transaction(async (tx) => {
    await tx.variant.deleteMany({ where: { itemId: id.data.id } });
    await tx.item.update({
      where: { id: id.data.id },
      data: {
        name: input.name,
        desc: input.desc,
        categoryId: input.categoryId,
        price: input.price,
        available: input.available,
        featured: input.featured,
        offer: input.offer,
        oldPrice: input.oldPrice,
        ...(last ? { sortOrder: (last._max.sortOrder ?? -1) + 1 } : {}),
        variants: {
          create: input.variants.map((variant, index) => ({
            label: variant.label,
            price: variant.price,
            sortOrder: index,
          })),
        },
      },
    });
  });

  revalidateMenu();
  revalidatePath(ADMIN_ITEMS);
  redirect(`${ADMIN_ITEMS}?saved=${encodeURIComponent(input.name)}`);
}

/* --------------------------------------------------------------------------
   Delete
   -------------------------------------------------------------------------- */

export async function deleteItemAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const parsed = itemDeleteSchema.safeParse({ id: formData.get("id") ?? "" });
  if (!parsed.success) redirect(`${ADMIN_ITEMS}?error=${encodeURIComponent("طلب حذف غير صالح")}`);

  // imageUrl is read HERE, before the row is gone: once the item is deleted
  // there is nothing left to tell us which Cloudinary asset was its photo.
  const item = await prisma.item.findUnique({
    where: { id: parsed.data.id },
    select: { name: true, imageUrl: true },
  });
  if (!item) redirect(`${ADMIN_ITEMS}?error=${encodeURIComponent("الصنف محذوف أصلًا")}`);

  // Variants go with it: the schema cascades on the item relation.
  await prisma.item.delete({ where: { id: parsed.data.id } });

  /* The photo goes with the item — otherwise it stays on Cloudinary forever,
     publicly fetchable and billed for.

     AFTER the delete and BEST EFFORT, exactly like the replace path in
     image-actions.ts. The row is what the owner asked to remove and it has
     already succeeded; a Cloudinary outage must not turn that into an error or
     undo it. The worst case here is one orphaned asset — no worse than before
     this cleanup existed. (destroyImageByUrl swallows its own failures too;
     this catch is the belt to that braces.) */
  if (item.imageUrl) {
    try {
      await destroyImageByUrl(item.imageUrl);
    } catch (error) {
      console.warn(
        `[cerablus] item "${item.name}" was deleted but its Cloudinary photo could not be removed; it is orphaned but harmless.`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  revalidateMenu();
  revalidatePath(ADMIN_ITEMS);
  redirect(`${ADMIN_ITEMS}?deleted=${encodeURIComponent(item.name)}`);
}

/* --------------------------------------------------------------------------
   Reorder
   -------------------------------------------------------------------------- */

/**
 * Move an item one place up or down WITHIN its category.
 *
 * Implemented as a swap with the adjacent neighbour rather than a renumber of
 * the whole list: it touches two rows, it is correct even if the sortOrder
 * values have gaps, and it runs in a transaction so the two can never end up
 * sharing a position.
 */
export async function moveItemAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const parsed = itemMoveSchema.safeParse({
    id: formData.get("id") ?? "",
    direction: formData.get("direction") ?? "",
  });
  if (!parsed.success) redirect(`${ADMIN_ITEMS}?error=${encodeURIComponent("طلب ترتيب غير صالح")}`);

  const item = await prisma.item.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, categoryId: true, sortOrder: true },
  });
  if (!item) redirect(`${ADMIN_ITEMS}?error=${encodeURIComponent("الصنف غير موجود")}`);

  const up = parsed.data.direction === "up";
  const neighbour = await prisma.item.findFirst({
    where: {
      categoryId: item.categoryId,
      sortOrder: up ? { lt: item.sortOrder } : { gt: item.sortOrder },
    },
    orderBy: { sortOrder: up ? "desc" : "asc" },
    select: { id: true, sortOrder: true },
  });

  // Already at the end of its category — nothing to swap with, and not an error.
  if (neighbour) {
    await prisma.$transaction([
      prisma.item.update({ where: { id: item.id }, data: { sortOrder: neighbour.sortOrder } }),
      prisma.item.update({ where: { id: neighbour.id }, data: { sortOrder: item.sortOrder } }),
    ]);
    revalidateMenu();
  }

  revalidatePath(ADMIN_ITEMS);
}

/* --------------------------------------------------------------------------
   Quick toggles from the list
   -------------------------------------------------------------------------- */

/**
 * Flip availability from the list, so "we're out of that today" is one click
 * rather than a trip through the editor. Only this one flag — featured and
 * offer change how a price reads, so they stay in the editor behind validation.
 */
export async function toggleItemAvailableAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const parsed = itemDeleteSchema.safeParse({ id: formData.get("id") ?? "" });
  if (!parsed.success) redirect(`${ADMIN_ITEMS}?error=${encodeURIComponent("طلب غير صالح")}`);

  const item = await prisma.item.findUnique({
    where: { id: parsed.data.id },
    select: { available: true },
  });
  if (!item) redirect(`${ADMIN_ITEMS}?error=${encodeURIComponent("الصنف غير موجود")}`);

  await prisma.item.update({
    where: { id: parsed.data.id },
    data: { available: !item.available },
  });

  revalidateMenu();
  revalidatePath(ADMIN_ITEMS);
}
