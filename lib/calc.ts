// Kalkylmotorn - porterad från va-pilot.html (calcProject/calcProjectDisplay/effCoef/
// computeFramdrift m.fl.). Ramverksoberoende ren logik, i det närmaste rakt av kopierad;
// enda skillnaden är att globalt STATE-beroende (STATE.coef, STATE.projects) är utbytt
// mot explicita parametrar eftersom det inte finns någon global app-state i Next.js.
//
// Håll den här filen i synk med kalkylmotorn i ../va-pilot.html om schablonerna ändras där
// innan piloten fasas ut helt.

export const LEDNINGSSLAG = [
  { id: "dricksvatten", label: "Dricksvatten", co2: 12, refDim: 150 },
  { id: "spillvatten", label: "Spillvatten", co2: 15, refDim: 200 },
  { id: "dagvatten", label: "Dagvatten", co2: 13, refDim: 300 },
] as const;

export const MATERIAL = [
  { id: "pvc", label: "PVC", co2Faktor: 0.9, tidsfaktor: 1.0 },
  { id: "pe", label: "PE", co2Faktor: 1.0, tidsfaktor: 1.0 },
  { id: "pp", label: "PP", co2Faktor: 0.95, tidsfaktor: 1.0 },
  { id: "gjutjarn", label: "Gjutjärn", co2Faktor: 2.1, tidsfaktor: 1.3 },
  { id: "betong", label: "Betong", co2Faktor: 1.8, tidsfaktor: 1.4 },
] as const;

export const ARSTID = [
  { id: "var", label: "Vår", faktor: 1.0 },
  { id: "sommar", label: "Sommar", faktor: 0.95 },
  { id: "host", label: "Höst", faktor: 1.05 },
  { id: "vinter", label: "Vinter", faktor: 1.2 },
] as const;

export const MARKTYP = [
  { id: "gatumark", label: "Gatumark" },
  { id: "skogsmark", label: "Skogsmark" },
  { id: "jordbruksmark", label: "Jordbruksmark" },
] as const;

export const KATEGORIER = [
  { id: "va-material", label: "VA-material" },
  { id: "arbetstid", label: "Arbetstid" },
  { id: "maskinkostnad", label: "Maskinkostnad" },
  { id: "tjanster", label: "Tjänster" },
  { id: "anlaggningsmaterial", label: "Anläggningsmaterial" },
  { id: "ovrigt", label: "Övrigt / ignorera" },
] as const;

export interface CategoryRates {
  arbetstid: number;
  maskinkostnad: number;
  anlaggningsmaterial: number;
  tjanster: number;
}

export interface Coef {
  refDim: Record<string, number>;
  categoryRates: CategoryRates;
  timmarPerArbetsdag: number;
  rateUnitVersion?: number;
  markFaktor: Record<string, number>;
  arstid: Record<string, number>;
  co2Slag: Record<string, number>;
  co2Material: Record<string, number>;
  tidsfaktorMaterial: Record<string, number>;
  dagstakt: number;
  krServis: number;
  krIntrang: number;
  krBesiktning: number;
  dagServis: number;
  extraPipeDagarFaktor: number;
  fallBrytdjup: number;
  lastbilKapacitet: number;
  anlaggningsmaterialM3PerM3: number;
  dagBesiktning: number;
  osakerhet: number;
  calibrationEnabled: boolean;
}

// coefOverrides är en gles, delvis nästlad delmängd av Coef - bara det som är ändrat per projekt.
export type CoefOverrides = { [K in keyof Coef]?: Coef[K] extends object ? Partial<Coef[K]> : Coef[K] };

export const DEFAULT_COEF: Coef = {
  refDim: Object.fromEntries(LEDNINGSSLAG.map((s) => [s.id, s.refDim])),
  categoryRates: { arbetstid: 550, maskinkostnad: 800, anlaggningsmaterial: 250, tjanster: 400 },
  timmarPerArbetsdag: 8,
  rateUnitVersion: 2,
  markFaktor: { gatumark: 1.0, skogsmark: 0.85, jordbruksmark: 0.75 },
  arstid: Object.fromEntries(ARSTID.map((a) => [a.id, a.faktor])),
  co2Slag: Object.fromEntries(LEDNINGSSLAG.map((s) => [s.id, s.co2])),
  co2Material: Object.fromEntries(MATERIAL.map((m) => [m.id, m.co2Faktor])),
  tidsfaktorMaterial: Object.fromEntries(MATERIAL.map((m) => [m.id, m.tidsfaktor])),
  dagstakt: 22,
  krServis: 45000,
  krIntrang: 15000,
  krBesiktning: 3000,
  dagServis: 0.3,
  extraPipeDagarFaktor: 0.15,
  fallBrytdjup: 0.5,
  lastbilKapacitet: 10,
  anlaggningsmaterialM3PerM3: 1.0,
  dagBesiktning: 0.1,
  osakerhet: 15,
  calibrationEnabled: true,
};

