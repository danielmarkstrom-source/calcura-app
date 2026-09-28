-- Antal brunnar på projektet. Materialkostnaden för själva brunnen hanteras redan som
-- en styckvara i ledningssträckorna (enhet "st") - det här är bara arbetsinsatsen för
-- att sätta brunnen, som en schablon likt servisanslutningar (krBrunn kr/st,
-- dagBrunn dagar/st, se org_settings.coef).
alter table projects
  add column if not exists antal_brunnar numeric default 0;
