"use client";

import { useActionState } from "react";
import Link from "next/link";
import { addMaterialRow, updateMaterialRow, type ActionState } from "@/app/actions";
import { LEDNINGSSLAG, MATERIAL } from "@/lib/calc";

export interface MaterialRowDb {
  id: string;
  slag: string;
  material: string;
  dimension: number;
  kr_per_m: number;
  co2_per_m: number | null;
  enhet: "m" | "st";
}

export default function MaterialForm({ editRow }: { editRow?: MaterialRowDb }) {
  const isEdit = !!editRow;
  const action = isEdit ? updateMaterialRow : addMaterialRow;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
      {isEdit && <input type="hidden" name="id" value={editRow.id} />}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600">Ledningsslag</label>
          <select
            name="slag"
            defaultValue={editRow?.slag ?? "spillvatten"}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {LEDNINGSSLAG.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Material</label>
          <select
            name="material"
            defaultValue={editRow?.material ?? "pvc"}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
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
          <label className="block text-xs font-medium text-slate-600">Dimension (mm)</label>
          <input
            type="number"
            name="dimension"
            required
            defaultValue={editRow?.dimension ?? 200}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Enhet</label>
          <select
            name="enhet"
            defaultValue={editRow?.enhet ?? "m"}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="m">m (rör i schakt)</option>
            <option value="st">st (brunnar, ventiler)</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600">Pris (kr)</label>
          <input
            type="number"
            name="krPerM"
            step="0.01"
            required
            defaultValue={editRow?.kr_per_m ?? 0}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">CO2-e (kg, valfritt)</label>
          <input
            type="number"
            name="co2PerM"
            step="0.01"
            defaultValue={editRow?.co2_per_m ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Sparar..." : isEdit ? "Spara ändringar" : "Lägg till rad"}
        </button>
        {isEdit && (
          <Link href="/material" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600">
            Avbryt
          </Link>
        )}
      </div>
      {state?.success && !isEdit && <p className="text-sm text-emerald-600">Raden tillagd.</p>}
    </form>
  );
}
