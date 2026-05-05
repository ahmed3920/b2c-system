import { useEffect, useState } from "react";
import { Paperclip, X, FileText, Image as ImageIcon, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { CmsCommentAttachment } from "@/hooks/useCmsTaskComments";
import { cn } from "@/lib/utils";

const BUCKET = "cms-comment-attachments";

function isImage(mime: string) {
  return mime?.startsWith("image/");
}

export function AttachmentItem({ att }: { att: CmsCommentAttachment }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(att.path, 3600);
      if (!cancelled) setUrl(data?.signedUrl ?? null);
    })();
    return () => { cancelled = true; };
  }, [att.path]);

  if (isImage(att.mime) && url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={url}
          alt={att.name}
          className="max-h-48 rounded-md border object-cover hover:opacity-90 transition"
        />
        <div className="text-xs text-muted-foreground mt-1 truncate max-w-[12rem]">{att.name}</div>
      </a>
    );
  }
  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-3 py-2 rounded-md border bg-secondary/40 hover:bg-secondary text-xs max-w-xs"
    >
      <FileText className="w-4 h-4 shrink-0" />
      <span className="truncate flex-1">{att.name}</span>
      <Download className="w-3.5 h-3.5 opacity-60" />
    </a>
  );
}

export function AttachmentPicker({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border bg-secondary/40 hover:bg-secondary">
        <Paperclip className="w-3.5 h-3.5" />
        Attach
        <input
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const next = Array.from(e.target.files ?? []);
            if (next.length) onChange([...files, ...next]);
            e.target.value = "";
          }}
        />
      </label>
      {files.map((f, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded-md border bg-card text-xs",
          )}
        >
          {f.type.startsWith("image/") ? (
            <ImageIcon className="w-3 h-3" />
          ) : (
            <FileText className="w-3 h-3" />
          )}
          <span className="truncate max-w-[8rem]">{f.name}</span>
          <button
            type="button"
            onClick={() => onChange(files.filter((_, j) => j !== i))}
            className="opacity-60 hover:opacity-100"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
