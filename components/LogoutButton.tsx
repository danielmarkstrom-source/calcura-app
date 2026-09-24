"use client";

import { logout } from "@/app/actions";

export default function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logout}>
      <button type="submit" className={className ?? "text-slate-600 hover:text-slate-900"}>
        Logga ut
      </button>
    </form>
  );
}
