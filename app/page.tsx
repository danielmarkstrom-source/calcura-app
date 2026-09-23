import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatKr } from "@/lib/calc";
import AppHeader from "@/components/AppHeader";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, orgs(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center p-8 text-sm text-slate-600">
        Kunde inte hitta din organisation. Kontakta den som bjöd in dig.
      </main>
    );
  }

  const orgId = membership.org_id as string;
  const orgName = (membership as { orgs?: { name?: string } }).orgs?.name;

  const { data: projects } = await supabase
    .from("projects")
    .select("id, namn, status, prognos_total, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <AppHeader orgName={orgName} active="/" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Projekt</h1>
          <Link href="/projects/new" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
            + Nytt projekt
          </Link>
        </div>
        {!projects || projects.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Inga projekt ännu.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <div className="font-medium text-slate-900">{p.namn || "Namnlöst projekt"}</div>
                  <div className="text-xs text-slate-500">{p.status === "avslutat" ? "Avslutat" : "Pågående"}</div>
                </div>
                <div className="font-mono text-slate-700">{formatKr(p.prognos_total || 0)}</div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
