create table if not exists public.academy_courses (
  id text primary key,
  title text not null,
  description text not null,
  display_order smallint not null unique
);

create table if not exists public.academy_lessons (
  id text primary key,
  course_id text not null references public.academy_courses (id) on delete cascade,
  title text not null,
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  duration_minutes smallint not null check (duration_minutes between 1 and 180),
  objectives jsonb not null check (jsonb_typeof(objectives) = 'array'),
  explanation text not null,
  practical_example text not null,
  important_concepts jsonb not null check (jsonb_typeof(important_concepts) = 'array'),
  scenario text not null,
  key_takeaways jsonb not null check (jsonb_typeof(key_takeaways) = 'array'),
  display_order smallint not null,
  unique (course_id, difficulty),
  unique (course_id, display_order),
  unique (course_id, id)
);

create index if not exists academy_lessons_course_order_idx
  on public.academy_lessons (course_id, display_order);

create table if not exists public.academy_questions (
  id text primary key,
  course_id text not null references public.academy_courses (id) on delete cascade,
  lesson_id text not null,
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  prompt text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2),
  correct_option_ids text[] not null check (cardinality(correct_option_ids) > 0),
  explanation text not null,
  multiple_select boolean not null default false,
  foreign key (course_id, lesson_id)
    references public.academy_lessons (course_id, id) on delete cascade
);

create index if not exists academy_questions_course_difficulty_idx
  on public.academy_questions (course_id, difficulty);

create table if not exists public.user_lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null references public.academy_lessons (id) on delete cascade,
  completed_at timestamptz not null default now(),
  time_spent_seconds integer not null default 0 check (time_spent_seconds between 0 and 7200),
  primary key (user_id, lesson_id)
);

create index if not exists user_lesson_progress_user_completed_idx
  on public.user_lesson_progress (user_id, completed_at desc);

create table if not exists public.user_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null references public.academy_courses (id) on delete cascade,
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  correct_count smallint not null check (correct_count >= 0),
  total_questions smallint not null check (total_questions > 0),
  score smallint not null check (score between 0 and 100),
  created_at timestamptz not null default now()
);

create index if not exists user_quiz_attempts_user_created_idx
  on public.user_quiz_attempts (user_id, created_at desc);
create index if not exists user_quiz_attempts_user_course_idx
  on public.user_quiz_attempts (user_id, course_id, created_at desc);

create table if not exists public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_key text not null,
  title text not null,
  description text not null,
  points integer not null check (points >= 0),
  awarded_at timestamptz not null default now(),
  primary key (user_id, achievement_key)
);

create table if not exists public.user_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null references public.academy_courses (id) on delete cascade,
  student_name text not null,
  certificate_reference text not null unique,
  completed_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create index if not exists user_certificates_user_idx
  on public.user_certificates (user_id, completed_at desc);

alter table public.academy_courses enable row level security;
alter table public.academy_lessons enable row level security;
alter table public.academy_questions enable row level security;
alter table public.user_lesson_progress enable row level security;
alter table public.user_quiz_attempts enable row level security;
alter table public.user_achievements enable row level security;
alter table public.user_certificates enable row level security;

revoke all on public.academy_courses, public.academy_lessons, public.academy_questions,
  public.user_lesson_progress, public.user_quiz_attempts, public.user_achievements,
  public.user_certificates from public, anon, authenticated;
grant select on public.academy_courses, public.academy_lessons to authenticated;
grant select (id, course_id, lesson_id, difficulty, prompt, options, multiple_select)
  on public.academy_questions to authenticated;
grant select on public.user_lesson_progress, public.user_quiz_attempts,
  public.user_achievements, public.user_certificates to authenticated;

drop policy if exists "Authenticated users can browse academy courses" on public.academy_courses;
create policy "Authenticated users can browse academy courses"
  on public.academy_courses for select to authenticated using (true);
drop policy if exists "Authenticated users can browse academy lessons" on public.academy_lessons;
create policy "Authenticated users can browse academy lessons"
  on public.academy_lessons for select to authenticated using (true);
drop policy if exists "Authenticated users can browse academy questions" on public.academy_questions;
create policy "Authenticated users can browse academy questions"
  on public.academy_questions for select to authenticated using (true);

drop policy if exists "Users can read their own academy lesson progress" on public.user_lesson_progress;
create policy "Users can read their own academy lesson progress"
  on public.user_lesson_progress for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Users can read their own academy quiz attempts" on public.user_quiz_attempts;
create policy "Users can read their own academy quiz attempts"
  on public.user_quiz_attempts for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Users can read their own academy achievements" on public.user_achievements;
create policy "Users can read their own academy achievements"
  on public.user_achievements for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Users can read their own academy certificates" on public.user_certificates;
