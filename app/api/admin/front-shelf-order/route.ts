import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ShelfType = "program_shelf" | "video_program_shelf" | "curated_shelf";

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

export async function GET() {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  if (!supabaseAdmin) return NextResponse.json({ error: "Server error" }, { status: 500 });

  const { data: shelves, error: shelfError } = await supabaseAdmin.from("shelves").select("id, title");
  if (shelfError) return NextResponse.json({ error: shelfError.message }, { status: 500 });
  const { data: programs, error: programError } = await supabaseAdmin
    .from("programs")
    .select("id, name, started_year, show_on_front")
    .eq("show_on_front", true)
    .order("started_year", { ascending: true, nullsFirst: false });
  if (programError) return NextResponse.json({ error: programError.message }, { status: 500 });

  const { data: currentRows, error: rowError } = await supabaseAdmin
    .from("front_shelf_order")
    .select("id, shelf_type, ref_id, sort_order, is_enabled")
    .order("sort_order", { ascending: true });
  if (rowError) return NextResponse.json({ error: rowError.message }, { status: 500 });

  const rows = currentRows ?? [];
  const shelfIds = new Set((shelves ?? []).map((s) => String(s.id)));
  const programIds = new Set((programs ?? []).map((p) => String(p.id)));
  const existingCurated = new Set(rows.filter((r) => r.shelf_type === "curated_shelf").map((r) => String(r.ref_id)));
  const existingProgramShelf = new Set(rows.filter((r) => r.shelf_type === "program_shelf").map((r) => String(r.ref_id)));
  const existingVideoProgramShelf = new Set(rows.filter((r) => r.shelf_type === "video_program_shelf").map((r) => String(r.ref_id)));
  const maxOrder = rows.reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0);

  const missingProgramShelves = [...programIds].filter((id) => !existingProgramShelf.has(id));
  const missingVideoProgramShelves = [...programIds].filter((id) => !existingVideoProgramShelf.has(id));
  const missingCurated = [...shelfIds].filter((id) => !existingCurated.has(id));
  if (missingProgramShelves.length > 0 || missingVideoProgramShelves.length > 0 || missingCurated.length > 0) {
    const { error: insError } = await supabaseAdmin.from("front_shelf_order").insert(
      [
        ...missingProgramShelves.map((id, idx) => ({
          shelf_type: "program_shelf" as const,
          ref_id: id,
          sort_order: maxOrder + idx * 2 + 1,
          is_enabled: true,
        })),
        ...missingVideoProgramShelves.map((id, idx) => ({
          shelf_type: "video_program_shelf" as const,
          ref_id: id,
          sort_order: maxOrder + idx * 2 + 2,
          is_enabled: true,
        })),
        ...missingCurated.map((id, idx) => ({
          shelf_type: "curated_shelf" as const,
          ref_id: id,
          sort_order: maxOrder + missingProgramShelves.length * 2 + idx + 1,
          is_enabled: true,
        })),
      ],
    );
    if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  const { data: finalRows, error: finalError } = await supabaseAdmin
    .from("front_shelf_order")
    .select("id, shelf_type, ref_id, sort_order, is_enabled")
    .order("sort_order", { ascending: true });
  if (finalError) return NextResponse.json({ error: finalError.message }, { status: 500 });

  const shelfTitleMap = new Map((shelves ?? []).map((s) => [String(s.id), s.title]));
  const programTitleMap = new Map((programs ?? []).map((p) => [String(p.id), p.name]));
  const withLabel = (finalRows ?? []).map((row) => {
    const type = row.shelf_type as ShelfType;
    const label =
      type === "program_shelf"
        ? `スライド棚: ${programTitleMap.get(String(row.ref_id)) ?? row.ref_id}`
        : type === "video_program_shelf"
          ? `動画棚: ${programTitleMap.get(String(row.ref_id)) ?? row.ref_id}`
          : `シリーズ棚: ${shelfTitleMap.get(String(row.ref_id)) ?? row.ref_id}`;
    return { ...row, shelf_type: type, label };
  });
  return NextResponse.json(withLabel);
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  if (!supabaseAdmin) return NextResponse.json({ error: "Server error" }, { status: 500 });
  const admin = supabaseAdmin;

  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return NextResponse.json({ success: true });

  const now = new Date().toISOString();
  const updates = items
    .map((it: unknown) => {
      if (!it || typeof it !== "object") return null;
      const row = it as { id?: string; sort_order?: number; is_enabled?: boolean };
      if (!row.id) return null;
      return admin
        .from("front_shelf_order")
        .update({
          sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
          is_enabled: row.is_enabled !== false,
          updated_at: now,
        })
        .eq("id", row.id);
    })
    .filter(Boolean);

  for (const query of updates) {
    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
