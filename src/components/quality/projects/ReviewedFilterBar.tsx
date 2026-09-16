import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EVAL_STATUS_OPTIONS } from "@/lib/projectEvaluation";
import type { ReviewedFilters } from "@/hooks/useReviewedProjects";

type Props = {
  filters: ReviewedFilters;
  onChange: (next: Partial<ReviewedFilters>) => void;
  teamLeaders: string[];
  reviewers: { id: string; name: string }[];
  onRefresh: () => void;
  showSearch?: boolean;
};

export function ReviewedFilterBar({
  filters,
  onChange,
  teamLeaders,
  reviewers,
  onRefresh,
  showSearch = true,
}: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Reviewed from</Label>
        <Input
          type="date"
          className="h-9 w-[150px]"
          value={filters.from}
          onChange={(e) => onChange({ from: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Reviewed to</Label>
        <Input
          type="date"
          className="h-9 w-[150px]"
          value={filters.to}
          onChange={(e) => onChange({ to: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Team leader</Label>
        <Select
          value={filters.teamLeader || "all"}
          onValueChange={(v) => onChange({ teamLeader: v === "all" ? "" : v })}
        >
          <SelectTrigger className="h-9 w-[200px]">
            <SelectValue placeholder="All team leaders" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="all">All team leaders</SelectItem>
            {teamLeaders.map((tl) => (
              <SelectItem key={tl} value={tl}>
                {tl}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Reviewer</Label>
        <Select
          value={filters.reviewer || "all"}
          onValueChange={(v) => onChange({ reviewer: v === "all" ? "" : v })}
        >
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="All reviewers" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="all">All reviewers</SelectItem>
            {reviewers.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Result</Label>
        <Select
          value={filters.status || "all"}
          onValueChange={(v) => onChange({ status: v === "all" ? "" : (v as ReviewedFilters["status"]) })}
        >
          <SelectTrigger className="h-9 w-[220px]">
            <SelectValue placeholder="All results" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All results</SelectItem>
            {EVAL_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showSearch && (
        <div className="space-y-1">
          <Label className="text-xs">Search</Label>
          <Input
            className="h-9 w-[220px]"
            placeholder="Project, student, tutor…"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
          />
        </div>
      )}

      <Button variant="outline" size="sm" className="h-9" onClick={onRefresh}>
        <RefreshCw className="h-4 w-4 mr-1" /> Refresh
      </Button>
    </div>
  );
}