create policy "Users can read their own academy certificates"
  on public.user_certificates for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.complete_academy_lesson(
  p_lesson_id text,
  p_time_spent_seconds integer
)
returns table (completed boolean, completed_count integer, course_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  lesson_course_id text;
  lesson_title text;
  inserted_count integer;
  lesson_count integer;
  course_lesson_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_time_spent_seconds is null or p_time_spent_seconds < 0 or p_time_spent_seconds > 7200 then
    raise exception 'Invalid lesson duration';
  end if;

  select lesson.course_id, lesson.title into lesson_course_id, lesson_title
  from public.academy_lessons as lesson where lesson.id = p_lesson_id;
  if lesson_course_id is null then
    raise exception 'Lesson not found';
  end if;

  insert into public.user_lesson_progress (user_id, lesson_id, time_spent_seconds)
  values (current_user_id, p_lesson_id, p_time_spent_seconds)
  on conflict (user_id, lesson_id) do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 1 then
    insert into public.user_achievements (user_id, achievement_key, title, description, points)
    values (current_user_id, 'lesson:' || p_lesson_id, 'Lesson complete', 'Completed ' || lesson_title, 10)
    on conflict (user_id, achievement_key) do nothing;
  end if;

  select count(*) into lesson_count
  from public.user_lesson_progress as progress
  join public.academy_lessons as lesson on lesson.id = progress.lesson_id
  where progress.user_id = current_user_id and lesson.course_id = lesson_course_id;
  select count(*) into course_lesson_count
  from public.academy_lessons as lesson where lesson.course_id = lesson_course_id;

  if course_lesson_count > 0 and lesson_count = course_lesson_count then
    insert into public.user_achievements (user_id, achievement_key, title, description, points)
    select current_user_id, 'course:' || course.id, 'Course lessons complete',
      'Completed all lessons in ' || course.title, 25
    from public.academy_courses as course where course.id = lesson_course_id
    on conflict (user_id, achievement_key) do nothing;
  end if;

  return query select inserted_count = 1, lesson_count, lesson_course_id;
end;
$$;

revoke all on function public.complete_academy_lesson(text, integer) from public, anon;
grant execute on function public.complete_academy_lesson(text, integer) to authenticated;

create or replace function public.submit_academy_quiz(
  p_course_id text,
  p_answers jsonb
)
returns table (
  attempt_id uuid,
  correct_count integer,
  total_questions integer,
  score integer,
  explanations jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  question_row record;
  submitted_ids text[];
  correct_total integer := 0;
  question_total integer := 0;
  new_attempt_id uuid;
  final_score integer;
  answer_explanations jsonb := '[]'::jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Invalid quiz answers';
  end if;
  if not exists (select 1 from public.academy_courses as course where course.id = p_course_id) then
    raise exception 'Course not found';
  end if;

  for question_row in
    select question.id, question.correct_option_ids, question.explanation,
      question.course_id, question.options
    from public.academy_questions as question
    where question.course_id = p_course_id
  loop
    question_total := question_total + 1;
    if not (p_answers ? question_row.id)
      or jsonb_typeof(p_answers -> question_row.id) is distinct from 'array' then
      raise exception 'Every quiz question must have an answer';
    end if;
    if jsonb_array_length(p_answers -> question_row.id) = 0 then
      raise exception 'Every quiz question must have an answer';
    end if;
    select coalesce(array_agg(value order by value), array[]::text[])
      into submitted_ids
      from jsonb_array_elements_text(p_answers -> question_row.id) as answer(value);
    if exists (
      select 1 from unnest(submitted_ids) as answer(value)
      where not exists (
        select 1 from jsonb_array_elements(question_row.options) as option_row(value)
        where option_row.value ->> 'id' = answer.value
      )
    ) then
      raise exception 'Invalid answer option';
    end if;
    if submitted_ids = (select array_agg(value order by value) from unnest(question_row.correct_option_ids) as correct(value)) then
      correct_total := correct_total + 1;
    end if;
    answer_explanations := answer_explanations || jsonb_build_array(jsonb_build_object(
      'questionId', question_row.id,
      'correctOptionIds', question_row.correct_option_ids,
      'explanation', question_row.explanation
    ));
  end loop;

  if question_total = 0
    or (select count(*) from jsonb_object_keys(p_answers)) <> question_total then
    raise exception 'Quiz answer set is incomplete or invalid';
  end if;
  final_score := round((correct_total::numeric / question_total) * 100)::integer;

  insert into public.user_quiz_attempts (user_id, course_id, answers, correct_count, total_questions, score)
  values (current_user_id, p_course_id, p_answers, correct_total, question_total, final_score)
  returning id into new_attempt_id;

  if final_score >= 80 then
    insert into public.user_achievements (user_id, achievement_key, title, description, points)
    select current_user_id, 'quiz:' || course.id, 'Quiz passed', 'Passed the ' || course.title || ' knowledge check', 20
    from public.academy_courses as course where course.id = p_course_id
    on conflict (user_id, achievement_key) do nothing;
  end if;

  return query select new_attempt_id, correct_total, question_total, final_score, answer_explanations;
end;
$$;

revoke all on function public.submit_academy_quiz(text, jsonb) from public, anon;
grant execute on function public.submit_academy_quiz(text, jsonb) to authenticated;

create or replace function public.issue_academy_certificate(p_course_id text)
returns public.user_certificates
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  student_display_name text;
  required_lessons integer;
  completed_lessons integer;
  best_score integer;
  certificate public.user_certificates;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  select count(*) into required_lessons from public.academy_lessons as lesson
    where lesson.course_id = p_course_id;
  select count(*) into completed_lessons
    from public.user_lesson_progress as progress
    join public.academy_lessons as lesson on lesson.id = progress.lesson_id
    where progress.user_id = current_user_id and lesson.course_id = p_course_id;
  select max(attempt.score) into best_score from public.user_quiz_attempts as attempt
    where attempt.user_id = current_user_id and attempt.course_id = p_course_id;
  select profile.full_name into student_display_name from public.profiles as profile
    where profile.id = current_user_id;

  if required_lessons = 0 or completed_lessons <> required_lessons or coalesce(best_score, 0) < 80 then
    raise exception 'Certificate requirements are not met';
  end if;
  if student_display_name is null or char_length(btrim(student_display_name)) < 2 then
    raise exception 'A valid profile display name is required';
  end if;

  insert into public.user_certificates (user_id, course_id, student_name, certificate_reference)
  values (
    current_user_id,
    p_course_id,
    student_display_name,
    'CSAI-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  )
  on conflict (user_id, course_id) do nothing;
  select * into certificate from public.user_certificates as item
    where item.user_id = current_user_id and item.course_id = p_course_id;
  return certificate;
end;
$$;

revoke all on function public.issue_academy_certificate(text) from public, anon;
grant execute on function public.issue_academy_certificate(text) to authenticated;

insert into public.academy_courses (id, title, description, display_order) values
  ('cybersecurity-fundamentals', 'Cybersecurity Fundamentals', 'Build a practical foundation in protecting information, devices, and people.', 1),
  ('ethical-hacking-fundamentals', 'Ethical Hacking Fundamentals', 'Learn the boundaries, authorization, and defensive purpose behind security testing.', 2),
  ('network-security', 'Network Security', 'Understand network traffic, segmentation, secure configuration, and monitoring.', 3),
  ('web-application-security', 'Web Application Security', 'Recognize common web risks and the design practices that prevent them.', 4),
  ('phishing-scam-awareness', 'Phishing and Scam Awareness', 'Identify social engineering signals and verify suspicious requests safely.', 5),
  ('digital-forensics', 'Digital Forensics', 'Learn evidence preservation, timelines, integrity, and responsible analysis.', 6),
  ('password-account-security', 'Password and Account Security', 'Strengthen authentication with unique credentials, MFA, and recovery planning.', 7),
  ('mobile-security', 'Mobile Security', 'Protect mobile devices, app permissions, data, and accounts.', 8),
  ('cloud-security', 'Cloud Security', 'Apply identity, configuration, and data protection principles to cloud services.', 9),
  ('ai-security', 'AI Security', 'Understand AI-specific risks, data boundaries, and safe, responsible use.', 10)
on conflict (id) do update set title = excluded.title, description = excluded.description,
  display_order = excluded.display_order;

insert into public.academy_lessons
  (id, course_id, title, difficulty, duration_minutes, objectives, explanation, practical_example, important_concepts, scenario, key_takeaways, display_order)
values
  ('fundamentals-beginner', 'cybersecurity-fundamentals', 'The security triad: protect what matters', 'beginner', 12,
   '["Explain confidentiality, integrity, and availability","Identify a valuable digital asset"]',
   'Cybersecurity reduces the chance and impact of unauthorized access, unwanted changes, and service disruption. The CIA triad is a simple way to think about these goals: confidentiality limits who can see data, integrity helps keep it accurate, and availability keeps it usable when needed.',
   'A clinic protects patient files with access controls (confidentiality), audit logs (integrity), and tested backups (availability). No single control solves every risk.',
   '["Confidentiality","Integrity","Availability","Risk"]',
   'A small business laptop is stolen. Device encryption can protect confidentiality; a separate backup helps restore availability.',
   '["Start with the information or service that matters.","Security balances confidentiality, integrity, and availability.","Controls reduce risk; they do not make risk disappear."]', 1),
  ('fundamentals-intermediate', 'cybersecurity-fundamentals', 'Threats, vulnerabilities, and layered controls', 'intermediate', 16,
   '["Distinguish a threat from a vulnerability","Describe defense in depth"]',
   'A threat is a potential cause of harm; a vulnerability is a weakness that could be used; risk combines likelihood and impact. Defense in depth uses independent safeguards so one missed control does not become a complete failure.',
   'For a shared account, replacing it with named accounts, requiring MFA, limiting permissions, and reviewing sign-in alerts create several independent barriers.',
   '["Threat","Vulnerability","Impact","Likelihood","Defense in depth"]',
   'An employee receives a convincing invoice request. Approval checks and a second verified communication channel can stop a single deceptive message from causing a payment.',
   '["A vulnerability is not proof of compromise.","Prioritize by likely impact and exposure.","Layer controls across people, process, and technology."]', 2),
  ('fundamentals-advanced', 'cybersecurity-fundamentals', 'Build a measurable security program', 'advanced', 20,
   '["Map controls to business risks","Choose useful security measurements"]',
   'A mature security program connects assets, threats, controls, owners, and evidence. Measure whether controls work, not just whether they exist. Metrics should support decisions and be reviewed for blind spots.',
   'Track the percentage of critical accounts with phishing-resistant MFA and the time needed to revoke access after a role change; define owners and review cadence.',
   '["Risk register","Control owner","Coverage metric","Residual risk"]',
   'A team reports that every server has a backup policy, but restore tests fail. A recovery-time measure reveals the operational gap.',
   '["Tie controls to explicit risks and owners.","Test controls under realistic conditions.","Document remaining risk and revisit it regularly."]', 3),

  ('ethical-hacking-beginner', 'ethical-hacking-fundamentals', 'Authorization and scope come first', 'beginner', 12,
   '["Explain why written authorization is required","Identify the limits of an agreed scope"]',
   'Ethical security testing is a permission-based activity. Before any test, the owner and tester agree on systems, dates, methods, data handling, contacts, and stop conditions. A public address or login page is not permission.',
   'A written lab scope might identify a local training VM and explicitly exclude the home router and internet-facing systems.',
   '["Written authorization","Scope","Rules of engagement","Stop condition"]',
   'A tester notices a neighboring service while working in a training environment. The correct action is to stop and ask the authorized owner, not to probe it.',
   '["Permission must be explicit and current.","Stay inside the named scope.","Stop and report unexpected impact."]', 1),
  ('ethical-hacking-intermediate', 'ethical-hacking-fundamentals', 'Plan a safe security assessment', 'intermediate', 16,
   '["Create a bounded test plan","Describe safe evidence handling and reporting"]',
   'A responsible assessment begins with objectives and a low-impact plan. Agree on test windows, rate limits, test accounts, data minimization, escalation contacts, and how findings will be verified and remediated.',
   'Use synthetic records and a staging environment; capture only the minimum evidence needed to describe a finding.',
   '["Test plan","Least impact","Synthetic data","Finding severity"]',
   'A test causes elevated error rates. A pre-agreed stop signal and contact allow the team to suspend work before users are affected.',
   '["Prefer isolated, non-production environments.","Collect the least sensitive evidence possible.","Report reproducible facts and remediation guidance."]', 2),
  ('ethical-hacking-advanced', 'ethical-hacking-fundamentals', 'Translate findings into remediation', 'advanced', 20,
   '["Prioritize findings using context","Write a useful, evidence-based report"]',
   'A finding is actionable when it explains affected assets, verified evidence, likely impact, constraints, and a proportionate fix. Severity is contextual: exposure, reachable privileges, affected users, and compensating controls matter.',
   'A report can pair a sanitized reproduction in a lab with the vulnerable design, affected component version, and a fix-validation checklist.',
   '["Evidence quality","Business impact","Remediation owner","Retest"]',
   'A high scanner score is contradicted by a tested network boundary. Document both the signal and the control evidence instead of overstating impact.',
   '["Separate observation from assumption.","Prioritize by context and impact.","Retest fixes within the authorized scope."]', 3),

  ('network-security-beginner', 'network-security', 'How devices communicate', 'beginner', 12,
   '["Describe a client, server, and network path","Explain why unknown networks deserve caution"]',
   'Devices exchange data through networks using addresses and protocols. A home router separates a local network from the wider internet, but encryption and authentication are still needed because traffic may cross networks you do not control.',
   'HTTPS protects a web connection in transit when certificates are valid; it does not prove that a page is honest or that a device is malware-free.',
   '["Client and server","IP address","Router","Encryption in transit"]',
   'On public Wi-Fi, a user opens a bookmarked banking site and checks the exact domain and HTTPS certificate before signing in.',
   '["Networks carry data across multiple devices.","Use trusted, encrypted services.","A secure connection does not establish a site’s trustworthiness."]', 1),
  ('network-security-intermediate', 'network-security', 'Segmentation and least privilege', 'intermediate', 16,
   '["Explain how segmentation limits exposure","Choose controls for administrative access"]',
   'Network segmentation places systems with different needs into controlled zones. Rules should allow only required communication. Administrative access should use named accounts, strong authentication, and monitored management paths.',
   'A guest Wi-Fi network should not be able to reach employee file shares or device-management interfaces.',
   '["Network zone","Allow-list rule","Management plane","Least privilege"]',
   'A compromised guest device is isolated from business systems by a separate network and restrictive routing rules.',
   '["Separate systems by trust and purpose.","Allow only necessary flows.","Protect and monitor administrative paths."]', 2),
  ('network-security-advanced', 'network-security', 'Monitor network signals responsibly', 'advanced', 20,
   '["Interpret basic network telemetry","Reduce false positives with context"]',
   'Defensive monitoring combines flow, DNS, authentication, and endpoint context. A single unusual connection is a lead, not a verdict. Retention, access, and privacy rules should define what is collected and who can review it.',
   'Compare an unexpected outbound connection with the device owner, approved software inventory, destination reputation, and change records before escalating.',
   '["Telemetry","Baseline","Signal versus finding","Retention"]',
   'A scheduled software update produces a new connection. Change records and endpoint inventory distinguish expected behavior from a real anomaly.',
   '["Correlate independent evidence.","Use a baseline but revisit it as systems change.","Limit collection and retention to a legitimate need."]', 3),

  ('web-security-beginner', 'web-application-security', 'How a browser and website share trust', 'beginner', 12,
   '["Describe a browser request and response","Recognize why input is untrusted"]',
   'A browser sends requests and renders responses. User input, URL parameters, uploaded files, and even data from another service must be treated as untrusted until validated and safely handled.',
   'A search term should be displayed as text, not inserted as executable markup. Context-aware output encoding preserves the user’s words without treating them as code.',
   '["Request and response","Input validation","Output encoding","Trust boundary"]',
   'A comment contains angle-bracket characters. The application stores it as data and renders it as text rather than interpreting markup.',
   '["Treat inputs as data, not instructions.","Validate at the boundary and encode on output.","Use framework protections rather than custom escaping."]', 1),
  ('web-security-intermediate', 'web-application-security', 'Prevent injection with safe data access', 'intermediate', 16,
   '["Explain how injection occurs","Choose parameterized data access"]',
   'Injection happens when data is merged into a command or query that a system interprets. Prepared statements keep query structure separate from values; allow-lists are useful for identifiers that cannot be parameterized.',
   'In a local teaching example, a parameterized query uses a placeholder such as `WHERE email = ?` and supplies the email as a separate value.',
   '["Code versus data","Parameterized query","Allow-list","Safe error handling"]',
   'A sign-in form receives punctuation and quotes. The database driver binds them as literal values rather than changing query structure.',
   '["Never build a query by concatenating user input.","Bind values with the database driver.","Use least-privilege database accounts."]', 2),
  ('web-security-advanced', 'web-application-security', 'Secure session and browser boundaries', 'advanced', 20,
   '["Describe secure cookie attributes","Explain cross-site request protections"]',
   'Sessions represent authenticated state and must be protected from theft and misuse. Secure, HttpOnly, and appropriate SameSite cookie settings reduce exposure; CSRF defenses and origin checks address browser request abuse.',
   'After privilege changes, rotate the session identifier and require reauthentication for high-impact account actions.',
   '["Session rotation","HttpOnly","SameSite","CSRF token"]',
   'A user clicks an external link while signed in. CSRF protections prevent that page from silently submitting an unwanted state-changing request.',
   '["Protect session tokens from scripts and transport exposure.","Use CSRF defenses for state-changing browser actions.","Recheck identity for sensitive operations."]', 3),

  ('phishing-beginner', 'phishing-scam-awareness', 'Pause, inspect, and verify', 'beginner', 12,
   '["Spot common social-engineering pressure","Verify a message through a separate channel"]',
   'Phishing uses deception to prompt unsafe actions. Urgency, secrecy, unexpected attachments, and requests for codes or payment are warning signs. A familiar logo or display name is not proof of identity.',
   'If a message claims to be from a bank, close the message and open the bank’s known app or type its saved address yourself.',
   '["Urgency","Impersonation","Unexpected request","Independent verification"]',
   'A colleague asks for a one-time sign-in code in chat. The safe response is never to share it and to verify the request through a known workplace channel.',
   '["Pause before clicking or replying.","Never share passwords or verification codes.","Verify requests using contact details you already trust."]', 1),
  ('phishing-intermediate', 'phishing-scam-awareness', 'Read links and sender details carefully', 'intermediate', 16,
   '["Distinguish a display name from an address","Identify misleading domain structures"]',
   'A link’s visible text may differ from its destination. Read the registrable domain from right to left, watch for lookalike characters and extra subdomains, and avoid opening unknown attachments. Do not rely on URL appearance alone.',
   'In a harmless practice URL, `signin.example.attacker.invalid` belongs to `attacker.invalid`, not `example`.',
   '["Display name","Registrable domain","Lookalike domain","Attachment risk"]',
   'A delivery notice links to an unfamiliar domain. The learner checks the courier’s official app rather than following the embedded link.',
   '["Inspect the actual domain, not only the link label.","Be cautious with unexpected files and QR codes.","Use a trusted app or bookmark to verify."]', 2),
  ('phishing-advanced', 'phishing-scam-awareness', 'Respond to suspected social engineering', 'advanced', 20,
   '["Preserve a suspicious message safely","Describe prompt reporting and account recovery"]',
   'When a message is suspicious, avoid forwarding it broadly or interacting with its links. Use the organization’s reporting process. If credentials were entered, contact the provider through a trusted channel, change the password, revoke sessions, and review MFA and account activity.',
   'Report a suspicious message with its original headers using the approved security mailbox; do not attach live malicious content to public chats.',
   '["Report channel","Message headers","Session revocation","Recovery"]',
   'An employee entered a password into a fake sign-in page. They report it immediately and use the legitimate site to reset credentials and revoke sessions.',
   '["Report early using approved channels.","Contain exposed accounts promptly.","Preserve evidence without spreading harmful links."]', 3),

  ('forensics-beginner', 'digital-forensics', 'Preserve before investigating', 'beginner', 12,
   '["Explain why evidence should not be altered","Record basic evidence context"]',
   'Digital evidence can change when a device is used. Record who collected it, when, from where, and how it was handled. Do not explore or copy data unless authorized and trained to do so.',
   'A learner notes the original filename, source, collection time, and responsible person before moving an approved sample into a read-only training folder.',
   '["Evidence integrity","Provenance","Authorization","Chain of custody"]',
   'A laptop may be relevant to an incident. The owner disconnects from networks only under the response team’s procedure and records the action.',
   '["Do not alter potential evidence casually.","Document every handling step.","Follow the organization’s authorized response process."]', 1),
  ('forensics-intermediate', 'digital-forensics', 'Build a reliable event timeline', 'intermediate', 16,
   '["Normalize timestamps with time zones","Separate recorded facts from hypotheses"]',
   'A timeline combines events from logs, devices, and user reports. Different clocks and time zones can create misleading order. Preserve original timestamps, record normalization assumptions, and link each claim to its source.',
   'Convert log timestamps to UTC for comparison while retaining the original value and the source system’s configured time zone.',
   '["Timestamp provenance","UTC normalization","Correlation","Confidence"]',
   'An account alert appears before a local log event. Checking clock drift and time-zone settings may explain the order without implying tampering.',
   '["Keep original timestamps.","Document conversions and uncertainty.","Treat a timeline as evidence, not proof of intent."]', 2),
  ('forensics-advanced', 'digital-forensics', 'Verify integrity and communicate limits', 'advanced', 20,
   '["Explain cryptographic hashes as integrity checks","State analysis limitations clearly"]',
   'A cryptographic hash can help determine whether a file changed between two measurements; it does not prove that the file is authentic or who created it. Reproducible procedures and documented limitations support trustworthy conclusions.',
   'Calculate a SHA-256 digest on an authorized training copy, record the tool and time, and compare it with a later digest of that same copy.',
   '["Cryptographic hash","Acquisition","Repeatability","Scope limitation"]',
   'Two files have matching hashes. This supports that their bytes match, but does not establish the history or meaning of either file.',
   '["A matching hash supports byte-for-byte integrity only.","Document tools, versions, and handling.","Avoid conclusions beyond the collected evidence."]', 3),

  ('passwords-beginner', 'password-account-security', 'Use unique passwords and a manager', 'beginner', 12,
   '["Explain why password reuse is risky","Choose a password-manager workflow"]',
   'A unique password limits the damage when a service is breached. A reputable password manager can create and store long, random passwords so people do not need to memorize a different secret for every site.',
   'Use a password manager to create a unique password for each account and protect the vault with a strong master passphrase and MFA.',
   '["Password reuse","Passphrase","Password manager","Credential stuffing"]',
   'A shopping site is breached. Unique credentials prevent the leaked password from opening the user’s email account.',
   '["Never reuse important passwords.","Use a password manager to generate unique secrets.","Protect recovery options and the manager account."]', 1),
  ('passwords-intermediate', 'password-account-security', 'Strengthen sign-in with MFA', 'intermediate', 16,
   '["Compare common MFA factors","Recognize the limits of one-time codes"]',
   'Multi-factor authentication combines different proof types, such as a secret and a device-bound approval. Authenticator apps and security keys can reduce some risks, but users should reject unexpected prompts and never share codes.',
   'A security key can help resist lookalike sign-in pages because it checks the site origin before responding.',
   '["MFA factor","Push fatigue","Passkey","Recovery code"]',
   'Repeated sign-in prompts arrive unexpectedly. The user denies them, changes the password from a trusted device, and reviews active sessions.',
   '["Prefer phishing-resistant authentication where available.","Deny prompts you did not initiate.","Store recovery codes securely and offline."]', 2),
  ('passwords-advanced', 'password-account-security', 'Design account recovery and access reviews', 'advanced', 20,
   '["Plan secure account recovery","Describe access review and session revocation"]',
   'Account security includes enrollment, recovery, device changes, and offboarding. Recovery must be usable without becoming a weaker bypass. Review active sessions and delegated access after suspected compromise or role changes.',
   'A recovery plan verifies identity through an established process, alerts the account owner, and revokes existing sessions after a confirmed takeover.',
   '["Recovery assurance","Session inventory","Delegated access","Offboarding"]',
   'A former contractor still has a shared token. A scheduled access review finds the stale credential and revokes it.',
   '["Secure recovery as carefully as sign-in.","Revoke sessions and tokens when risk changes.","Review access regularly and after role changes."]', 3),

  ('mobile-beginner', 'mobile-security', 'Secure a phone’s basics', 'beginner', 12,
   '["Enable a screen lock and updates","Explain why device backups matter"]',
   'A phone contains messages, payment apps, and account approvals. A strong screen lock, timely operating-system updates, device encryption, and a tested backup reduce the harm of loss or software flaws.',
   'Set an automatic lock, enable supported device encryption, install updates from system settings, and verify that the backup can be restored.',
   '["Screen lock","Device encryption","Updates","Backup"]',
   'A phone is lost during travel. A strong lock and remote account recovery protect data while the owner contacts the carrier and service providers.',
   '["Use a strong screen lock.","Install updates promptly.","Know how to locate, lock, and recover a lost device."]', 1),
  ('mobile-intermediate', 'mobile-security', 'Review apps and permissions', 'intermediate', 16,
   '["Evaluate app provenance","Limit permissions to the task"]',
   'Install apps only from trusted sources and review the developer, purpose, and update history. Grant camera, microphone, location, and contacts access only when needed; revoke access when circumstances change.',
   'A flashlight app has no clear need for contacts or continuous location access. Deny those permissions and remove the app if it behaves unexpectedly.',
   '["App provenance","Permission scope","Background access","Updates"]',
   'A navigation app requests location while in use. The user selects the narrowest setting that supports the feature.',
   '["Install from trusted sources.","Grant the least permission needed.","Revisit app permissions and remove unused apps."]', 2),
  ('mobile-advanced', 'mobile-security', 'Protect work data on personal devices', 'advanced', 20,
   '["Separate personal and managed data","Plan for device loss and access revocation"]',
   'Organizations can separate work and personal data using approved management controls. Clear privacy boundaries, encryption, remote removal of work data, and rapid access revocation protect both employees and company information.',
   'A managed work profile allows an administrator to remove corporate data without erasing an employee’s personal photos.',
   '["Work profile","Mobile device management","Selective wipe","Device compliance"]',
   'An employee leaves the organization. Their managed work profile and access tokens are revoked while personal content remains private.',
   '["Use approved device-management controls.","Separate work and personal information.","Revoke work access promptly when risk changes."]', 3),

  ('cloud-beginner', 'cloud-security', 'Shared responsibility in the cloud', 'beginner', 12,
   '["Explain shared responsibility","Identify customer-managed settings"]',
   'A cloud provider protects parts of the underlying service, while customers remain responsible for areas such as identities, data, and configuration. The exact boundary depends on the service model and contract.',
   'A managed database provider may operate the database host, while the customer still manages user roles, network exposure, and data retention.',
   '["Shared responsibility","Identity","Configuration","Data ownership"]',
   'A team assumes a storage service is private by default. Reviewing the actual access configuration prevents unintended public exposure.',
   '["Read the service-specific responsibility model.","Secure customer-controlled identities and data.","Verify actual configuration instead of assuming defaults."]', 1),
  ('cloud-intermediate', 'cloud-security', 'Identity and storage guardrails', 'intermediate', 16,
   '["Apply least privilege to cloud identities","Describe safe storage access controls"]',
   'Cloud identities often control many resources. Use named identities, short-lived credentials, narrowly scoped roles, MFA for administrators, and storage policies that explicitly limit intended access.',
   'A read-only reporting job receives permission to one required dataset rather than broad account-wide access.',
   '["Role-based access","Short-lived credentials","Storage policy","Audit log"]',
   'An old access key is found in a repository. Revoke it, investigate its use, and replace it with a managed identity instead of merely hiding the key.',
   '["Use least privilege and short-lived credentials.","Keep storage private unless sharing is explicitly required.","Audit access and rotate exposed credentials."]', 2),
  ('cloud-advanced', 'cloud-security', 'Detect drift and prepare recovery', 'advanced', 20,
   '["Describe configuration drift","Plan recovery with tested backups"]',
   'Cloud resources can change through consoles, automation, and service updates. Inventory, configuration policies, alerts, and infrastructure-as-code reviews help detect drift. Backups must be isolated and restoration tested against business recovery goals.',
   'Compare deployed storage policies to a reviewed baseline and alert on unexpected public access; periodically restore a backup in an isolated account.',
   '["Configuration drift","Policy as code","Immutable backup","Recovery objective"]',
   'A production setting changes outside the normal deployment pipeline. Audit records identify the change and a tested rollback plan restores the approved state.',
   '["Continuously validate important configuration.","Alert on high-impact changes.","Test isolated restores, not only backup creation."]', 3),

  ('ai-security-beginner', 'ai-security', 'Use AI without oversharing', 'beginner', 12,
   '["Identify sensitive data before using AI","Explain why generated answers need verification"]',
   'AI tools may process prompts according to their provider and organization settings. Do not enter credentials, private records, or confidential code unless policy explicitly permits it. AI output can be fluent and still be incorrect.',
   'Replace real customer names and identifiers with invented examples before asking for a general explanation.',
   '["Data classification","Prompt privacy","Hallucination","Human verification"]',
   'A user wants help with an internal incident report. They remove identifying details and use an approved tool, then verify every factual claim.',
   '["Follow your organization’s AI data policy.","Share the minimum necessary information.","Verify generated facts before acting on them."]', 1),
  ('ai-security-intermediate', 'ai-security', 'Recognize prompt injection and unsafe output', 'intermediate', 16,
   '["Explain prompt injection at a high level","Describe safe handling of untrusted AI output"]',
   'Prompt injection is an attempt to make a model ignore its intended task through hostile or misleading content. Treat retrieved documents and model output as untrusted data; do not let them independently authorize actions or access secrets.',
   'A summarizer labels instructions found inside a document as quoted content and never follows them as tool commands.',
   '["Untrusted input","Instruction hierarchy","Tool permission","Output validation"]',
   'A support chatbot reads a message telling it to reveal private records. Access controls remain outside the model and deny unauthorized data access.',
   '["Separate instructions from untrusted content.","Constrain tools and permissions outside the model.","Validate outputs before taking consequential actions."]', 2),
  ('ai-security-advanced', 'ai-security', 'Govern AI systems across their lifecycle', 'advanced', 20,
   '["Map AI data and tool boundaries","Describe evaluation and incident response"]',
   'AI security requires inventorying models, datasets, prompts, integrations, and data flows. Test realistic misuse cases, minimize tool permissions, log appropriate events, document limitations, and provide a human escalation path.',
   'Before deployment, evaluate whether a retrieval assistant can expose one user’s documents to another, then verify tenant authorization at the data layer.',
   '["Model inventory","Data lineage","Tenant isolation","Red-team evaluation"]',
   'A model update changes its behavior. Versioned evaluations and rollback plans allow the team to detect and contain regressions.',
   '["Secure the surrounding system, not just the model.","Test authorization and data isolation directly.","Monitor changes and maintain a safe fallback."]', 3)
on conflict (id) do update set
  course_id = excluded.course_id, title = excluded.title, difficulty = excluded.difficulty,
  duration_minutes = excluded.duration_minutes, objectives = excluded.objectives,
  explanation = excluded.explanation, practical_example = excluded.practical_example,
  important_concepts = excluded.important_concepts, scenario = excluded.scenario,
  key_takeaways = excluded.key_takeaways, display_order = excluded.display_order;

insert into public.academy_questions
  (id, course_id, lesson_id, difficulty, prompt, options, correct_option_ids, explanation, multiple_select)
values
  ('q-fund-beginner', 'cybersecurity-fundamentals', 'fundamentals-beginner', 'beginner', 'Which security goal helps ensure a file has not been changed without authorization?', '[{"id":"a","text":"Confidentiality"},{"id":"b","text":"Integrity"},{"id":"c","text":"Availability"}]', array['b'], 'Integrity is the goal of preserving the accuracy and completeness of information.', false),
  ('q-fund-intermediate', 'cybersecurity-fundamentals', 'fundamentals-intermediate', 'intermediate', 'Which statement best describes defense in depth?', '[{"id":"a","text":"Rely on one strong perimeter control"},{"id":"b","text":"Use independent safeguards so one failure is not decisive"},{"id":"c","text":"Block all user access"}]', array['b'], 'Layered, independent controls reduce reliance on any single safeguard.', false),
  ('q-fund-advanced', 'cybersecurity-fundamentals', 'fundamentals-advanced', 'advanced', 'Which measures can provide useful evidence that recovery controls work?', '[{"id":"a","text":"A written backup policy"},{"id":"b","text":"A successful, documented restore test"},{"id":"c","text":"A server inventory"}]', array['b'], 'A restore test demonstrates that recovery can work; documentation alone does not.', false),
  ('q-ethical-beginner', 'ethical-hacking-fundamentals', 'ethical-hacking-beginner', 'beginner', 'What is needed before a security test begins?', '[{"id":"a","text":"A publicly reachable target"},{"id":"b","text":"Written authorization and a defined scope"},{"id":"c","text":"A strong password"}]', array['b'], 'Testing requires explicit authorization and boundaries; public reachability is not permission.', false),
  ('q-ethical-intermediate', 'ethical-hacking-fundamentals', 'ethical-hacking-intermediate', 'intermediate', 'Which practice best limits assessment impact?', '[{"id":"a","text":"Use production customer data for realism"},{"id":"b","text":"Use an authorized staging environment and synthetic data"},{"id":"c","text":"Ignore the agreed test window"}]', array['b'], 'An authorized, isolated environment and synthetic data reduce risk to real users.', false),
  ('q-ethical-advanced', 'ethical-hacking-fundamentals', 'ethical-hacking-advanced', 'advanced', 'A scanner flags a finding but a verified compensating control changes its impact. What should a report do?', '[{"id":"a","text":"Report the scanner score alone"},{"id":"b","text":"Document the signal, evidence, and control context"},{"id":"c","text":"Omit all evidence"}]', array['b'], 'A useful report separates verified observations from assumptions and includes relevant context.', false),
  ('q-network-beginner', 'network-security', 'network-security-beginner', 'beginner', 'What does HTTPS primarily help protect?', '[{"id":"a","text":"Data in transit between a browser and a site"},{"id":"b","text":"The honesty of every web page"},{"id":"c","text":"A device from every malware infection"}]', array['a'], 'HTTPS encrypts a connection in transit but does not establish that the site is trustworthy.', false),
  ('q-network-intermediate', 'network-security', 'network-security-intermediate', 'intermediate', 'Which is a good network segmentation practice?', '[{"id":"a","text":"Allow guest devices to reach management interfaces"},{"id":"b","text":"Separate guest Wi-Fi from business systems"},{"id":"c","text":"Use one shared administrator account"}]', array['b'], 'Separating guest and business networks limits unnecessary access between zones.', false),
  ('q-network-advanced', 'network-security', 'network-security-advanced', 'advanced', 'An unusual connection appears in a log. What is the best first interpretation?', '[{"id":"a","text":"Confirmed compromise"},{"id":"b","text":"A signal to investigate with additional context"},{"id":"c","text":"Proof that the device is safe"}]', array['b'], 'One event is a lead, not a verdict. Correlate it with approved software and other evidence.', false),
  ('q-web-beginner', 'web-application-security', 'web-security-beginner', 'beginner', 'How should untrusted user input be handled when shown on a web page?', '[{"id":"a","text":"Treat it as executable markup"},{"id":"b","text":"Render it as data using framework-safe output handling"},{"id":"c","text":"Assume it is safe if it came from a form"}]', array['b'], 'Context-aware safe rendering keeps input as data rather than executable markup.', false),
  ('q-web-intermediate', 'web-application-security', 'web-security-intermediate', 'intermediate', 'Which approach helps prevent SQL injection?', '[{"id":"a","text":"Concatenate strings into the query"},{"id":"b","text":"Use parameterized queries with values bound separately"},{"id":"c","text":"Hide database error messages only"}]', array['b'], 'Parameterized queries preserve the query structure and treat supplied values as data.', false),
  ('q-web-advanced', 'web-application-security', 'web-security-advanced', 'advanced', 'Which cookie attributes most directly help limit script access and cleartext transport?', '[{"id":"a","text":"HttpOnly and Secure"},{"id":"b","text":"Large and Persistent"},{"id":"c","text":"Public and Shared"}]', array['a'], 'HttpOnly prevents access from browser scripts; Secure restricts cookie transmission to secure connections.', false),
  ('q-phishing-beginner', 'phishing-scam-awareness', 'phishing-beginner', 'beginner', 'A message asks for a one-time sign-in code. What should you do?', '[{"id":"a","text":"Share it if the sender knows your name"},{"id":"b","text":"Never share it and verify through a known channel"},{"id":"c","text":"Reply asking for a different code"}]', array['b'], 'Verification codes are secrets. Verify unexpected requests using a trusted, separate channel.', false),
  ('q-phishing-intermediate', 'phishing-scam-awareness', 'phishing-intermediate', 'intermediate', 'In `signin.example.attacker.invalid`, which part is the registrable domain?', '[{"id":"a","text":"example"},{"id":"b","text":"attacker.invalid"},{"id":"c","text":"signin"}]', array['b'], 'The address belongs to attacker.invalid; words to its left are subdomains.', false),
  ('q-phishing-advanced', 'phishing-scam-awareness', 'phishing-advanced', 'advanced', 'After entering a password into a suspected fake page, what is a sound response?', '[{"id":"a","text":"Wait to see if anything happens"},{"id":"b","text":"Use the trusted site to change it, revoke sessions, and report promptly"},{"id":"c","text":"Post the link in a public forum"}]', array['b'], 'Prompt recovery through a known-good channel and reporting help contain possible account exposure.', false),
  ('q-forensics-beginner', 'digital-forensics', 'forensics-beginner', 'beginner', 'What is a useful first step when handling potential digital evidence?', '[{"id":"a","text":"Open and edit the file to understand it"},{"id":"b","text":"Record its source and handling context"},{"id":"c","text":"Rename it and delete the original"}]', array['b'], 'Documenting source and handling helps preserve provenance and integrity.', false),
  ('q-forensics-intermediate', 'digital-forensics', 'forensics-intermediate', 'intermediate', 'When comparing timestamps from different systems, what should you do?', '[{"id":"a","text":"Discard original times"},{"id":"b","text":"Retain originals and document time-zone normalization"},{"id":"c","text":"Assume all clocks are exact"}]', array['b'], 'Keep original values and document conversions because clocks and zones can differ.', false),
  ('q-forensics-advanced', 'digital-forensics', 'forensics-advanced', 'advanced', 'What does a matching SHA-256 hash support?', '[{"id":"a","text":"That two files have matching bytes at the time measured"},{"id":"b","text":"Who created a file"},{"id":"c","text":"That a file is harmless"}]', array['a'], 'A matching hash supports byte-for-byte integrity, not origin, authorship, or safety.', false),
  ('q-password-beginner', 'password-account-security', 'passwords-beginner', 'beginner', 'Why use unique passwords for important accounts?', '[{"id":"a","text":"It prevents every phishing attempt"},{"id":"b","text":"A breach at one site is less likely to expose other accounts"},{"id":"c","text":"It removes the need for account recovery"}]', array['b'], 'Unique passwords limit credential reuse when a service is breached.', false),
  ('q-password-intermediate', 'password-account-security', 'passwords-intermediate', 'intermediate', 'Which actions improve authentication security? Select all that apply.', '[{"id":"a","text":"Use unique passwords stored in a password manager"},{"id":"b","text":"Enable phishing-resistant MFA where available"},{"id":"c","text":"Share one-time codes with a coworker"},{"id":"d","text":"Reuse the same password for easier recovery"}]', array['a','b'], 'Unique passwords limit reuse, and phishing-resistant MFA can protect against lookalike sign-in pages. Never share codes or reuse passwords.', true),
  ('q-password-advanced', 'password-account-security', 'passwords-advanced', 'advanced', 'Which account-security process should be reviewed regularly?', '[{"id":"a","text":"Active sessions and delegated access"},{"id":"b","text":"Only the display name"},{"id":"c","text":"Public profile views"}]', array['a'], 'Review and revoke sessions or delegated access as roles and risk change.', false),
  ('q-mobile-beginner', 'mobile-security', 'mobile-beginner', 'beginner', 'Which group of practices helps protect a lost phone?', '[{"id":"a","text":"Screen lock, timely updates, and a tested backup"},{"id":"b","text":"Disable all backups"},{"id":"c","text":"Install apps from any link"}]', array['a'], 'A strong lock, current software, and a usable backup support both protection and recovery.', false),
  ('q-mobile-intermediate', 'mobile-security', 'mobile-intermediate', 'intermediate', 'An app requests permissions unrelated to its purpose. What should you do?', '[{"id":"a","text":"Grant everything automatically"},{"id":"b","text":"Deny unnecessary access and review whether the app is trustworthy"},{"id":"c","text":"Share your account password with the app"}]', array['b'], 'Grant only the permissions needed and remove apps that behave unexpectedly.', false),
  ('q-mobile-advanced', 'mobile-security', 'mobile-advanced', 'advanced', 'What can a well-designed work profile help accomplish?', '[{"id":"a","text":"Separate company data from personal content"},{"id":"b","text":"Make all phone data public"},{"id":"c","text":"Replace account access reviews"}]', array['a'], 'Work profiles separate managed work information and can support selective removal.', false),
  ('q-cloud-beginner', 'cloud-security', 'cloud-beginner', 'beginner', 'In a cloud service, who remains responsible for customer identities and data?', '[{"id":"a","text":"Always only the provider"},{"id":"b","text":"The customer, according to the service responsibility model"},{"id":"c","text":"No one"}]', array['b'], 'Responsibility varies by service, but customers typically retain duties for their identities and data.', false),
  ('q-cloud-intermediate', 'cloud-security', 'cloud-intermediate', 'intermediate', 'A reporting job needs read access to one dataset. What permission is appropriate?', '[{"id":"a","text":"Broad account administrator access"},{"id":"b","text":"A narrowly scoped read-only role"},{"id":"c","text":"A shared long-lived owner key"}]', array['b'], 'Grant only the required scope and use managed or short-lived credentials where available.', false),
  ('q-cloud-advanced', 'cloud-security', 'cloud-advanced', 'advanced', 'How can a team verify that a backup supports recovery?', '[{"id":"a","text":"Check only that a backup job ran"},{"id":"b","text":"Test restoration in an isolated environment"},{"id":"c","text":"Keep the only backup beside production"}]', array['b'], 'An isolated restore test confirms that a backup can meet recovery needs.', false),
  ('q-ai-beginner', 'ai-security', 'ai-security-beginner', 'beginner', 'Before entering data into an AI tool, what should you check?', '[{"id":"a","text":"Whether the data is allowed by policy and contains sensitive details"},{"id":"b","text":"Whether the prompt is long"},{"id":"c","text":"Whether the model sounds confident"}]', array['a'], 'Follow the organization’s AI data policy and minimize information shared.', false),
  ('q-ai-intermediate', 'ai-security', 'ai-security-intermediate', 'intermediate', 'A document tells an AI assistant to reveal another user’s records. What should protect those records?', '[{"id":"a","text":"The model’s willingness to ignore the document"},{"id":"b","text":"Authorization controls enforced outside the model"},{"id":"c","text":"A longer prompt alone"}]', array['b'], 'Access control must be enforced by the surrounding system and cannot depend on model compliance.', false),
  ('q-ai-advanced', 'ai-security', 'ai-security-advanced', 'advanced', 'What is a strong way to test an AI retrieval assistant before release?', '[{"id":"a","text":"Test that users cannot retrieve another tenant’s documents"},{"id":"b","text":"Assume the model will always obey instructions"},{"id":"c","text":"Disable all evaluation"}]', array['a'], 'Test tenant authorization at the data layer as well as model behavior.', false)
on conflict (id) do update set
  course_id = excluded.course_id, lesson_id = excluded.lesson_id, difficulty = excluded.difficulty,
  prompt = excluded.prompt, options = excluded.options, correct_option_ids = excluded.correct_option_ids,
  explanation = excluded.explanation, multiple_select = excluded.multiple_select;

notify pgrst, 'reload schema';
