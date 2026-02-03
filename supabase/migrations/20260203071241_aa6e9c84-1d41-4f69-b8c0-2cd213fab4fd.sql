-- Drop existing RLS policies for general_reminders
DROP POLICY IF EXISTS "Users can view own reminders" ON public.general_reminders;
DROP POLICY IF EXISTS "Users can create own reminders" ON public.general_reminders;
DROP POLICY IF EXISTS "Users can update own reminders" ON public.general_reminders;
DROP POLICY IF EXISTS "Users can delete own reminders" ON public.general_reminders;

-- Create new policies: Everyone can view all reminders, but only owner can modify
CREATE POLICY "Authenticated users can view all reminders" 
  ON public.general_reminders 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create reminders" 
  ON public.general_reminders 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminders" 
  ON public.general_reminders 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminders" 
  ON public.general_reminders 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Drop existing RLS policies for osticket_tickets
DROP POLICY IF EXISTS "Users can view own osticket tickets" ON public.osticket_tickets;
DROP POLICY IF EXISTS "Users can insert osticket tickets" ON public.osticket_tickets;
DROP POLICY IF EXISTS "Users can delete own osticket tickets" ON public.osticket_tickets;

-- Create new policies: Everyone can view all tickets
CREATE POLICY "Authenticated users can view all tickets" 
  ON public.osticket_tickets 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert osticket tickets" 
  ON public.osticket_tickets 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own osticket tickets" 
  ON public.osticket_tickets 
  FOR DELETE 
  USING (auth.uid() = user_id);