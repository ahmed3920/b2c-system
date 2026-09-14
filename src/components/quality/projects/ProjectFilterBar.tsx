import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw } from "lucide-react";
import { SearchableSelect } from "@/components/tracking/quality/QualityFilterBar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProjectFilters } from "@/hooks/useProjectAudit";

type Props = {
  filters: ProjectFilters;
  onChange: (next: Partial<ProjectFilters>) => void;
  teamLeaders: string[];
  grades: string[];
  onRefresh: () => void;
  showPublished?: boolean;
  showDates?: boolean;
};

export function ProjectFilterBar({
  filters,
  onChange,
  teamLeaders,
  grades,
  onRefresh,
  showPublished = true,
  showDates = true,
}: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {showDates && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              className="h-9 w-[150px]"
              value={filters.dateFrom}
              onChange={(e) => onChange({ dateFrom: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              className="h-9 w-[150px]"
              value={filters.dateTo}
              onChange={(e) => onChange({ dateTo: e.target.value })}
            />
          </div>
        </>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Team leader</Label>
        <SearchableSelect
          value={filters.teamLeader}
          onChange={(v) => onChange({ teamLeader: v })}
          options={teamLeaders}
          placeholder="All team leaders"
          className="w-[200px]"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Grade</Label>
        <SearchableSelect
          value={filters.grade}
          onChange={(v) => onChange({ grade: v })}
          options={grades}
          placeholder="All grades"
          className="w-[170px]"
        />
      </div>

      {showPublished && (
        <div className="space-y-1">
          <Label className="text-xs">Published</Label>
          <Select
            value={filters.published || "all"}
            onValueChange={(v) => onChange({ published: v === "all" ? "" : v })}
          >
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="yes">Published</SelectItem>
              <SelectItem value="no">Not published</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Search</Label>
        <Input
          className="h-9 w-[230px]"
          placeholder="Student, ID, tutor or project"
          defaultValue={filters.search}
          onKeyDown={(e) => {
            if (e.key === "Enter") onChange({ search: (e.target as HTMLInputElement).value });
          }}
          onBlur={(e) => onChange({ search: e.target.value })}
        />
      </div>

      <Button variant="outline" size="sm" onClick={onRefresh} className="h-9">
        <RefreshCw className="h-4 w-4 mr-1" />
        Refresh
      </Button>
    </div>
  );
}
