import { useRef, useState } from "react";
import { Download, ExternalLink, Link2, Loader2, Paperclip, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { ParentAttachment } from "./useCSTickets";

interface Props {
  ticketId?: string | null; // when null/undefined, upload is deferred (form mode)
  attachments: ParentAttachment[];
  onChange: (next: ParentAttachment[]) => void;
  canEdit: boolean;
  currentUserId?: string | null;
  currentUserName?: string | null;
  storageFolder?: string; // e.g. "parent"
  onFilesPicked?: (files: File[]) => void; // deferred mode: parent gets actual File objects
}

export function ParentAttachmentsPanel({
  ticketId,
  attachments,
  onChange,
  canEdit,
  currentUserId,
  currentUserName,
  storageFolder = "parent",
}: Props) {
  const [linkInput, setLinkInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // In form mode (no ticketId), keep selected files in memory until parent persists.
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const addLink = () => {
    const url = linkInput.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      toast({ title: "Invalid link", description: "Must start with http(s)://", variant: "destructive" });
      return;
    }
    onChange([
      ...attachments,
      {
        kind: "link",
        url,
        added_at: new Date().toISOString(),
        added_by: currentUserId ?? undefined,
        added_by_name: currentUserName ?? undefined,
      },
    ]);
    setLinkInput("");
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    // Deferred upload mode: stash files; parent form will upload after insert
    if (!ticketId) {
      setPendingFiles((cur) => [...cur, ...arr]);
      onChange([
        ...attachments,
        ...arr.map((f) => ({
          kind: "file" as const,
          url: `pending:${f.name}`,
          label: f.name,
          size: f.size,
          mime: f.type,
          added_at: new Date().toISOString(),
          added_by: currentUserId ?? undefined,
          added_by_name: currentUserName ?? undefined,
        })),
      ]);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    setProgress({ current: 0, total: arr.length, name: arr[0]?.name ?? "" });
    try {
      const added: ParentAttachment[] = [];
      for (let i = 0; i < arr.length; i++) {
        const file = arr[i];
        setProgress({ current: i, total: arr.length, name: file.name });
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${ticketId}/${storageFolder}/${Date.now()}_${safe}`;
        const { error } = await supabase.storage
          .from("cs-recordings")
          .upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (error) throw error;
        added.push({
          kind: "file",
          url: path,
          path,
          label: file.name,
          size: file.size,
          mime: file.type,
          added_at: new Date().toISOString(),
          added_by: currentUserId ?? undefined,
          added_by_name: currentUserName ?? undefined,
        });
        setProgress({ current: i + 1, total: arr.length, name: file.name });
      }
      const next = [...attachments, ...added];
      onChange(next);
      // Persist immediately when working against a saved ticket
      const { error: updErr } = await supabase
        .from("cs_tickets")
        .update({ parent_attachments: next } as any)
        .eq("id", ticketId);
      if (updErr) throw updErr;
      toast({ title: `Uploaded ${added.length} file(s)` });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAt = async (idx: number) => {
    const rec = attachments[idx];
    const next = attachments.filter((_, i) => i !== idx);
    onChange(next);
    if (rec.kind === "file" && rec.path && ticketId) {
      await supabase.storage.from("cs-recordings").remove([rec.path]);
    }
    if (ticketId) {
      await supabase.from("cs_tickets").update({ parent_attachments: next } as any).eq("id", ticketId);
    }
    // remove from pendingFiles if matches by name (best effort)
    if (!ticketId && rec.kind === "file") {
      setPendingFiles((cur) => {
        const i = cur.findIndex((f) => f.name === rec.label);
        if (i === -1) return cur;
        return cur.filter((_, j) => j !== i);
      });
    }
  };

  const open = async (rec: ParentAttachment) => {
    if (rec.kind === "link") {
      window.open(rec.url, "_blank", "noopener");
      return;
    }
    if (!rec.path) return;
    const { data, error } = await supabase.storage.from("cs-recordings").createSignedUrl(rec.path, 60 * 60);
    if (error || !data) {
      toast({ title: "Cannot open file", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Parent Attachments</Label>
        <span className="text-xs text-muted-foreground">Records, images, or files sent by the parent</span>
      </div>

      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No attachments yet.</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((rec, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 rounded border bg-muted/30 px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                {rec.kind === "link" ? (
                  <Link2 className="h-4 w-4 shrink-0" />
                ) : (
                  <Paperclip className="h-4 w-4 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="truncate" title={rec.label || rec.url}>
                    {rec.label || rec.url}
                  </div>
                  {rec.added_by_name && (
                    <div className="text-xs text-muted-foreground truncate">Added by {rec.added_by_name}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {(!rec.url?.startsWith("pending:")) && (
                  <Button size="icon" variant="ghost" onClick={() => open(rec)} title="Open">
                    {rec.kind === "link" ? <ExternalLink className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                  </Button>
                )}
                {canEdit && (
                  <Button size="icon" variant="ghost" onClick={() => removeAt(idx)} title="Remove">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {progress && (
        <div className="space-y-1 rounded-md border bg-muted/40 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="truncate font-medium">
              Uploading {progress.current + (progress.current < progress.total ? 1 : 0)}/{progress.total}: {progress.name}
            </span>
            <span className="text-muted-foreground">
              {Math.round((progress.current / progress.total) * 100)}%
            </span>
          </div>
          <Progress value={(progress.current / progress.total) * 100} />
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Paste a link (https://...)"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <Button type="button" variant="outline" onClick={addLink} disabled={uploading}>
            <Plus className="mr-2 h-4 w-4" /> Add Link
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}
            Upload File
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Helper used by CSTicketFormDialog: after inserting a ticket, upload any files
 * the user added during the form session and replace pending entries with real paths.
 */
export async function uploadPendingParentAttachments(opts: {
  ticketId: string;
  pending: { file: File; meta: ParentAttachment }[];
  existingNonFile: ParentAttachment[];
}): Promise<ParentAttachment[]> {
  const uploaded: ParentAttachment[] = [];
  for (const { file, meta } of opts.pending) {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${opts.ticketId}/parent/${Date.now()}_${safe}`;
    const { error } = await supabase.storage
      .from("cs-recordings")
      .upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (error) throw error;
    uploaded.push({ ...meta, url: path, path });
  }
  return [...opts.existingNonFile, ...uploaded];
}
