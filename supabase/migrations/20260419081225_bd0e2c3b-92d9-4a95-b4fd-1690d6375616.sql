-- Create storage bucket for action plan attachments (screenshots, etc.)
insert into storage.buckets (id, name, public)
values ('action-plan-attachments', 'action-plan-attachments', true)
on conflict (id) do nothing;

-- Public read access
create policy "Action plan attachments are publicly accessible"
on storage.objects for select
using (bucket_id = 'action-plan-attachments');

-- Authenticated users can upload
create policy "Authenticated users can upload action plan attachments"
on storage.objects for insert
to authenticated
with check (bucket_id = 'action-plan-attachments');

-- Users can update their own uploads (path prefixed by their uid)
create policy "Users can update their own action plan attachments"
on storage.objects for update
to authenticated
using (bucket_id = 'action-plan-attachments' and (auth.uid())::text = (storage.foldername(name))[1]);

-- Users can delete their own uploads
create policy "Users can delete their own action plan attachments"
on storage.objects for delete
to authenticated
using (bucket_id = 'action-plan-attachments' and (auth.uid())::text = (storage.foldername(name))[1]);