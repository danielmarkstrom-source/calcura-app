import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InviteForm from "@/components/InviteForm";
import AppHeader from "@/components/AppHeader";
import CoefForm from "@/components/CoefForm";
import { DEFAULT_COEF, getCalibration, type Coef } from "@/lib/calc";

export default async function SettingsPage() {
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
  const orgName = (membership as { orgs?: { name?: string } }).orgs?.name ?? "Din organisation";

  const { data: members } = await supabase.from("org_members").select("user_id").eq("org_id", orgId);
  const { data: invites } = await supabase
    .from("org_invites")
    .select("id, email, created_at")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  const [{ data: settingsRow }, { data: projectsData }] = await Promise.all([
    supabase.from("org_settings").select("coef").eq("org_id", orgId).maybeSingle(),
    supabase.from("projects").select("utfall, prognos_total").eq("org_id", orgId),
  ]);
  const coef: Coef = { ...DEFAULT_COEF, ...((settingsRow?.coef as object) || {}) };
  const calibration = getCalibration((projectsData || []).map((p) => ({ utfall: p.utfall, prognosTotal: p.prognos_total })));

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[var(--paper)]">
      <AppHeader orgName={orgName} active="/settings" title="Inställningar" subtitle="Koefficienter" />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-8 px-6 py-5">
        <p className="text-sm text-[var(--muted-2)]">
          {members?.length ?? 0} medlem(mar) i {orgName}.
        </p>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Bjud in kollega</h2>
          <p className="mt-1 text-sm text-slate-500">
            De skapar ett konto med sin mejl på inloggningssidan och hamnar automatiskt i samma organisation som du.
          </p>
          <div className="mt-3">
            <InviteForm />
          </div>
        </section>

        {invites && invites.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Väntande inbjudningar</h2>
            <ul className="mt-2 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white text-sm">
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between px-4 py-2">
                  <span>{inv.email}</span>
                  <span className="text-xs text-slate-400">{new Date(inv.created_at).toLocaleDateString("sv-SE")}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Kalkylinställningar</h2>
          <p className="mt-1 text-sm text-slate-500">
            Styr alla nya prognoser. Materialdatabasen redigeras separat under{" "}
            <span className="font-medium text-slate-700">Material</span>.
          </p>
          <div className="mt-3">
            <CoefForm coef={coef} calibration={calibration} />
          </div>
        </section>
      </main>
    </div>
  );
}
