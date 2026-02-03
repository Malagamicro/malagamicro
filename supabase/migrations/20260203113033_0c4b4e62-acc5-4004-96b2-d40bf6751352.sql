-- Add category field to message_templates for organizing templates
-- Using predefined categories: general, ventas, soporte, bienvenida, seguimiento, otros

-- First, let's update the column if it doesn't have proper defaults
UPDATE public.message_templates 
SET category = 'general' 
WHERE category IS NULL OR category = '';