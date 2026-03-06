
-- Create AI subagents table
CREATE TABLE public.ai_subagents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  model text NOT NULL,
  role_prompt text NOT NULL DEFAULT 'Eres un asistente útil.',
  agent_type text NOT NULL DEFAULT 'text' CHECK (agent_type IN ('text', 'image', 'audio')),
  avatar_emoji text DEFAULT '🤖',
  avatar_color text DEFAULT '#6C63FF',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_subagents ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own subagents" ON public.ai_subagents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create own subagents" ON public.ai_subagents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subagents" ON public.ai_subagents
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subagents" ON public.ai_subagents
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
