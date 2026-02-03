-- Add missing INSERT policies for budget tables (for webhook/service role usage)

-- budget_notifications: Allow service role to insert for any user
-- Note: Service role bypasses RLS, but we need policy for authenticated users too
CREATE POLICY "Users can insert their own notifications" ON public.budget_notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- budgets_received: Allow insert for responsible users
CREATE POLICY "Users can insert budgets they are responsible for" ON public.budgets_received
  FOR INSERT WITH CHECK (auth.uid() = user_responsible);

CREATE POLICY "Admins can insert budgets" ON public.budgets_received
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

-- workflow_logs: Allow admins to insert logs
CREATE POLICY "Admins can insert logs" ON public.workflow_logs
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

-- Add delete policy for budget_requests (for admins)
CREATE POLICY "Admins can delete requests" ON public.budget_requests
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their own requests" ON public.budget_requests
  FOR DELETE USING (auth.uid() = user_id);