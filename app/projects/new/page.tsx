import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_COEF, type Coef, type MaterialRow } from "@/lib/calc";
import AppHeader from "@/components/AppHeader";
import ProjectForm from "@/components/ProjectForm";

export default async function NewProjectPage() {
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
        Kunde inte hitta din organisation.
      </main>
    );
  }
  const orgId = membership.org_id as string;
  const orgName = (membership as { orgs?: { name?: string } }).orgs?.name;

  const [{ data: settingsRow }, { data: materialRowsData }, { data: projectsData }] = await Promise.all([
    supabase.from("org_settings").select("coef").eq("org_id", orgId).maybeSingle(),
    supabase
      .from("material_rows")
      .select("id, slag, material, dimension, kr_per_m, co2_per_m, enhet")
      .eq("org_id", orgId)
      .order("slag")
      .order("material")
      .order("dimension"),
    supabase.from("projects").select("utfall, prognos_total").eq("org_id", orgId),
  ]);

  const coef: Coef = { ...DEFAULT_COEF, ...((settingsRow?.coef as object) || {}) };
  const materialDB: MaterialRow[] = (materialRowsData || []).map((r) => ({
    id: r.id,
    slag: r.slag,
    material: r.material,
    dimension: r.dimension,
    krPerM: r.kr_per_m,
    co2PerM: r.co2_per_m,
    enhet: r.enhet,
  }));
  const calibrationProjects = (projectsData || []).map((p) => ({ utfall: p.utfall, prognosTotal: p.prognos_total }));

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[var(--paper)]">
      <AppHeader orgName={orgName} active="/" title="Projekt" subtitle="Nytt projekt" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-5">
        <Link href="/" className="text-xs text-[var(--muted)] hover:text-[var(--navy)]">
          ← Tillbaka till översikt
        </Link>
        <div className="mt-4">
          <ProjectForm coef={coef} materialDB={materialDB} calibrationProjects={calibrationProjects} />
        </div>
      </main>
    </div>
  );
}
