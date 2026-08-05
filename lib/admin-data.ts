/**
 * SERVER ONLY — the admin's view of the menu.
 *
 * Deliberately NOT cached, unlike lib/menu-data.ts. The owner has just made a
 * change and must see the result; they are also the one person for whom a Neon
 * cold start is acceptable (CLAUDE.md: "never in a customer's path — only the
 * admin's"). Every admin page is `dynamic = "force-dynamic"` for the same
 * reason.
 */
import { prisma } from "@/lib/prisma";

export type AdminVariant = {
  id: string;
  label: string;
  price: number;
  sortOrder: number;
};

export type AdminItem = {
  id: string;
  name: string;
  desc: string;
  price: number | null;
  imageUrl: string;
  available: boolean;
  featured: boolean;
  offer: boolean;
  oldPrice: number | null;
  sortOrder: number;
  categoryId: string;
  variants: AdminVariant[];
};

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  itemCount: number;
};

export type AdminMenu = {
  categories: AdminCategory[];
  /** Every item, in category order then sortOrder — same order the public site uses. */
  items: (AdminItem & { categoryName: string })[];
};

/** Categories in menu order, each with how many items it holds. */
export async function getAdminCategories(): Promise<AdminCategory[]> {
  const rows = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { items: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    sortOrder: row.sortOrder,
    itemCount: row._count.items,
  }));
}

/** The whole menu for the admin list: categories plus every item. */
export async function getAdminMenu(): Promise<AdminMenu> {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { items: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        include: { variants: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  return {
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      sortOrder: category.sortOrder,
      itemCount: category._count.items,
    })),
    items: categories.flatMap((category) =>
      category.items.map((item) => ({
        id: item.id,
        name: item.name,
        desc: item.desc,
        price: item.price,
        imageUrl: item.imageUrl,
        available: item.available,
        featured: item.featured,
        offer: item.offer,
        oldPrice: item.oldPrice,
        sortOrder: item.sortOrder,
        categoryId: item.categoryId,
        categoryName: category.name,
        variants: item.variants.map((variant) => ({
          id: variant.id,
          label: variant.label,
          price: variant.price,
          sortOrder: variant.sortOrder,
        })),
      })),
    ),
  };
}

/** One item for the editor, or null if it is gone. */
export async function getAdminItem(id: string): Promise<AdminItem | null> {
  const item = await prisma.item.findUnique({
    where: { id },
    include: { variants: { orderBy: { sortOrder: "asc" } } },
  });
  if (!item) return null;

  return {
    id: item.id,
    name: item.name,
    desc: item.desc,
    price: item.price,
    imageUrl: item.imageUrl,
    available: item.available,
    featured: item.featured,
    offer: item.offer,
    oldPrice: item.oldPrice,
    sortOrder: item.sortOrder,
    categoryId: item.categoryId,
    variants: item.variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      price: variant.price,
      sortOrder: variant.sortOrder,
    })),
  };
}
