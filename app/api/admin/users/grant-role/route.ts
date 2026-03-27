import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type GrantRoleRequest = {
  email?: string;
  role?: "admin" | "core_staff";
  action?: "grant" | "revoke";
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "ログインが必要です" }, { status: 401 }), supabase: null };
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (profile?.is_admin !== true) {
    return { error: NextResponse.json({ error: "管理者のみ利用できます" }, { status: 403 }), supabase: null };
  }
  return { error: null, supabase };
}

/** 現在の管理者/コアスタッフ一覧（管理者専用） */
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const { data: roleProfiles, error: rolesError } = await supabaseAdmin
    .from("profiles")
    .select("id, is_admin, is_core_staff")
    .or("is_admin.eq.true,is_core_staff.eq.true");

  if (rolesError) {
    return NextResponse.json({ error: rolesError.message }, { status: 500 });
  }

  const roleMap = new Map((roleProfiles ?? []).map((p) => [p.id, { is_admin: p.is_admin === true, is_core_staff: p.is_core_staff === true }]));
  if (roleMap.size === 0) {
    return NextResponse.json({ items: [] });
  }

  const usersById = new Map<string, string>();
  let page = 1;
  const perPage = 200;
  while (page <= 20) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const users = data?.users ?? [];
    for (const u of users) {
      if (roleMap.has(u.id)) usersById.set(u.id, u.email ?? "");
    }
    if (users.length < perPage) break;
    page += 1;
  }

  const items = Array.from(roleMap.entries())
    .map(([id, role]) => ({
      user_id: id,
      email: usersById.get(id) ?? "(email not found)",
      is_admin: role.is_admin,
      is_core_staff: role.is_core_staff,
    }))
    .sort((a, b) => a.email.localeCompare(b.email));

  return NextResponse.json({ items });
}

/** メールアドレス指定で管理者/コアスタッフ権限を付与・解除（管理者専用） */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as GrantRoleRequest;
  const role = body.role;
  const action = body.action === "revoke" ? "revoke" : "grant";
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";

  if (!email) {
    return NextResponse.json({ error: "メールアドレスを入力してください" }, { status: 400 });
  }
  if (role !== "admin" && role !== "core_staff") {
    return NextResponse.json({ error: "role が不正です" }, { status: 400 });
  }

  let page = 1;
  const perPage = 200;
  let targetUserId: string | null = null;

  while (page <= 20 && !targetUserId) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const users = data?.users ?? [];
    const hit = users.find((u) => normalizeEmail(u.email ?? "") === email);
    if (hit) {
      targetUserId = hit.id;
      break;
    }
    if (users.length < perPage) break;
    page += 1;
  }

  if (!targetUserId) {
    return NextResponse.json({ error: "そのメールアドレスのユーザーが見つかりません。先に一度ログインしてください。" }, { status: 404 });
  }

  const updates =
    role === "admin"
      ? { id: targetUserId, is_admin: action === "grant" }
      : { id: targetUserId, is_core_staff: action === "grant" };

  const { error: upsertError } = await supabaseAdmin
    .from("profiles")
    .upsert(updates, { onConflict: "id" });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message:
      role === "admin"
        ? action === "grant"
          ? "管理者権限を付与しました"
          : "管理者権限を解除しました"
        : action === "grant"
          ? "コアスタッフ権限を付与しました"
          : "コアスタッフ権限を解除しました",
  });
}
