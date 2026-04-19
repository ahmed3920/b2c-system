import { Fragment, useState } from "react";
import { Mail, Calendar, User as UserIcon, FileText, CalendarClock, Image as ImageIcon, ExternalLink } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

/**
 * Renders a posted timeline note. If the note matches one of our template
 * markers (warning email, schedule meeting, meeting follow-up), it renders a
 * structured card. Otherwise it falls back to a small markdown-ish renderer
 * supporting **bold**, [text](url), bare URLs and ![alt](url) images.
 */
export function StepNoteRenderer({ text }: { text: string }) {
  if (text.startsWith("📧 **Warning Email Sent**")) {
    return <WarningEmailCard text={text} />;
  }
  if (text.startsWith("📅 **Evaluation Meeting Scheduled**")) {
    return <MeetingScheduledCard text={text} />;
  }
  if (text.startsWith("📝 **Meeting Follow-up**")) {
    return <MeetingFollowupCard text={text} />;
  }
  return <PlainNote text={text} />;
}

/* ---------------- Template cards ---------------- */

function WarningEmailCard({ text }: { text: string }) {
  const subject = extract(text, /\*\*Subject:\*\*\s*(.+)/);
  const to = extract(text, /\*\*To:\*\*\s*(.+)/);
  const date = extract(text, /\*\*Date:\*\*\s*(.+)/);
  const image = extractImage(text);
  const body = stripKnownLines(text, [
    "📧 **Warning Email Sent**",
    /\*\*Subject:\*\*/,
    /\*\*To:\*\*/,
    /\*\*Date:\*\*/,
    /^!\[/,
  ]);

  return (
    <div className="rounded-md border border-blue-500/30 bg-blue-500/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border-b border-blue-500/20">
        <Mail className="w-4 h-4 text-blue-700" />
        <span className="text-sm font-semibold text-blue-700">Warning Email Sent</span>
      </div>
      <div className="p-3 space-y-2">
        {subject && (
          <Field icon={<FileText className="w-3.5 h-3.5" />} label="Subject" value={subject} />
        )}
        {to && (
          <Field icon={<UserIcon className="w-3.5 h-3.5" />} label="To" value={to} />
        )}
        {date && (
          <Field icon={<Calendar className="w-3.5 h-3.5" />} label="Date" value={date} />
        )}
        {body && (
          <p className="text-sm whitespace-pre-wrap text-foreground/90 mt-2 pt-2 border-t border-border/50">
            {body}
          </p>
        )}
        {image && (
          <div className="mt-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <ImageIcon className="w-3 h-3" /> Email screenshot
            </div>
            <ZoomableImage src={image} alt="Email screenshot" />
          </div>
        )}
      </div>
    </div>
  );
}

function MeetingScheduledCard({ text }: { text: string }) {
  const when = extract(text, /\*\*When:\*\*\s*(.+)/);
  const topic = extract(text, /\*\*Topic:\*\*\s*(.+)/);
  const body = stripKnownLines(text, [
    "📅 **Evaluation Meeting Scheduled**",
    /\*\*When:\*\*/,
    /\*\*Topic:\*\*/,
  ]);
  return (
    <div className="rounded-md border border-purple-500/30 bg-purple-500/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 border-b border-purple-500/20">
        <CalendarClock className="w-4 h-4 text-purple-700" />
        <span className="text-sm font-semibold text-purple-700">Evaluation Meeting Scheduled</span>
      </div>
      <div className="p-3 space-y-2">
        {when && <Field icon={<Calendar className="w-3.5 h-3.5" />} label="When" value={when} />}
        {topic && <Field icon={<FileText className="w-3.5 h-3.5" />} label="Topic" value={topic} />}
        {body && (
          <p className="text-sm whitespace-pre-wrap text-foreground/90 mt-2 pt-2 border-t border-border/50">
            {body}
          </p>
        )}
      </div>
    </div>
  );
}

function MeetingFollowupCard({ text }: { text: string }) {
  // Notes start after "**Notes:**" line, recording on a "**Recording:**" line.
  const recording = extract(text, /\*\*Recording:\*\*\s*(\S+)/);
  // Everything between "**Notes:**" and (optional) "**Recording:**" is the body
  const m = text.match(/\*\*Notes:\*\*\s*\n?([\s\S]*?)(?:\n+\*\*Recording:\*\*|$)/);
  const notes = m ? m[1].trim() : "";
  return (
    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border-b border-emerald-500/20">
        <FileText className="w-4 h-4 text-emerald-700" />
        <span className="text-sm font-semibold text-emerald-700">Meeting Follow-up</span>
      </div>
      <div className="p-3 space-y-2">
        {notes && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
            <p className="text-sm whitespace-pre-wrap">{notes}</p>
          </div>
        )}
        {recording && (
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs font-medium text-muted-foreground mb-1">Recording</p>
            <a
              href={recording}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary underline inline-flex items-center gap-1 break-all"
            >
              {recording} <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Helpers ---------------- */

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground min-w-[60px]">{label}:</span>
      <span className="font-medium break-words">{value}</span>
    </div>
  );
}

function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block">
        <img
          src={src}
          alt={alt}
          className="max-h-56 rounded border hover:opacity-90 transition-opacity cursor-zoom-in"
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl p-2">
          <img src={src} alt={alt} className="w-full h-auto rounded" />
        </DialogContent>
      </Dialog>
    </>
  );
}

function extract(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

function extractImage(text: string): string | null {
  const m = text.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/);
  return m ? m[1] : null;
}

function stripKnownLines(text: string, patterns: (string | RegExp)[]): string {
  return text
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      return !patterns.some((p) =>
        typeof p === "string" ? t.startsWith(p) : p.test(t),
      );
    })
    .join("\n")
    .trim();
}

/* ---------------- Plain (free-note) renderer ---------------- */

function PlainNote({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="text-sm whitespace-pre-wrap break-words space-y-1">
      {lines.map((line, i) => (
        <Fragment key={i}>
          {renderLine(line)}
          {i < lines.length - 1 && <br />}
        </Fragment>
      ))}
    </div>
  );
}

function renderLine(line: string) {
  const imgMatch = line.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)\s*$/);
  if (imgMatch) {
    return <ZoomableImage src={imgMatch[2]} alt={imgMatch[1] || "attachment"} />;
  }
  return <span>{renderInline(line)}</span>;
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|((https?:\/\/[^\s)]+))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[1]) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(
        <a key={key++} href={match[5]} target="_blank" rel="noreferrer" className="text-primary underline">
          {match[4]}
        </a>,
      );
    } else if (match[6]) {
      parts.push(
        <a key={key++} href={match[7]} target="_blank" rel="noreferrer" className="text-primary underline break-all">
          {match[7]}
        </a>,
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
