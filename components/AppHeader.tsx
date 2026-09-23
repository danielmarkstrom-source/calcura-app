import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

const LINKS = [
  { href: "/", label: "Projekt" },
  { href: "/material", label: "Material" },
  { href: "/settings", label: "Inställningar" },
];

export default function AppHeader({ orgName, active }: { orgName?: string; active: string }) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div>
        <div className="text-sm font-semibold text-slate-900">Calcura</div>
        <div className="text-xs text-slate-500">{orgName ?? "Din organisation"}</div>
      </div>
      <nav className="flex items-center gap-4 text-sm">
        {LINKS.filter((l) => l.href !== active).map((l) => (
          <Link key={l.href} href={l.href} className="text-slate-600 hover:text-slate-900">
            {l.label}
          </Link>
        ))}
        <LogoutButton />
      </nav>
    </header>
  );
}
