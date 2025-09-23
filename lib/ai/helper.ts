export function bytesFromPrisma(data: Buffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array
    ? data
    : new Uint8Array(
        (data as Buffer).buffer,
        (data as Buffer).byteOffset,
        (data as Buffer).byteLength
      );
}

export type SupportedMediaType =
  | "text/plain"
  | "text/csv"
  | "application/csv"
  | "application/json"
  | "application/xml"
  | "application/vnd.ms-excel"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  | "application/x-parquet"
  | "application/octet-stream";

export interface FileBlob {
  name: string;
  mediaType: SupportedMediaType;
  data: Uint8Array; // from DB / storage
}

export interface FilePreview {
  name: string;
  mediaType: string;
  summary: string; // one-line description
  previewText: string; // what goes to the model
}

// --- Helpers for text-like content
const MAX_CHARS = 10_000; // keep prompts small

function clip(s: string) {
  return s.length > MAX_CHARS
    ? s.slice(0, MAX_CHARS) + "\n...[truncated]..."
    : s;
}

function decodeUtf8(u8: Uint8Array) {
  // strict = true throws on invalid sequences (better than leaking �)
  return new TextDecoder("utf-8", { fatal: true }).decode(u8);
}

// --- XLSX and Parquet parsers are optional, plug-in where you need them
async function parseXlsxToMarkdown(u8: Uint8Array): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(u8, { type: "buffer" });
  const first = wb.SheetNames[0];
  const sheet = wb.Sheets[first];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const head = rows[0] ?? [];
  const body = rows.slice(1, 11); // preview first 10 rows
  const md = [
    `# Excel Preview (${first})`,
    `Columns: ${head.join(", ")}`,
    "",
    "| " + head.join(" | ") + " |",
    "| " + head.map(() => "---").join(" | ") + " |",
    ...body.map(
      (r) => "| " + head.map((_, i) => r?.[i] ?? "").join(" | ") + " |"
    ),
  ].join("\n");
  return md;
}

async function parseParquetToMarkdown(u8: Uint8Array): Promise<string> {
  // Option A: apache-arrow + duckdb-wasm; Option B: parquet-wasm/parquets
  // Keep it stubbed here to avoid heavy deps; implement in your project.
  return "Parquet file detected. Implement parquet → markdown preview in your runtime.";
}

// ------- CSV preview helpers (cell clipping) -------
type CsvPreviewOpts = {
  maxRows?: number; // how many rows to preview
  maxCellChars?: number; // per-cell clip length
};

const DEFAULT_CSV_OPTS: Required<CsvPreviewOpts> = {
  maxRows: 5,
  maxCellChars: 120,
};

function clipCell(s: string, max = DEFAULT_CSV_OPTS.maxCellChars): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function needsQuotes(s: string): boolean {
  return /[",\r\n]/.test(s);
}

function escapeCsvCell(s: string): string {
  return `"${s.replace(/"/g, `""`)}"`;
}

function serializeCsv(rows: string[][]): string {
  return rows
    .map((r) => r.map((c) => (needsQuotes(c) ? escapeCsvCell(c) : c)).join(","))
    .join("\n");
}

/**
 * Minimal CSV parser that respects quotes, escaped quotes ("") and CRLF.
 * Stops after `maxRows` are parsed.
 */
function parseCsvRows(text: string, maxRows: number): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length && rows.length < maxRows; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === `"`) {
        // escaped quote?
        if (text[i + 1] === `"`) {
          cell += `"`; // add one quote
          i += 1; // skip the second one
        } else {
          inQuotes = false; // closing quote
        }
      } else {
        cell += ch;
      }
      continue;
    }

    // not in quotes
    if (ch === `"`) {
      inQuotes = true;
    } else if (ch === ",") {
      pushCell();
    } else if (ch === "\n") {
      pushRow();
    } else if (ch === "\r") {
      // handle CRLF or lone CR
      if (text[i + 1] === "\n") i += 1;
      pushRow();
    } else {
      cell += ch;
    }
  }

  // flush trailing data (if any) and if we still need a row
  if (rows.length < maxRows && (cell.length > 0 || row.length > 0)) {
    pushRow();
  }

  return rows.slice(0, maxRows);
}

/** Build a clipped CSV preview string */
function buildClippedCsvPreview(
  text: string,
  opts: CsvPreviewOpts = {}
): string {
  const { maxRows, maxCellChars } = { ...DEFAULT_CSV_OPTS, ...opts };
  const rows = parseCsvRows(text, maxRows);
  const clipped = rows.map((r) => r.map((c) => clipCell(c, maxCellChars)));
  return serializeCsv(clipped);
}

// --- Main normalizer
export async function normalizeForModel(file: FileBlob): Promise<FilePreview> {
  const { name, mediaType, data } = file;

  try {
    switch (mediaType) {
      case "text/plain": {
        const text = decodeUtf8(data);
        return {
          name,
          mediaType,
          summary: "Plain text",
          previewText: clip(text),
        };
      }

      case "text/csv":
      case "application/csv": {
        const text = decodeUtf8(data);
        const preview = buildClippedCsvPreview(text, {
          maxRows: 10,
          maxCellChars: 80,
        });
        return {
          name,
          mediaType,
          summary: "CSV (first ~5 lines)",
          previewText: clip(preview),
        };
      }

      case "application/json": {
        const text = decodeUtf8(data);
        const obj = JSON.parse(text);
        const pretty = JSON.stringify(obj, null, 2);
        return {
          name,
          mediaType,
          summary: "JSON (pretty-printed)",
          previewText: clip(pretty),
        };
      }

      case "application/xml": {
        const text = decodeUtf8(data);
        return {
          name,
          mediaType,
          summary: "XML (raw, first ~80k chars)",
          previewText: clip(text),
        };
      }

      case "application/vnd.ms-excel":
      case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
        const md = await parseXlsxToMarkdown(data);
        return {
          name,
          mediaType,
          summary: "Excel (sheet 1, first rows)",
          previewText: clip(md),
        };
      }

      case "application/x-parquet": {
        const md = await parseParquetToMarkdown(data);
        return {
          name,
          mediaType,
          summary: "Parquet (schema/preview)",
          previewText: clip(md),
        };
      }

      case "application/octet-stream": {
        // Unknown binary → do not send bytes to model
        return {
          name,
          mediaType,
          summary: "Binary blob (unsupported for direct LLM input)",
          previewText:
            "This is a binary file. Ask me (via tools) what you need (schema, stats, rows) and I will return textual previews.",
        };
      }
    }
  } catch (e: any) {
    return {
      name,
      mediaType,
      summary: "Failed to parse",
      previewText: `Could not parse file: ${e?.message ?? e}`,
    };
  }
}
