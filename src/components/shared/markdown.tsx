import * as React from "react";

/**
 * Minimal, safe Markdown renderer for admin-edited legal pages (no raw HTML is ever rendered):
 * "## heading", "- list item", blank-line paragraphs, **bold** and [text](https://url).
 */
function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={`${keyPrefix}-b${i++}`}>{m[1]}</strong>);
    else out.push(<a key={`${keyPrefix}-a${i++}`} href={m[3]} className="font-medium text-brand underline underline-offset-2" rel="noopener noreferrer">{m[2]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className="prose-legal">
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter(Boolean);
        if (!lines.length) return null;
        if (lines[0].startsWith("## ")) {
          return (
            <React.Fragment key={bi}>
              <h2>{inline(lines[0].slice(3), `h${bi}`)}</h2>
              {lines.length > 1 && <Markdown source={lines.slice(1).join("\n")} />}
            </React.Fragment>
          );
        }
        if (lines.every((l) => l.startsWith("- "))) {
          return <ul key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.slice(2), `l${bi}-${li}`)}</li>)}</ul>;
        }
        return <p key={bi}>{lines.flatMap((l, li) => (li ? [<br key={`br${li}`} />, ...inline(l, `p${bi}-${li}`)] : inline(l, `p${bi}-${li}`)))}</p>;
      })}
    </div>
  );
}
