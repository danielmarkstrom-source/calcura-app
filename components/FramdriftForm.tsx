"use client";

import { useActionState } from "react";
import { addFramdriftEntry, type ActionState } from "@/app/actions";

export default function FramdriftForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addFramdriftEntry, undefined);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-slate-400">Meter utförda</label>
          <input type="number" name="meter" placeholder="t.ex. 100" className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-[10px] text-slate-400">Dagar åtgångna</label>
          <input type="number" name="dagar" placeholder="t.ex. 25" className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Sparar..." : "Lägg till mätpunkt"}
      </button>
    </form>
  );
}
