"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recalcProject } from "@/app/actions";
import { formatKr } from "@/lib/calc";

export default function RecalcButton({ projectId, hint }: { projectId: string; hint?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  function run() {
    if (
      !window.confirm(
        "Räkna om prognosen med nuvarande koefficienter och kalibrering? Projektets nuvarande prognos ersätts.",
      )
    )
      return;
    setMessage(null);
    startTransition(async () => {
      const res = await recalcProject(projectId);
      if (res.error) {
        setMessage({ text: res.error, error: true });
        return;
      }
      const before = res.before ?? 0;
      const after = res.after ?? 0;
      setMessage({
        text: Math.round(before) === Math.round(after) ? `Ingen ändring (${formatKr(after)}).` : `${formatKr(before)} → ${formatKr(after)}`,
      });
      router.refresh();
    });
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="text-xs text-[var(--muted)] hover:text-[var(--navy)] disabled:text-slate-300"
      >
        {pending ? "Räknar om…" : "Räkna om prognos"}
      </button>
      {hint && !message && <div className="text-[11px] text-amber-600">{hint}</div>}
      {message && <div className={"text-[11px] " + (message.error ? "text-red-600" : "text-emerald-600")}>{message.text}</div>}
    </div>
  );
}