export interface MaterialRow {
  id: string;
  slag: string;
  material: string;
  dimension: number;
  krPerM: number;
  co2PerM?: number | null;
  enhet: "m" | "st";
}

export interface Post {
  id: string;
  slag: string;
  material: string;
  dimension: number;
  langd: number;
  mark?: string;
  enhet?: "m" | "st";
  delarSchakt?: boolean;
}

export interface ProjectInput {
  poster: Post[];
  arstid: string;
  servis?: number;
  intrang?: number;
  besiktning?: number;
  schaktdjup?: number;
  schaktbredd?: number;
  slantH?: number;
  slantV?: number;
  antalPersoner?: number;
  antalMaskiner?: number;
  coefOverrides?: CoefOverrides;
}

export interface ProjectRecord extends ProjectInput {
  id: string;
  namn: string;
  status: "pagaende" | "avslutat";
  utfall?: number | null;
  prognosTotal?: number | null;
  framdrift?: FramdriftEntry[];
}

export interface FramdriftEntry {
  id: string;
  datum: string;
  meter: number;
  dagar: number;
}

export function formatKr(n: number): string {
  return Math.round(n || 0).toLocaleString("sv-SE") + " kr";
}
export function fmtInt(n: number): string {
  return Math.round(n || 0).toLocaleString("sv-SE");
}
export function slagLabel(id: string): string {
  return LEDNINGSSLAG.find((s) => s.id === id)?.label ?? id;
}
export function materialLabel(id: string): string {
  return MATERIAL.find((m) => m.id === id)?.label ?? id;
}
export function markLabel(id: string): string {
  return MARKTYP.find((m) => m.id === id)?.label ?? id;
}
export function kategoriLabel(id: string): string {
  return KATEGORIER.find((k) => k.id === id)?.label ?? id;
}

export function getMaterialPrice(materialDB: MaterialRow[], slag: string, material: string, dimension: number): number {
  const row = materialDB.find((r) => r.slag === slag && r.material === material && Number(r.dimension) === Number(dimension));
  return row ? row.krPerM : 0;
}
export function getMaterialCO2(materialDB: MaterialRow[], slag: string, material: string, dimension: number): number | null {
  const row = materialDB.find((r) => r.slag === slag && r.material === material && Number(r.dimension) === Number(dimension));
  return row && row.co2PerM ? Number(row.co2PerM) : null;
}
export function getMaterialDimensions(materialDB: MaterialRow[], slag: string, material: string): number[] {
  return materialDB
    .filter((r) => r.slag === slag && r.material === material)
    .map((r) => Number(r.dimension))
    .sort((a, b) => a - b);
}

interface Massor {
  djup: number;
  bredd: number;
  brytdjup: number;
  toppbredd: number;
  fallAVolym: number;
  fallBVolym: number;
  totalVolym: number;
  fallATransporter: number;
  fallBTransporter: number;
  anlaggningsmaterialBehov: number;
}

export interface CalcPart {
  key: string;
  label: string;
  value: number;
}

export interface CalcResult {
  total: number;
  low: number;
  high: number;
  co2: number;
  dagar: number;
  langdTotal: number;
  krPerMeter: number;
  parts: CalcPart[];
  materialTotal: number;
  ovrigtTotal: number;
  massor: Massor;
  schakttimmar: number;
  arbetstimmar: number;
  antalPersoner: number;
  antalMaskiner: number;
  ledningDagar: number;
  dagstakt: number;
  tidsdrivenTotal: number;
  calibration?: { factor: number; n: number };
}

