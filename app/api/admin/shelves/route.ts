import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "ログインが必要です" }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (profile?.is_admin !== true) {
    return { error: NextResponse.json({ error: "管理者のみ利用できます" }, { status: 403 }) };
  }
  return { error: null };
}

function normalizeSlug(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

type ShelfItemInput = {
  content_type: "slide" | "video";
  content_id: string;
  sort_order?: number;
};

export async function GET() {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  if (!supabaseAdmin) return NextResponse.json({ error: "Server error" }, { status: 500 });

  const { data: shelves, error: shelvesError } = await supabaseAdmin
    .from("shelves")
    .select("id, title, slug, description, sort_order, is_published, created_at, updated_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (shelvesError) return NextResponse.json({ error: shelvesError.message }, { status: 500 });

  const shelfIds = (shelves ?? []).map((s) => s.id);
  let items: Array<{ id: string; shelf_id: string; content_type: "slide" | "video"; content_id: string; sort_order: number }> = [];
  if (shelfIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("shelf_items")
      .select("id, shelf_id, content_type, content_id, sort_order")
      .in("shelf_id", shelfIds)
      .order("sort_order", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    items = (data ?? []) as typeof items;
  }

  const itemsByShelf = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsByShelf.get(item.shelf_id) ?? [];
    list.push(item);
    itemsByShelf.set(item.shelf_id, list);
  }

  return NextResponse.json((shelves ?? []).map((s) => ({ ...s, items: itemsByShelf.get(s.id) ?? [] })));
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  if (!supabaseAdmin) return NextResponse.json({ error: "Server error" }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const slugBase = typeof body.slug === "string" && body.slug.trim() ? body.slug : title;
  const slug = normalizeSlug(slugBase);
  const description = typeof body.description === "string" ? body.description.trim() || null : null;
  const sortOrder = typeof body.sort_order === "number" ? body.sort_order : Number(body.sort_order) || 0;
  const isPublished = body.is_published !== false;
  const items = Array.isArray(body.items) ? (body.items as ShelfItemInput[]) : [];

  if (!title || !slug) {
    return NextResponse.json({ error: "タイトルとslugは必須です" }, { status: 400 });
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from("shelves")
    .insert({
      title,
      slug,
      description,
      sort_order: sortOrder,
      is_published: isPublished,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (createError || !created) {
    return NextResponse.json({ error: createError?.message ?? "作成に失敗しました" }, { status: 500 });
  }

  if (items.length > 0) {
    const filtered = items.filter((it) => (it.content_type === "slide" || it.content_type === "video") && typeof it.content_id === "string" && it.content_id.trim().length > 0);
    if (filtered.length > 0) {
      const { error: itemError } = await supabaseAdmin.from("shelf_items").insert(
        filtered.map((it, idx) => ({
          shelf_id: created.id,
          content_type: it.content_type,
          content_id: String(it.content_id),
          sort_order: typeof it.sort_order === "number" ? it.sort_order : idx,
        })),
      );
      if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });
    }
  }

  const { error: orderError } = await supabaseAdmin.from("front_shelf_order").insert({
    shelf_type: "curated_shelf",
    ref_id: created.id,
    sort_order: sortOrder + 1000,
    is_enabled: isPublished,
    updated_at: new Date().toISOString(),
  });
  if (orderError && !String(orderError.message).includes("duplicate key")) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: created.id });
}
