"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calcProjectDisplay, DEFAULT_COEF, type Coef, type MaterialRow } from "@/lib/calc";

export type ActionState = { error?: string; success?: boolean } | undefined;

async function getOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/** Skickar en magisk inloggningslänk till mejladressen. */
export async function login(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") || "").trim();
  if (!email) return { error: "Ange en mejladress." };

  const supabase = await createClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: error.message };
  return { success: true };
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
