-- CyberSaathi AI — Hardened RLS Policies & Search Path for Family Safety Circles
-- Mitigates search_path hijacking in SECURITY DEFINER function
-- Mitigates unauthorized member injection without valid invite code

-- 1. Re-declare is_circle_member with safe search_path
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

-- 2. Drop vulnerable INSERT policy on family_circle_members
DROP POLICY IF EXISTS "Users can join circles with valid member row" ON public.family_circle_members;

-- 3. Replace with hardened policy: only circle owners can directly insert member rows, and role must be 'member'
DROP POLICY IF EXISTS "Circle owners can add members directly" ON public.family_circle_members;
CREATE POLICY "Circle owners can add members directly"
    ON public.family_circle_members
    FOR INSERT
    TO authenticated
    WITH CHECK (
      role = 'member' AND
      EXISTS (
        SELECT 1 FROM public.family_circles
        WHERE id = circle_id AND owner_user_id = (SELECT auth.uid())
      )
    );

-- 3b. Harden UPDATE policy: members can only update their own display_name; role tampering prohibited
DROP POLICY IF EXISTS "Members can update their own profile" ON public.family_circle_members;
DROP POLICY IF EXISTS "Members can update their own display name" ON public.family_circle_members;
CREATE POLICY "Members can update their own display name"
    ON public.family_circle_members
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3c. Column-level privilege hardening: revoke broad UPDATE, grant UPDATE exclusively on display_name
REVOKE UPDATE ON public.family_circle_members FROM PUBLIC, anon, authenticated;
GRANT UPDATE (display_name) ON public.family_circle_members TO authenticated;

-- 4. Secure RPC function for joining a family circle with a verified invite code
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

  -- 4. Locate target family circle
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

  -- 6. Insert new member row as 'member'
  INSERT INTO public.family_circle_members (circle_id, user_id, role, display_name)
  VALUES (v_circle.id, v_user_id, 'member', v_clean_name)
  RETURNING id, circle_id, user_id, role, display_name, joined_at INTO v_member;

  -- 7. Return sanitized response (invite_code removed)
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

-- 5. Restrict function execution to authenticated users only (revoke from public and anon)
REVOKE ALL ON FUNCTION public.is_circle_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_circle_member(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.join_family_circle_with_invite(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_family_circle_with_invite(TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

