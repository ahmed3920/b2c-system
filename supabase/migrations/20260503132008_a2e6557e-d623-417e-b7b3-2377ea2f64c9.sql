
ALTER TABLE public.login_tokens DROP COLUMN IF EXISTS expires_at;
ALTER TABLE public.login_tokens DROP COLUMN IF EXISTS used_at;
