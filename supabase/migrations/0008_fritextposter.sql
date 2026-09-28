-- Fria, egna kostnadsposter per projekt (namn + belopp) utöver de fördefinierade
-- kategorierna - t.ex. trafikanordningsplan, extra konsultarvode. Se lib/calc.ts.
alter table projects
  add column if not exists fritextposter jsonb not null default '[]'::jsonb;
