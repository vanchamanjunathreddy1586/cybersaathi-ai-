-- CYBERSAATHI AI: Allow authenticated users to perform health check queries
-- File: backend/supabase/migrations/20261117000000_allow_authenticated_health_check.sql

grant select on table public.health_check to authenticated;

drop policy if exists "Allow health check row read" on public.health_check;
create policy "Allow health check row read"
  on public.health_check
  for select
  to anon, authenticated
  using (id = 1);

notify pgrst, 'reload schema';
