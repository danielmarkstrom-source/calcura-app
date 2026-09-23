"use client";

import { useActionState } from "react";
import { updateCoef, type ActionState } from "@/app/actions";
import { OVERRIDE_FIELDS, getCoefByPath, type Coef } from "@/lib/calc";

export default function CoefForm({ coef, calibration }: { coef: Coef; calibration: { factor: number; n: number } }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateCoef, undefined);

  const groups = OVERRIDE_FIELDS.reduce<string[]>((acc, f) => (acc.includes(f.group) ? acc : [...acc, f.group]), []);

  return (
    <form action={formAction} className="space-y-6">
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="calibrationEnabled" defaultChecked={coef.calibrationEnabled} />
          Använd kalibrering mot utfall
        </label>
        <p className="mt-1 text-xs text-slate-500">
          Justerar arbetstid/maskin/tjänster/anläggning m.m. (inte materialpriser) utifrån hur mycket
          faktiskt utfall avvikit från prognoserna på avslutade projekt.
        </p>
        <p className="mt-2 font-mono text-xs text-slate-600">
          {calibration.n === 0 ? "Ingen data ännu" : `Faktor ${calibration.factor.toFixed(3)}× baserat på ${calibration.n} avslutade projekt`}
        </p>
      </div>

      {groups.map((g) => (
        <div key={g} className="rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{g}</h3>
          <div className="mt-2 space-y-2">
            {OVERRIDE_FIELDS.filter((f) => f.group === g).map((f) => (
              <div key={f.path} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-600">{f.label}</span>
                <span className="flex items-center gap-2">
                  <input
                    type="number"
                    name={f.path}
                    step={f.step ?? "1"}
                    defaultValue={getCoefByPath(coef, f.path) as number}
                    className="w-28 rounded-md border border-slate-300 px-2 py-1 text-right text-sm"
                  />
                  <span className="w-16 text-xs text-slate-400">{f.unit}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Sparar..." : "Spara inställningar"}
        </button>
        {state?.success && <span className="text-sm text-emerald-600">Sparat.</span>}
      </div>
    </form>
  );
}
