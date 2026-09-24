import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import Logo from "@/components/Logo";

const LINKS = [
  { href: "/", label: "Projekt" },
  { href: "/material", label: "Material" },
  { href: "/settings", label: "Inställningar" },
];

// Navy topbar + vit titelrad - samma layout som va-pilot.html:s .topbar/.titlebar,
// så calcura-app och piloten är visuellt igenkännbara som samma verktyg.
export default function AppHeader({
  userEmail,
  active,
  title,
  subtitle,
}: {
  userEmail?: string;
  active: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <>
      <header className="flex h-[46px] items-center justify-between bg-[var(--navy)] px-5 text-white">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">Calcura</span>
          {userEmail && <span className="text-xs text-[#8FA7B8]">· {userEmail}</span>}
        </div>
        <nav className="flex items-center gap-1 text-[13px]">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                "rounded px-3 py-1.5 font-medium " +
                (l.href === active ? "bg-[var(--steel)] text-white" : "text-[#B9C6CE] hover:bg-white/10 hover:text-white")
              }
            >
              {l.label}
            </Link>
          ))}
          <LogoutButton className="rounded px-3 py-1.5 text-[#B9C6CE] hover:bg-white/10 hover:text-white" />
        </nav>
      </header>
      {title && (
        <div className="border-b border-[var(--line)] bg-white px-6 pt-4">
          <h1 className="m-0 mb-2.5 text-[20px] font-semibold text-[var(--ink)]">{title}</h1>
          {subtitle && <div className="pb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">{subtitle}</div>}
        </div>
      )}
    </>
  );
}