export function calcProject(p: ProjectInput, coef: Coef, materialDB: MaterialRow[]): CalcResult {
  const arstidFaktor = coef.arstid[p.arstid] ?? 1;
  const poster = Array.isArray(p.poster) ? p.poster : [];

  const postResults = poster.map((post) => {
    const enhet = post.enhet || "m";
    const refDim = coef.refDim[post.slag] || 200;
    const dimFaktor = (post.dimension || refDim) / refDim;
    const markFaktor = coef.markFaktor[post.mark || "gatumark"] ?? 1;
    const materialPris = getMaterialPrice(materialDB, post.slag, post.material, post.dimension);
    const mangd = post.langd || 0;
    const co2PerEnhetFromDB = getMaterialCO2(materialDB, post.slag, post.material, post.dimension);

    let materialKostnad: number, co2: number, dagar: number;

    if (enhet === "st") {
      // Styckvaror (t.ex. brunnar, ventiler): bara material- och klimatkostnad per styck.
      materialKostnad = mangd * materialPris;
      co2 = mangd * (co2PerEnhetFromDB || 0);
      dagar = 0;
    } else {
      materialKostnad = mangd * materialPris * arstidFaktor * markFaktor;
      co2 =
        co2PerEnhetFromDB !== null
          ? mangd * co2PerEnhetFromDB
          : mangd * (coef.co2Slag[post.slag] || 0) * (coef.co2Material[post.material] || 1) * dimFaktor;
      dagar = (mangd / (coef.dagstakt || 22)) * (coef.tidsfaktorMaterial[post.material] || 1) * arstidFaktor;
    }

    return { ...post, enhet, materialKostnad, co2, dagar };
  });

  const meterPosts = postResults.filter((p2) => (p2.enhet || "m") === "m");

  const langdTotal = (() => {
    const shared = meterPosts.filter((p2) => p2.delarSchakt !== false);
    const separate = meterPosts.filter((p2) => p2.delarSchakt === false);
    const sharedMax = shared.length ? Math.max(...shared.map((p2) => p2.langd || 0)) : 0;
    const separateSum = separate.reduce((a, p2) => a + (p2.langd || 0), 0);
    return sharedMax + separateSum;
  })();

  const pipeLangdSum = meterPosts.reduce((a, p2) => a + (p2.langd || 0), 0);
  const materialTotalM = meterPosts.reduce((a, p2) => a + p2.materialKostnad, 0);
  const hasStyckItems = postResults.some((p2) => (p2.enhet || "m") === "st");
  const materialTotal = postResults.reduce((a, p2) => a + p2.materialKostnad, 0);
  const ledningCO2 = postResults.reduce((a, p2) => a + p2.co2, 0);

  const ledningDagar = (() => {
    const shared = meterPosts.filter((p2) => p2.delarSchakt !== false);
    const separate = meterPosts.filter((p2) => p2.delarSchakt === false);
    let sharedDagar = 0;
    if (shared.length) {
      const longest = shared.reduce((a, b) => ((b.langd || 0) > (a.langd || 0) ? b : a));
      const extraPipes = shared.length - 1;
      sharedDagar = longest.dagar * (1 + extraPipes * (coef.extraPipeDagarFaktor ?? 0.15));
    }
    const separateDagar = separate.reduce((a, p2) => a + p2.dagar, 0);
    return sharedDagar + separateDagar;
  })();

  const massor: Massor = (() => {
    const djup = p.schaktdjup || 0;
    const bredd = p.schaktbredd || 0;
    const slantH = p.slantH ?? 1;
    const slantV = p.slantV ?? 1;
    const slopeFaktor = slantV > 0 ? slantH / slantV : 0;
    const widthAt = (d: number) => bredd + 2 * slopeFaktor * (djup - d);
    const sliceArea = (d1: number, d2: number) => ((widthAt(d1) + widthAt(d2)) / 2) * Math.max(0, d2 - d1);

    const brytdjup = Math.min(coef.fallBrytdjup ?? 0.5, djup);
    const fallAVolym = langdTotal * sliceArea(0, brytdjup);
    const fallBVolym = langdTotal * sliceArea(brytdjup, djup);
    const totalVolym = fallAVolym + fallBVolym;
    const toppbredd = widthAt(0);
    const kapacitet = coef.lastbilKapacitet || 10;
    const fallATransporter = fallAVolym > 0 ? Math.ceil(fallAVolym / kapacitet) : 0;
    const fallBTransporter = fallBVolym > 0 ? Math.ceil(fallBVolym / kapacitet) : 0;
    const anlaggningsmaterialBehov = fallBVolym * (coef.anlaggningsmaterialM3PerM3 ?? 1);
    return { djup, bredd, brytdjup, toppbredd, fallAVolym, fallBVolym, totalVolym, fallATransporter, fallBTransporter, anlaggningsmaterialBehov };
  })();

  // Tidsbaserade kategorikostnader: schakttiden (dagar ur förläggningstakten) -> timmar.
  const tph = coef.timmarPerArbetsdag || 8;
  const antalPersoner = p.antalPersoner ?? 3;
  const antalMaskiner = p.antalMaskiner ?? 1;
  const schakttimmar = ledningDagar * tph;
  const arbetstimmar = schakttimmar * antalPersoner;
  const avgMark =
    pipeLangdSum > 0
      ? meterPosts.reduce((a, p2) => a + (coef.markFaktor[p2.mark || "gatumark"] ?? 1) * (p2.langd || 0), 0) / pipeLangdSum
      : 1;
  const arbetstidTotal = schakttimmar * antalPersoner * (coef.categoryRates.arbetstid || 0) * avgMark;
  const maskinTotal = schakttimmar * antalMaskiner * (coef.categoryRates.maskinkostnad || 0) * avgMark;
  const tjansterTotal = schakttimmar * (coef.categoryRates.tjanster || 0) * avgMark;
  const anlaggningsTotal = massor.anlaggningsmaterialBehov * (coef.categoryRates.anlaggningsmaterial || 0);
  const ovrigtTotal = arbetstidTotal + maskinTotal + anlaggningsTotal + tjansterTotal;
  const ledningKostnad = materialTotal + ovrigtTotal;

  const servisKostnad = (p.servis || 0) * coef.krServis * arstidFaktor;
  const intrangKostnad = (p.intrang || 0) * coef.krIntrang * arstidFaktor;
  const besiktningKostnad = (p.besiktning || 0) * coef.krBesiktning * arstidFaktor;
  const servisDagar = (p.servis || 0) * coef.dagServis;
  const besiktningDagar = (p.besiktning || 0) * coef.dagBesiktning;

  const total = ledningKostnad + servisKostnad + intrangKostnad + besiktningKostnad;
  const co2 = ledningCO2 + (p.servis || 0) * 180;
  const dagar = ledningDagar + servisDagar + besiktningDagar;

  const materialKrPerM = pipeLangdSum > 0 ? materialTotalM / pipeLangdSum : 0;
  const parts: CalcPart[] = [
    { key: "material", label: hasStyckItems ? "Material (meter- och styckvaror)" : `Material (snitt ${formatKr(materialKrPerM)}/m)`, value: materialTotal },
    { key: "arbetstid", label: "Arbetstid", value: arbetstidTotal },
    { key: "anlaggningsmaterial", label: "Anläggningsmaterial", value: anlaggningsTotal },
    { key: "tjanster", label: "Tjänster", value: tjansterTotal },
    { key: "maskinkostnad", label: "Maskinkostnader", value: maskinTotal },
    { key: "servis", label: "Servisanslutningar", value: servisKostnad },
    { key: "intrang", label: "Fastighetsintrång", value: intrangKostnad },
    { key: "besiktning", label: "Besiktning", value: besiktningKostnad },
  ];

  return {
    total,
    low: total * (1 - coef.osakerhet / 100),
    high: total * (1 + coef.osakerhet / 100),
    co2,
    dagar,
    langdTotal,
    krPerMeter: langdTotal > 0 ? total / langdTotal : 0,
    parts,
    materialTotal,
    ovrigtTotal,
    massor,
    schakttimmar,
    arbetstimmar,
    antalPersoner,
    antalMaskiner,
    ledningDagar,
    dagstakt: coef.dagstakt || 22,
    tidsdrivenTotal: arbetstidTotal + maskinTotal + tjansterTotal,
  };
}

