-- =============================================================================
-- CYBERSAATHI AI — PRODUCTION-GRADE FAMILY SAFETY CIRCLES MIGRATION
-- File: CYBERSAATHI_FAMILY_SAFETY_FINAL_MIGRATION.sql
-- Target Database: Remote Supabase PostgreSQL (PostgREST)
-- Idempotency: Fully idempotent; safe on fresh OR partially migrated databases
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PREREQUISITES & EXTENSIONS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 2. BASE TABLE CREATION (IF NOT EXISTS)
-- -----------------------------------------------------------------------------

-- Table 1: family_circles
CREATE TABLE IF NOT EXISTS public.family_circles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invite_code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Table 2: family_circle_members
CREATE TABLE IF NOT EXISTS public.family_circle_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES public.family_circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    display_name TEXT,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(circle_id, user_id)
);

-- Table 3: family_circle_alerts
CREATE TABLE IF NOT EXISTS public.family_circle_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES public.family_circles(id) ON DELETE CASCADE,
    triggered_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    threat_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    summary TEXT NOT NULL,
    advice TEXT NOT NULL,
    resolved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- -----------------------------------------------------------------------------
-- 3. DEFENSIVE SCHEMA REPAIR & DATA INTEGRITY VALIDATION (BLOCKER 1 & 6)
-- Execution Order:
--   Step 3A: Add missing required columns safely if they do not exist.
--   Step 3B: Validate existing data in columns (stop with clear error if invalid).
--   Step 3C: Add constraints (CHECK, UNIQUE, FOREIGN KEY) only after validation.
-- Does not silently delete, overwrite, or corrupt existing records.
-- Scopes constraint checks using conrelid.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_null_invites INT;
  v_duplicate_invites INT;
  v_invalid_roles INT;
  v_invalid_severities INT;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Step 3A: Add missing required columns FIRST so subsequent checks do not fail
  -- ---------------------------------------------------------------------------
  -- Columns on public.family_circles
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'family_circles' AND column_name = 'invite_code') THEN
    ALTER TABLE public.family_circles ADD COLUMN invite_code TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'family_circles' AND column_name = 'updated_at') THEN
    ALTER TABLE public.family_circles ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now());
  END IF;

  -- Columns on public.family_circle_members
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'family_circle_members' AND column_name = 'role') THEN
    ALTER TABLE public.family_circle_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'family_circle_members' AND column_name = 'display_name') THEN
    ALTER TABLE public.family_circle_members ADD COLUMN display_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'family_circle_members' AND column_name = 'joined_at') THEN
    ALTER TABLE public.family_circle_members ADD COLUMN joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now());
  END IF;

  -- Columns on public.family_circle_alerts
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'family_circle_alerts' AND column_name = 'resolved') THEN
    ALTER TABLE public.family_circle_alerts ADD COLUMN resolved BOOLEAN NOT NULL DEFAULT false;
  END IF;

  -- ---------------------------------------------------------------------------
  -- Step 3B: Validate existing data now that columns are guaranteed to exist
  -- ---------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'family_circles') THEN
    SELECT COUNT(*) INTO v_null_invites FROM public.family_circles WHERE invite_code IS NULL;
    IF v_null_invites > 0 THEN
      RAISE EXCEPTION 'Migration safety stop: family_circles contains % rows with NULL invite_code. Manual remediation required.', v_null_invites;
    END IF;

    SELECT COUNT(*) INTO v_duplicate_invites FROM (
      SELECT invite_code FROM public.family_circles GROUP BY invite_code HAVING COUNT(*) > 1
    ) dupes;
    IF v_duplicate_invites > 0 THEN
      RAISE EXCEPTION 'Migration safety stop: family_circles contains % duplicate invite_code values. Manual remediation required.', v_duplicate_invites;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'family_circle_members') THEN
    SELECT COUNT(*) INTO v_invalid_roles FROM public.family_circle_members WHERE role NOT IN ('guardian', 'member');
    IF v_invalid_roles > 0 THEN
      RAISE EXCEPTION 'Migration safety stop: family_circle_members contains % rows with invalid role values. Manual remediation required.', v_invalid_roles;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'family_circle_alerts') THEN
    SELECT COUNT(*) INTO v_invalid_severities FROM public.family_circle_alerts WHERE severity NOT IN ('high', 'critical');
    IF v_invalid_severities > 0 THEN
      RAISE EXCEPTION 'Migration safety stop: family_circle_alerts contains % rows with invalid severity values. Manual remediation required.', v_invalid_severities;
    END IF;
  END IF;

  -- ---------------------------------------------------------------------------
  -- Step 3C: Add constraints only after validation passes
  -- ---------------------------------------------------------------------------
  -- Constraints: public.family_circles (verified via conrelid)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.family_circles'::regclass AND conname = 'chk_family_circles_name_length') THEN
    ALTER TABLE public.family_circles ADD CONSTRAINT chk_family_circles_name_length 
      CHECK (length(trim(name)) >= 2 AND length(trim(name)) <= 64);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.family_circles'::regclass AND conname = 'chk_family_circles_invite_code_format') THEN
    ALTER TABLE public.family_circles ADD CONSTRAINT chk_family_circles_invite_code_format 
      CHECK (length(trim(invite_code)) >= 6 AND length(trim(invite_code)) <= 16);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.family_circles'::regclass AND conname = 'family_circles_invite_code_key') THEN
    ALTER TABLE public.family_circles ADD CONSTRAINT family_circles_invite_code_key UNIQUE (invite_code);
  END IF;

  -- Constraints: public.family_circle_members (verified via conrelid)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.family_circle_members'::regclass AND conname = 'chk_family_circle_members_role') THEN
    ALTER TABLE public.family_circle_members ADD CONSTRAINT chk_family_circle_members_role 
      CHECK (role IN ('guardian', 'member'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.family_circle_members'::regclass AND conname = 'chk_family_circle_members_display_name_length') THEN
    ALTER TABLE public.family_circle_members ADD CONSTRAINT chk_family_circle_members_display_name_length 
      CHECK (display_name IS NULL OR (length(trim(display_name)) >= 1 AND length(trim(display_name)) <= 64));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.family_circle_members'::regclass AND conname = 'family_circle_members_circle_id_user_id_key') THEN
    ALTER TABLE public.family_circle_members ADD CONSTRAINT family_circle_members_circle_id_user_id_key UNIQUE (circle_id, user_id);
  END IF;

  -- Constraints: public.family_circle_alerts (verified via conrelid)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.family_circle_alerts'::regclass AND conname = 'chk_family_circle_alerts_severity') THEN
    ALTER TABLE public.family_circle_alerts ADD CONSTRAINT chk_family_circle_alerts_severity 
      CHECK (severity IN ('high', 'critical'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.family_circle_alerts'::regclass AND conname = 'chk_family_circle_alerts_threat_type_length') THEN
    ALTER TABLE public.family_circle_alerts ADD CONSTRAINT chk_family_circle_alerts_threat_type_length 
      CHECK (length(trim(threat_type)) >= 2 AND length(trim(threat_type)) <= 64);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.family_circle_alerts'::regclass AND conname = 'chk_family_circle_alerts_summary_length') THEN
    ALTER TABLE public.family_circle_alerts ADD CONSTRAINT chk_family_circle_alerts_summary_length 
      CHECK (length(trim(summary)) >= 5 AND length(trim(summary)) <= 500);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.family_circle_alerts'::regclass AND conname = 'chk_family_circle_alerts_advice_length') THEN
    ALTER TABLE public.family_circle_alerts ADD CONSTRAINT chk_family_circle_alerts_advice_length 
      CHECK (length(trim(advice)) >= 5 AND length(trim(advice)) <= 500);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. PERFORMANCE & LOOKUP INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_family_circles_owner ON public.family_circles(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_family_circles_invite_code ON public.family_circles(invite_code);
CREATE INDEX IF NOT EXISTS idx_family_circle_members_circle ON public.family_circle_members(circle_id);
CREATE INDEX IF NOT EXISTS idx_family_circle_members_user ON public.family_circle_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_circle_members_circle_user ON public.family_circle_members(circle_id, user_id);
CREATE INDEX IF NOT EXISTS idx_family_circle_alerts_circle ON public.family_circle_alerts(circle_id);
CREATE INDEX IF NOT EXISTS idx_family_circle_alerts_created_at ON public.family_circle_alerts(circle_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 5. ENABLE ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.family_circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_circle_alerts ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 6. SECURITY DEFINER HELPER: is_circle_member
-- Hardened against search_path hijacking; runs STABLE with zero recursion.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_circle_member(check_circle_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_circle_members
    WHERE circle_id = check_circle_id AND user_id = (SELECT auth.uid())
  );
$$;

-- -----------------------------------------------------------------------------
-- 7. AUTOMATIC GUARDIAN ASSIGNMENT TRIGGER (BLOCKER 4)
-- Guarantees that the circle creator is recorded as guardian atomically.
-- Trigger function is protected against direct execution (TG_OP assertion).
-- Direct EXECUTE is REVOKED from all clients (trigger runs under owner context).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_family_circle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Defense-in-depth: prohibit direct execution outside trigger context
  IF TG_OP IS NULL OR TG_OP != 'INSERT' THEN
    RAISE EXCEPTION 'handle_new_family_circle can only be executed as an AFTER INSERT trigger.';
  END IF;

  INSERT INTO public.family_circle_members (circle_id, user_id, role, display_name)
  VALUES (NEW.id, NEW.owner_user_id, 'guardian', 'Circle Guardian')
  ON CONFLICT (circle_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_family_circles_add_guardian ON public.family_circles;
CREATE TRIGGER tr_family_circles_add_guardian
  AFTER INSERT ON public.family_circles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_family_circle();

-- -----------------------------------------------------------------------------
-- 8. COMPREHENSIVE RLS POLICY PURGE & RE-CREATION (BLOCKER 2 & 3)
-- Dynamically drops all legacy/obsolete policies across the family tables
-- to ensure no unexpected, broad, or differently named policies survive.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT schemaname, tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename IN ('family_circles', 'family_circle_members', 'family_circle_alerts')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- --- Policies for public.family_circles ---
CREATE POLICY "family_circles_select_policy"
    ON public.family_circles FOR SELECT
    TO authenticated
    USING (owner_user_id = (SELECT auth.uid()) OR public.is_circle_member(id));

CREATE POLICY "family_circles_insert_policy"
    ON public.family_circles FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = owner_user_id);

CREATE POLICY "family_circles_update_policy"
    ON public.family_circles FOR UPDATE
    TO authenticated
    USING (owner_user_id = (SELECT auth.uid()))
    WITH CHECK (owner_user_id = (SELECT auth.uid()));

CREATE POLICY "family_circles_delete_policy"
    ON public.family_circles FOR DELETE
    TO authenticated
    USING (owner_user_id = (SELECT auth.uid()));

-- --- Policies for public.family_circle_members ---
CREATE POLICY "family_circle_members_select_policy"
    ON public.family_circle_members FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()) OR public.is_circle_member(circle_id));

-- Restrict owner direct insertion: MUST have role = 'member' and be the circle owner
CREATE POLICY "family_circle_members_insert_policy"
    ON public.family_circle_members FOR INSERT
    TO authenticated
    WITH CHECK (
      role = 'member' AND
      EXISTS (
        SELECT 1 FROM public.family_circles
        WHERE id = circle_id AND owner_user_id = (SELECT auth.uid())
      )
    );

-- BLOCKER 2: Non-recursive self-row UPDATE policy.
-- Subqueries removed. Column-level privilege exclusively grants UPDATE on display_name.
-- Role, circle_id, user_id, id, joined_at cannot be updated by authenticated users.
CREATE POLICY "family_circle_members_update_policy"
    ON public.family_circle_members FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- Members can leave circles, or owners can remove members
CREATE POLICY "family_circle_members_delete_policy"
    ON public.family_circle_members FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id OR EXISTS (
      SELECT 1 FROM public.family_circles
      WHERE id = circle_id AND owner_user_id = (SELECT auth.uid())
    ));

-- --- Policies for public.family_circle_alerts (BLOCKER 5: Immutable Broadcast Feed) ---
-- Alerts cannot be updated or deleted by users. No UPDATE or DELETE policies exist.
CREATE POLICY "family_circle_alerts_select_policy"
    ON public.family_circle_alerts FOR SELECT
    TO authenticated
    USING (public.is_circle_member(circle_id));

CREATE POLICY "family_circle_alerts_insert_policy"
    ON public.family_circle_alerts FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = triggered_by_user_id AND public.is_circle_member(circle_id));

-- -----------------------------------------------------------------------------
-- 9. ATOMIC STORED PROCEDURE: join_family_circle_with_invite
-- Validates invite code, enforces input limits, checks duplicate membership,
-- and inserts membership atomically without leaking invite_code in response.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_family_circle_with_invite(
  p_invite_code TEXT,
  p_display_name TEXT DEFAULT 'Family Member'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_circle RECORD;
  v_user_id UUID;
  v_existing UUID;
  v_member RECORD;
  v_clean_code TEXT;
  v_clean_name TEXT;
BEGIN
  -- 1. Enforce authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to join a family safety circle.';
  END IF;

  -- 2. Validate invite code input
  IF p_invite_code IS NULL OR trim(p_invite_code) = '' THEN
    RAISE EXCEPTION 'Invite code cannot be blank.';
  END IF;

  v_clean_code := upper(trim(p_invite_code));
  IF length(v_clean_code) < 6 OR length(v_clean_code) > 16 THEN
    RAISE EXCEPTION 'Invalid invite code length (must be between 6 and 16 characters).';
  END IF;

  IF v_clean_code !~ '^[A-Z0-9-]+$' THEN
    RAISE EXCEPTION 'Invalid characters in invite code (alphanumeric and hyphens only).';
  END IF;

  -- 3. Validate display name input
  IF p_display_name IS NULL OR trim(p_display_name) = '' THEN
    v_clean_name := 'Family Member';
  ELSE
    v_clean_name := trim(p_display_name);
    IF length(v_clean_name) > 64 THEN
      RAISE EXCEPTION 'Display name must not exceed 64 characters.';
    END IF;
  END IF;

  -- 4. Query target family circle
  SELECT id, name, created_at
  INTO v_circle
  FROM public.family_circles
  WHERE invite_code = v_clean_code;

  IF v_circle.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired family circle invite code.';
  END IF;

  -- 5. Prevent duplicate membership
  SELECT id INTO v_existing
  FROM public.family_circle_members
  WHERE circle_id = v_circle.id AND user_id = v_user_id;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'You are already a member of this family safety circle.';
  END IF;

  -- 6. Insert new member row with immutable role = 'member'
  INSERT INTO public.family_circle_members (circle_id, user_id, role, display_name)
  VALUES (v_circle.id, v_user_id, 'member', v_clean_name)
  RETURNING id, circle_id, user_id, role, display_name, joined_at INTO v_member;

  -- 7. Return sanitized response (invite_code and owner_user_id stripped)
  RETURN jsonb_build_object(
    'circle', jsonb_build_object(
      'id', v_circle.id,
      'name', v_circle.name,
      'created_at', v_circle.created_at
    ),
    'member', jsonb_build_object(
      'id', v_member.id,
      'circle_id', v_member.circle_id,
      'user_id', v_member.user_id,
      'role', v_member.role,
      'display_name', v_member.display_name,
      'joined_at', v_member.joined_at
    )
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. TABLE-LEVEL & COLUMN-LEVEL PRIVILEGE HARDENING (BLOCKER 2, 4 & 5)
-- Implements least-privilege access:
-- - Revokes all access from anon and PUBLIC across all family tables.
-- - Authenticated users get SELECT, INSERT, DELETE on family_circle_members.
-- - Table-level UPDATE is REVOKED on family_circle_members.
-- - Column-level UPDATE is GRANTED EXCLUSIVELY on display_name.
-- - Table-level UPDATE/DELETE is REVOKED on family_circle_alerts (immutable feed).
-- - Trigger function handle_new_family_circle() has EXECUTE REVOKED from all clients.
-- -----------------------------------------------------------------------------

-- A. Revoke all access from anon and PUBLIC
REVOKE ALL ON public.family_circles FROM PUBLIC, anon;
REVOKE ALL ON public.family_circle_members FROM PUBLIC, anon;
REVOKE ALL ON public.family_circle_alerts FROM PUBLIC, anon;

-- B. Table-level permissions for authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_circles TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.family_circle_members TO authenticated;
GRANT SELECT, INSERT ON public.family_circle_alerts TO authenticated;

-- C. Column-level UPDATE privilege on family_circle_members (BLOCKER 2)
REVOKE UPDATE ON public.family_circle_members FROM PUBLIC, anon, authenticated;
GRANT UPDATE (display_name) ON public.family_circle_members TO authenticated;

-- D. Alert Workflow Security (BLOCKER 5): Zero UPDATE or DELETE granted on alerts
REVOKE UPDATE, DELETE ON public.family_circle_alerts FROM PUBLIC, anon, authenticated;

-- E. Function execution privileges (BLOCKER 4)
REVOKE ALL ON FUNCTION public.is_circle_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_circle_member(UUID) TO authenticated;

-- Trigger function: REVOKE from authenticated too (runs via trigger context only)
REVOKE ALL ON FUNCTION public.handle_new_family_circle() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.join_family_circle_with_invite(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_family_circle_with_invite(TEXT, TEXT) TO authenticated;

-- -----------------------------------------------------------------------------
-- 11. POSTGREST SCHEMA CACHE REFRESH
-- -----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
