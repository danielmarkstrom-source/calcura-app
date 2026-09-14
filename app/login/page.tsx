"use client";

import { useActionState } from "react";
import { login, type ActionState } from "@/app/actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(login, undefined);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Calcura</h1>
        <p className="mt-1 text-sm text-slate-500">Logga in med en länk som skickas till din mejl - inget lösenord.</p>

        {state?.success ? (
          <p className="mt-6 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Kolla din mejl - vi har skickat en inloggningslänk dit.
          </p>
        ) : (
          <form action={action} className="mt-6 space-y-3">
            <input
              type="email"
              name="email"
              required
              placeholder="namn@kommun.se"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending ? "Skickar..." : "Skicka inloggningslänk"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
