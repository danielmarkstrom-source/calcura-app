-- Möjlighet att skriva in en känd faktisk kostnad för Tjänster (del av Schaktkostnad)
-- och Fastighetsintrång, istället för att alltid använda schablonen. Null = använd
-- schablonen som vanligt (befintliga projekt påverkas inte).
alter table projects
  add column if not exists tjanster_manuell numeric,
  add column if not exists intrang_manuell numeric;
