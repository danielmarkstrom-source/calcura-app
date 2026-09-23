import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatKr, slagLabel, materialLabel } from "@/lib/calc";
import AppHeader from "@/components/AppHeader";
import MaterialForm, { type MaterialRowDb } from "@/components/MaterialForm";
import { deleteMaterialRow } from "@/app/actions";

export default async function MaterialPage({ searchParams }: PageProps<"/material">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, orgs(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center p-8 text-sm text-slate-600">
        Kunde inte hitta din organisation.
      </main>
    );
  }

  const orgId = membership.org_id as string;
  const orgName = (membership as { orgs?: { name?: string } }).orgs?.name;

  const { data: rows } = await supabase
    .from("material_rows")
    .select("id, slag, material, dimension, kr_per_m, co2_per_m, enhet")
    .eq("org_id", orgId)
    .order("slag")
    .order("material")
    .order("dimension");

  const materialRows = (rows || []) as MaterialRowDb[];
  const sp = await searchParams;
  const editId = typeof sp?.edit === "string" ? sp.edit : undefined;
  const editRow = editId ? materialRows.find((r) => r.id === editId) : undefined;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <AppHeader orgName={orgName} active="/material" />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-6 py-8">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Material</h1>
          <p className="mt-1 text-sm text-slate-500">
            En rad per kombination av ledningsslag, materialtyp och dimension, med ett exakt pris - inte en
            skalad schablon. Priserna används vid nya projekt.
          </p>
        </div>

        {materialRows.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Materialdatabasen är tom.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white text-sm">
            {materialRows.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="font-medium text-slate-900">
                    {slagLabel(r.slag)} · {materialLabel(r.material)} · Ø{r.dimension}mm
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatKr(r.kr_per_m)}/{r.enhet}
                    {r.co2_per_m ? ` · ${r.co2_per_m} kg CO2-e/${r.enhet}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <a href={`/material?edit=${r.id}`} className="text-sm text-slate-500 hover:text-slate-900">
                    Redigera
                  </a>
                  <form action={deleteMaterialRow.bind(null, r.id)}>
                    <button type="submit" className="text-sm text-red-600 hover:text-red-800">
                      Ta bort
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {editRow ? "Redigera rad" : "Lägg till rad"}
          </h2>
          <div className="mt-3">
            <MaterialForm key={editRow?.id ?? "new"} editRow={editRow} />
          </div>
        </div>
      </main>
    </div>
  );
}
