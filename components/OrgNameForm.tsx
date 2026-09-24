"use client";

import { useActionState } from "react";
import { renameOrg, type ActionState } from "@/app/actions";

export default function OrgNameForm({ currentName }: { currentName: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(renameOrg, undefined);

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          name="name"
          defaultValue={currentName}
          required
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Sparar..." : "Spara namn"}
        </button>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-600">Sparat.</p>}
    </form>
  );
}
