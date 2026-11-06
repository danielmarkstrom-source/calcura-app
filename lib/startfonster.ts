// Startfönster: vad kostar projektet - och när blir det klart - beroende på vilken månad
// det startar?
//
// Prognosen räknar annars med EN årstid för hela projektet. I verkligheten glider ett
// projekt som startar i oktober in i vintern, och ett som startar i juni står still under
// byggsemestern medan TA, etableringsutrustning och omgivningspåverkan fortsätter att
// kosta per vecka. Här simuleras projektet arbetsdag för arbetsdag i kalendern:
//
//  1. Etablering (fasta dagar, ingen årstidspåverkan).
//  2. Schaktet: varje arbetsdag i månad m klarar 1/årstidsfaktor(m) "normaldagar" av
//     schaktarbete - en vinterdag (1,2×) gör alltså bara ~83 % av en vårdag.
//  3. Serviser/brunnar och avetablering (fasta dagar).
//
// Helger hoppas över och byggsemestern (v. 28-31) är stillestånd. Den faktiska, blandade
// årstidsfaktorn (verkliga schaktdagar / normaldagar) skickas sedan in i den vanliga
// kalkylmotorn, så alla poster räknas exakt som i en vanlig prognos. Stilleståndsveckorna
// läggs på som en egen kostnad för det som fortsätter att ticka per vecka.

import { calcProject, type Coef, type MaterialRow, type ProjectInput } from "@/lib/calc";

export const BYGGSEMESTER_VECKOR = [28, 29, 30, 31];

const MANADER = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

// Månad (0-11) -> årstid. Svensk anläggningsbransch: vinter dec-feb, vår mar-maj,
// sommar jun-aug, höst sep-nov.
export function arstidForManad(m: number): string {
  if (m === 11 || m <= 1) return "vinter";
  if (m <= 4) return "var";
  if (m <= 7) return "sommar";
  return "host";
}

// ISO 8601-veckonummer.
export function isoVecka(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dag = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dag);
  const arStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - arStart.getTime()) / 86400000 + 1) / 7);
}

function arByggsemester(d: Date): boolean {
  return BYGGSEMESTER_VECKOR.includes(isoVecka(d));
}

export interface StartfonsterAlternativ {
  start: Date;
  label: string; // "apr 2027"
  slut: Date;
  total: number;
  arbetsdagar: number; // dagar på plats inkl. etablering/avetablering
  kalenderveckor: number; // start -> slut, inkl. helger och stillestånd
  stillestandVeckor: number;
  stillestandKostnad: number;
  effektivFaktor: number; // blandad årstidsfaktor för schaktet
  arstidsfordelning: Record<string, number>; // andel av schaktdagarna per årstid (0-1)
}

export interface StartfonsterResultat {
  alternativ: StartfonsterAlternativ[];
  billigast: StartfonsterAlternativ;
  dyrast: StartfonsterAlternativ;
}

const MAX_DAGAR = 365 * 5; // skydd mot oändliga loopar vid orimliga koefficienter

