import type { CoefOverrides, FritextPost, MaskinPost, Post, ProjectInput } from "@/lib/calc";

// Den delmängd av en `projects`-rad som kalkylen läser. Supabase-klienten är otypad här,
// så raden kommer in som any - det här dokumenterar vilka kolumner som faktiskt används.
export interface ProjectRow {
  poster: Post[];
  arstid: string;
  servis: number;
  intrang: number;
  besiktning: number;
  antal_brunnar: number;
  schaktdjup: number;
  schaktbredd: number;
  slant_h: number;
  slant_v: number;
  antal_personer: number;
  maskinpark: MaskinPost[];
  schaktslede_hyresdagar: number;
  fritextposter: FritextPost[];
  driftposter: FritextPost[];
  coef_overrides: CoefOverrides;
  tjanster_manuell: number | null;
  intrang_manuell: number | null;
  omgivningspaverkan_manuell: number | null;
}

export function rowToProjectInput(project: ProjectRow): ProjectInput {
  return {
    poster: project.poster,
    arstid: project.arstid,
    servis: project.servis,
    intrang: project.intrang,
    besiktning: project.besiktning,
    brunnar: project.antal_brunnar,
    schaktdjup: project.schaktdjup,
    schaktbredd: project.schaktbredd,
    slantH: project.slant_h,
    slantV: project.slant_v,
    antalPersoner: project.antal_personer,
    maskinpark: project.maskinpark,
    hyresdagarSchaktslede: project.schaktslede_hyresdagar,
    fritextposter: project.fritextposter,
    driftposter: project.driftposter,
    coefOverrides: project.coef_overrides,
    tjansterManuell: project.tjanster_manuell,
    intrangManuell: project.intrang_manuell,
    omgivningspaverkanManuell: project.omgivningspaverkan_manuell,
  };
}
