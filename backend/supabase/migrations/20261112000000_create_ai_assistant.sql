create table if not exists public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New conversation'
    check (char_length(title) between 1 and 120),
  language text not null default 'en'
    check (language in ('en', 'te', 'hi')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  message_order bigint generated always as identity unique,
  conversation_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  language text not null check (language in ('en', 'te', 'hi')),
  context_used text[] not null default '{}'
    check (context_used <@ array['scan', 'investigation', 'academy']::text[]),
  created_at timestamptz not null default now(),
  foreign key (conversation_id, user_id)
    references public.assistant_conversations (id, user_id) on delete cascade
);

create index if not exists assistant_conversations_user_updated_idx
  on public.assistant_conversations (user_id, updated_at desc);
create index if not exists assistant_messages_conversation_created_idx
  on public.assistant_messages (conversation_id, created_at);
create index if not exists assistant_messages_conversation_order_idx
  on public.assistant_messages (conversation_id, message_order);
create index if not exists assistant_messages_user_created_idx
  on public.assistant_messages (user_id, created_at desc);

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;

revoke all on public.assistant_conversations, public.assistant_messages
  from public, anon, authenticated;
grant select, insert, update, delete on public.assistant_conversations to authenticated;
grant select, insert, delete on public.assistant_messages to authenticated;

drop policy if exists "Users manage their own assistant conversations"
  on public.assistant_conversations;
create policy "Users manage their own assistant conversations"
  on public.assistant_conversations for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users read their own assistant messages"
  on public.assistant_messages;
create policy "Users read their own assistant messages"
  on public.assistant_messages for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users add messages to their own conversations"
  on public.assistant_messages;
create policy "Users add messages to their own conversations"
  on public.assistant_messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.assistant_conversations as conversation
      where conversation.id = conversation_id
        and conversation.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users delete their own assistant messages"
  on public.assistant_messages;
create policy "Users delete their own assistant messages"
  on public.assistant_messages for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.touch_assistant_conversation_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists assistant_conversations_touch_updated_at
  on public.assistant_conversations;
create trigger assistant_conversations_touch_updated_at
  before update on public.assistant_conversations
  for each row execute function public.touch_assistant_conversation_updated_at();

create or replace function public.get_assistant_learning_context(p_course_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  latest_attempt public.user_quiz_attempts%rowtype;
  completed_count integer;
  reviewed_questions jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_course_id is null or not exists (
    select 1 from public.academy_courses where id = p_course_id
  ) then
    raise exception 'Course not found';
  end if;

  select count(*) into completed_count
  from public.user_lesson_progress as progress
  join public.academy_lessons as lesson on lesson.id = progress.lesson_id
  where progress.user_id = current_user_id
    and lesson.course_id = p_course_id;

  select attempt.* into latest_attempt
  from public.user_quiz_attempts as attempt
  where attempt.user_id = current_user_id
    and attempt.course_id = p_course_id
  order by attempt.created_at desc
  limit 1;

  if found then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'questionId', question.id,
          'prompt', question.prompt,
          'options', question.options,
          'submittedOptionIds', latest_attempt.answers -> question.id,
          'correctOptionIds', question.correct_option_ids,
          'explanation', question.explanation
        )
        order by question.id
      ),
      '[]'::jsonb
    )
    into reviewed_questions
    from public.academy_questions as question
    where question.course_id = p_course_id
      and latest_attempt.answers ? question.id;
  else
    reviewed_questions := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'completedLessonCount', completed_count,
    'latestQuizAttempt', case
      when latest_attempt.id is null then null
      else jsonb_build_object(
        'score', latest_attempt.score,
        'createdAt', latest_attempt.created_at,
        'questions', reviewed_questions
      )
    end
  );
end;
$$;

revoke all on function public.get_assistant_learning_context(text) from public, anon;
grant execute on function public.get_assistant_learning_context(text) to authenticated;

notify pgrst, 'reload schema';