function simulera(
  start: Date,
  etableringDagar: number,
  normalSchaktDagar: number,
  ovrigaDagar: number,
  avetableringDagar: number,
  coef: Coef
) {
  const d = new Date(start);
  let arbetsdagar = 0;
  let schaktDagar = 0;
  let schaktKvar = normalSchaktDagar;
  let etabKvar = etableringDagar;
  let ovrigtKvar = ovrigaDagar;
  let avetabKvar = avetableringDagar;
  const perArstid: Record<string, number> = {};
  const stillestandVeckor = new Set<string>();
  let slut = new Date(start);

  for (let i = 0; i < MAX_DAGAR && etabKvar + schaktKvar + ovrigtKvar + avetabKvar > 1e-9; i++) {
    const veckodag = d.getDay();
    if (veckodag !== 0 && veckodag !== 6) {
      if (arByggsemester(d)) {
        stillestandVeckor.add(`${d.getFullYear()}-${isoVecka(d)}`);
      } else {
        arbetsdagar++;
        if (etabKvar > 1e-9) {
          etabKvar = Math.max(0, etabKvar - 1);
        } else if (schaktKvar > 1e-9) {
          const arstid = arstidForManad(d.getMonth());
          const f = coef.arstid[arstid] || 1;
          // En del av sista dagen räcker om bara en rest återstår.
          const andel = Math.min(1, schaktKvar * f);
          schaktKvar = Math.max(0, schaktKvar - andel / f);
          schaktDagar += andel;
          perArstid[arstid] = (perArstid[arstid] || 0) + andel;
        } else if (ovrigtKvar > 1e-9) {
          ovrigtKvar = Math.max(0, ovrigtKvar - 1);
        } else {
          avetabKvar = Math.max(0, avetabKvar - 1);
        }
        slut = new Date(d);
      }
    }
    d.setDate(d.getDate() + 1);
  }

  const effektivFaktor = normalSchaktDagar > 0 ? schaktDagar / normalSchaktDagar : 1;
  const arstidsfordelning: Record<string, number> = {};
  for (const [k, v] of Object.entries(perArstid)) arstidsfordelning[k] = schaktDagar > 0 ? v / schaktDagar : 0;
  // Stillestånd räknas bara om projektet faktiskt pågick både före och efter semestern.
  const stillestand = [...stillestandVeckor].filter((v) => {
    const [ar, vecka] = v.split("-").map(Number);
    return slut.getFullYear() > ar || isoVecka(slut) > vecka;
  }).length;
  return { slut, arbetsdagar, effektivFaktor, arstidsfordelning, stillestandVeckor: stillestand };
}

export function beraknaStartfonster(
  p: ProjectInput,
  coef: Coef,
  materialDB: MaterialRow[],
  kalibreringFaktor: number,
  fran: Date = new Date(),
  antalManader = 12
): StartfonsterResultat | null {
  const NEUTRAL = "__neutral";
  const BLAND = "__blandad";
  // Kalkyl med årstidsfaktor 1 ger antalet "normaldagar" schakt.
  const bas = calcProject({ ...p, arstid: NEUTRAL }, { ...coef, arstid: { ...coef.arstid, [NEUTRAL]: 1 } }, materialDB);
  const ovrigaDagar = bas.dagar - bas.ledningDagar;
  if (bas.dagar <= 0) return null;
  const etab = coef.dagarEtablering || 0;
  const avetab = coef.dagarAvetablering || 0;

  // Kostnader som fortsätter per vecka även när arbetsplatsen står still under semestern.
  const perVeckaStillestand =
    (coef.krEtableringPerVecka || 0) +
    (coef.krTAPerVecka || 0) +
    (p.omgivningspaverkanManuell != null ? 0 : coef.krOmgivningspaverkanPerVecka || 0);

  const alternativ: StartfonsterAlternativ[] = [];
  for (let i = 0; i < antalManader; i++) {
    const start = new Date(fran.getFullYear(), fran.getMonth() + 1 + i, 1);
    const sim = simulera(start, etab, bas.ledningDagar, ovrigaDagar, avetab, coef);
    const r = calcProject({ ...p, arstid: BLAND }, { ...coef, arstid: { ...coef.arstid, [BLAND]: sim.effektivFaktor } }, materialDB);
    // Samma kalibrering som den aktuella prognosen, så jämförelsen bara visar årstidseffekten.
    const kalibrerad = r.total + r.tidsdrivenTotal * (kalibreringFaktor - 1);
    const stillestandKostnad = sim.stillestandVeckor * perVeckaStillestand * kalibreringFaktor;
    alternativ.push({
      start,
      label: `${MANADER[start.getMonth()]} ${start.getFullYear()}`,
      slut: sim.slut,
      total: kalibrerad + stillestandKostnad,
      arbetsdagar: sim.arbetsdagar,
      kalenderveckor: Math.max(1, Math.ceil((sim.slut.getTime() - start.getTime()) / (7 * 86400000))),
      stillestandVeckor: sim.stillestandVeckor,
      stillestandKostnad,
      effektivFaktor: sim.effektivFaktor,
      arstidsfordelning: sim.arstidsfordelning,
    });
  }
  const billigast = alternativ.reduce((a, b) => (b.total < a.total ? b : a));
  const dyrast = alternativ.reduce((a, b) => (b.total > a.total ? b : a));
  return { alternativ, billigast, dyrast };
}
