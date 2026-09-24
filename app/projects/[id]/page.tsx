import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calcProjectDisplay, computeFramdrift, effCoef, formatKr, fmtInt, DEFAULT_COEF, type Coef, type MaterialRow, type CalcResult } from "@/lib/calc";
import AppHeader from "@/components/AppHeader";
import UtfallForm from "@/components/UtfallForm";
import FramdriftForm from "@/components/FramdriftForm";
import { deleteProject, removeFramdriftEntry } from "@/app/actions";

export default async function ProjectDetailPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
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

  const { data: project } = await supabase.from("projects").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
  if (!project) notFound();

  const { data: settingsRow } = await supabase.from("org_settings").select("coef").eq("org_id", orgId).maybeSingle();
  const globalCoef: Coef = { ...DEFAULT_COEF, ...((settingsRow?.coef as object) || {}) };

  // Frusen kalkyl från när projektet sparades (samma princip som piloten: ändrade
  // koefficienter/kalibrering ska INTE ändra redan sparade projekts prognos retroaktivt).
  // Äldre/ofullständiga rader utan snapshot räknas fram en gång som fallback.
  let calc = project.prognos_snapshot as CalcResult | null;
  if (!calc) {
    const [{ data: materialRowsData }, { data: projectsData }] = await Promise.all([
      supabase.from("material_rows").select("*").eq("org_id", orgId),
      supabase.from("projects").select("utfall, prognos_total").eq("org_id", orgId),
    ]);
    const materialDB: MaterialRow[] = (materialRowsData || []).map((r) => ({
      id: r.id,
      slag: r.slag,
      material: r.material,
      dimension: r.dimension,
      krPerM: r.kr_per_m,
      co2PerM: r.co2_per_m,
      enhet: r.enhet,
    }));
    const projectsForCalibration = (projectsData || []).map((p) => ({ utfall: p.utfall, prognosTotal: p.prognos_total }));
    calc = calcProjectDisplay(
      {
        poster: project.poster,
        arstid: project.arstid,
        servis: project.servis,
        intrang: project.intrang,
        besiktning: project.besiktning,
        schaktdjup: project.schaktdjup,
        schaktbredd: project.schaktbredd,
        slantH: project.slant_h,
        slantV: project.slant_v,
        antalPersoner: project.antal_personer,
        antalMaskiner: project.antal_maskiner,
        coefOverrides: project.coef_overrides,
      },
      effCoef(globalCoef, { coefOverrides: project.coef_overrides }),
      materialDB,
      projectsForCalibration
    );
  }

  const avvikelse = project.utfall ? ((project.utfall - (project.prognos_total || 0)) / (project.prognos_total || 1)) * 100 : null;
  const fd =
    project.status === "pagaende"
      ? computeFramdrift({ framdrift: project.framdrift, coefOverrides: project.coef_overrides }, calc, globalCoef)
      : null;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <AppHeader orgName={orgName} active="/" />
      <main className="mx-auto grid w-full max-w-3xl flex-1 gap-6 px-6 py-8 md:grid-cols-[1fr_280px]">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
            ← Tillbaka till översikt
          </Link>
          <div className="mt-2 flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900">{project.namn || "Namnlöst projekt"}</h1>
            <span
              className={
                "rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wide " +
                (project.status === "avslutat" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700")
              }
            >
              {project.status === "avslutat" ? "Avslutat" : "Pågående"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-slate-900 p-4 text-white sm:grid-cols-4">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Prognos</div>
              <div className="text-base font-bold">{formatKr(calc.total)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Kr/meter</div>
              <div className="text-base font-bold">{formatKr(calc.krPerMeter)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Tidsåtgång</div>
              <div className="text-base font-bold">{fmtInt(calc.dagar)} dagar</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Klimat</div>
              <div className="text-base font-bold">{fmtInt(calc.co2)} kg</div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {calc.parts.map((part) => (
              <div key={part.key}>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">{part.label}</span>
                  <span className="font-mono text-slate-700">
                    {formatKr(part.value)} <span className="text-slate-400">({calc.total > 0 ? ((part.value / calc.total) * 100).toFixed(1) : "0.0"}%)</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded bg-slate-100">
                  <div
                    className="h-1.5 rounded bg-sky-500"
                    style={{ width: `${Math.max((part.value / calc.total) * 100, 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-sm text-slate-500">
            Schaktdjup {(project.schaktdjup || 0).toFixed(1)} m · schaktbredd {(project.schaktbredd || 0).toFixed(1)} m ·
            Fall A {calc.massor.fallAVolym.toFixed(1)} m³ · Fall B {calc.massor.fallBVolym.toFixed(1)} m³ · anläggningsmaterial{" "}
            {calc.massor.anlaggningsmaterialBehov.toFixed(1)} m³
          </div>

          <form action={deleteProject.bind(null, project.id)} className="mt-6">
            <button type="submit" className="text-sm text-red-600 hover:text-red-800">
              Ta bort projekt
            </button>
          </form>
        </div>

        <div>
          {fd && (
            <>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Framdrift</h2>
              <div className="mb-6 rounded-md border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-500">
                  Logga hur långt ni faktiskt kommit och hur många dagar det tagit, så räknas en reviderad
                  prognos för resten fram utifrån den faktiska takten hittills.
                </p>
                {fd.entries.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {fd.entries.map((e) => (
                      <div key={e.id} className="flex items-center justify-between text-xs text-slate-600">
                        <span className="font-mono text-slate-400">{new Date(e.datum).toLocaleDateString("sv-SE")}</span>
                        <span className="font-mono">{e.meter} m</span>
                        <span className="font-mono">{e.dagar} dgr</span>
                        <form action={removeFramdriftEntry.bind(null, project.id, e.id)}>
                          <button type="submit" className="text-red-500 hover:text-red-700" aria-label="Ta bort mätpunkt">
                            ×
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}
                {fd.observeradTakt !== null && (
                  <div className="mt-3 space-y-1 rounded-md bg-slate-50 p-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Faktisk takt hittills</span>
                      <span className="font-mono font-semibold">{fd.observeradTakt.toFixed(1)} m/dag</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Planerad läggningstakt</span>
                      <span className="font-mono">{fd.ursprungligTakt?.toFixed(1) ?? "—"} m/dag</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Återstående längd</span>
                      <span className="font-mono">{fd.aterstaendeLangd.toFixed(0)} m</span>
                    </div>
                    <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-semibold">
                      <span>Reviderad total tidsåtgång</span>
                      <span className="font-mono">{fd.revideradTotalDagar?.toFixed(0)} dagar</span>
                    </div>
                    {fd.dagarAvvikelse !== null && (
                      <div className={"font-mono " + (Math.abs(fd.dagarAvvikelse) > calc.dagar * 0.1 ? "text-red-600" : "text-emerald-600")}>
                        {fd.dagarAvvikelse > 0 ? "+" : ""}
                        {fd.dagarAvvikelse.toFixed(0)} dagar mot ursprunglig prognos ({fmtInt(calc.dagar)} dagar)
                      </div>
                    )}
                    {fd.revideradKostnad !== null && (
                      <div className="flex justify-between pt-1">
                        <span className="text-slate-500">Grov kostnadsomprognos</span>
                        <span className="font-mono">{formatKr(fd.revideradKostnad)}</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-3">
                  <FramdriftForm projectId={project.id} />
                </div>
              </div>
            </>
          )}

          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Utfall</h2>
          <div className="mt-3 rounded-md border border-slate-200 bg-white p-4">
            {project.utfall ? (
              <>
                <div className="text-xs uppercase tracking-wide text-slate-500">Faktisk slutkostnad</div>
                <div className="mt-1 font-mono text-lg font-bold text-slate-900">{formatKr(project.utfall)}</div>
                {avvikelse !== null && (
                  <div className={"mt-1 font-mono text-sm " + (Math.abs(avvikelse) > 15 ? "text-red-600" : "text-emerald-600")}>
                    Avvikelse mot prognos: {avvikelse > 0 ? "+" : ""}
                    {avvikelse.toFixed(1)}%
                  </div>
                )}
                <p className="mt-3 text-xs text-slate-500">
                  Denna avvikelse räknas in i kalibreringen för nya prognoser (kr/tim-schablonerna, inte materialpriser).
                </p>
              </>
            ) : (
              <UtfallForm projectId={project.id} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
