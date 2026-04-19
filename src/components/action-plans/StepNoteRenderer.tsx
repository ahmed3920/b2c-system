import { Fragment } from "react";

/**
 * Tiny safe-ish renderer for our template-generated notes.
 * Supports:
 *   **bold**
 *   ![alt](url)   → <img>
 *   [text](url)   → <a>
 *   plain URLs    → <a>
 * Everything else is rendered as text with preserved line breaks.
 */
export function StepNoteRenderer({ text }: { text: string }) {
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
  // Image first: ![alt](url)
  const imgMatch = line.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)\s*$/);
  if (imgMatch) {
    return (
      <a href={imgMatch[2]} target="_blank" rel="noreferrer" className="inline-block">
        <img
          src={imgMatch[2]}
          alt={imgMatch[1] || "attachment"}
          className="max-h-64 rounded border my-1"
        />
      </a>
    );
  }
  return <span>{renderInline(line)}</span>;
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Combined regex for **bold**, [text](url), and bare urls
  const regex = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|((https?:\/\/[^\s)]+))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(
        <a
          key={key++}
          href={match[5]}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline"
        >
          {match[4]}
        </a>,
      );
    } else if (match[6]) {
      parts.push(
        <a
          key={key++}
          href={match[7]}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline break-all"
        >
          {match[7]}
        </a>,
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
