-- Calcura – fas 1: orgs/medlemskap/inbjudningar + datatabeller, alla scopade per org via RLS.
-- Körs en gång i Supabase SQL Editor (Dashboard -> SQL Editor -> New query -> klistra in -> Run).

-- ========== Tabeller ==========

create table if not exists orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists org_members (
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table if not exists org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  email text not null,
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

-- Hela DEFAULT_COEF-blobben (se lib/calc.ts) som jsonb - en rad per org. Snabbast att portera
-- ur piloten rakt av; kan brytas ut till egna kolumner senare om det behövs.
create table if not exists org_settings (
  org_id uuid primary key references orgs(id) on delete cascade,
  coef jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists material_rows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  slag text not null,
  material text not null,
  dimension numeric not null,
  kr_per_m numeric not null default 0,
  co2_per_m numeric,
  enhet text not null default 'm' check (enhet in ('m', 'st')),
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  namn text,
  status text not null default 'pagaende' check (status in ('pagaende', 'avslutat')),
  poster jsonb not null default '[]'::jsonb,
  servis numeric default 0,
  arstid text default 'host',
  intrang numeric default 0,
  besiktning numeric default 0,
  antal_personer numeric default 3,
  antal_maskiner numeric default 1,
  coef_overrides jsonb not null default '{}'::jsonb,
  schaktdjup numeric,
  schaktbredd numeric,
  slant_h numeric default 1,
  slant_v numeric default 1,
  prognos_total numeric,
  prognos_snapshot jsonb,
  utfall numeric,
  framdrift jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists historik (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  namn text,
  langd numeric,
  mantimmar numeric,
  anlmaterial_m3 numeric,
  rows jsonb not null default '[]'::jsonb,
  leverantor_col text,
  belopp_col text,
  categorization jsonb not null default '{}'::jsonb,
  uploaded_at timestamptz not null default now()
);

-- ========== Row Level Security ==========
-- Genomgående mönster: en rad är synlig/skrivbar för alla som är medlem i dess org_id.
-- Kända förenklingar för fas 1 (skärps vid behov): alla medlemmar (inte bara "owner") får
-- hantera org_members/org_invites - rimligt för en liten pilot med få användare per org.
--
-- is_org_member/is_org_owner är security definer-funktioner som kringgår RLS internt när
-- de läser org_members. Det är nödvändigt: en policy på org_members som frågar org_members
-- rakt av (även indirekt, via en policy på en annan tabell) ger "infinite recursion detected
-- in policy" (42P17) - Postgres kan inte evaluera policyn utan att evaluera policyn.

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

alter table orgs enable row level security;
alter table org_members enable row level security;
alter table org_invites enable row level security;
alter table org_settings enable row level security;
alter table material_rows enable row level security;
alter table projects enable row level security;
alter table historik enable row level security;

create policy "members can read own org" on orgs
  for select using (is_org_member(id));

create policy "owners can update own org" on orgs
  for update using (is_org_owner(id)) with check (is_org_owner(id));

create policy "members can manage own org_members" on org_members
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

create policy "members can manage own org_invites" on org_invites
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

create policy "members can manage own org_settings" on org_settings
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

create policy "members can manage own material_rows" on material_rows
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

create policy "members can manage own projects" on projects
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

create policy "members can manage own historik" on historik
  for all using (is_org_member(org_id)) with check (is_org_member(org_id));

-- RLS styr bara VILKA RADER en roll ser - PostgREST kräver även ett GRANT på tabellen.
-- Vi valde "Automatically expose new tables" = av vid projektskapandet, så det GRANT:et
-- måste sättas manuellt. `anon` (utloggad) får medvetet ingenting; all åtkomst kräver inloggning.
grant select, insert, update, delete on
  orgs, org_members, org_invites, org_settings, material_rows, projects, historik
to authenticated;

-- ========== Ny användare: gå med i org via inbjudan, annars skapa en ny org ==========
-- Körs (security definer, kringgår RLS) varje gång en rad skapas i auth.users - vilket
-- Supabase Auth gör direkt vid signInWithOtp för en ny mejladress, innan länken ens klickats.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  new_org_id uuid;
begin
  select * into inv from org_invites
    where lower(email) = lower(new.email) and accepted_at is null
    order by created_at asc
    limit 1;

  if found then
    insert into org_members (org_id, user_id, role) values (inv.org_id, new.id, 'member');
    update org_invites set accepted_at = now() where id = inv.id;
  else
    insert into orgs (name) values (split_part(new.email, '@', 1) || E'’s org')
      returning id into new_org_id;
    insert into org_members (org_id, user_id, role) values (new_org_id, new.id, 'owner');
    -- coef fylls i av appen vid första inloggning (DEFAULT_COEF, se lib/calc.ts) - tom här.
    insert into org_settings (org_id, coef) values (new_org_id, '{}'::jsonb);
    -- Samma tre exempelrader som DEFAULT_COEF.materialDB i piloten/lib/calc.ts.
    insert into material_rows (org_id, slag, material, dimension, kr_per_m, co2_per_m, enhet) values
      (new_org_id, 'dricksvatten', 'pe', 110, 450, 12, 'm'),
      (new_org_id, 'spillvatten', 'pvc', 200, 800, 15, 'm'),
      (new_org_id, 'dagvatten', 'pvc', 300, 900, 13, 'm');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
