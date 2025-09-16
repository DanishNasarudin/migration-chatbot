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
const MAX_CHARS = 80_000; // keep prompts small

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
        const lines = text.split(/\r?\n/).slice(0, 20).join("\n");
        return {
          name,
          mediaType,
          summary: "CSV (first ~20 lines)",
          previewText: clip(lines),
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
