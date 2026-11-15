create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (
    char_length(endpoint) between 1 and 2048
    and endpoint ~* '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|notify\.windows\.com|wns[0-9]+-[a-z0-9-]+\.notify\.windows\.com)/'
  ),
  p256dh text not null check (char_length(p256dh) between 1 and 256),
  auth text not null check (char_length(auth) between 1 and 256),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists web_push_subscriptions_user_idx
  on public.web_push_subscriptions (user_id);

alter table public.web_push_subscriptions enable row level security;
revoke all on public.web_push_subscriptions from public, anon, authenticated;
grant select, insert, delete on public.web_push_subscriptions to authenticated;

drop policy if exists "Users read their own web push subscriptions"
  on public.web_push_subscriptions;
create policy "Users read their own web push subscriptions"
  on public.web_push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users add their own web push subscriptions"
  on public.web_push_subscriptions;
create policy "Users add their own web push subscriptions"
  on public.web_push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users remove their own web push subscriptions"
  on public.web_push_subscriptions;
create policy "Users remove their own web push subscriptions"
  on public.web_push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));
