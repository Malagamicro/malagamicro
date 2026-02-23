
-- Add theme customization columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS custom_theme jsonb DEFAULT '{}'::jsonb;

-- custom_theme will store:
-- {
--   "colorPreset": "default" | "ocean" | "forest" | "sunset" | "berry" | "slate",
--   "backgroundPattern": "none" | "dots" | "grid" | "diagonal" | "waves",
--   "fontFamily": "dm-sans" | "inter" | "poppins" | "nunito" | "outfit" | "work-sans"
-- }
