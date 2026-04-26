import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  FEATURE_MODULES,
  FeaturePlan,
  FeatureStatus,
  FeatureVisibility,
  FeatureModule,
  addFeaturePlan,
  updateFeaturePlan,
} from "@/data/mockFeaturePlans";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  feature: FeaturePlan | null;
}

export function FeatureFormDialog({ open, onOpenChange, feature }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [module, setModule] = useState<FeatureModule>("Tasks");
  const [status, setStatus] = useState<FeatureStatus>("planned");
  const [progress, setProgress] = useState(0);
  const [assignedTo, setAssignedTo] = useState("");
  const [audience, setAudience] = useState<Exclude<FeatureVisibility, "hidden">>("both");
  const [visible, setVisible] = useState(true);
  const [date, setDate] = useState<Date>(new Date());

  useEffect(() => {
    if (open) {
      if (feature) {
        setName(feature.name);
        setDescription(feature.description);
        setModule(feature.module);
        setStatus(feature.status);
        setProgress(feature.progress);
        setAssignedTo(feature.assignedTo);
        setAudience(feature.visibility === "hidden" ? "both" : feature.visibility);
        setVisible(feature.visibility !== "hidden");
        setDate(new Date(feature.targetRelease));
      } else {
        setName("");
        setDescription("");
        setModule("Tasks");
        setStatus("planned");
        setProgress(0);
        setAssignedTo("");
        setAudience("both");
        setVisible(true);
        setDate(new Date());
      }
    }
  }, [open, feature]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const visibility: FeatureVisibility = visible ? audience : "hidden";
    const payload = {
      name: name.trim(),
      description: description.trim(),
      module,
      status,
      progress,
      assignedTo: assignedTo.trim() || "Unassigned",
      targetRelease: date.toISOString(),
      visibility,
    };
    try {
      if (feature) {
        await updateFeaturePlan(feature.id, payload);
        toast({ title: "Feature updated" });
      } else {
        await addFeaturePlan(payload);
        toast({ title: "Feature created" });
      }
      onOpenChange(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Failed to save feature", description: message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{feature ? "Edit Feature" : "Create Feature"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fname">Feature Name</Label>
            <Input
              id="fname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bulk Task Assignment"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fdesc">Description</Label>
            <Textarea
              id="fdesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the feature..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Module</Label>
              <Select value={module} onValueChange={(v) => setModule(v as FeatureModule)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEATURE_MODULES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as FeatureStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fassigned">Assigned To</Label>
              <Input
                id="fassigned"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="Team or person"
              />
            </div>

            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as typeof audience)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team_leaders">Team Leaders</SelectItem>
                  <SelectItem value="mentors">Mentors</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Progress</Label>
                <span className="text-sm font-medium">{progress}%</span>
              </div>
              <Slider
                value={[progress]}
                onValueChange={(v) => setProgress(v[0])}
                min={0}
                max={100}
                step={5}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Target Release Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="sm:col-span-2 flex items-center gap-2 rounded-md border border-border p-3">
              <Checkbox
                id="visible"
                checked={visible}
                onCheckedChange={(c) => setVisible(!!c)}
              />
              <Label htmlFor="visible" className="cursor-pointer">
                Visible to users
              </Label>
              <span className="text-xs text-muted-foreground ml-auto">
                {visible ? "Will appear in dashboards" : "Hidden from end users"}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>{feature ? "Save Changes" : "Create Feature"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
