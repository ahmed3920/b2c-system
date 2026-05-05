import { useMemo } from "react";
import { useCmsRole } from "@/hooks/useCmsRole";
import {
  PERMISSION_MATRIX,
  assignableRolesFor,
  can as canFn,
  type CmsCapability,
} from "@/lib/cmsPermissions";

/**
 * Resolves the current user's CMS capabilities from their job title.
 * Use this everywhere instead of ad-hoc `isCmsAdmin || isCmsSupervisor` checks.
 */
export function useCmsPermissions() {
  const { title, loading } = useCmsRole();

  return useMemo(() => {
    const capabilities = title ? PERMISSION_MATRIX[title] : null;
    return {
      title,
      loading,
      capabilities,
      can: (c: CmsCapability) => canFn(title, c),
      assignableRoles: assignableRolesFor(title),
    };
  }, [title, loading]);
}
