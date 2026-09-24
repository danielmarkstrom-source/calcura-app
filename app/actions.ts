"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calcProjectDisplay, deepMergeCoef, effCoef, DEFAULT_COEF, OVERRIDE_FIELDS, type Coef, type CoefOverrides, type MaterialRow, type Post } from "@/lib/calc";

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

/**
 * Byter namn på organisationen (t.ex. bort med det automatgenererade
 * "namn@mejl's org" från handle_new_user-triggern). RLS ("owners can update own
 * org" i supabase/migrations/0001_init.sql) begränsar detta till org:ens owner.
 */
export async function renameOrg(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Ange ett namn." };

  const supabase = await createClient();
  const orgId = await requireOrgId(supabase);

  const { error } = await supabase.from("orgs").update({ name }).eq("id", orgId);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/material");
  return { success: true };
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

/**
 * Uppdaterar organisationens globala kalkylinställningar (kategoripriser, marktypsfaktor,
 * massberäkning m.m.). Fälten kommer från lib/calc.ts:s OVERRIDE_FIELDS - samma lista som
 * driver den (ännu inte porterade) projektspecifika override-sektionen i piloten, så
 * global-formuläret och det framtida per-projekt-formuläret delar en och samma källa.
 */
export async function updateCoef(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const orgId = await requireOrgId(supabase);

  const { data: settingsRow } = await supabase.from("org_settings").select("coef").eq("org_id", orgId).maybeSingle();
  const currentCoef: Coef = { ...DEFAULT_COEF, ...((settingsRow?.coef as object) || {}) };

  const updates: Record<string, unknown> = {};
  for (const f of OVERRIDE_FIELDS) {
    const raw = formData.get(f.path);
    if (raw === null || raw === "") continue;
    const num = Number(raw);
    if (Number.isNaN(num)) continue;
    const [group, key] = f.path.split(".");
    if (key === undefined) {
      updates[group] = num;
    } else {
      updates[group] = { ...((updates[group] as object) || {}), [key]: num };
    }
  }

  const merged: Coef = {
    ...deepMergeCoef(currentCoef, updates as CoefOverrides),
    calibrationEnabled: formData.get("calibrationEnabled") === "on",
  };

  const { error } = await supabase
    .from("org_settings")
    .upsert({ org_id: orgId, coef: merged, updated_at: new Date().toISOString() });
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

/** Läser org:ens coef + materialDB + projekt-facit (kalibrering) i ett svep. */
async function getOrgCalcContext(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string) {
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
  return { coef, materialDB, projectsForCalibration };
}

/**
 * Skapar ett projekt med flera sträckor, massberäkning m.m. `posterJson` kommer från
 * ProjectForm (client-komponenten bygger raderna interaktivt och serialiserar hela
 * listan till ett dolt fält - enklare än att indexera FormData-fält per rad).
 */
export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const orgId = await requireOrgId(supabase);

  const namn = String(formData.get("namn") || "").trim() || "Namnlöst projekt";
  const arstid = String(formData.get("arstid") || "host");
  const servis = Number(formData.get("servis") || 0);
  const intrang = Number(formData.get("intrang") || 0);
  const besiktning = Number(formData.get("besiktning") || 0);
  const schaktdjup = Number(formData.get("schaktdjup") || 1.5);
  const schaktbredd = Number(formData.get("schaktbredd") || 1.0);
  const slantH = Number(formData.get("slantH") || 1);
  const slantV = Number(formData.get("slantV") || 1);
  const antalPersoner = Number(formData.get("antalPersoner") || 3);
  const antalMaskiner = Number(formData.get("antalMaskiner") || 1);

  let poster: Post[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("posterJson") || "[]"));
    if (Array.isArray(parsed)) {
      poster = parsed
        .filter((p) => p && p.slag && p.material && p.dimension && p.langd > 0)
        .map((p, i) => ({
          id: String(p.id || `p${i}`),
          slag: String(p.slag),
          material: String(p.material),
          dimension: Number(p.dimension),
          langd: Number(p.langd),
          mark: p.mark ? String(p.mark) : "gatumark",
          enhet: p.enhet === "st" ? "st" : "m",
          delarSchakt: p.delarSchakt !== false,
        }));
    }
  } catch {
    return;
  }

  let coefOverrides: CoefOverrides = {};
  try {
    const parsedOv = JSON.parse(String(formData.get("coefOverridesJson") || "{}"));
    if (parsedOv && typeof parsedOv === "object") coefOverrides = parsedOv;
  } catch {
    coefOverrides = {};
  }

  const { coef, materialDB, projectsForCalibration } = await getOrgCalcContext(supabase, orgId);

  const projectInput = {
    poster,
    arstid,
    servis,
    intrang,
    besiktning,
    schaktdjup,
    schaktbredd,
    slantH,
    slantV,
    antalPersoner,
    antalMaskiner,
    coefOverrides,
  };

  const calc = calcProjectDisplay(projectInput, effCoef(coef, { coefOverrides }), materialDB, projectsForCalibration);

  const { error } = await supabase.from("projects").insert({
    org_id: orgId,
    namn,
    status: "pagaende",
    poster,
    servis,
    arstid,
    intrang,
    besiktning,
    antal_personer: antalPersoner,
    antal_maskiner: antalMaskiner,
    coef_overrides: coefOverrides,
    schaktdjup,
    schaktbredd,
    slant_h: slantH,
    slant_v: slantV,
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

/** Loggar en framdriftsmätpunkt (meter/dagar) på ett pågående projekt. */
export async function addFramdriftEntry(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const orgId = await requireOrgId(supabase);

  const projectId = String(formData.get("projectId") || "");
  const meter = Number(formData.get("meter") || 0);
  const dagar = Number(formData.get("dagar") || 0);
  if (!projectId || !meter || !dagar) return { error: "Ange både meter och dagar för mätpunkten." };

  const { data: project } = await supabase.from("projects").select("framdrift").eq("id", projectId).eq("org_id", orgId).maybeSingle();
  if (!project) return { error: "Hittade inte projektet." };

  const framdrift = Array.isArray(project.framdrift) ? project.framdrift : [];
  framdrift.push({ id: crypto.randomUUID(), datum: new Date().toISOString(), meter, dagar });

  const { error } = await supabase.from("projects").update({ framdrift }).eq("id", projectId).eq("org_id", orgId);
  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

/** Tar bort en framdriftsmätpunkt. Bindas: removeFramdriftEntry.bind(null, projectId, entryId). */
export async function removeFramdriftEntry(projectId: string, entryId: string) {
  const supabase = await createClient();
  const orgId = await requireOrgId(supabase);

  const { data: project } = await supabase.from("projects").select("framdrift").eq("id", projectId).eq("org_id", orgId).maybeSingle();
  if (!project) return;
  const framdrift = (Array.isArray(project.framdrift) ? project.framdrift : []).filter((e: { id: string }) => e.id !== entryId);

  await supabase.from("projects").update({ framdrift }).eq("id", projectId).eq("org_id", orgId);
  revalidatePath(`/projects/${projectId}`);
}

/** Tar bort ett projekt. Bindas med projektets id: deleteProject.bind(null, id). */
export async function deleteProject(id: string) {
  const supabase = await createClient();
  const orgId = await requireOrgId(supabase);
  await supabase.from("projects").delete().eq("id", id).eq("org_id", orgId);
  revalidatePath("/");
  redirect("/");
}
