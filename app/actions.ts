"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calcProjectDisplay, DEFAULT_COEF, type Coef, type MaterialRow } from "@/lib/calc";

export type ActionState = { error?: string; success?: boolean } | undefined;

// E-post + lösenord, inget mejlsteg (Supabase-projektets "Confirm email" är avstängt -
// se arbetslogg.md). Bara den som redan har en giltig inbjudan (org_invites) hamnar i en
// befintlig organisation vid kontoskapande - annars skapas en ny åt dem (handle_new_user-
// triggern i supabase/migrations/0001_init.sql), så ett öppet konto ger ingen åtkomst
// till någon annans data.

/** Skapar ett nytt konto (e-post + lösenord) och loggar in direkt. */
export async function signup(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Ange både mejladress och lösenord." };
  if (password.length < 6) return { error: "Lösenordet måste vara minst 6 tecken." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  redirect("/");
}

/** Loggar in med e-post + lösenord. */
export async function login(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Ange både mejladress och lösenord." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message === "Invalid login credentials" ? "Fel mejladress eller lösenord." : error.message };

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function requireOrgId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership, error } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error || !membership) throw new Error("Kunde inte hitta din organisation.");
  return membership.org_id as string;
}

/** Bjuder in en kollega via mejl - de hamnar automatiskt i samma organisation vid inloggning. */
export async function inviteColleague(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  if (!email) return { error: "Ange en mejladress." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = await requireOrgId(supabase);
  const { error } = await supabase.from("org_invites").insert({ org_id: orgId, email, invited_by: user!.id });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { success: true };
}

/** Lägger till en rad i materialdatabasen. */
export async function addMaterialRow(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const orgId = await requireOrgId(supabase);

  const slag = String(formData.get("slag") || "");
  const material = String(formData.get("material") || "");
  const dimension = Number(formData.get("dimension") || 0);
  const enhet = String(formData.get("enhet") || "m");
  const krPerM = Number(formData.get("krPerM") || 0);
  const co2PerMRaw = formData.get("co2PerM");
  const co2PerM = co2PerMRaw ? Number(co2PerMRaw) : null;
  if (!slag || !material || !dimension) return { error: "Fyll i ledningsslag, material och dimension." };

  const { error } = await supabase.from("material_rows").insert({
    org_id: orgId,
    slag,
    material,
    dimension,
    kr_per_m: krPerM,
    co2_per_m: co2PerM,
    enhet,
  });
  if (error) return { error: error.message };

  revalidatePath("/material");
  return { success: true };
}

/** Uppdaterar en befintlig materialrad. */
export async function updateMaterialRow(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const orgId = await requireOrgId(supabase);

  const id = String(formData.get("id") || "");
  const slag = String(formData.get("slag") || "");
  const material = String(formData.get("material") || "");
  const dimension = Number(formData.get("dimension") || 0);
  const enhet = String(formData.get("enhet") || "m");
  const krPerM = Number(formData.get("krPerM") || 0);
  const co2PerMRaw = formData.get("co2PerM");
  const co2PerM = co2PerMRaw ? Number(co2PerMRaw) : null;
  if (!id || !slag || !material || !dimension) return { error: "Fyll i ledningsslag, material och dimension." };

  const { error } = await supabase
    .from("material_rows")
    .update({ slag, material, dimension, kr_per_m: krPerM, co2_per_m: co2PerM, enhet })
    .eq("id", id)
    .eq("org_id", orgId);
  if (error) return { error: error.message };

  revalidatePath("/material");
  redirect("/material");
}

/** Tar bort en materialrad. Bindas med radens id: deleteMaterialRow.bind(null, row.id). */
export async function deleteMaterialRow(id: string) {
  const supabase = await createClient();
  const orgId = await requireOrgId(supabase);
  await supabase.from("material_rows").delete().eq("id", id).eq("org_id", orgId);
  revalidatePath("/material");
}

/**
 * Minimal första version av "skapa projekt" - en sträcka. Fler fält (fler sträckor,
 * servis/intrång/besiktning, massberäkning, projektspecifika inställningar) kommer i
 * nästa steg av porten; se lib/calc.ts som redan stödjer hela modellen.
 */
export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const orgId = await requireOrgId(supabase);

  const namn = String(formData.get("namn") || "").trim() || "Namnlöst projekt";
  const slag = String(formData.get("slag") || "spillvatten");
  const material = String(formData.get("material") || "pvc");
  const dimension = Number(formData.get("dimension") || 200);
  const langd = Number(formData.get("langd") || 0);
  const mark = String(formData.get("mark") || "gatumark");
  const arstid = String(formData.get("arstid") || "host");

  const [{ data: settingsRow }, { data: materialRowsData }, { data: projectsData }] = await Promise.all([
    supabase.from("org_settings").select("coef").eq("org_id", orgId).maybeSingle(),
    supabase.from("material_rows").select("*").eq("org_id", orgId),
    supabase.from("projects").select("utfall, prognos_total").eq("org_id", orgId),
  ]);

  const coef: Coef = { ...DEFAULT_COEF, ...((settingsRow?.coef as object) || {}) };
  const materialDB: MaterialRow[] = (materialRowsData || []).map((r) => ({
    id: r.id,
    slag: r.slag,
    material: r.material,
    dimension: r.dimension,
    krPerM: r.kr_per_m,
    co2PerM: r.co2_per_m,
    enhet: r.enhet,
  }));
  const projectsForCalibration = (projectsData || []).map((p) => ({ utfall: p.utfall, prognosTotal: p.prognos_total }));

  const poster = langd > 0 ? [{ id: "a", slag, material, dimension, langd, mark, enhet: "m" as const }] : [];
  const projectInput = {
    poster,
    arstid,
    servis: 0,
    intrang: 0,
    besiktning: 0,
    schaktdjup: 1.5,
    schaktbredd: 1.0,
    slantH: 1,
    slantV: 1,
    antalPersoner: 3,
    antalMaskiner: 1,
    coefOverrides: {},
  };

  const calc = calcProjectDisplay(projectInput, coef, materialDB, projectsForCalibration);

  const { error } = await supabase.from("projects").insert({
    org_id: orgId,
    namn,
    status: "pagaende",
    poster,
    servis: 0,
    arstid,
    intrang: 0,
    besiktning: 0,
    antal_personer: 3,
    antal_maskiner: 1,
    coef_overrides: {},
    schaktdjup: 1.5,
    schaktbredd: 1.0,
    slant_h: 1,
    slant_v: 1,
    prognos_total: calc.total,
    prognos_snapshot: calc,
    framdrift: [],
  });
  if (error) throw new Error(error.message);

  revalidatePath("/");
  redirect("/");
}

/** Registrerar faktisk slutkostnad och markerar projektet avslutat. */
export async function saveUtfall(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const orgId = await requireOrgId(supabase);

  const id = String(formData.get("id") || "");
  const utfall = Number(formData.get("utfall") || 0);
  if (!id || !utfall) return { error: "Ange en slutkostnad." };

  const { error } = await supabase
    .from("projects")
    .update({ utfall, status: "avslutat" })
    .eq("id", id)
    .eq("org_id", orgId);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${id}`);
  revalidatePath("/");
  return { success: true };
}

/** Tar bort ett projekt. Bindas med projektets id: deleteProject.bind(null, id). */
export async function deleteProject(id: string) {
  const supabase = await createClient();
  const orgId = await requireOrgId(supabase);
  await supabase.from("projects").delete().eq("id", id).eq("org_id", orgId);
  revalidatePath("/");
  redirect("/");
}
