import {
  PERMISSION_MATRIX as BASE_MATRIX,
  type CmsCapability,
  type CmsCapabilityMap,
} from "./cmsPermissions";
import type { CmsJobTitle } from "./cmsJobTitles";

const STORAGE_KEY = "cms.permissionOverrides.v1";

type Overrides = Partial<Record<CmsJobTitle, Partial<CmsCapabilityMap>>>;

let overrides: Overrides = load();
const listeners = new Set<() => void>();

function load(): Overrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Overrides) : {};
  } catch {
    return {};
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function subscribePermissionOverrides(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getEffectiveMatrix(): Record<CmsJobTitle, CmsCapabilityMap> {
  const result = {} as Record<CmsJobTitle, CmsCapabilityMap>;
  (Object.keys(BASE_MATRIX) as CmsJobTitle[]).forEach((title) => {
    result[title] = { ...BASE_MATRIX[title], ...(overrides[title] ?? {}) };
  });
  return result;
}

export function getEffectiveCapabilities(title: CmsJobTitle): CmsCapabilityMap {
  return { ...BASE_MATRIX[title], ...(overrides[title] ?? {}) };
}

export function setOverride(
  title: CmsJobTitle,
  capability: CmsCapability,
  value: boolean,
) {
  const baseValue = BASE_MATRIX[title][capability];
  const next: Overrides = { ...overrides, [title]: { ...(overrides[title] ?? {}) } };
  if (value === baseValue) {
    delete next[title]![capability];
    if (Object.keys(next[title]!).length === 0) delete next[title];
  } else {
    next[title]![capability] = value;
  }
  overrides = next;
  persist();
}

export function resetOverrides(title?: CmsJobTitle) {
  if (title) {
    const next = { ...overrides };
    delete next[title];
    overrides = next;
  } else {
    overrides = {};
  }
  persist();
}

export function hasOverride(title: CmsJobTitle, capability: CmsCapability): boolean {
  return overrides[title]?.[capability] !== undefined;
}

export function getOverrides(): Overrides {
  return overrides;
}
