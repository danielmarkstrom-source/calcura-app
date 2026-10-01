"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeFramdriftEntry } from "@/app/actions";

export default function RemoveFramdriftButton({ projectId, entryId }: { projectId: string; entryId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await removeFramdriftEntry(projectId, entryId);
          router.refresh();
        })
      }
      className="text-red-500 hover:text-red-700 disabled:text-slate-300"
      aria-label="Ta bort mätpunkt"
    >
      {pending ? "…" : "×"}
    </button>
  );
}
