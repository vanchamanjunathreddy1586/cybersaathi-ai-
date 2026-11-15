-- Migration: 20261114000000_create_call_scans.sql
-- Table: call_scans
-- Description: Stores results of analyzed phone call transcripts and audio for cyber fraud detection.

CREATE TABLE IF NOT EXISTS public.call_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  input_type text NOT NULL CHECK (input_type IN ('transcript', 'audio')),
  file_name text,
  file_size_bytes bigint,
  detected_language text NOT NULL DEFAULT 'en' CHECK (detected_language IN ('en', 'hi', 'te', 'mixed', 'unknown')),
  transcript_snippet text NOT NULL,
  risk_score integer NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level text NOT NULL CHECK (risk_level IN ('Low Risk', 'Medium Risk', 'High Risk', 'Critical Risk')),
  verdict text NOT NULL CHECK (verdict IN ('Likely Safe', 'Suspicious', 'Likely Scam', 'Inconclusive')),
  impersonation_target text,
  detected_tactics jsonb NOT NULL DEFAULT '[]'::jsonb,
  indicators jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.call_scans ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own call scans
CREATE POLICY "Users can view their own call scans"
  ON public.call_scans
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own call scans
CREATE POLICY "Users can insert their own call scans"
  ON public.call_scans
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own call scans
CREATE POLICY "Users can delete their own call scans"
  ON public.call_scans
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_scans_user_id ON public.call_scans (user_id);
CREATE INDEX IF NOT EXISTS idx_call_scans_created_at ON public.call_scans (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_scans_verdict ON public.call_scans (verdict);
