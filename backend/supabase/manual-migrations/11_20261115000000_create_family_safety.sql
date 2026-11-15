-- CyberSaathi AI — Family Safety Circles (Consent-based protection)
-- Manual Migration 11

CREATE TABLE IF NOT EXISTS public.family_circles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invite_code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.family_circle_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES public.family_circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('guardian', 'member')),
    display_name TEXT,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE(circle_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.family_circle_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES public.family_circles(id) ON DELETE CASCADE,
    triggered_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    threat_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('high', 'critical')),
    summary TEXT NOT NULL,
    advice TEXT NOT NULL,
    resolved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_family_circles_owner ON public.family_circles(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_family_circle_members_user ON public.family_circle_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_circle_alerts_circle ON public.family_circle_alerts(circle_id);

ALTER TABLE public.family_circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_circle_alerts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_circle_member(check_circle_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_circle_members
    WHERE circle_id = check_circle_id AND user_id = auth.uid()
  );
$$;

DO $$ BEGIN
  CREATE POLICY "Users can view family circles they belong to"
      ON public.family_circles
      FOR SELECT
      USING (owner_user_id = auth.uid() OR public.is_circle_member(id));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can create family circles"
      ON public.family_circles
      FOR INSERT
      WITH CHECK (auth.uid() = owner_user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Members can view other members in their circle"
      ON public.family_circle_members
      FOR SELECT
      USING (public.is_circle_member(circle_id));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can join circles with valid member row"
      ON public.family_circle_members
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Circle members can view shared threat alerts"
      ON public.family_circle_alerts
      FOR SELECT
      USING (public.is_circle_member(circle_id));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Circle members can broadcast critical threat alerts"
      ON public.family_circle_alerts
      FOR INSERT
      WITH CHECK (auth.uid() = triggered_by_user_id AND public.is_circle_member(circle_id));
EXCEPTION WHEN duplicate_object THEN null; END $$;
