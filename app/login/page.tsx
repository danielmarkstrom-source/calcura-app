"use client";

import { useState } from "react";
import { useActionState } from "react";
import { login, signup, type ActionState } from "@/app/actions";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginState, loginAction, loginPending] = useActionState<ActionState, FormData>(login, undefined);
  const [signupState, signupAction, signupPending] = useActionState<ActionState, FormData>(signup, undefined);

  const isSignup = mode === "signup";
  const action = isSignup ? signupAction : loginAction;
  const state = isSignup ? signupState : loginState;
  const pending = isSignup ? signupPending : loginPending;

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Calcura</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isSignup ? "Skapa ett konto med mejl och lösenord." : "Logga in med mejl och lösenord."}
        </p>

        <form action={action} className="mt-6 space-y-3">
          <input
            type="email"
            name="email"
            required
            placeholder="namn@kommun.se"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <input
            type="password"
            name="password"
            required
            minLength={isSignup ? 6 : undefined}
            placeholder={isSignup ? "Lösenord (minst 6 tecken)" : "Lösenord"}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Ett ögonblick..." : isSignup ? "Skapa konto" : "Logga in"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(isSignup ? "login" : "signup")}
          className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-700"
        >
          {isSignup ? "Har du redan ett konto? Logga in" : "Inget konto än? Skapa ett"}
        </button>
      </div>
    </main>
  );
}
