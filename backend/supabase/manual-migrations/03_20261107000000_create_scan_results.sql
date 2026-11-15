create table if not exists public.scan_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_type text not null check (scan_type in ('url', 'sms', 'email', 'qr')),
  risk_score smallint not null check (risk_score between 0 and 100),
  risk_level text not null check (
    risk_level in ('Low Risk', 'Medium Risk', 'High Risk', 'Critical Risk')
  ),
  verdict text not null check (
    verdict in ('Likely Safe', 'Suspicious', 'Likely Malicious', 'Inconclusive')
  ),
  confidence smallint not null check (confidence between 0 and 100),
  findings jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  checks_performed jsonb not null default '[]'::jsonb,
  checks_unavailable jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists scan_results_user_created_idx
  on public.scan_results (user_id, created_at desc);
create index if not exists scan_results_user_type_created_idx
  on public.scan_results (user_id, scan_type, created_at desc);

alter table public.scan_results enable row level security;
revoke all on table public.scan_results from public, anon, authenticated;
grant select, insert, delete on table public.scan_results to authenticated;

drop policy if exists "Users can read their own scans" on public.scan_results;
create policy "Users can read their own scans"
  on public.scan_results
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can insert their own scans" on public.scan_results;
create policy "Users can insert their own scans"
  on public.scan_results
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own scans" on public.scan_results;
create policy "Users can delete their own scans"
  on public.scan_results
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

notify pgrst, 'reload schema';
