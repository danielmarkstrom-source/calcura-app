-- Schaktsläde (schaktskyddsbox/spont) - hyrestiden sätts fritt per projekt, frikopplad
-- från den beräknade schakttiden (se lib/calc.ts, krSchaktslede kr/dag i org_settings.coef).
alter table projects
  add column if not exists schaktslede_hyresdagar numeric default 0;