/* ---------- Projektspecifika inställningar (override av globala koefficienter) ---------- */
export function deepMergeCoef(base: Coef, ov: CoefOverrides | undefined | null): Coef {
  const out = { ...base } as Record<string, unknown>;
  const baseRec = base as unknown as Record<string, unknown>;
  const ovRec = (ov || {}) as Record<string, unknown>;
  Object.keys(ovRec).forEach((k) => {
    const bv = baseRec[k];
    const nv = ovRec[k];
    if (nv && typeof nv === "object" && !Array.isArray(nv) && bv && typeof bv === "object" && !Array.isArray(bv)) {
      out[k] = { ...(bv as object), ...(nv as object) };
    } else if (nv !== undefined && nv !== null && nv !== "") {
      out[k] = nv;
    }
  });
  return out as unknown as Coef;
}

export function effCoef(globalCoef: Coef, project: { coefOverrides?: CoefOverrides } | null | undefined): Coef {
  const ov = project?.coefOverrides;
  if (!ov || Object.keys(ov).length === 0) return globalCoef;
  return deepMergeCoef(globalCoef, ov);
}

export function getCoefByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce((o: unknown, k: string) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj);
}

// Lista över override:bara fält och deras etikett/enhet/grupp - används av "avancerat"-formuläret.
export const OVERRIDE_FIELDS: { group: string; path: string; label: string; unit: string; step?: string }[] = [
  { group: "Kategorikostnader", path: "categoryRates.arbetstid", label: "Arbetstid", unit: "kr/tim" },
  { group: "Kategorikostnader", path: "categoryRates.maskinkostnad", label: "Maskinkostnad", unit: "kr/tim" },
  { group: "Kategorikostnader", path: "categoryRates.tjanster", label: "Tjänster", unit: "kr/tim" },
  { group: "Kategorikostnader", path: "categoryRates.anlaggningsmaterial", label: "Anläggningsmaterial", unit: "kr/m³" },
  { group: "Tidsantaganden", path: "timmarPerArbetsdag", label: "Timmar per arbetsdag", unit: "tim" },
  { group: "Tidsantaganden", path: "dagstakt", label: "Meter per arbetsdag", unit: "m/dag" },
  { group: "Tidsantaganden", path: "extraPipeDagarFaktor", label: "Extra tid per parallell ledning", unit: "×", step: "0.05" },
  { group: "Marktypsfaktor", path: "markFaktor.gatumark", label: "Gatumark", unit: "×", step: "0.05" },
  { group: "Marktypsfaktor", path: "markFaktor.skogsmark", label: "Skogsmark", unit: "×", step: "0.05" },
  { group: "Marktypsfaktor", path: "markFaktor.jordbruksmark", label: "Jordbruksmark", unit: "×", step: "0.05" },
  { group: "Årstidsfaktor", path: "arstid.var", label: "Vår", unit: "×", step: "0.05" },
  { group: "Årstidsfaktor", path: "arstid.sommar", label: "Sommar", unit: "×", step: "0.05" },
  { group: "Årstidsfaktor", path: "arstid.host", label: "Höst", unit: "×", step: "0.05" },
  { group: "Årstidsfaktor", path: "arstid.vinter", label: "Vinter", unit: "×", step: "0.05" },
  { group: "Massberäkning", path: "fallBrytdjup", label: "Brytdjup Fall A / Fall B", unit: "m", step: "0.1" },
  { group: "Massberäkning", path: "lastbilKapacitet", label: "Lastbilskapacitet", unit: "m³/lass" },
  { group: "Massberäkning", path: "anlaggningsmaterialM3PerM3", label: "Anläggningsmaterial per m³ Fall B", unit: "m³/m³", step: "0.05" },
  { group: "Övriga kostnader", path: "krServis", label: "Per servisanslutning", unit: "kr/st" },
  { group: "Övriga kostnader", path: "krIntrang", label: "Per fastighetsintrång", unit: "kr/st" },
  { group: "Övriga kostnader", path: "krBesiktning", label: "Per besiktning", unit: "kr/st" },
  { group: "Övriga kostnader", path: "osakerhet", label: "Osäkerhetsspann", unit: "%" },
];

