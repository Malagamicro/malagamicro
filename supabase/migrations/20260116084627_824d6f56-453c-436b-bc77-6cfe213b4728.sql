-- Fix handle_new_user function to remove email column reference
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$function$;

-- Fix update_lead_score to prevent infinite recursion
-- The trigger was updating leads table which re-triggers the function
CREATE OR REPLACE FUNCTION public.update_lead_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lead_id UUID;
  v_new_score INTEGER;
BEGIN
  -- Determine which lead to update
  IF TG_TABLE_NAME = 'leads' THEN
    v_lead_id := NEW.id;
    -- Only calculate score, don't update (we'll set it directly on NEW)
    v_new_score := calculate_lead_score(v_lead_id);
    NEW.score := v_new_score;
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'lead_activities' THEN
    v_lead_id := NEW.lead_id;
    -- Calculate and update the score for activities trigger
    v_new_score := calculate_lead_score(v_lead_id);
    UPDATE leads SET score = v_new_score WHERE id = v_lead_id;
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Make sure the trigger on leads is BEFORE INSERT/UPDATE (not AFTER)
-- so we can modify NEW.score directly without causing recursion
DROP TRIGGER IF EXISTS update_lead_score_on_change ON leads;
CREATE TRIGGER update_lead_score_on_change
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_score();