-- Maskinpark (utrullningsbar lista: grävmaskin/hjullastare/lastbil/maskinhyra) ersätter
-- de gamla enkla antal_maskiner/antal_lastbilar-fälten (som lämnas kvar oanvända).
-- Etablering/TA/omgivningspåverkan drivs av en uppskattad projekttid i veckor.
-- Driftkostnader är en egen utrullningsbar lista (namn+belopp), separat från fritextposter.
alter table projects
  add column if not exists maskinpark jsonb not null default '[]'::jsonb,
  add column if not exists projekttid_veckor numeric default 0,
  add column if not exists omgivningspaverkan_manuell numeric,
  add column if not exists driftposter jsonb not null default '[]'::jsonb;
