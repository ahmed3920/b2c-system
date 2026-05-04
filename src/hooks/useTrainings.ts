import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type TrainingCreatorType = "team_leader" | "mentor" | "tutor";

export interface TrainingPerson {
  id: string;
  name: string;
  role: "team_leader" | "mentor" | "tutor";
}

export interface TrainingAttachment {
  name: string;
  url: string;
  type: "file" | "link";
}

export interface Training {
  id: string;
  team_leader: string;
  creator_type: TrainingCreatorType;
  creator_name: string;
  creator_external_id: string | null;
  conducted_by: TrainingPerson[];
  training_date: string;
  training_time: string;
  title: string;
  notes: string | null;
  sub_teams: string[];
  material_urls: TrainingAttachment[];
  record_urls: TrainingAttachment[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingInput {
  team_leader: string;
  creator_type: TrainingCreatorType;
  creator_name: string;
  creator_external_id?: string | null;
  conducted_by: TrainingPerson[];
  training_date: string;
  training_time: string;
  title: string;
  notes?: string | null;
  sub_teams: string[];
  material_urls: TrainingAttachment[];
  record_urls: TrainingAttachment[];
}

export function useTrainings() {
  const [items, setItems] = useState<Training[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("trainings" as never)
      .select("*")
      .order("training_date", { ascending: false })
      .order("training_time", { ascending: false });
    if (error) {
      toast.error("Failed to load trainings: " + error.message);
      setItems([]);
    } else {
      setItems((data as unknown as Training[]) ?? []);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const create = useCallback(
    async (input: TrainingInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return false;
      }
      const { error } = await supabase
        .from("trainings" as never)
        .insert({ ...input, created_by: session.user.id } as never);
      if (error) {
        toast.error("Failed to create training: " + error.message);
        return false;
      }
      toast.success("Training added");
      await refetch();
      return true;
    },
    [refetch],
  );

  const update = useCallback(
    async (id: string, input: Partial<TrainingInput>) => {
      const { error } = await supabase
        .from("trainings" as never)
        .update(input as never)
        .eq("id", id);
      if (error) {
        toast.error("Failed to update training: " + error.message);
        return false;
      }
      toast.success("Training updated");
      await refetch();
      return true;
    },
    [refetch],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("trainings" as never)
        .delete()
        .eq("id", id);
      if (error) {
        toast.error("Failed to delete training: " + error.message);
        return false;
      }
      toast.success("Training deleted");
      await refetch();
      return true;
    },
    [refetch],
  );

  async function uploadFile(file: File): Promise<TrainingAttachment | null> {
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from("training-materials")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      toast.error(`Upload failed for ${file.name}: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from("training-materials").getPublicUrl(path);
    return { name: file.name, url: data.publicUrl, type: "file" };
  }

  return { items, isLoading, refetch, create, update, remove, uploadFile };
}
