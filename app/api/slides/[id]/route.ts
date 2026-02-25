import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET_NAME = "slides";

export const dynamic = "force-dynamic";

/** Storage 内のフォルダ配下の全ファイルパスを再帰的に取得 */
async function listAllFilePaths(prefix: string): Promise<string[]> {
  if (!supabaseAdmin) return [];

  const paths: string[] = [];
  const stack: string[] = [prefix];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .list(current, { limit: 1000 });

    if (error) {
      console.error("Storage list error:", error);
      break;
    }

    for (const item of data ?? []) {
      const fullPath = current ? `${current}/${item.name}` : item.name;
      // metadata.size がある場合はファイル、なければフォルダ
      const isFile = item.metadata?.size !== undefined;
      if (isFile) {
        paths.push(fullPath);
      } else if (item.name) {
        stack.push(fullPath);
      }
    }
  }

  return paths;
}

/** スライドを削除（DB + Storage） */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Slide ID is required" },
      { status: 400 }
    );
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY が必要です" },
      { status: 500 }
    );
  }

  try {
    // 1. Storage 内のファイルを削除
    const filePaths = await listAllFilePaths(id);
    if (filePaths.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .remove(filePaths);

      if (storageError) {
        console.error("Storage delete error:", storageError);
        return NextResponse.json(
          { error: "Storage の削除に失敗しました", details: storageError.message },
          { status: 500 }
        );
      }
    }

    // 2. DB から削除
    const { error: dbError } = await supabaseAdmin
      .from("slides")
      .delete()
      .eq("id", id);

    if (dbError) {
      return NextResponse.json(
        { error: "DB の削除に失敗しました", details: dbError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err) {
    console.error("Delete slide error:", err);
    return NextResponse.json(
      {
        error: "削除に失敗しました",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

/** スライドのメタデータを更新（タイトル・年・タグ） */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Slide ID is required" },
      { status: 400 }
    );
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY が必要です" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.title === "string" && body.title.trim()) {
      updates.title = body.title.trim();
    }
    if (body.year !== undefined) {
      updates.year = body.year === "" || body.year === null ? null : Number(body.year);
    }
    if (Array.isArray(body.keyword_tags)) {
      updates.keyword_tags = body.keyword_tags.filter(
        (t: unknown): t is string => typeof t === "string" && t.trim() !== ""
      );
    }
    if (typeof body.caption === "string") {
      updates.caption = body.caption.trim() || null;
    }
    if (body.program_id !== undefined && typeof body.program_id === "string" && body.program_id.trim()) {
      updates.program_id = body.program_id.trim();
    }
    if (typeof body.visibility === "string" && ["free", "invite_only", "private"].includes(body.visibility)) {
      updates.visibility = body.visibility;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "更新する項目がありません" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("slides")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "更新に失敗しました", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, slide: data });
  } catch (err) {
    console.error("Update slide error:", err);
    return NextResponse.json(
      {
        error: "更新に失敗しました",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
