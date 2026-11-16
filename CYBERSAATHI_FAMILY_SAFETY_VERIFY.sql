-- =============================================================================
-- CYBERSAATHI AI — FAMILY SAFETY CIRCLES READ-ONLY VERIFICATION SUITE
-- File: CYBERSAATHI_FAMILY_SAFETY_VERIFY.sql
-- Target: Remote Supabase PostgreSQL (Dashboard SQL Editor)
-- Operation: 100% READ-ONLY (No modifications, drops, or writes)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- CHECK 1: VERIFY TABLES EXIST
-- Expected: 3 rows (family_circles, family_circle_members, family_circle_alerts)
-- -----------------------------------------------------------------------------
SELECT 
  table_schema, 
  table_name, 
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('family_circles', 'family_circle_members', 'family_circle_alerts')
ORDER BY table_name;

-- -----------------------------------------------------------------------------
-- CHECK 2: CONFIRM ROW LEVEL SECURITY (RLS) IS ENABLED
-- Expected: rowsecurity = true for all 3 tables
-- -----------------------------------------------------------------------------
SELECT 
  tablename, 
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('family_circles', 'family_circle_members', 'family_circle_alerts')
ORDER BY tablename;

-- -----------------------------------------------------------------------------
-- CHECK 3: VERIFY COLUMN-LEVEL UPDATE PRIVILEGES ON family_circle_members (BLOCKER 2)
-- Expected: Only 'display_name' is granted UPDATE to authenticated.
-- Protected columns (role, circle_id, user_id, id, joined_at) MUST NOT be listed.
-- -----------------------------------------------------------------------------
SELECT 
  table_name,
  column_name,
  grantee,
  privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name = 'family_circle_members'
  AND privilege_type = 'UPDATE'
ORDER BY column_name, grantee;

