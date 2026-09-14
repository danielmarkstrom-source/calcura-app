-- Fix: "permission denied for table X" (42501) för inloggade användare.
--
-- Orsak: vi valde medvetet "Automatically expose new tables" = av när Supabase-projektet
-- skapades (se arbetslogg.md), så nya tabeller får INGA rättigheter till API-rollerna
-- förrän vi själva ger dem - RLS-policyerna i 0001/0002 styr bara VILKA RADER en roll
-- får se, inte OM rollen får röra tabellen alls. Den delen saknades.
--
-- `anon` (utloggade besökare) får medvetet ingenting - all åtkomst kräver inloggning.
-- `authenticated` får CRUD, begränsat av RLS-policyerna (org-medlemskap).

grant select, insert, update, delete on
  orgs, org_members, org_invites, org_settings, material_rows, projects, historik
to authenticated;
