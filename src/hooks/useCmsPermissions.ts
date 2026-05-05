import { useEffect, useMemo, useState } from "react";
import { useCmsRole } from "@/hooks/useCmsRole";
import {
  assignableRolesFor,
  type CmsCapability,
} from "@/lib/cmsPermissions";
import {
  getEffectiveCapabilities,
  subscribePermissionOverrides,
} from "@/lib/cmsPermissionOverrides";

/**
 * Resolves the current user's CMS capabilities from their job title,
 * honoring any admin-set overrides stored locally.
 */
export function useCmsPermissions() {
  const { title, loading } = useCmsRole();
  const [version, setVersion] = useState(0);

  useEffect(() => subscribePermissionOverrides(() => setVersion((v) => v + 1)), []);

  return useMemo(() => {
    const capabilities = title ? getEffectiveCapabilities(title) : null;
    return {
      title,
      loading,
      capabilities,
      can: (c: CmsCapability) => (capabilities ? !!capabilities[c] : false),
      assignableRoles: title
        ? (capabilities?.assign_any_role
            ? (["developer", "senior_developer", "reviewer", "team_leader"] as const)
            : capabilities?.assign_dev_reviewer_only
              ? (["developer", "reviewer"] as const)
              : assignableRolesFor(title))
        : [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, loading, version]);
}
