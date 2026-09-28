-- Antal lastbilar på projektet - kostar precis som en maskin (schakttimmar x antal x
-- kr/tim, se categoryRates.lastbil i org_settings.coef), inte kopplat till massvolymer.
alter table projects
  add column if not exists antal_lastbilar numeric default 0;
