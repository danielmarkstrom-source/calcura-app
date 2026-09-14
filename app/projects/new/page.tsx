import Link from "next/link";
import { createProject } from "@/app/actions";
import { LEDNINGSSLAG, MATERIAL, MARKTYP, ARSTID } from "@/lib/calc";

export default function NewProjectPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-3">
        <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
          ← Tillbaka
        </Link>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-8">
        <h1 className="text-lg font-semibold text-slate-900">Nytt projekt</h1>
        <p className="mt-1 text-sm text-slate-500">
          Minimal första version - en sträcka. Fler sträckor, servis/intrång/besiktning,
          massberäkning och projektspecifika inställningar kommer i nästa steg av porten
          (kalkylmotorn i <code className="rounded bg-slate-100 px-1 py-0.5">lib/calc.ts</code>{" "}
          stödjer redan hela modellen).
        </p>
        <form action={createProject} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Projektnamn</label>
            <input
              name="namn"
              required
              placeholder="t.ex. Storgatan VA-förnyelse"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Ledningsslag</label>
              <select name="slag" defaultValue="spillvatten" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                {LEDNINGSSLAG.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Material</label>
              <select name="material" defaultValue="pvc" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                {MATERIAL.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Dimension (mm)</label>
              <input type="number" name="dimension" defaultValue={200} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Längd (m)</label>
              <input type="number" name="langd" defaultValue={100} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Marktyp</label>
              <select name="mark" defaultValue="gatumark" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                {MARKTYP.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Årstid</label>
              <select name="arstid" defaultValue="host" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                {ARSTID.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white">
            Spara projekt
          </button>
        </form>
      </main>
    </div>
  );
}