/* ---------- Kalibrering ---------- */
export function getCalibration(projects: { utfall?: number | null; prognosTotal?: number | null }[]): { factor: number; n: number } {
  const done = projects.filter((p) => p.utfall && p.prognosTotal);
  if (done.length === 0) return { factor: 1, n: 0 };
  const ratios = done.map((p) => (p.utfall as number) / (p.prognosTotal as number));
  const factor = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return { factor, n: done.length };
}

export function calcProjectDisplay(
  p: ProjectInput,
  coef: Coef,
  materialDB: MaterialRow[],
  projectsForCalibration: { utfall?: number | null; prognosTotal?: number | null }[]
): CalcResult {
  const raw = calcProject(p, coef, materialDB);
  const cal = getCalibration(projectsForCalibration);
  if (!coef.calibrationEnabled || cal.n === 0) return { ...raw, calibration: cal };
  const f = cal.factor;
  // Materialkostnaden bygger på faktiska priser ur materialdatabasen och kalibreras aldrig -
  // bara de schablonbaserade posterna (arbetstid/maskin/anläggning/tjänster/servis/intrång/besiktning).
  const materialTotal = raw.materialTotal;
  const nonMaterialRaw = raw.total - raw.materialTotal;
  const total = materialTotal + nonMaterialRaw * f;
  const ovrigtTotal = raw.ovrigtTotal * f;
  return {
    ...raw,
    total,
    low: total * (1 - coef.osakerhet / 100),
    high: total * (1 + coef.osakerhet / 100),
    krPerMeter: raw.langdTotal > 0 ? total / raw.langdTotal : 0,
    materialTotal,
    ovrigtTotal,
    parts: raw.parts.map((pt) => (pt.key === "material" ? pt : { ...pt, value: pt.value * f })),
    calibration: cal,
  };
}

