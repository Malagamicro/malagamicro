-- Fix security issues: Remove overly permissive RLS policy on leads table
-- and consolidate duplicate profile policies

-- 1. Drop the overly permissive "Authenticated users can manage leads" policy
DROP POLICY IF EXISTS "Authenticated users can manage leads" ON public.leads;

-- 2. Fix profiles table: Remove duplicate/conflicting SELECT policies
-- Keep only the user_id-based policy since user_id is the correct reference
DROP POLICY IF EXISTS "Users can see own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Users can see their own profile" ON public.profiles;

-- The "Users can view their own profile" policy with (auth.uid() = user_id) remains
-- This is the correct policy since profiles.user_id references the authenticated user