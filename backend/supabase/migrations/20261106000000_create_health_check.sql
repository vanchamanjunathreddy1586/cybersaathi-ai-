create table if not exists public.health_check (
  id smallint primary key check (id = 1)
);

alter table public.health_check enable row level security;

revoke all on table public.health_check from public, anon, authenticated;
grant select on table public.health_check to anon;

drop policy if exists "Allow health check row read" on public.health_check;
create policy "Allow health check row read"
  on public.health_check
  for select
  to anon
  using (id = 1);

insert into public.health_check (id)
values (1)
on conflict (id) do nothing;
