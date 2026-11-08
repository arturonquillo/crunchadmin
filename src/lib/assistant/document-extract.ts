/**
 * Extract readable text / inventory lines from Hablar attachments.
 * Images are handled separately (vision). This covers PDF, CSV, Excel, plain text.
 */

export type ExtractedLine = {
  name: string;
  quantity: number;
  unit: string;
};

export type ExtractedDocument = {
  filename: string;
  kind: "text" | "table" | "pdf" | "unknown";
  text: string;
  lines: ExtractedLine[];
};

const NAME_HEADERS = /^(insumo|producto|item|nombre|articulo|artículo|mercader[ií]a|descripcion|descripción|detalle)$/i;
const QTY_HEADERS = /^(qty|cant|cantidad|q|stock|kilos|kg|unidades)$/i;
const UNIT_HEADERS = /^(unidad|unit|um|u\.?m\.?|medida)$/i;

export function parseCsv(text: string): string[][] {
  const raw = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = raw.split("\n")[0] || "";
  const delim = guessDelim(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delim) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell.trim());
      cell = "";
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

function guessDelim(line: string): string {
  const counts: [string, number][] = [
    [",", (line.match(/,/g) || []).length],
    [";", (line.match(/;/g) || []).length],
    ["\t", (line.match(/\t/g) || []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

export function linesFromTable(rows: string[][]): ExtractedLine[] {
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  const nameIdx = header.findIndex((h) => NAME_HEADERS.test(h));
  const qtyIdx = header.findIndex((h) => QTY_HEADERS.test(h));
  const unitIdx = header.findIndex((h) => UNIT_HEADERS.test(h));

  const body = nameIdx >= 0 ? rows.slice(1) : rows;
  const nIdx = nameIdx >= 0 ? nameIdx : 0;
  const qIdx = qtyIdx >= 0 ? qtyIdx : 1;
  const uIdx = unitIdx >= 0 ? unitIdx : 2;

  const out: ExtractedLine[] = [];
  for (const r of body) {
    const parsed = parseLineCells(
      r[nIdx] || "",
      r[qIdx] || "",
      r[uIdx] || ""
    );
    if (parsed) out.push(parsed);
  }
  return out;
}

const QTY_UNIT_RE =
  /^(\d+(?:[.,]\d+)?)\s*(kg|g|l|lt|lts|litro|litros|ml|ud|un|u|unidad(?:es)?|pack|paq)?$/i;

export function parseLineCells(
  nameRaw: string,
  qtyRaw: string,
  unitRaw: string
): ExtractedLine | null {
  const name = nameRaw.replace(/\s+/g, " ").trim();
  if (!name || NAME_HEADERS.test(name)) return null;

  const qtyStr = qtyRaw.trim();
  let unit = unitRaw.trim();
  if (!qtyStr && name) {
    const m = name.match(/(.+?)\s+(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|ud)?$/i);
    if (m) {
      return parseLineCells(m[1], m[2], m[3] || unit);
    }
  }

  const combined = `${qtyStr} ${unit}`.trim();
  const m = combined.match(QTY_UNIT_RE);
  if (!m) return null;
  const quantity = Number(m[1].replace(",", "."));
  if (!(quantity > 0)) return null;
  unit = normalizeDocUnit(m[2] || unit || "ud");
  if (name.length < 2) return null;
  return { name, quantity, unit };
}

export function normalizeDocUnit(unit: string): string {
  const u = unit.trim().toLowerCase();
  if (!u) return "ud";
  if (u === "l" || u === "lt" || u === "lts" || u.startsWith("litro")) return "L";
  if (u === "ml") return "ml";
  if (u === "kg" || u === "kgs") return "kg";
  if (u === "g" || u === "gr" || u === "grs") return "g";
  if (u.startsWith("unidad") || u === "ud" || u === "un" || u === "u") return "ud";
  if (u === "pack" || u === "paq") return "ud";
  return unit.trim();
}

/** Best-effort text from simple (uncompressed / literal-string) PDFs. */
export function extractPdfText(bytes: Buffer): string {
  const raw = bytes.toString("latin1");
  const chunks: string[] = [];

  const tj = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = tj.exec(raw))) {
    chunks.push(unescapePdfString(m[0].replace(/\s*Tj$/, "")));
  }

  const tjArr = /\[(?:\s*(?:\((?:\\.|[^\\)])*\)|-?\d+(?:\.\d+)?)\s*)+\]\s*TJ/g;
  while ((m = tjArr.exec(raw))) {
    const inner = m[0];
    const parts = inner.match(/\((?:\\.|[^\\)])*\)/g) || [];
    chunks.push(parts.map((p) => unescapePdfString(p)).join(""));
  }

  const text = chunks
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 12000);
}

