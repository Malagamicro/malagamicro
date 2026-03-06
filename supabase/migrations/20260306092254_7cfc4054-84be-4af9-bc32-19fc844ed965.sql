
-- Create subagent teams table
CREATE TABLE public.ai_subagent_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add team_id and tools columns to ai_subagents
ALTER TABLE public.ai_subagents 
  ADD COLUMN team_id UUID REFERENCES public.ai_subagent_teams(id) ON DELETE SET NULL,
  ADD COLUMN tools TEXT[] NOT NULL DEFAULT '{}';

-- Enable RLS on teams
ALTER TABLE public.ai_subagent_teams ENABLE ROW LEVEL SECURITY;

-- RLS policies for teams
CREATE POLICY "Users can view own teams" ON public.ai_subagent_teams FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own teams" ON public.ai_subagent_teams FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own teams" ON public.ai_subagent_teams FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own teams" ON public.ai_subagent_teams FOR DELETE USING (auth.uid() = user_id);
