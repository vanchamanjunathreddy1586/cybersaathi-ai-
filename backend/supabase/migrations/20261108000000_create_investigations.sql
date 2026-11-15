create table if not exists public.investigations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.investigation_events (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null check (
    event_type in ('created', 'updated', 'status_changed', 'note', 'evidence_added', 'evidence_removed')
  ),
  summary text not null check (char_length(summary) between 1 and 2000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (investigation_id, user_id)
    references public.investigations (id, user_id) on delete cascade
);

create table if not exists public.investigation_evidence (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  object_path text not null unique check (char_length(object_path) <= 512),
  mime_type text not null check (mime_type in (
    'application/json',
    'application/pdf',
    'message/rfc822',
    'text/csv',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp'
  )),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (investigation_id, user_id)
    references public.investigations (id, user_id) on delete cascade
);

create index if not exists investigations_user_updated_idx
  on public.investigations (user_id, updated_at desc);
create index if not exists investigation_events_case_created_idx
  on public.investigation_events (investigation_id, created_at);
create index if not exists investigation_evidence_case_created_idx
  on public.investigation_evidence (investigation_id, created_at);

alter table public.investigations enable row level security;
alter table public.investigation_events enable row level security;
alter table public.investigation_evidence enable row level security;

revoke all on table public.investigations, public.investigation_events, public.investigation_evidence
  from public, anon, authenticated;
grant select, insert, update, delete on table public.investigations to authenticated;
grant select, insert on table public.investigation_events to authenticated;
grant select, insert, delete on table public.investigation_evidence to authenticated;

drop policy if exists "Users manage their own investigations" on public.investigations;
create policy "Users manage their own investigations"
  on public.investigations for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users read their own investigation events" on public.investigation_events;
create policy "Users read their own investigation events"
  on public.investigation_events for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users add their own investigation events" on public.investigation_events;
create policy "Users add their own investigation events"
  on public.investigation_events for insert to authenticated
  with check (user_id = (select auth.uid()) and event_type = 'note');

drop policy if exists "Users read their own investigation evidence" on public.investigation_evidence;
create policy "Users read their own investigation evidence"
  on public.investigation_evidence for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users add their own investigation evidence" on public.investigation_evidence;
create policy "Users add their own investigation evidence"
  on public.investigation_evidence for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users delete their own investigation evidence" on public.investigation_evidence;
create policy "Users delete their own investigation evidence"
  on public.investigation_evidence for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.touch_investigation_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists investigations_touch_updated_at on public.investigations;
create trigger investigations_touch_updated_at
  before update on public.investigations
  for each row execute function public.touch_investigation_updated_at();

create or replace function public.record_investigation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.investigation_events (investigation_id, user_id, event_type, summary)
    values (new.id, new.user_id, 'created', 'Investigation created');
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.investigation_events (investigation_id, user_id, event_type, summary)
    values (new.id, new.user_id, 'status_changed', 'Status changed to ' || new.status);
  elsif old.title is distinct from new.title or old.description is distinct from new.description then
    insert into public.investigation_events (investigation_id, user_id, event_type, summary)
    values (new.id, new.user_id, 'updated', 'Investigation details updated');
  end if;
  return new;
end;
$$;
revoke all on function public.record_investigation_change() from public, anon, authenticated;

drop trigger if exists investigations_record_change on public.investigations;
create trigger investigations_record_change
  after insert or update on public.investigations
  for each row execute function public.record_investigation_change();

create or replace function public.record_investigation_evidence_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.investigation_events (
      investigation_id, user_id, event_type, summary, metadata
    )
    values (
      new.investigation_id,
      new.user_id,
      'evidence_added',
      'Evidence added: ' || left(new.file_name, 240),
      jsonb_build_object('evidenceId', new.id)
    );
    return new;
  end if;

  insert into public.investigation_events (
    investigation_id, user_id, event_type, summary, metadata
  )
  values (
    old.investigation_id,
    old.user_id,
    'evidence_removed',
    'Evidence removed: ' || left(old.file_name, 240),
    jsonb_build_object('evidenceId', old.id)
  );
  return old;
end;
$$;
revoke all on function public.record_investigation_evidence_change() from public, anon, authenticated;

drop trigger if exists investigation_evidence_record_change on public.investigation_evidence;
create trigger investigation_evidence_record_change
  after insert or delete on public.investigation_evidence
  for each row execute function public.record_investigation_evidence_change();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'investigation-evidence',
  'investigation-evidence',
  false,
  10485760,
  array[
    'application/json',
    'application/pdf',
    'message/rfc822',
    'text/csv',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read their own investigation evidence files" on storage.objects;
create policy "Users can read their own investigation evidence files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'investigation-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.investigations i
      where i.id::text = (storage.foldername(name))[2]
        and i.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can upload their own investigation evidence files" on storage.objects;
create policy "Users can upload their own investigation evidence files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'investigation-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.investigations i
      where i.id::text = (storage.foldername(name))[2]
        and i.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can delete their own investigation evidence files" on storage.objects;
create policy "Users can delete their own investigation evidence files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'investigation-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.investigations i
      where i.id::text = (storage.foldername(name))[2]
        and i.user_id = (select auth.uid())
    )
  );

notify pgrst, 'reload schema';
