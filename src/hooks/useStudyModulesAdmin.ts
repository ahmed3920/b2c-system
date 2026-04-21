import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StudyModule {
  id: string;
  grade_band: string;
  module_code: string;
  hours_required: number;
  display_order: number;
  is_active: boolean;
}

export const useStudyModules = () =>
  useQuery({
    queryKey: ["study-modules-admin"],
    queryFn: async (): Promise<StudyModule[]> => {
      const { data, error } = await supabase
        .from("study_modules")
        .select("id, grade_band, module_code, hours_required, display_order, is_active")
        .order("grade_band")
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as StudyModule[];
    },
  });

export const useUpsertStudyModule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Partial<StudyModule> & { id?: string }) => {
      if (m.id) {
        const { error } = await supabase
          .from("study_modules")
          .update({
            grade_band: m.grade_band,
            module_code: m.module_code,
            hours_required: m.hours_required,
            display_order: m.display_order ?? 0,
            is_active: m.is_active ?? true,
          })
          .eq("id", m.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("study_modules").insert({
          grade_band: m.grade_band!,
          module_code: m.module_code!,
          hours_required: m.hours_required!,
          display_order: m.display_order ?? 0,
          is_active: m.is_active ?? true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study-modules-admin"] }),
  });
};

export const useDeleteStudyModule = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("study_modules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study-modules-admin"] }),
  });
};