/* ---------- Framdrift: logga faktisk takt under pågående projekt ---------- */
export interface FramdriftResult {
  entries: FramdriftEntry[];
  totalMeter: number;
  totalDagar: number;
  observeradTakt: number | null;
  ursprungligTakt: number | null;
  aterstaendeLangd: number;
  revideradAterstaendeDagar: number | null;
  revideradSchaktDagar: number | null;
  revideradTotalDagar: number | null;
  dagarAvvikelse: number | null;
  revideradKostnad: number | null;
  ovrigaDagar: number;
}

export function computeFramdrift(p: { framdrift?: FramdriftEntry[]; coefOverrides?: CoefOverrides }, calc: CalcResult, globalCoef: Coef): FramdriftResult {
  const entries = Array.isArray(p.framdrift) ? p.framdrift : [];
  const totalMeter = entries.reduce((a, e) => a + (e.meter || 0), 0);
  const totalDagar = entries.reduce((a, e) => a + (e.dagar || 0), 0);
  const observeradTakt = totalMeter > 0 && totalDagar > 0 ? totalMeter / totalDagar : null;
  // Framdriften loggar ren schakt-/läggningstakt (meter per grävdag) - jämförs mot schakttiden
  // i planen, inte totala dagar (som även rymmer servis/besiktning).
  const schaktDagarPlan = calc.ledningDagar != null && calc.ledningDagar > 0 ? calc.ledningDagar : calc.dagar;
  const ovrigaDagar = Math.max(0, (calc.dagar || 0) - schaktDagarPlan);
  // Visas som referens: den inställda förläggningstakten - medvetet frikopplad från
  // beräkningen nedan, som räknar på den projektjusterade schakttiden (ledningDagar).
  const dagstaktRef = (getCoefByPath(effCoef(globalCoef, p), "dagstakt") as number | undefined) ?? calc.dagstakt ?? globalCoef.dagstakt;
  const ursprungligTakt =
    dagstaktRef != null && dagstaktRef > 0
      ? dagstaktRef
      : calc.langdTotal > 0 && schaktDagarPlan > 0
        ? calc.langdTotal / schaktDagarPlan
        : null;
  const aterstaendeLangd = Math.max(0, calc.langdTotal - totalMeter);
  const revideradAterstaendeDagar = observeradTakt ? aterstaendeLangd / observeradTakt : null;
  const revideradSchaktDagar = observeradTakt ? totalDagar + (revideradAterstaendeDagar as number) : null;
  const revideradTotalDagar = revideradSchaktDagar !== null ? revideradSchaktDagar + ovrigaDagar : null;
  const dagarAvvikelse = revideradTotalDagar !== null ? revideradTotalDagar - calc.dagar : null;
  // Kostnadsomprognos: bara den tidsdrivna kostnaden (arbetstid/maskin/tjänster) skalar med
  // schakttiden. Material, anläggningsmaterial, servis/intrång/besiktning ligger kvar.
  const tidsdriven = calc.tidsdrivenTotal != null ? calc.tidsdrivenTotal : calc.ovrigtTotal || 0;
  const schaktFaktor = revideradSchaktDagar !== null && schaktDagarPlan > 0 ? revideradSchaktDagar / schaktDagarPlan : null;
  const revideradKostnad = schaktFaktor !== null ? calc.total + tidsdriven * (schaktFaktor - 1) : null;
  return {
    entries,
    totalMeter,
    totalDagar,
    observeradTakt,
    ursprungligTakt,
    aterstaendeLangd,
    revideradAterstaendeDagar,
    revideradSchaktDagar,
    revideradTotalDagar,
    dagarAvvikelse,
    revideradKostnad,
    ovrigaDagar,
  };
}
