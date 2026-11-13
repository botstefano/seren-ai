import type { ReactNode } from "react";

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "rule" };

function parseRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function isListItem(line: string): boolean {
  return /^\s*(?:[-*•]|\d+[.)])\s+/.test(line);
}

function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (index + 1 < lines.length && line.includes("|") && isTableSeparator(lines[index + 1])) {
      const headers = parseRow(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(parseRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }

    if (/^(?:---+|\*\*\*+|___+)$/.test(line)) {
      blocks.push({ type: "rule" });
      index += 1;
      continue;
    }

    if (isListItem(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (index < lines.length && isListItem(lines[index])) {
        items.push(lines[index].replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim());
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && lines[index].trim()) {
      const next = lines[index].trim();
      if (/^#{1,3}\s+/.test(next) || /^(?:---+|\*\*\*+|___+)$/.test(next) || isListItem(next)) break;
      if (index + 1 < lines.length && next.includes("|") && isTableSeparator(lines[index + 1])) break;
      paragraph.push(next);
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

function inlineMarkdown(value: string): ReactNode[] {
  const tokens = value.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={index} className="font-semibold text-[#23483d]">{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith("*") && token.endsWith("*")) {
      return <em key={index} className="italic">{token.slice(1, -1)}</em>;
    }
    return <span key={index}>{token}</span>;
  });
}

function CellContent({ value }: { value: string }) {
  const lines = value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/^(?:[-*•]|\d+[.)])\s+/, ""))
    .filter(Boolean);

  if (lines.length > 1) {
    return (
      <ul className="space-y-1.5">
        {lines.map((line, index) => (
          <li key={index} className="flex gap-2 text-[11px] leading-[1.55] text-[#59645d]">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#91a58f]" />
            <span>{inlineMarkdown(line)}</span>
          </li>
        ))}
      </ul>
    );
  }

  return <span>{inlineMarkdown(lines[0] ?? value)}</span>;
}

function TableCards({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const wide = headers.length > 2;
  return (
    <div className="my-2.5 space-y-2">
      {rows.map((row, rowIndex) => (
        <article key={rowIndex} className="overflow-hidden rounded-2xl border border-[#e3e9e1] bg-white shadow-[0_2px_10px_rgba(35,72,61,0.045)]">
          <div className="border-b border-[#edf0eb] bg-[#f5f8f3] px-3.5 py-2.5">
            <p className="text-[11px] font-bold leading-5 text-[#23483d]">
              <CellContent value={row[0] ?? "Detalle"} />
            </p>
          </div>
          {wide ? (
            <div className="space-y-3 px-3.5 py-3">
              {headers.slice(1).map((header, cellIndex) => {
                const value = row[cellIndex + 1] ?? "—";
                return (
                  <div key={header + cellIndex}>
                    <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#849087]">{header}</p>
                    <div className="text-[11px] leading-[1.6] text-[#59645d]"><CellContent value={value} /></div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="divide-y divide-[#edf0eb] px-3.5">
              {headers.slice(1).map((header, cellIndex) => (
                <div key={header + cellIndex} className="grid grid-cols-[minmax(76px,0.7fr)_minmax(0,1.5fr)] gap-3 py-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#849087]">{header}</p>
                  <div className="text-[11px] leading-[1.6] text-[#59645d]"><CellContent value={row[cellIndex + 1] ?? "—"} /></div>
                </div>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

export function AssistantMessage({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  return (
    <div className="space-y-2.5 text-[12px] leading-[1.7] text-[#46534b]">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const className = block.level === 1
            ? "pt-1 text-[15px] font-bold leading-6 text-[#23483d]"
            : block.level === 2
              ? "pt-1 text-[13px] font-bold leading-5 text-[#23483d]"
              : "pt-1 text-[12px] font-bold leading-5 text-[#315b4b]";
          return <h4 key={index} className={className}>{inlineMarkdown(block.text)}</h4>;
        }
        if (block.type === "paragraph") {
          return <p key={index} className="leading-[1.75]">{inlineMarkdown(block.text)}</p>;
        }
        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag key={index} className={(block.ordered ? "list-decimal" : "list-disc") + " space-y-1.5 pl-5 marker:text-[#8ca18c]"}>
              {block.items.map((item, itemIndex) => <li key={itemIndex} className="pl-1 leading-[1.65]">{inlineMarkdown(item)}</li>)}
            </ListTag>
          );
        }
        if (block.type === "table") {
          return <TableCards key={index} headers={block.headers} rows={block.rows} />;
        }
        return <div key={index} className="my-1 h-px bg-[#e8ede6]" />;
      })}
    </div>
  );
}
