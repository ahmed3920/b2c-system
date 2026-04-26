import { supabase } from "@/integrations/supabase/client";

export type FeatureDocStatus = "planned" | "in_progress" | "completed" | "needs_review";

export interface FeatureDoc {
  id: string;
  feature_name: string;
  module: string;
  description: string;
  purpose: string;
  functionalities: string[];
  user_roles: string[];
  status: FeatureDocStatus;
  how_it_works: string;
  ui_explanation: string;
  notes: string;
  screenshots: string[];
  route_path: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export const STATUS_LABEL: Record<FeatureDocStatus, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  completed: "Completed",
  needs_review: "Needs Review",
};

export const STATUS_STYLE: Record<FeatureDocStatus, string> = {
  planned: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  completed: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
  needs_review: "bg-muted text-muted-foreground border-border",
};

export const MODULE_ORDER = [
  "Overview",
  "Operations",
  "Tracking",
  "Growth & Risk",
  "Task Tracker",
  "Admin",
  "Other",
];

export async function fetchFeatureDocs(): Promise<FeatureDoc[]> {
  const { data, error } = await supabase
    .from("feature_documentation")
    .select("*")
    .order("display_order", { ascending: true })
    .order("feature_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FeatureDoc[];
}

export async function createFeatureDoc(
  doc: Partial<FeatureDoc> & { feature_name: string; module: string },
): Promise<FeatureDoc> {
  const { data: userRes } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("feature_documentation")
    .insert({
      feature_name: doc.feature_name,
      module: doc.module,
      description: doc.description ?? "",
      purpose: doc.purpose ?? "",
      functionalities: doc.functionalities ?? [],
      user_roles: doc.user_roles ?? [],
      status: doc.status ?? "needs_review",
      how_it_works: doc.how_it_works ?? "",
      ui_explanation: doc.ui_explanation ?? "",
      notes: doc.notes ?? "",
      screenshots: doc.screenshots ?? [],
      route_path: doc.route_path ?? null,
      display_order: doc.display_order ?? 999,
      created_by: userRes.user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as FeatureDoc;
}

export async function updateFeatureDoc(id: string, patch: Partial<FeatureDoc>): Promise<FeatureDoc> {
  const { data, error } = await supabase
    .from("feature_documentation")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as FeatureDoc;
}

export async function deleteFeatureDoc(id: string): Promise<void> {
  const { error } = await supabase.from("feature_documentation").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadScreenshot(file: File, docId: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${docId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("feature-docs")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("feature-docs").getPublicUrl(path);
  return data.publicUrl;
}

export function moduleStats(docs: FeatureDoc[]) {
  const grouped = new Map<string, FeatureDoc[]>();
  for (const d of docs) {
    const arr = grouped.get(d.module) ?? [];
    arr.push(d);
    grouped.set(d.module, arr);
  }
  return Array.from(grouped.entries())
    .map(([module, items]) => ({
      module,
      total: items.length,
      completed: items.filter((i) => i.status === "completed").length,
      in_progress: items.filter((i) => i.status === "in_progress").length,
      planned: items.filter((i) => i.status === "planned").length,
      needs_review: items.filter((i) => i.status === "needs_review").length,
      items,
    }))
    .sort((a, b) => {
      const ai = MODULE_ORDER.indexOf(a.module);
      const bi = MODULE_ORDER.indexOf(b.module);
      if (ai === -1 && bi === -1) return a.module.localeCompare(b.module);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
}
