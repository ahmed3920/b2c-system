import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useUserRole";

export interface FeatureControl {
  id: string;
  feature_key: string;
  name: string;
  description: string | null;
  route_path: string | null;
  enabled_admin: boolean;
  enabled_super_team_leader: boolean;
  enabled_team_leader: boolean;
  enabled_mentor: boolean;
  enabled_community_moderator: boolean;
  display_order: number;
}

export const ROLE_FIELD: Record<AppRole, keyof FeatureControl> = {
  admin: "enabled_admin",
  super_team_leader: "enabled_super_team_leader",
  team_leader: "enabled_team_leader",
  mentor: "enabled_mentor",
  community_moderator: "enabled_community_moderator",
};

export function useFeatureControls() {
  const [features, setFeatures] = useState<FeatureControl[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("feature_controls")
      .select("*")
      .order("display_order", { ascending: true });
    setFeatures((data as FeatureControl[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { features, loading, refresh };
}

/**
 * Check if a feature is enabled for a role. Falls back to TRUE when
 * the feature is not registered, so unregistered routes stay accessible.
 */
export function isFeatureEnabled(
  features: FeatureControl[],
  featureKeyOrPath: string,
  role: AppRole | null,
): boolean {
  if (!role) return true;
  const f = features.find(
    (x) => x.feature_key === featureKeyOrPath || x.route_path === featureKeyOrPath,
  );
  if (!f) return true;
  return Boolean(f[ROLE_FIELD[role]]);
}
