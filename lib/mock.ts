import { ChatMessage } from "./types";

export const chatsMock = [
  {
    id: "1",
    name: "chat 1",
  },
  {
    id: "2",
    name: "chat 2",
  },
  {
    id: "3",
    name: "chat 3",
  },
  {
    id: "4",
    name: "chat 4",
  },
  {
    id: "5",
    name: "chat 5",
  },
  {
    id: "6",
    name: "chat 6",
  },
  {
    id: "7",
    name: "chat 7",
  },
  {
    id: "8",
    name: "chat 8",
  },
  {
    id: "9",
    name: "chat 9",
  },
];

export const mockChatMessages: ChatMessage[] = [
  {
    id: "msg_sys_0001",
    role: "system",
    metadata: {
      createdAt: "2025-09-16T01:58:00.000Z",
    },
    parts: [
      {
        type: "text",
        text: "You are a helpful assistant. When given a CSV, summarize it and, if asked, generate a chart.",
        state: "done",
      },
    ],
  },
  {
    id: "msg_user_1001",
    role: "user",
    metadata: {
      createdAt: "2025-09-16T01:59:10.000Z",
    },
    parts: [
      {
        type: "text",
        text: "Plot a bar chart of total sales by region from the attached CSV, then summarize key insights.",
        state: "done",
      },
      {
        type: "file",
        mediaType: "text/csv",
        filename: "sales_by_region.csv",
        url: "https://example.com/files/sales_by_region.csv",
      },
      // Example of sending a custom data part alongside the user message
      {
        type: "data-id",
        id: "dp_user_meta_1",
        data: "client-upload-42",
      },
    ],
  },
  {
    id: "msg_asst_2001",
    role: "assistant",
    metadata: {
      createdAt: "2025-09-16T02:00:02.000Z",
    },
    parts: [
      // (Optional) streaming-like text delta first
      {
        type: "text",
        text: "Parsing CSV and preparing the chart…",
        state: "streaming",
      },
      // Custom data parts you defined (all strongly typed)
      {
        type: "data-textDelta",
        id: "dp_text_1",
        data: "Reading headers… detected columns: region, total_sales.",
      },
      {
        type: "data-sheetDelta",
        id: "dp_sheet_1",
        data: "Normalized 8 region names; filled 2 missing totals with 0.",
      },
      {
        type: "data-codeDelta",
        id: "dp_code_1",
        data: "const totals = rows.reduce((m, r) => (m[r.region] = (m[r.region] ?? 0) + r.total_sales, m), {} as Record<string, number>);",
      },
      // Final assistant text
      {
        type: "text",
        text: "Here’s the chart and a short summary. Peak sales in North, followed by West; East underperforms 18% below mean.",
        state: "done",
      },
      // An image artifact you might render in UI (string fits your `imageDelta: string`)
      {
        type: "data-imageDelta",
        id: "dp_img_1",
        data: "https://example.com/artifacts/sales_by_region_bar.png",
      },
      // Title + id you might pin in your UI
      {
        type: "data-title",
        id: "dp_title_1",
        data: "Sales by Region (Q3)",
      },
      {
        type: "data-id",
        id: "dp_id_1",
        data: "artifact-7c973e",
      },
      // Append a follow-up message instruction to your client
      {
        type: "data-appendMessage",
        id: "dp_append_1",
        data: "Would you like a stacked bar by product category or a trend line across months?",
      },
      // Signal that this response is “complete” in your UI pipeline
      {
        type: "data-finish",
        id: "dp_finish_1",
        data: null,
      },
    ],
  },
  {
    id: "msg_user_1002",
    role: "user",
    metadata: {
      createdAt: "2025-09-16T02:01:40.000Z",
    },
    parts: [
      {
        type: "text",
        text: "Nice. Can you also share the raw numbers table you computed for each region?",
        state: "done",
      },
      {
        type: "data-clear",
        id: "dp_clear_hint_1",
        data: null, // e.g., tell UI to clear a transient loader/overlay
      },
    ],
  },
  {
    id: "msg_asst_2002",
    role: "assistant",
    metadata: {
      createdAt: "2025-09-16T02:02:05.000Z",
    },
    parts: [
      {
        type: "text",
        text: "Attaching the derived table now. You can download it as CSV or copy to clipboard.",
        state: "done",
      },
      // Pretend we also generate a file the user can download
      {
        type: "file",
        mediaType: "text/csv",
        filename: "derived_totals_by_region.csv",
        url: "https://example.com/artifacts/derived_totals_by_region.csv",
      },
      {
        type: "data-sheetDelta",
        id: "dp_sheet_2",
        data: "Region,Total\nNorth,182340\nWest,160120\nSouth,149980\nEast,112400\nCentral,120010\nCoastal,118770\nMountain,101330\nValley,98950\n",
      },
      {
        type: "data-appendMessage",
        id: "dp_append_2",
        data: "Need a variance chart or CI bands as well?",
      },
    ],
  },
];
