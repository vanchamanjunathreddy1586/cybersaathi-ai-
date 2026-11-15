create table if not exists public.app_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null,
  file_size_bytes bigint not null,
  sha256 text not null,
  package_name text not null,
  app_label text,
  version_name text,
  version_code text,
  min_sdk integer,
  target_sdk integer,
  risk_score smallint not null check (risk_score between 0 and 100),
  risk_level text not null check (
    risk_level in ('Low Risk', 'Medium Risk', 'High Risk', 'Critical Risk')
  ),
  verdict text not null check (
    verdict in ('Likely Safe', 'Suspicious', 'Likely Malicious', 'Inconclusive')
  ),
  declared_permissions jsonb not null default '[]'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  components_summary jsonb not null default '{}'::jsonb,
  threat_reputation jsonb not null default '{}'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_scans_user_created_idx
  on public.app_scans (user_id, created_at desc);
create index if not exists app_scans_sha256_idx
  on public.app_scans (sha256);

alter table public.app_scans enable row level security;
revoke all on table public.app_scans from public, anon, authenticated;
grant select, insert, delete on table public.app_scans to authenticated;

drop policy if exists "Users can read their own app scans" on public.app_scans;
create policy "Users can read their own app scans"
  on public.app_scans
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can insert their own app scans" on public.app_scans;
create policy "Users can insert their own app scans"
  on public.app_scans
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own app scans" on public.app_scans;
create policy "Users can delete their own app scans"
  on public.app_scans
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

notify pgrst, 'reload schema';
