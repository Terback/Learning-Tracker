import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function isAllowedEmail(email: string) {
  const allowed = (process.env.ALLOWED_SIGNUP_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  if (!isAllowedEmail(String(email))) {
    return NextResponse.json({ error: "This email is not authorized to create an account." }, { status: 403 });
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ hasSession: Boolean(data.session) });
}
