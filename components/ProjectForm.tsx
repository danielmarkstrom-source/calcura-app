"use client";

import { useMemo, useState } from "react";
import {
  ARSTID,
  MARKTYP,
  calcProjectDisplay,
  formatKr,
  fmtInt,
  materialLabel,
  slagLabel,
  type Coef,
  type MaterialRow,
  type Post,
} from "@/lib/calc";
import { createProject } from "@/app/actions";

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export default function ProjectForm({
  coef,
  materialDB,
  calibrationProjects,
}: {
  coef: Coef;
  materialDB: MaterialRow[];
  calibrationProjects: { utfall?: number | null; prognosTotal?: number | null }[];
}) {
  const [namn, setNamn] = useState("");
  const [arstid, setArstid] = useState("host");
  const [servis, setServis] = useState(0);
  const [intrang, setIntrang] = useState(0);
  const [besiktning, setBesiktning] = useState(0);
  const [schaktdjup, setSchaktdjup] = useState(1.5);
  const [schaktbredd, setSchaktbredd] = useState(1.0);
  const [slantH, setSlantH] = useState(1);
  const [slantV, setSlantV] = useState(1);
  const [antalPersoner, setAntalPersoner] = useState(3);
  const [antalMaskiner, setAntalMaskiner] = useState(1);
  const [poster, setPoster] = useState<Post[]>([]);

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

  const projectInput = useMemo(
    () => ({
      poster,
      arstid,
      servis,
      intrang,
      besiktning,
      schaktdjup,
      schaktbredd,
      slantH,
      slantV,
      antalPersoner,
      antalMaskiner,
      coefOverrides: {},
    }),
    [poster, arstid, servis, intrang, besiktning, schaktdjup, schaktbredd, slantH, slantV, antalPersoner, antalMaskiner]
  );
  const calc = useMemo(
    () => calcProjectDisplay(projectInput, coef, materialDB, calibrationProjects),
    [projectInput, coef, materialDB, calibrationProjects]
  );

  return (
    <form action={createProject} className="space-y-6">
      <input type="hidden" name="posterJson" value={JSON.stringify(poster)} />

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

      <div className="grid grid-cols-3 gap-3">
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
      </div>

      <div className="grid grid-cols-2 gap-3">
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
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600">Antal i laget</label>
            <input type="number" name="antalPersoner" value={antalPersoner} onChange={(e) => setAntalPersoner(Number(e.target.value))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">Antal maskiner</label>
            <input type="number" name="antalMaskiner" value={antalMaskiner} onChange={(e) => setAntalMaskiner(Number(e.target.value))} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Massberäkning</h2>
        <div className="mt-2 grid grid-cols-4 gap-2">
          <div>
            <label className="block text-[10px] text-slate-400">Schaktdjup (m)</label>
            <input type="number" step="0.1" name="schaktdjup" value={schaktdjup} onChange={(e) => setSchaktdjup(Number(e.target.value))} className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400">Schaktbredd (m)</label>
            <input type="number" step="0.1" name="schaktbredd" value={schaktbredd} onChange={(e) => setSchaktbredd(Number(e.target.value))} className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400">Slänt H</label>
            <input type="number" step="0.1" name="slantH" value={slantH} onChange={(e) => setSlantH(Number(e.target.value))} className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400">Slänt V</label>
            <input type="number" step="0.1" name="slantV" value={slantV} onChange={(e) => setSlantV(Number(e.target.value))} className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Fall A {calc.massor.fallAVolym.toFixed(1)} m³ · Fall B {calc.massor.fallBVolym.toFixed(1)} m³ · anläggningsmaterial{" "}
          {calc.massor.anlaggningsmaterialBehov.toFixed(1)} m³
        </p>
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
        Spara projekt
      </button>
    </form>
  );
}
