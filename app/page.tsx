import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatKr, getCalibration, DEFAULT_COEF, type CalcResult, type Coef } from "@/lib/calc";
import AppHeader from "@/components/AppHeader";
import ClickableRow from "@/components/ClickableRow";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
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

  const [{ data: projects }, { data: settingsRow }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, namn, status, poster, prognos_total, prognos_snapshot, utfall, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase.from("org_settings").select("coef").eq("org_id", orgId).maybeSingle(),
  ]);

  const coef: Coef = { ...DEFAULT_COEF, ...((settingsRow?.coef as object) || {}) };
  const list = projects || [];

  const rows = list.map((p) => {
    const snapshot = p.prognos_snapshot as CalcResult | null;
    const strackor = (Array.isArray(p.poster) ? p.poster.length : 0) || 1;
    const langdTotal = snapshot?.langdTotal ?? 0;
    const total = p.prognos_total || 0;
    const krPerMeter = snapshot?.krPerMeter ?? (langdTotal > 0 ? total / langdTotal : 0);
    const avv = p.utfall ? ((p.utfall - total) / (total || 1)) * 100 : null;
    return { ...p, strackor, langdTotal, total, krPerMeter, avv };
  });

  const avslutade = list.filter((p) => p.utfall);
  const avvList = avslutade.map((p) => ((p.utfall - (p.prognos_total || 0)) / (p.prognos_total || 1)) * 100);
  const snitt = avvList.length ? avvList.reduce((a, b) => a + b, 0) / avvList.length : null;
  const calibration = getCalibration(list.map((p) => ({ utfall: p.utfall, prognosTotal: p.prognos_total })));

  return (
    <div className="flex min-h-full flex-1 flex-col bg-[var(--paper)]">
      <AppHeader userEmail={user.email} active="/" title="Projekt" subtitle="Översikt" />
      <main className="mx-auto grid w-full max-w-[1180px] flex-1 items-start gap-6 px-6 py-5 md:grid-cols-[1fr_260px]">
        <div className="rounded border border-[var(--line)] bg-white">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-[18px] py-3.5">
            <h2 className="m-0 text-[15px] font-semibold text-[var(--ink)]">Alla projekt</h2>
            <Link
              href="/projects/new"
              className="rounded border border-[var(--steel)] bg-[var(--steel)] px-3 py-[7px] text-xs font-medium text-white hover:bg-[#1590ba]"
            >
              + Nytt projekt
            </Link>
          </div>
          {rows.length === 0 ? (
            <div className="px-5 py-[50px] text-center text-[13px] text-[var(--muted-2)]">
              Inga projekt inlagda ännu.
              <br />
              <br />
              <Link href="/projects/new" className="text-[var(--steel)] underline underline-offset-2">
                Lägg till ditt första projekt →
              </Link>
            </div>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#fafaf8]">
                  <th className="border-b border-[var(--line)] px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">#</th>
                  <th className="border-b border-[var(--line)] px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Projekt</th>
                  <th className="border-b border-[var(--line)] px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Omfattning</th>
                  <th className="border-b border-[var(--line)] px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Status</th>
                  <th className="border-b border-[var(--line)] px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Kr/m</th>
                  <th className="border-b border-[var(--line)] px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Prognos</th>
                  <th className="border-b border-[var(--line)] px-2.5 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Utfall-avv.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <ClickableRow key={r.id} href={`/projects/${r.id}`}>
                    <td className="border-b border-[#eeeeea] px-2.5 py-2.5 font-mono text-[var(--muted)]">{rows.length - i}</td>
                    <td className="border-b border-[#eeeeea] px-2.5 py-2.5 text-[var(--ink)]">{r.namn || "Namnlöst projekt"}</td>
                    <td className="border-b border-[#eeeeea] px-2.5 py-2.5 font-mono text-[var(--muted-2)]">
                      {r.strackor} st · {r.langdTotal} m
                    </td>
                    <td className="border-b border-[#eeeeea] px-2.5 py-2.5">
                      <span
                        className={
                          "rounded px-[7px] py-[3px] text-[10px] font-semibold uppercase tracking-wide " +
                          (r.status === "avslutat" ? "bg-[var(--green-light)] text-[var(--green)]" : "bg-[var(--steel-light)] text-[var(--steel)]")
                        }
                      >
                        {r.status === "avslutat" ? "Avslutat" : "Pågående"}
                      </span>
                    </td>
                    <td className="border-b border-[#eeeeea] px-2.5 py-2.5 text-right font-mono">{formatKr(r.krPerMeter)}/m</td>
                    <td className="border-b border-[#eeeeea] px-2.5 py-2.5 text-right font-mono font-semibold">{formatKr(r.total)}</td>
                    <td
                      className={
                        "border-b border-[#eeeeea] px-2.5 py-2.5 text-right font-mono " +
                        (r.avv === null ? "text-[var(--muted)]" : Math.abs(r.avv) > 15 ? "text-[var(--red)]" : "text-[var(--green)]")
                      }
                    >
                      {r.avv === null ? "—" : (r.avv > 0 ? "+" : "") + r.avv.toFixed(1) + "%"}
                    </td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded border border-[var(--line)] bg-white">
          <div className="border-b border-[var(--line)] p-3.5">
            <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Projekt totalt</div>
            <div className="text-[22px] font-bold text-[var(--ink)]">{rows.length}</div>
          </div>
          <div className="border-b border-[var(--line)] p-3.5">
            <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Pågående</div>
            <div className="text-[22px] font-bold text-[var(--ink)]">{rows.filter((p) => p.status === "pagaende").length}</div>
          </div>
          <div className="border-b border-[var(--line)] p-3.5">
            <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Snittavvikelse</div>
            <div className="text-[22px] font-bold text-[var(--ink)]">{snitt === null ? "—" : (snitt > 0 ? "+" : "") + snitt.toFixed(1) + "%"}</div>
          </div>
          <div className="p-3.5">
            <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Kalibrering</div>
            {calibration.n === 0 ? (
              <div className="mt-1 text-xs leading-snug text-[var(--muted-2)]">Ingen data ännu. Registrera utfall på avslutade projekt.</div>
            ) : !coef.calibrationEnabled ? (
              <div className="mt-1 text-xs leading-snug text-[var(--muted-2)]">
                Avstängd. Skulle vara {calibration.factor.toFixed(2)}× ({calibration.n} projekt).
              </div>
            ) : (
              <>
                <div className="text-lg font-bold text-[var(--ink)]">{calibration.factor.toFixed(2)}×</div>
                <div className="mt-0.5 text-[11px] text-[var(--muted-2)]">
                  {calibration.n} avslutade projekt · icke-materialposter {calibration.factor >= 1 ? "höjs" : "sänks"}{" "}
                  {Math.abs((calibration.factor - 1) * 100).toFixed(0)}%
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
