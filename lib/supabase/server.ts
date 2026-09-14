import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Klient för Server Components/Actions/Route Handlers. Måste skapas på nytt per
// request (aldrig delas/cachas globalt) enligt Supabases eget API-kontrakt.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // setAll anropad från en Server Component (där man inte får sätta kakor) -
            // ofarligt så länge proxy.ts (sessionsuppdateringen) körs på varje request.
          }
        },
      },
    }
  );
}
