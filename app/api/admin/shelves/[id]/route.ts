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
  if (profile?.is_admin !== true) return { error: NextResponse.json({ error: "管理者のみ利用できます" }, { status: 403 }) };
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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  if (!supabaseAdmin) return NextResponse.json({ error: "Server error" }, { status: 500 });
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") updates.title = body.title.trim();
  if (typeof body.slug === "string") updates.slug = normalizeSlug(body.slug);
  if (typeof body.description === "string") updates.description = body.description.trim() || null;
  if (typeof body.sort_order === "number" || typeof body.sort_order === "string") {
    const n = Number(body.sort_order);
    if (Number.isFinite(n)) updates.sort_order = n;
  }
  if (typeof body.is_published === "boolean") updates.is_published = body.is_published;

  const { error: updateError } = await supabaseAdmin.from("shelves").update(updates).eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (Array.isArray(body.items)) {
    const items = (body.items as ShelfItemInput[])
      .filter((it) => (it.content_type === "slide" || it.content_type === "video") && typeof it.content_id === "string" && it.content_id.trim().length > 0);

    const { error: delError } = await supabaseAdmin.from("shelf_items").delete().eq("shelf_id", id);
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

    if (items.length > 0) {
      const { error: insError } = await supabaseAdmin.from("shelf_items").insert(
        items.map((it, idx) => ({
          shelf_id: id,
          content_type: it.content_type,
          content_id: String(it.content_id),
          sort_order: typeof it.sort_order === "number" ? it.sort_order : idx,
        })),
      );
      if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  if (!supabaseAdmin) return NextResponse.json({ error: "Server error" }, { status: 500 });
  const { id } = await params;

  await supabaseAdmin.from("front_shelf_order").delete().eq("shelf_type", "curated_shelf").eq("ref_id", id);
  const { error } = await supabaseAdmin.from("shelves").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
