import React from 'react';

/**
 * Minimal, safe renderer for the advisor's answer format: `**HEADING**` lines, `- ` bullets and
 * inline `**bold**`. It builds React elements (no HTML injection) and never reorders or edits the text.
 */
const renderInline = (text: string, keyPrefix: string): React.ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    /^\*\*[^*]+\*\*$/.test(part) ? (
      <strong key={`${keyPrefix}-${i}`} className="font-semibold text-white">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>
    )
  );

export const AmiRichText: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n').map((l) => l.trimEnd());
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flush = (key: string) => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={key} className="list-disc pl-4 flex flex-col gap-1">
        {bullets.map((b, i) => (
          <li key={i}>{renderInline(b, `${key}-${i}`)}</li>
        ))}
      </ul>
    );
    bullets = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) {
      flush(`ul-${idx}`);
      return;
    }
    const bullet = /^[-•]\s+(.*)$/.exec(line);
    if (bullet) {
      bullets.push(bullet[1]);
      return;
    }
    flush(`ul-${idx}`);
    if (/^\*\*[^*]+\*\*$/.test(line)) {
      blocks.push(
        <p key={`h-${idx}`} className="text-[10px] uppercase tracking-wider text-white/55 font-semibold mt-2 first:mt-0">
          {line.slice(2, -2)}
        </p>
      );
    } else {
      blocks.push(<p key={`p-${idx}`}>{renderInline(line, `p-${idx}`)}</p>);
    }
  });
  flush('ul-end');

  return <div className="flex flex-col gap-1.5">{blocks}</div>;
};
