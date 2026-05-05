ALTER TABLE public.login_tokens
  ALTER COLUMN token SET DEFAULT encode(extensions.gen_random_bytes(32), 'hex');