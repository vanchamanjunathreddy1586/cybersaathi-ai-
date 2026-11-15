create table if not exists public.security_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in (
    'suspicious_url',
    'high_risk_scan',
    'investigation_update',
    'evidence_added'
  )),
  severity text not null check (severity in ('medium', 'high', 'critical')),
  title text not null check (char_length(title) between 1 and 160),
  summary text not null check (char_length(summary) between 1 and 500),
  entity_type text not null check (entity_type in ('scan', 'investigation')),
  entity_id text not null,
  source_id uuid not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists security_alerts_user_created_idx
  on public.security_alerts (user_id, created_at desc);
create index if not exists security_alerts_user_unread_idx
  on public.security_alerts (user_id, created_at desc)
  where read_at is null;

alter table public.security_alerts enable row level security;
revoke all on public.security_alerts from public, anon, authenticated;
grant select, delete on public.security_alerts to authenticated;
grant update (read_at) on public.security_alerts to authenticated;

drop policy if exists "Users can read their own security alerts" on public.security_alerts;
create policy "Users can read their own security alerts"
  on public.security_alerts for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Users can mark their own security alerts read" on public.security_alerts;
create policy "Users can mark their own security alerts read"
  on public.security_alerts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists "Users can delete their own security alerts" on public.security_alerts;
create policy "Users can delete their own security alerts"
  on public.security_alerts for delete to authenticated
  using (user_id = (select auth.uid()));

create table if not exists public.user_notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  critical_alerts boolean not null default true,
  high_risk_alerts boolean not null default true,
  investigation_updates boolean not null default true,
  community_notifications boolean not null default true,
  learning_reminders boolean not null default false,
  browser_notifications boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_notification_preferences enable row level security;
revoke all on public.user_notification_preferences from public, anon, authenticated;
grant select, insert, update on public.user_notification_preferences to authenticated;

drop policy if exists "Users can read their own notification preferences" on public.user_notification_preferences;
create policy "Users can read their own notification preferences"
  on public.user_notification_preferences for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Users can create their own notification preferences" on public.user_notification_preferences;
create policy "Users can create their own notification preferences"
  on public.user_notification_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "Users can update their own notification preferences" on public.user_notification_preferences;
create policy "Users can update their own notification preferences"
  on public.user_notification_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.touch_notification_preferences_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.touch_notification_preferences_updated_at() from public, anon, authenticated;

drop trigger if exists user_notification_preferences_touch_updated_at
  on public.user_notification_preferences;
create trigger user_notification_preferences_touch_updated_at
  before update on public.user_notification_preferences
  for each row execute function public.touch_notification_preferences_updated_at();

create or replace function public.create_scan_security_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.risk_score < 30 then
    return new;
  end if;

  insert into public.security_alerts (
    user_id, category, severity, title, summary, entity_type, entity_id, source_id
  )
  values (
    new.user_id,
    case when new.scan_type in ('url', 'qr') then 'suspicious_url' else 'high_risk_scan' end,
    case
      when new.risk_score >= 80 then 'critical'
      when new.risk_score >= 60 then 'high'
      else 'medium'
    end,
    case
      when new.scan_type in ('url', 'qr') then 'Suspicious destination detected'
      else 'Suspicious scan result recorded'
    end,
    format(
      'A %s scan returned %s with a recorded risk score of %s/100.',
      new.scan_type,
      new.verdict,
      new.risk_score
    ),
    'scan',
    new.id::text,
    new.id
  ) on conflict (source_id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_scan_security_alert() from public, anon, authenticated;

drop trigger if exists scan_results_create_security_alert on public.scan_results;
create trigger scan_results_create_security_alert
  after insert on public.scan_results
  for each row execute function public.create_scan_security_alert();

create or replace function public.create_investigation_security_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_type = 'evidence_added' then
    insert into public.security_alerts (
      user_id, category, severity, title, summary, entity_type, entity_id, source_id
    )
    values (
      new.user_id,
      'evidence_added',
      'medium',
      'Investigation evidence added',
      'New evidence was added to one of your investigations.',
      'investigation',
      new.investigation_id::text,
      new.id
    ) on conflict (source_id) do nothing;
  elsif new.event_type = 'status_changed' then
    insert into public.security_alerts (
      user_id, category, severity, title, summary, entity_type, entity_id, source_id
    )
    values (
      new.user_id,
      'investigation_update',
      'medium',
      'Investigation status updated',
      'The status of one of your investigations changed.',
      'investigation',
      new.investigation_id::text,
      new.id
    ) on conflict (source_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.create_investigation_security_alert() from public, anon, authenticated;

drop trigger if exists investigation_events_create_security_alert on public.investigation_events;
create trigger investigation_events_create_security_alert
  after insert on public.investigation_events
  for each row execute function public.create_investigation_security_alert();

insert into public.security_alerts (
  user_id, category, severity, title, summary, entity_type, entity_id, created_at, source_id
)
select
  scan.user_id,
  case when scan.scan_type in ('url', 'qr') then 'suspicious_url' else 'high_risk_scan' end,
  case
    when scan.risk_score >= 80 then 'critical'
    when scan.risk_score >= 60 then 'high'
    else 'medium'
  end,
  case
    when scan.scan_type in ('url', 'qr') then 'Suspicious destination detected'
    else 'Suspicious scan result recorded'
  end,
  format(
    'A %s scan returned %s with a recorded risk score of %s/100.',
    scan.scan_type,
    scan.verdict,
    scan.risk_score
  ),
  'scan',
  scan.id::text,
  scan.created_at,
  scan.id
from public.scan_results as scan
where scan.risk_score >= 30
on conflict (source_id) do nothing;

insert into public.security_alerts (
  user_id, category, severity, title, summary, entity_type, entity_id, created_at, source_id
)
select
  event.user_id,
  case when event.event_type = 'evidence_added' then 'evidence_added' else 'investigation_update' end,
  'medium',
  case
    when event.event_type = 'evidence_added' then 'Investigation evidence added'
    else 'Investigation status updated'
  end,
  case
    when event.event_type = 'evidence_added' then 'New evidence was added to one of your investigations.'
    else 'The status of one of your investigations changed.'
  end,
  'investigation',
  event.investigation_id::text,
  event.created_at,
  event.id
from public.investigation_events as event
where event.event_type in ('evidence_added', 'status_changed')
on conflict (source_id) do nothing;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'security_alerts'
  ) then
    alter publication supabase_realtime add table public.security_alerts;
  end if;
end
$$;

notify pgrst, 'reload schema';
