"use client";

import { useMemo, useState } from "react";
import {
  ARSTID,
  MARKTYP,
  MASKINTYPER,
  OVERRIDE_FIELDS,
  calcProjectDisplay,
  effCoef,
  formatKr,
  fmtInt,
  getCoefByPath,
  materialLabel,
  slagLabel,
  type Coef,
  type CoefOverrides,
  type FritextPost,
  type MaskinPost,
  type MaterialRow,
  type Post,
} from "@/lib/calc";
import { createProject, updateProject } from "@/app/actions";

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export interface ExistingProject {
  id: string;
  namn: string;
  arstid: string;
  servis: number;
  intrang: number;
  besiktning: number;
  brunnar: number;
  schaktdjup: number;
  schaktbredd: number;
  slantH: number;
  slantV: number;
  antalPersoner: number;
  maskinpark: MaskinPost[];
  hyresdagarSchaktslede: number;
  projekttidVeckor: number;
  poster: Post[];
  fritextposter: FritextPost[];
  driftposter: FritextPost[];
  coefOverrides: CoefOverrides;
  tjansterManuell?: number | null;
  intrangManuell?: number | null;
  omgivningspaverkanManuell?: number | null;
}

export default function ProjectForm({
  coef,
  materialDB,
  calibrationProjects,
  project,
}: {
  coef: Coef;
  materialDB: MaterialRow[];
  calibrationProjects: { utfall?: number | null; prognosTotal?: number | null }[];
  project?: ExistingProject;
}) {
  const [namn, setNamn] = useState(project?.namn ?? "");
  const [arstid, setArstid] = useState(project?.arstid ?? "host");
  const [servis, setServis] = useState(project?.servis ?? 0);
  const [intrang, setIntrang] = useState(project?.intrang ?? 0);
  const [besiktning, setBesiktning] = useState(project?.besiktning ?? 0);
  const [brunnar, setBrunnar] = useState(project?.brunnar ?? 0);
  const [schaktdjup, setSchaktdjup] = useState(project?.schaktdjup ?? 1.5);
  const [schaktbredd, setSchaktbredd] = useState(project?.schaktbredd ?? 1.0);
  const [slantH, setSlantH] = useState(project?.slantH ?? 1);
  const [slantV, setSlantV] = useState(project?.slantV ?? 1);
  const [antalPersoner, setAntalPersoner] = useState(project?.antalPersoner ?? 3);
  const [maskinpark, setMaskinpark] = useState<MaskinPost[]>(project?.maskinpark ?? []);
  const [hyresdagarSchaktslede, setHyresdagarSchaktslede] = useState(project?.hyresdagarSchaktslede ?? 0);
  const [projekttidVeckor, setProjekttidVeckor] = useState(project?.projekttidVeckor ?? 0);
  const [poster, setPoster] = useState<Post[]>(project?.poster ?? []);
  const [fritextposter, setFritextposter] = useState<FritextPost[]>(project?.fritextposter ?? []);
  const [driftposter, setDriftposter] = useState<FritextPost[]>(project?.driftposter ?? []);
  const [coefOverrides, setCoefOverrides] = useState<CoefOverrides>(project?.coefOverrides ?? {});
  // Känd faktisk kostnad (t.ex. en offert) - textfält som strängar så fältet kan vara
  // tomt (= använd schablonen). Tomt/ogiltigt tolkas som null vid beräkning och spara.
  const [tjansterManuell, setTjansterManuell] = useState(project?.tjansterManuell != null ? String(project.tjansterManuell) : "");
  const [intrangManuell, setIntrangManuell] = useState(project?.intrangManuell != null ? String(project.intrangManuell) : "");
  const [omgivningspaverkanManuell, setOmgivningspaverkanManuell] = useState(
    project?.omgivningspaverkanManuell != null ? String(project.omgivningspaverkanManuell) : ""
  );
  const [advOpen, setAdvOpen] = useState(false);
  const formAction = project ? updateProject.bind(null, project.id) : createProject;

  // Skriv/rensa ett override-fält (dotted path). Tomt eller lika med globalt värde
  // tas bort helt - fältet ärver då det globala värdet igen. Samma mönster som
  // det globala inställningsformuläret (components/CoefForm.tsx) använder.
  function updateOverride(path: string, value: string) {
    const num = Number(value);
    const globalVal = getCoefByPath(coef, path) as number | undefined;
    const remove = value === "" || Number.isNaN(num) || num === Number(globalVal);
    setCoefOverrides((ov) => {
      const next: Record<string, unknown> = { ...ov };
      const [group, key] = path.split(".");
      if (key === undefined) {
        if (remove) delete next[group];
        else next[group] = num;
      } else {
        const groupVal = { ...((next[group] as Record<string, unknown>) || {}) };
        if (remove) {
          delete groupVal[key];
          if (Object.keys(groupVal).length === 0) delete next[group];
          else next[group] = groupVal;
        } else {
          groupVal[key] = num;
          next[group] = groupVal;
        }
      }
      return next as CoefOverrides;
    });
  }

  function addFritextpost() {
    setFritextposter((f) => [...f, { id: uid(), namn: "", belopp: 0 }]);
  }
  function updateFritextpost(id: string, patch: Partial<FritextPost>) {
    setFritextposter((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeFritextpost(id: string) {
    setFritextposter((rows) => rows.filter((r) => r.id !== id));
  }

  function addDriftpost() {
    setDriftposter((f) => [...f, { id: uid(), namn: "", belopp: 0 }]);
  }
  function updateDriftpost(id: string, patch: Partial<FritextPost>) {
    setDriftposter((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeDriftpost(id: string) {
    setDriftposter((rows) => rows.filter((r) => r.id !== id));
  }

  function addMaskinpost() {
    setMaskinpark((m) => [...m, { id: uid(), typ: MASKINTYPER[0].id, antal: 1 }]);
  }
  function updateMaskinpost(id: string, patch: Partial<MaskinPost>) {
    setMaskinpark((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeMaskinpost(id: string) {
    setMaskinpark((rows) => rows.filter((r) => r.id !== id));
  }

  const slags = useMemo(() => Array.from(new Set(materialDB.map((r) => r.slag))), [materialDB]);
  const materialsFor = (slag: string) => Array.from(new Set(materialDB.filter((r) => r.slag === slag).map((r) => r.material)));
  const dimsFor = (slag: string, material: string) =>
    materialDB.filter((r) => r.slag === slag && r.material === material).map((r) => r.dimension).sort((a, b) => a - b);
  const rowFor = (slag: string, material: string, dimension: number) =>
    materialDB.find((r) => r.slag === slag && r.material === material && r.dimension === dimension);

  function addPost() {
    if (materialDB.length === 0) return;
    const first = materialDB[0];
    setPoster((p) => [
      ...p,
      {
        id: uid(),
        slag: first.slag,
        material: first.material,
        dimension: first.dimension,
        langd: first.enhet === "st" ? 1 : 100,
        mark: "gatumark",
        enhet: first.enhet,
        delarSchakt: true,
      },
    ]);
  }
  function updatePost(id: string, patch: Partial<Post>) {
    setPoster((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removePost(id: string) {
    setPoster((rows) => rows.filter((r) => r.id !== id));
  }
  function onSlagChange(id: string, slag: string) {
    const material = materialsFor(slag)[0] ?? "";
    const dims = dimsFor(slag, material);
    const dimension = dims[0] ?? 0;
    const row = rowFor(slag, material, dimension);
    updatePost(id, { slag, material, dimension, enhet: row?.enhet ?? "m" });
  }
  function onMaterialChange(id: string, slag: string, material: string) {
    const dims = dimsFor(slag, material);
    const dimension = dims[0] ?? 0;
    const row = rowFor(slag, material, dimension);
    updatePost(id, { material, dimension, enhet: row?.enhet ?? "m" });
  }
  function onDimensionChange(id: string, slag: string, material: string, dimension: number) {
    const row = rowFor(slag, material, dimension);
    updatePost(id, { dimension, enhet: row?.enhet ?? "m" });
  }

  const tjansterManuellNum = tjansterManuell === "" ? null : Number(tjansterManuell);
  const intrangManuellNum = intrangManuell === "" ? null : Number(intrangManuell);
  const omgivningspaverkanManuellNum = omgivningspaverkanManuell === "" ? null : Number(omgivningspaverkanManuell);
  const projectInput = useMemo(
    () => ({
      poster,
      arstid,
      servis,
      intrang,
      besiktning,
      brunnar,
      schaktdjup,
      schaktbredd,
      slantH,
      slantV,
      antalPersoner,
      maskinpark,
      hyresdagarSchaktslede,
      projekttidVeckor,
      fritextposter,
      driftposter,
      coefOverrides,
      tjansterManuell: tjansterManuellNum,
      intrangManuell: intrangManuellNum,
      omgivningspaverkanManuell: omgivningspaverkanManuellNum,
    }),
    [
      poster,
      arstid,
      servis,
      intrang,
      besiktning,
      brunnar,
      schaktdjup,
      schaktbredd,
      slantH,
      slantV,
      antalPersoner,
      maskinpark,
      hyresdagarSchaktslede,
      projekttidVeckor,
      fritextposter,
      driftposter,
      coefOverrides,
      tjansterManuellNum,
      intrangManuellNum,
      omgivningspaverkanManuellNum,
    ]
  );
  const effectiveCoef = useMemo(() => effCoef(coef, { coefOverrides }), [coef, coefOverrides]);
  const calc = useMemo(
    () => calcProjectDisplay(projectInput, effectiveCoef, materialDB, calibrationProjects),
    [projectInput, effectiveCoef, materialDB, calibrationProjects]
  );
  // Årstidsfaktorerna (perProject: false) går bara att ändra på huvudnivån (Inställningar) -
  // här väljer projektet bara vilken årstid som gäller (fältet `arstid` nedan).
  const projectOverrideFields = useMemo(() => OVERRIDE_FIELDS.filter((f) => f.perProject !== false), []);
  const overrideGroups = useMemo(
    () => projectOverrideFields.reduce<string[]>((acc, f) => (acc.includes(f.group) ? acc : [...acc, f.group]), []),
    [projectOverrideFields]
  );
  const activeOverrideCount = projectOverrideFields.filter((f) => getCoefByPath(coefOverrides, f.path) !== undefined).length;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="posterJson" value={JSON.stringify(poster)} />
      <input type="hidden" name="coefOverridesJson" value={JSON.stringify(coefOverrides)} />
      <input type="hidden" name="fritextposterJson" value={JSON.stringify(fritextposter)} />
      <input type="hidden" name="driftposterJson" value={JSON.stringify(driftposter)} />
      <input type="hidden" name="maskinparkJson" value={JSON.stringify(maskinpark)} />

      <div>
        <label className="block text-sm font-medium text-slate-700">Projektnamn</label>
        <input
          name="namn"
          required
          value={namn}
          onChange={(e) => setNamn(e.target.value)}
          placeholder="t.ex. Storgatan VA-förnyelse"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Ledningssträckor</h2>
          <span className="text-xs text-slate-500">{calc.langdTotal} m schaktlängd</span>
        </div>

        {materialDB.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
            Materialdatabasen är tom - lägg till material under Material-fliken först.
          </p>
        ) : (
          <div className="space-y-3">
            {poster.map((post, i) => {
              const isStyck = post.enhet === "st";
              return (
                <div key={post.id} className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide text-slate-400">
                      Sträcka {i + 1}
                      {isStyck ? " · styckvara" : ""}
                    </span>
                    <button type="button" onClick={() => removePost(post.id)} className="text-red-500 hover:text-red-700" aria-label="Ta bort sträcka">
                      ×
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400">Ledningsslag</label>
                      <select
                        value={post.slag}
                        onChange={(e) => onSlagChange(post.id, e.target.value)}
                        className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                      >
                        {slags.map((s) => (
                          <option key={s} value={s}>
                            {slagLabel(s)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">Material</label>
                      <select
                        value={post.material}
                        onChange={(e) => onMaterialChange(post.id, post.slag, e.target.value)}
                        className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                      >
                        {materialsFor(post.slag).map((m) => (
                          <option key={m} value={m}>
                            {materialLabel(m)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400">Dimension</label>
                      <select
                        value={post.dimension}
                        onChange={(e) => onDimensionChange(post.id, post.slag, post.material, Number(e.target.value))}
                        className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                      >
                        {dimsFor(post.slag, post.material).map((d) => (
                          <option key={d} value={d}>
                            Ø{d}mm
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400">{isStyck ? "Antal (st)" : "Längd (m)"}</label>
                      <input
                        type="number"
                        value={post.langd}
                        onChange={(e) => updatePost(post.id, { langd: Number(e.target.value) })}
                        className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                      />
                    </div>
                    {!isStyck && (
                      <div>
                        <label className="block text-[10px] text-slate-400">Marktyp</label>
                        <select
                          value={post.mark}
                          onChange={(e) => updatePost(post.id, { mark: e.target.value })}
                          className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
                        >
                          {MARKTYP.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  {!isStyck && (
                    <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                      <input
                        type="checkbox"
                        checked={post.delarSchakt !== false}
                        onChange={(e) => updatePost(post.id, { delarSchakt: e.target.checked })}
                      />
                      Ligger i samma schakt som övriga sträckor
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={addPost}
          disabled={materialDB.length === 0}
          className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"
        >
          + Lägg till sträcka
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600">Servisanslutningar (st)</label>
          <input type="number" name="servis" value={servis} onChange={(e) => setServis(Number(e.target.value))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Intrång (st)</label>
          <input type="number" name="intrang" value={intrang} onChange={(e) => setIntrang(Number(e.target.value))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Besiktningar (st)</label>
          <input type="number" name="besiktning" value={besiktning} onChange={(e) => setBesiktning(Number(e.target.value))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Brunnar (st)</label>
          <input type="number" name="brunnar" value={brunnar} onChange={(e) => setBrunnar(Number(e.target.value))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Kända kostnader (valfritt)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Fyll i när den faktiska kostnaden är känd (t.ex. en offert) - används då istället för
          schablonen. Lämna tomt för att räkna som vanligt.
        </p>
        <div className="mt-2 grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600">Tjänster (kr)</label>
            <input
              type="number"
              name="tjansterManuell"
              value={tjansterManuell}
              onChange={(e) => setTjansterManuell(e.target.value)}
              placeholder="schablon"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Fastighetsintrång (kr)</label>
            <input
              type="number"
              name="intrangManuell"
              value={intrangManuell}
              onChange={(e) => setIntrangManuell(e.target.value)}
              placeholder="schablon"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Omgivningspåverkan (kr)</label>
            <input
              type="number"
              name="omgivningspaverkanManuell"
              value={omgivningspaverkanManuell}
              onChange={(e) => setOmgivningspaverkanManuell(e.target.value)}
              placeholder={String(Math.round(projekttidVeckor * coef.krOmgivningspaverkanPerVecka))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="mt-0.5 text-[10px] text-slate-400">
              Föreslaget värde ({formatKr(projekttidVeckor * coef.krOmgivningspaverkanPerVecka)}) baseras på
              projekttiden - varierar ofta mycket, ändra vid behov.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600">Årstid</label>
          <select name="arstid" value={arstid} onChange={(e) => setArstid(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            {ARSTID.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Antal i laget</label>
          <input type="number" name="antalPersoner" value={antalPersoner} onChange={(e) => setAntalPersoner(Number(e.target.value))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Beräknad projekttid (veckor)</label>
          <input type="number" name="projekttidVeckor" value={projekttidVeckor} onChange={(e) => setProjekttidVeckor(Number(e.target.value))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Maskinpark</h2>
        <p className="mt-1 text-xs text-slate-500">
          Grävmaskin, hjullastare och lastbil kostar schakttimmar × antal × kr/tim. Maskinhyra är en
          schablon (kr/st), inte kopplad till schakttiden.
        </p>
        {maskinpark.length > 0 && (
          <div className="mt-2 space-y-2">
            {maskinpark.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <select
                  value={m.typ}
                  onChange={(e) => updateMaskinpost(m.id, { typ: e.target.value as MaskinPost["typ"] })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {MASKINTYPER.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={m.antal}
                  onChange={(e) => updateMaskinpost(m.id, { antal: Number(e.target.value) })}
                  placeholder="Antal"
                  className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <button type="button" onClick={() => removeMaskinpost(m.id)} className="text-red-500 hover:text-red-700" aria-label="Ta bort maskin">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={addMaskinpost} className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700">
          + Lägg till maskin
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600">Schaktsläde - hyresdagar</label>
        <input
          type="number"
          name="hyresdagarSchaktslede"
          value={hyresdagarSchaktslede}
          onChange={(e) => setHyresdagarSchaktslede(Number(e.target.value))}
          className="mt-1 w-32 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-slate-500">
          Hyrestiden sätts fritt - inte kopplad till den beräknade schakttiden.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Massberäkning</h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] text-slate-400">Schaktdjup (m)</label>
            <input type="number" step="0.1" name="schaktdjup" value={schaktdjup} onChange={(e) => setSchaktdjup(Number(e.target.value))} className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400">Schaktbredd (botten, m)</label>
            <input type="number" step="0.1" name="schaktbredd" value={schaktbredd} onChange={(e) => setSchaktbredd(Number(e.target.value))} className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400">Släntlutning (vertikal : horisontell)</label>
            <div className="mt-0.5 flex items-center gap-1">
              <input type="number" step="0.1" name="slantV" value={slantV} onChange={(e) => setSlantV(Number(e.target.value))} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
              <span className="text-slate-400">:</span>
              <input type="number" step="0.1" name="slantH" value={slantH} onChange={(e) => setSlantH(Number(e.target.value))} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          T.ex. 1:1 (45°) eller 1:1,5 (flackare). Enligt AMA/MER Anläggning gäller 1:1 om inget annat anges i
          handlingarna.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Fall A {calc.massor.fallAVolym.toFixed(1)} m³ · Fall B {calc.massor.fallBVolym.toFixed(1)} m³ · anläggningsmaterial{" "}
          {calc.massor.anlaggningsmaterialBehov.toFixed(1)} m³
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Övriga kostnader (fritext)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Egna kostnadsposter utöver de fördefinierade kategorierna, t.ex. ett engångsarvode.
          Visas som egna rader i kostnadsuppställningen.
        </p>
        {fritextposter.length > 0 && (
          <div className="mt-2 space-y-2">
            {fritextposter.map((f) => (
              <div key={f.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={f.namn}
                  onChange={(e) => updateFritextpost(f.id, { namn: e.target.value })}
                  placeholder="Beskrivning"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  value={f.belopp}
                  onChange={(e) => updateFritextpost(f.id, { belopp: Number(e.target.value) })}
                  placeholder="kr"
                  className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <button type="button" onClick={() => removeFritextpost(f.id)} className="text-red-500 hover:text-red-700" aria-label="Ta bort post">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={addFritextpost} className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700">
          + Lägg till post
        </button>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Driftkostnader</h2>
        <p className="mt-1 text-xs text-slate-500">
          Löpande kostnader som städning, förbrukningsartiklar, elförbrukning, spolning/sugning,
          inmätning m.m. Egen post per rad, precis som övriga kostnader ovan.
        </p>
        {driftposter.length > 0 && (
          <div className="mt-2 space-y-2">
            {driftposter.map((f) => (
              <div key={f.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={f.namn}
                  onChange={(e) => updateDriftpost(f.id, { namn: e.target.value })}
                  placeholder="Beskrivning"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  value={f.belopp}
                  onChange={(e) => updateDriftpost(f.id, { belopp: Number(e.target.value) })}
                  placeholder="kr"
                  className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <button type="button" onClick={() => removeDriftpost(f.id)} className="text-red-500 hover:text-red-700" aria-label="Ta bort post">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={addDriftpost} className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700">
          + Lägg till driftpost
        </button>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setAdvOpen((v) => !v)}
          className={
            "flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700" +
            (advOpen ? " rounded-b-none border-b-0" : "")
          }
        >
          <span>Projektspecifika inställningar (avancerat){activeOverrideCount > 0 ? ` · ${activeOverrideCount} ändrade` : ""}</span>
          <span className="text-slate-400">{advOpen ? "▲" : "▼"}</span>
        </button>
        {advOpen && (
          <div className="space-y-3 rounded-b-md border border-t-0 border-slate-300 bg-white p-4">
            <p className="text-xs text-slate-500">
              Varje fält ärver värdet från Inställningar tills du skriver in ett eget. Töm fältet för att återgå
              till det globala värdet.
            </p>
            {overrideGroups.map((g) => (
              <div key={g}>
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{g}</h3>
                <div className="mt-1 space-y-1">
                  {projectOverrideFields.filter((f) => f.group === g).map((f) => {
                    const globalVal = getCoefByPath(coef, f.path) as number;
                    const overrideVal = getCoefByPath(coefOverrides, f.path) as number | undefined;
                    const isOverridden = overrideVal !== undefined;
                    return (
                      <div key={f.path} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-600">{f.label}</span>
                        <span className="flex items-center gap-2">
                          <input
                            type="number"
                            step={f.step ?? "1"}
                            defaultValue={isOverridden ? overrideVal : ""}
                            placeholder={String(globalVal)}
                            onChange={(e) => updateOverride(f.path, e.target.value)}
                            className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-xs"
                          />
                          <span className="w-14 text-slate-400">{f.unit}</span>
                          <span className={isOverridden ? "w-12 text-sky-600" : "w-12 text-slate-400"}>
                            {isOverridden ? "ändrad" : "ärvd"}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3 rounded-md bg-slate-900 p-4 text-white">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Kostnad</div>
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

      <button type="submit" className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white">
        {project ? "Spara ändringar" : "Spara projekt"}
      </button>
    </form>
  );
}
