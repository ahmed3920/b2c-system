import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMergedRoster } from "@/hooks/useMergedRoster";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function GenerateTutorLinkDialog({ open, onOpenChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tutorId, setTutorId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [link, setLink] = useState("");
  const tutorRoster = useMergedRoster();

  const tutor = useMemo(() => tutorRoster.find((t) => t.id === tutorId), [tutorId, tutorRoster]);

  useEffect(() => {
    if (!open) { setTutorId(""); setLink(""); }
  }, [open]);

  const generate = async () => {
    if (!tutor) { toast({ title: "Pick a tutor first", variant: "destructive" }); return; }
    setGenerating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session!.user.id;
      const { data: profile } = await supabase.from("profiles").select("full_name, mentor_name").eq("user_id", userId).maybeSingle();
      const createdByName = profile?.full_name || profile?.mentor_name || null;
      const { data, error } = await supabase
        .from("session_incident_tokens")
        .insert({
          tutor_external_id: tutor.id,
          tutor_name: tutor.name,
          team_leader: tutor.team_leader,
          created_by: userId,
          created_by_name: createdByName,
        })
        .select()
        .single();
      if (error) throw error;
      const url = `${window.location.origin}/incident-submit?token=${data.token}`;
      setLink(url);
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    toast({ title: "Copied to clipboard" });
  };

  const genericLink = `${window.location.origin}/incident-submit`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Generate Tutor Submission Link</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border p-3 space-y-2">
            <Label>Generic public link (any tutor can use)</Label>
            <div className="flex gap-2">
              <Input value={genericLink} readOnly className="bg-muted text-xs" />
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(genericLink); toast({ title: "Copied" }); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-md border p-3 space-y-3">
            <Label>Per-tutor pre-filled link</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  <span className="truncate">{tutor ? `${tutor.name} (${tutor.id})` : "Pick tutor..."}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
                <Command>
                  <CommandInput placeholder="Search tutor..." />
                  <CommandList>
                    <CommandEmpty>No tutor found.</CommandEmpty>
                    <CommandGroup>
                      {tutorRoster.map((t) => (
                        <CommandItem key={t.id} value={`${t.name} ${t.id}`} onSelect={() => { setTutorId(t.id); setPickerOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", tutorId === t.id ? "opacity-100" : "opacity-0")} />
                          <div className="flex flex-col">
                            <span>{t.name}</span>
                            <span className="text-xs text-muted-foreground">{t.id} · {t.team_leader}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Button onClick={generate} disabled={generating || !tutor} className="w-full">
              {generating ? "Generating..." : "Generate Link"}
            </Button>
            {link && (
              <div className="flex gap-2">
                <Input value={link} readOnly className="bg-muted text-xs" />
                <Button variant="outline" size="icon" onClick={copy}><Copy className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