function unescapePdfString(wrapped: string): string {
  let s = wrapped;
  if (s.startsWith("(") && s.endsWith(")")) s = s.slice(1, -1);
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

function tableToText(rows: string[][], lines: ExtractedLine[]): string {
  const preview = rows
    .slice(0, 40)
    .map((r) => r.join(" | "))
    .join("\n");
  const lineBlock =
    lines.length > 0
      ? `\nLíneas detectadas (${lines.length}):\n${lines
          .map((l) => `- ${l.quantity} ${l.unit} ${l.name}`)
          .join("\n")}`
      : "";
  return `${preview}${lineBlock}`.slice(0, 12000);
}

type XlsxMod = {
  read: (data: Buffer, opts: { type: string }) => {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  utils: {
    sheet_to_json: (
      sheet: unknown,
      opts: { header: number; raw: boolean; defval: string }
    ) => unknown[];
  };
};

export async function extractSpreadsheet(bytes: Buffer): Promise<string[][]> {
  const mod = (await import("xlsx")) as unknown as XlsxMod & { default?: XlsxMod };
  const XLSX = mod.default ?? mod;
  const wb = XLSX.read(bytes, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  return rows.map((r) =>
    Array.isArray(r) ? r.map((c) => String(c ?? "").trim()) : []
  );
}

export function looksLikeSpreadsheet(filename: string, mime: string): boolean {
  const n = filename.toLowerCase();
  return (
    n.endsWith(".xlsx") ||
    n.endsWith(".xls") ||
    n.endsWith(".csv") ||
    n.endsWith(".tsv") ||
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime === "text/csv" ||
    mime === "text/tab-separated-values"
  );
}

export function looksLikePdf(filename: string, mime: string): boolean {
  return filename.toLowerCase().endsWith(".pdf") || mime === "application/pdf";
}

export async function extractDocument(params: {
  filename: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<ExtractedDocument> {
  const { filename, mimeType, bytes } = params;
  const mime = mimeType || "application/octet-stream";

  if (looksLikeSpreadsheet(filename, mime) || filename.toLowerCase().endsWith(".csv")) {
    let rows: string[][] = [];
    if (filename.toLowerCase().endsWith(".csv") || filename.toLowerCase().endsWith(".tsv") || mime === "text/csv") {
      rows = parseCsv(bytes.toString("utf8"));
    } else {
      try {
        rows = await extractSpreadsheet(bytes);
      } catch {
        rows = parseCsv(bytes.toString("utf8"));
      }
    }
    const lines = linesFromTable(rows);
    return {
      filename,
      kind: "table",
      text: tableToText(rows, lines),
      lines,
    };
  }

  if (looksLikePdf(filename, mime)) {
    const text = extractPdfText(bytes);
    return {
      filename,
      kind: "pdf",
      text: text || "(PDF sin texto extraíble — pedí foto o CSV)",
      lines: [],
    };
  }

  if (mime.startsWith("text/") || /\.(txt|md)$/i.test(filename)) {
    const text = bytes.toString("utf8").slice(0, 12000);
    const rows = parseCsv(text);
    const lines = rows.length > 1 ? linesFromTable(rows) : [];
    return { filename, kind: lines.length ? "table" : "text", text, lines };
  }

  return { filename, kind: "unknown", text: "", lines: [] };
}

export function wantsInventoryLoad(text: string, hasStructuredLines: boolean): boolean {
  if (!hasStructuredLines) return false;
  const t = text.trim();
  if (!t) return true;
  return /(carg[aeá]|agreg[aeá]|sum[aeá]|insumo|compra|factura|ticket|inventario|stock|recib[ií])/i.test(
    t
  );
}
