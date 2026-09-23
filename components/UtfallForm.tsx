"use client";

import { useActionState } from "react";
import { saveUtfall, type ActionState } from "@/app/actions";

export default function UtfallForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveUtfall, undefined);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={projectId} />
      <p className="text-sm text-slate-500">
        När projektet är avslutat, mata in den faktiska slutkostnaden för att jämföra mot prognosen.
      </p>
      <input
        type="number"
        name="utfall"
        placeholder="kr"
        required
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Sparar..." : "Registrera utfall"}
      </button>
    </form>
  );
}
