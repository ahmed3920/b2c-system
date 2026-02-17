-- Create a temporary bucket for data imports
INSERT INTO storage.buckets (id, name, public) VALUES ('imports', 'imports', false)
ON CONFLICT (id) DO NOTHING;

-- Allow service role to access
CREATE POLICY "Service role can manage imports" ON storage.objects
FOR ALL USING (bucket_id = 'imports');
