import { formatKr, fmtInt } from "@/lib/calc";
import { BYGGSEMESTER_VECKOR, type StartfonsterResultat } from "@/lib/startfonster";

const ARSTID_FARG: Record<string, { farg: string; label: string }> = {
  var: { farg: "#2ec573", label: "Vår" },
  sommar: { farg: "#f2b632", label: "Sommar" },
  host: { farg: "#c9773a", label: "Höst" },
  vinter: { farg: "#1aacdb", label: "Vinter" },
};

function datum(d: Date): string {
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

export default function StartfonsterPanel({ res, nuvarandeTotal }: { res: StartfonsterResultat; nuvarandeTotal: number }) {
  const { alternativ, billigast, dyrast } = res;
  const spann = dyrast.total - billigast.total;
  const hojd = (t: number) => (spann > 0 ? 25 + 75 * ((t - billigast.total) / spann) : 60);
  const skillnadMotNu = billigast.total - nuvarandeTotal;

  return (
    <section className="mt-8">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Startfönster</h2>
      <p className="mb-3 text-xs text-slate-500">
        Projektet simulerat dag för dag från den 1:a i varje månad. Schaktet går långsammare de
        dagar som hamnar i en tyngre årstid, och under byggsemestern (v. {BYGGSEMESTER_VECKOR[0]}–
        {BYGGSEMESTER_VECKOR[BYGGSEMESTER_VECKOR.length - 1]}) står arbetet still medan TA,
        etableringsutrustning och omgivningspåverkan fortsätter att kosta per vecka.
      </p>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex h-32 items-end gap-1">
          {alternativ.map((a) => {
            const best = a === billigast;
            const worst = a === dyrast && spann > 0;
            return (
              <div
                key={a.label}
                className="flex h-full flex-1 flex-col justify-end"
                title={
                  `Start ${datum(a.start)} → klart ${datum(a.slut)}\n` +
                  `${formatKr(a.total)} · ${fmtInt(a.arbetsdagar)} arbetsdagar · ${a.kalenderveckor} veckor\n` +
                  `Årstidsfaktor schakt ${a.effektivFaktor.toFixed(2)}×` +
                  (a.stillestandVeckor > 0 ? `\nStillestånd ${a.stillestandVeckor} v: ${formatKr(a.stillestandKostnad)}` : "")
                }
              >
                <div
                  className={"rounded-t " + (best ? "bg-[var(--green)]" : worst ? "bg-[var(--red)]" : "bg-[var(--navy-light)] opacity-70")}
                  style={{ height: `${hojd(a.total)}%` }}
                />
                {/* Årstidsmix för schaktdagarna */}
                <div className="mt-0.5 flex h-1.5 overflow-hidden rounded-sm">
                  {Object.entries(a.arstidsfordelning).map(([k, v]) => (
                    <div key={k} style={{ width: `${v * 100}%`, background: ARSTID_FARG[k]?.farg }} />
                  ))}
                </div>
                {a.stillestandVeckor > 0 ? (
                  <div className="mt-0.5 text-center text-[9px] leading-none text-[var(--red)]" aria-label="Byggsemester inom projekttiden">
                    ☀
                  </div>
                ) : (
                  <div className="mt-0.5 text-[9px] leading-none">&nbsp;</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-1">
          {alternativ.map((a) => (
            <div key={a.label} className="flex-1 text-center text-[9px] leading-tight text-slate-500">
              {a.label.split(" ")[0]}
              {a.start.getMonth() === 0 && <div className="text-slate-400">{a.start.getFullYear()}</div>}
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-500">
          {Object.values(ARSTID_FARG).map((s) => (
            <span key={s.label} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: s.farg }} />
              {s.label}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="text-[var(--red)]">☀</span> byggsemester inom projekttiden
          </span>
        </div>

        <div className="mt-4 space-y-1 rounded-md bg-slate-50 p-3 text-xs">
          <div className="flex justify-between font-semibold">
            <span>Bästa start: {billigast.label}</span>
            <span className="font-mono">{formatKr(billigast.total)}</span>
          </div>
          <div className="text-slate-500">
            Klart ca {datum(billigast.slut)} · {fmtInt(billigast.arbetsdagar)} arbetsdagar på plats
          </div>
          {spann > 0 && (
            <div className="flex justify-between pt-1">
              <span className="text-slate-500">Sämsta start: {dyrast.label}</span>
              <span className="font-mono text-[var(--red)]">+{formatKr(spann)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-1">
            <span className="text-slate-500">Bästa start mot nuvarande prognos</span>
            <span className={"font-mono " + (skillnadMotNu < 0 ? "text-emerald-600" : "text-slate-700")}>
              {skillnadMotNu > 0 ? "+" : ""}
              {formatKr(skillnadMotNu)}
            </span>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-slate-400">
          Håll muspekaren över en stapel för detaljer. Använder samma kalibrering som den
          aktuella prognosen, så skillnaderna visar bara effekten av när projektet ligger i kalendern.
        </p>
      </div>
    </section>
  );
}
