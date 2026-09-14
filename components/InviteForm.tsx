"use client";

import { useActionState } from "react";
import { inviteColleague, type ActionState } from "@/app/actions";

export default function InviteForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(inviteColleague, undefined);

  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <input
          type="email"
          name="email"
          required
          placeholder="kollega@kommun.se"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Skickar..." : "Bjud in"}
        </button>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-600">Inbjudan skickad.</p>}
    </form>
  );
}
