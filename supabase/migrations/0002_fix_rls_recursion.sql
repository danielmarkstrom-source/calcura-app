-- Fix: "infinite recursion detected in policy for relation org_members" (42P17).
--
-- Orsak: policyerna jämförde org_id mot en subquery på org_members, och org_members
-- egen policy gjorde samma sak mot sig själv - Postgres kan inte evaluera en policy
-- som (direkt eller indirekt, via en policy på en annan tabell) kräver att evaluera
-- sig själv. Fixen: två security definer-funktioner som läser org_members utan att
-- gå via RLS internt, och alla policyer byts till att använda dem.
--
-- Säkert att köra ovanpå 0001_init.sql - rör bara policyer, ingen data/tabellstruktur.

create or replace function is_org_member(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from org_members where org_id = check_org_id and user_id = auth.uid()
  );
$$;

create or replace function is_org_owner(check_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from org_members where org_id = check_org_id and user_id = auth.uid() and role = 'owner'
  );
$$;

drop policy if exists "members can read own org" on orgs;
create policy "members can read own org" on orgs
  for select using (is_org_member(id));

drop policy if exists "owners can update own org" on orgs;
create policy "owners can update own org" on orgs
  for update using (is_org_owner(id)) with check (is_org_owner(id));

drop policy if exists "members can manage own org_members" on org_members;
create policy "members can manage own org_members" on org_members
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

drop policy if exists "members can manage own org_invites" on org_invites;
create policy "members can manage own org_invites" on org_invites
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

drop policy if exists "members can manage own org_settings" on org_settings;
create policy "members can manage own org_settings" on org_settings
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

drop policy if exists "members can manage own material_rows" on material_rows;
create policy "members can manage own material_rows" on material_rows
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

drop policy if exists "members can manage own projects" on projects;
create policy "members can manage own projects" on projects
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

drop policy if exists "members can manage own historik" on historik;
create policy "members can manage own historik" on historik
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));