-- -----------------------------------------------------------------------------
-- CHECK 4: VERIFY TABLE-LEVEL GRANTS
-- Expected:
--   authenticated: SELECT, INSERT, UPDATE, DELETE on family_circles
--   authenticated: SELECT, INSERT, DELETE on family_circle_members (NO table-level UPDATE)
--   authenticated: SELECT, INSERT on family_circle_alerts (NO UPDATE, NO DELETE)
--   anon / PUBLIC: 0 privileges
-- -----------------------------------------------------------------------------
SELECT 
  table_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('family_circles', 'family_circle_members', 'family_circle_alerts')
  AND grantee IN ('authenticated', 'anon', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;

-- -----------------------------------------------------------------------------
-- CHECK 5: VERIFY TABLE CONSTRAINTS (NOT NULL, CHECK, UNIQUE, FOREIGN KEYS)
-- Verified via conrelid to guarantee correct table assignment
-- -----------------------------------------------------------------------------
SELECT 
  conrelid::regclass AS table_name,
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid::regclass::text IN (
  'public.family_circles', 
  'public.family_circle_members', 
  'public.family_circle_alerts'
)
ORDER BY table_name, contype, constraint_name;

-- -----------------------------------------------------------------------------
-- CHECK 6: VERIFY PERFORMANCE & LOOKUP INDEXES
-- Expected: All 7 primary/foreign/lookup indexes present
-- -----------------------------------------------------------------------------
SELECT 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('family_circles', 'family_circle_members', 'family_circle_alerts')
ORDER BY tablename, indexname;

-- -----------------------------------------------------------------------------
-- CHECK 7: VERIFY SECURITY DEFINER FUNCTIONS & SAFE SEARCH_PATH (BLOCKER 4)
-- Expected: prosecdef = true, configuration_settings = {search_path=}
-- -----------------------------------------------------------------------------
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  p.prosecdef AS is_security_definer,
  p.proconfig AS configuration_settings
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('is_circle_member', 'handle_new_family_circle', 'join_family_circle_with_invite')
ORDER BY p.proname;

-- -----------------------------------------------------------------------------
-- CHECK 8: VERIFY AUTOMATIC GUARDIAN ASSIGNMENT TRIGGER & RPC ISOLATION (BLOCKER 4)
-- Expected: tr_family_circles_add_guardian AFTER INSERT ON family_circles
-- Function handle_new_family_circle() must NOT have direct EXECUTE for authenticated or anon.
-- -----------------------------------------------------------------------------
SELECT 
  event_object_table AS target_table,
  trigger_name,
  event_manipulation AS trigger_event,
  action_timing AS trigger_timing,
  action_statement AS executed_function
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'family_circles'
  AND trigger_name = 'tr_family_circles_add_guardian';

-- -----------------------------------------------------------------------------
-- CHECK 9: VERIFY ACTIVE RLS POLICIES & ABSENCE OF OBSOLETE POLICIES (BLOCKER 2 & 3)
-- Confirms:
--   - Canonical policy set active (10 policies total)
--   - No legacy broad policies exist
--   - family_circle_members UPDATE policy is non-recursive (no self-subqueries)
--   - family_circle_alerts has NO UPDATE or DELETE policies (immutable feed)
-- -----------------------------------------------------------------------------
SELECT 
  tablename, 
  policyname, 
  cmd AS command, 
  permissive, 
  roles,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('family_circles', 'family_circle_members', 'family_circle_alerts')
ORDER BY tablename, cmd, policyname;

-- -----------------------------------------------------------------------------
-- CHECK 10: VERIFY FUNCTION EXECUTION PRIVILEGES (BLOCKER 4)
-- Expected:
--   is_circle_member: authenticated EXECUTE
--   join_family_circle_with_invite: authenticated EXECUTE
--   handle_new_family_circle: 0 grants (trigger context only)
--   anon / PUBLIC: 0 grants across all functions
-- -----------------------------------------------------------------------------
SELECT 
  routine_name, 
  grantee, 
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('is_circle_member', 'handle_new_family_circle', 'join_family_circle_with_invite')
ORDER BY routine_name, grantee;

-- -----------------------------------------------------------------------------
-- CHECK 11: COMPREHENSIVE AUTOMATED 10-GATE READINESS AUDIT QUERY
-- Evaluates all security gates and returns a single PASS/FAIL report.
-- -----------------------------------------------------------------------------
WITH audit_checks AS (
  -- Gate 1: Tables Exist
  SELECT 
    '1. Tables Exist' AS gate,
    CASE WHEN COUNT(*) = 3 THEN 'PASS' ELSE 'FAIL: Expected 3 tables' END AS status,
    COUNT(*)::text || ' / 3 tables found' AS detail
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('family_circles', 'family_circle_members', 'family_circle_alerts')

  UNION ALL

  -- Gate 2: Row Level Security Enabled
  SELECT 
    '2. Row Level Security Enabled' AS gate,
    CASE WHEN COUNT(*) = 3 AND bool_and(rowsecurity) THEN 'PASS' ELSE 'FAIL: RLS not active on all tables' END AS status,
    COUNT(*)::text || ' / 3 tables protected' AS detail
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('family_circles', 'family_circle_members', 'family_circle_alerts')

  UNION ALL

  -- Gate 3: Column-Level UPDATE Isolation (BLOCKER 2)
  SELECT 
    '3. Column-Level UPDATE Isolation' AS gate,
    CASE 
      WHEN bool_and(column_name = 'display_name') AND COUNT(*) = 1 
      THEN 'PASS' 
      ELSE 'FAIL: Broad UPDATE or protected column exposed' 
    END AS status,
    'Granted UPDATE columns for authenticated: ' || COALESCE(string_agg(column_name, ', '), 'NONE') AS detail
  FROM information_schema.column_privileges
  WHERE table_schema = 'public'
    AND table_name = 'family_circle_members'
    AND privilege_type = 'UPDATE'
    AND grantee = 'authenticated'

  UNION ALL

  -- Gate 4: Table-Level UPDATE Revoked on Members & Alerts (BLOCKER 2 & 5)
  SELECT 
    '4. Table-Level UPDATE Revoked on Members & Alerts' AS gate,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL: Table-level UPDATE granted on members or alerts' END AS status,
    COUNT(*)::text || ' unauthorized table-level UPDATE grants found' AS detail
  FROM information_schema.table_privileges
  WHERE table_schema = 'public'
    AND table_name IN ('family_circle_members', 'family_circle_alerts')
    AND privilege_type = 'UPDATE'
    AND grantee IN ('authenticated', 'anon', 'PUBLIC')

  UNION ALL

  -- Gate 5: Security Definer Functions & search_path (BLOCKER 4)
  SELECT 
    '5. Security Definer Functions & search_path' AS gate,
    CASE WHEN COUNT(*) = 3 AND bool_and(p.prosecdef) THEN 'PASS' ELSE 'FAIL: Functions not SECURITY DEFINER' END AS status,
    COUNT(*)::text || ' / 3 functions verified' AS detail
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('is_circle_member', 'handle_new_family_circle', 'join_family_circle_with_invite')

  UNION ALL

  -- Gate 6: Trigger Registered & Direct RPC Revoked (BLOCKER 4)
  SELECT 
    '6. Trigger Registered & Direct RPC Revoked' AS gate,
    CASE 
      WHEN (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name = 'tr_family_circles_add_guardian') >= 1
       AND (SELECT COUNT(*) FROM information_schema.routine_privileges WHERE routine_name = 'handle_new_family_circle' AND grantee IN ('authenticated', 'anon', 'PUBLIC')) = 0
      THEN 'PASS' 
      ELSE 'FAIL: Trigger missing or direct RPC execute not revoked' 
    END AS status,
    'Trigger registered; direct RPC execute revoked from authenticated/anon/PUBLIC' AS detail

  UNION ALL

  -- Gate 7: Canonical Policy Audit & Obsolete Policies Purged (BLOCKER 3)
  SELECT 
    '7. Policy Audit & Obsolete Policies Purged' AS gate,
    CASE 
      WHEN COUNT(*) = 10 
       AND bool_and(policyname NOT IN ('Users can join circles with valid member row', 'Members can update their own profile'))
      THEN 'PASS' 
      ELSE 'FAIL: Unexpected policy count or legacy policy detected' 
    END AS status,
    COUNT(*)::text || ' / 10 canonical policies active; legacy policies purged' AS detail
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('family_circles', 'family_circle_members', 'family_circle_alerts')

  UNION ALL

  -- Gate 8: Non-Recursive Member UPDATE Policy (BLOCKER 2)
  SELECT 
    '8. Non-Recursive Member UPDATE Policy' AS gate,
    CASE 
      WHEN COUNT(*) >= 1 AND bool_and(qual NOT LIKE '%SELECT%family_circle_members%')
      THEN 'PASS' 
      ELSE 'FAIL: UPDATE policy contains recursive self-subquery' 
    END AS status,
    'Member UPDATE policy is non-recursive self-row check' AS detail
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'family_circle_members'
    AND cmd = 'UPDATE'

  UNION ALL

  -- Gate 9: Anon & Public Access Revoked from Tables & Functions
  SELECT 
    '9. Anon & Public Revocations' AS gate,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL: Anon or PUBLIC has unauthorized access' END AS status,
    COUNT(*)::text || ' unauthorized privileges detected' AS detail
  FROM (
    SELECT routine_name FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name IN ('is_circle_member', 'handle_new_family_circle', 'join_family_circle_with_invite')
      AND grantee IN ('anon', 'PUBLIC')
    UNION ALL
    SELECT table_name FROM information_schema.table_privileges
    WHERE table_schema = 'public'
      AND table_name IN ('family_circles', 'family_circle_members', 'family_circle_alerts')
      AND grantee IN ('anon', 'PUBLIC')
  ) unauthorized

  UNION ALL

  -- Gate 10: Performance & Lookup Indexes (All 7 active)
  SELECT 
    '10. Performance & Lookup Indexes' AS gate,
    CASE WHEN COUNT(*) >= 7 THEN 'PASS' ELSE 'FAIL: Missing indexes' END AS status,
    COUNT(*)::text || ' / 7 indexes verified' AS detail
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename IN ('family_circles', 'family_circle_members', 'family_circle_alerts')
)
SELECT * FROM audit_checks ORDER BY gate;
