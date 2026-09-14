import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Tas emot när användaren klickar den magiska länken i mejlet. `code` växlas in mot
// en session (PKCE-flödet, standard i @supabase/ssr) och kakan sätts av lib/supabase/server.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
