import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "slides";
const MAX_BYTES = 5 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

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

/** 管理画面からスライドの一覧用サムネイル画像をアップロード（JPEG/PNG/WebP/GIF、最大5MB） */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard.error) return guard.error;
  if (!supabaseAdmin) return NextResponse.json({ error: "Server error" }, { status: 500 });

  const { id: slideId } = await params;
  if (!slideId) return NextResponse.json({ error: "id が必要です" }, { status: 400 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file が必要です" }, { status: 400 });
  }

  const mime = file.type || "";
  const ext = MIME_TO_EXT[mime];
  if (!ext) {
    return NextResponse.json(
      { error: "対応形式: JPEG, PNG, WebP, GIF のみです" },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ error: "ファイルサイズは5MB以下にしてください" }, { status: 400 });
  }

  const storagePath = `slide-thumbnails/${slideId}/thumbnail.${ext}`;
  const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, buf, {
    contentType: mime,
    upsert: true,
  });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);

  const { error: dbErr } = await supabaseAdmin.from("slides").update({ image_url: publicUrl }).eq("id", slideId);

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, image_url: publicUrl });
}
