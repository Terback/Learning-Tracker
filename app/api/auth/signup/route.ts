import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function isAllowedEmail(email: string) {
  const allowed = (process.env.ALLOWED_SIGNUP_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

export async function POST(request: Request) {
  const { email, password, displayName } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const trimmedName = String(displayName ?? "").trim();
  if (!trimmedName) {
    return NextResponse.json({ error: "Display name is required." }, { status: 400 });
  }

  if (!isAllowedEmail(String(email))) {
    return NextResponse.json({ error: "This email is not authorized to create an account." }, { status: 403 });
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // data.user.id comes from Supabase's own signUp response, not the client-supplied request body.
  if (data.user) {
    await prisma.userProfile.upsert({
      where: { userId: data.user.id },
      update: { displayName: trimmedName },
      create: { userId: data.user.id, displayName: trimmedName }
    });
  }

  return NextResponse.json({ hasSession: Boolean(data.session) });
}
