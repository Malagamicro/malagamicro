-- Add score column to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;

-- Create a function to calculate lead score
CREATE OR REPLACE FUNCTION public.calculate_lead_score(p_lead_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score INTEGER := 0;
  v_lead RECORD;
  v_activity_count INTEGER;
  v_days_since_contact INTEGER;
  v_days_since_created INTEGER;
BEGIN
  -- Get lead data
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Base score by status (0-40 points)
  CASE v_lead.status
    WHEN 'nuevo' THEN v_score := v_score + 10;
    WHEN 'contactado' THEN v_score := v_score + 20;
    WHEN 'interesado' THEN v_score := v_score + 35;
    WHEN 'cliente' THEN v_score := v_score + 40;
    ELSE v_score := v_score + 5;
  END CASE;
  
  -- Contact info completeness (0-15 points)
  IF v_lead.email IS NOT NULL AND v_lead.email != '' THEN
    v_score := v_score + 5;
  END IF;
  IF v_lead.phone IS NOT NULL AND v_lead.phone != '' THEN
    v_score := v_score + 5;
  END IF;
  IF v_lead.contact_name IS NOT NULL AND v_lead.contact_name != '' THEN
    v_score := v_score + 5;
  END IF;
  
  -- Equipment count indicates value (0-10 points)
  IF v_lead.equipment_count IS NOT NULL THEN
    IF v_lead.equipment_count >= 10 THEN
      v_score := v_score + 10;
    ELSIF v_lead.equipment_count >= 5 THEN
      v_score := v_score + 7;
    ELSIF v_lead.equipment_count >= 1 THEN
      v_score := v_score + 4;
    END IF;
  END IF;
  
  -- Activity engagement (0-20 points)
  SELECT COUNT(*) INTO v_activity_count 
  FROM lead_activities 
  WHERE lead_id = p_lead_id;
  
  IF v_activity_count >= 10 THEN
    v_score := v_score + 20;
  ELSIF v_activity_count >= 5 THEN
    v_score := v_score + 15;
  ELSIF v_activity_count >= 2 THEN
    v_score := v_score + 10;
  ELSIF v_activity_count >= 1 THEN
    v_score := v_score + 5;
  END IF;
  
  -- Recency bonus/penalty (0-15 points)
  IF v_lead.last_contacted_at IS NOT NULL THEN
    v_days_since_contact := EXTRACT(DAY FROM (NOW() - v_lead.last_contacted_at));
    IF v_days_since_contact <= 3 THEN
      v_score := v_score + 15;
    ELSIF v_days_since_contact <= 7 THEN
      v_score := v_score + 10;
    ELSIF v_days_since_contact <= 14 THEN
      v_score := v_score + 5;
    ELSIF v_days_since_contact > 30 THEN
      v_score := v_score - 5; -- Penalty for cold leads
    END IF;
  ELSE
    -- Never contacted - check how old the lead is
    v_days_since_created := EXTRACT(DAY FROM (NOW() - v_lead.created_at));
    IF v_days_since_created <= 3 THEN
      v_score := v_score + 10; -- Fresh lead bonus
    ELSIF v_days_since_created > 14 THEN
      v_score := v_score - 5; -- Stale untouched lead penalty
    END IF;
  END IF;
  
  -- Ensure score is between 0 and 100
  IF v_score < 0 THEN
    v_score := 0;
  ELSIF v_score > 100 THEN
    v_score := 100;
  END IF;
  
  RETURN v_score;
END;
$$;

-- Create a function to update lead score
CREATE OR REPLACE FUNCTION public.update_lead_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id UUID;
  v_new_score INTEGER;
BEGIN
  -- Determine which lead to update
  IF TG_TABLE_NAME = 'leads' THEN
    v_lead_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'lead_activities' THEN
    v_lead_id := NEW.lead_id;
  END IF;
  
  -- Calculate and update the score
  v_new_score := calculate_lead_score(v_lead_id);
  
  UPDATE leads SET score = v_new_score WHERE id = v_lead_id;
  
  RETURN NEW;
END;
$$;

-- Create triggers to automatically update scores
DROP TRIGGER IF EXISTS update_lead_score_on_lead_change ON leads;
CREATE TRIGGER update_lead_score_on_lead_change
  AFTER INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_score();

DROP TRIGGER IF EXISTS update_lead_score_on_activity ON lead_activities;
CREATE TRIGGER update_lead_score_on_activity
  AFTER INSERT ON lead_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_score();

-- Update existing leads with their scores
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM leads LOOP
    UPDATE leads SET score = calculate_lead_score(r.id) WHERE id = r.id;
  END LOOP;
END $$;