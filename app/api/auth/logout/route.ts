import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { searchParams } = new URL(request.url);
  const redirectTo = searchParams.get("redirect") || "/";
  return NextResponse.redirect(new URL(redirectTo, request.url));
}
