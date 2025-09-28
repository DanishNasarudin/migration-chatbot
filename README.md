# Migration Chatbot — Self‑Hosted (Next.js 15 + Prisma + PostgreSQL + Ollama)

This repo is a full‑stack app that helps you **inspect CSV/JSON/Excel‑like data, propose a clean schema, validate against a spec, and run reproducible experiments** with different local LLMs. It is built with **Next.js 15**, **React 19**, **Prisma**, and **PostgreSQL**, and talks to a **local Ollama** server for models.

> Quick demo flow: upload a CSV from [`/data`](./data), chat about the dataset, generate a draft schema, then run a validation or experiment and view metrics on the dashboard.

---

## ✨ Features

- **Chat UI** with file‑aware tools (attach data, ask questions, generate titles)
- **Schema generation** modes: baseline, few‑shot, schema‑guided
- **Validation & Experiments** against saved specs
- **Metrics dashboard**: latency, TTFT, throughput, success ratio, and accuracy summaries
- **Datasets manager** with uploads stored in Postgres (BYTEA)
- **Local models via Ollama** (Qwen3, DeepSeek‑R1, Gemma 3, Phi‑3, etc.)

---

## 🗂️ Project Layout (selected)

```
app/
  (chat)/
    chat/                # main chat UI
    api/                 # chat, files, history, experiments
    page.tsx             # redirects to /dashboard
  (admin)/
    dashboard/           # charts and summaries
    datasets/            # upload + list datasets
    experiments/         # list + detail
    specs/               # list + detail
    validation/          # list + detail

lib/
  ai/                    # model registry, prompts, tools
  generated/prisma/      # Prisma client output
  prisma.ts              # Prisma client singleton

prisma/
  schema.prisma          # PostgreSQL models
  migrations/            # ready-to-apply migrations

data/                    # sample CSVs for trying the app
```

---

## 🧰 Prerequisites

- **Node.js 20+** (Next 15 works best on Node 20 or 22)
- **PostgreSQL 15+** (local or managed). Docker is fine.
- **Ollama** (0.1.40+ recommended) running on the same machine or reachable over the network

Optional but useful:

- **pnpm** or **npm** (this project ships with `package-lock.json`, so `npm` is fine)
- **Prisma CLI** (installed via devDependency)
- **Docker** (to run Postgres/Ollama easily)

---

## ⚙️ Environment variables

Create a `.env` in the project root:

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/migration_chatbot?schema=public"

# Ollama (defaults to http://host.docker.internal:11434/api if unset)
# If running locally (not in Docker), prefer:
OLLAMA_API_URL="http://localhost:11434/api"

# Model choices (override defaults so the picker works out of the box)
# Recommended values that exist in the registry in this repo:
OLLAMA_CHAT_MODEL="qwen3:8b"          # or "deepseek-r1:8b", "gemma3:4b"
OLLAMA_TITLE_MODEL="llama3.2:3b"      # small title generator

# Upload size (optional). Defaults to 200MB if not set.
MAX_FILE_BYTES=209715200

# Node environment
NODE_ENV=development
```

> The app references these vars in code: `DATABASE_URL`, `OLLAMA_API_URL`, `OLLAMA_CHAT_MODEL`, `OLLAMA_TITLE_MODEL`, `MAX_FILE_BYTES`, `NODE_ENV`.

---

## 🐘 Start PostgreSQL (Docker)

If you don’t already have Postgres:

```yaml
# docker-compose.postgres.yml
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: migration_chatbot
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata: {}
```

Start it:

```bash
docker compose -f docker-compose.postgres.yml up -d
```

---

## 🤖 Install & run Ollama

1. Install Ollama: https://ollama.com/download
2. Start the server (it auto‑starts on most OS). Verify:

```bash
curl http://localhost:11434/api/tags
```

3. Pull models that the app knows about (pick a couple to begin):

```bash
ollama pull qwen3:8b
ollama pull deepseek-r1:8b
ollama pull gemma3:4b
ollama pull phi3:mini
# Optional: for embeddings (used in the provider):
ollama pull avr/sfr-embedding-mistral:latest
```

4. If Ollama runs on another host or inside Docker, set `OLLAMA_API_URL` accordingly, e.g. `http://host.docker.internal:11434/api` when the app runs in Docker on macOS/Windows.

---

## 🚀 Local development

```bash
# 1) Install deps
npm install

# 2) Generate Prisma client
npx prisma generate

# 3) Apply database migrations
#    For first-time dev setup, 'dev' will create/migrate your DB:
npx prisma migrate dev --name init

# 4) Run the app
npm run dev

# Open http://localhost:3000
```

> Tip: `npx prisma studio` opens a DB GUI at http://localhost:5555

---

## 🧪 Try it with the bundled data

There’s a `data/` folder with ready‑to‑use CSVs, including bigger ones under `data/main/`. You can **upload these in the UI**:

- Go to **Datasets** at `http://localhost:3000/datasets`
- Click **Upload**, choose a CSV (for example `data/main/shipping-ecommerce.csv`), then **Upload**
- Switch to **Chat** and start a new conversation. Attach the dataset or ask questions about it.
- Use the **Specs** and **Validation** pages to generate a schema and validate.
- Visit **Dashboard** for charts on latency, TTFT, throughput, and reliability.

Common test files in this repo:

- `data/main/shipping-ecommerce.csv`
- `data/main/stroke-prediction.csv`
- `data/ecommerce_consumer_behaviour.csv`
- `data/finance_consumer_complaints.csv`

---

## 🧩 Model registry (what’s available by default)

The app’s model picker is backed by a simple registry (see `lib/ai/models.ts`). Out of the box it includes:

- `llama3.2:3b`  ≈2.0GB  128K ctx
- `qwen3:8b`  ≈5.2GB  40K ctx
- `qwen3:14b`  ≈9.3GB  40K ctx
- `deepseek-r1:8b`  ≈5.2GB  128K ctx  (reasoning)
- `deepseek-r1:14b`  ≈9.0GB  128K ctx  (reasoning)
- `gemma3:4b`  ≈3.3GB  128K ctx
- `gemma3:12b`  ≈8.1GB  128K ctx
- `gpt-oss:20b`  ≈14GB  128K ctx  (reasoning)
- `phi3:mini`  ≈2.2GB  128K ctx
- `phi3:medium`  ≈7.9GB  128K ctx

If you set `OLLAMA_CHAT_MODEL` / `OLLAMA_TITLE_MODEL`, use one of the IDs above (e.g., `qwen3:8b` and `llama3.2:3b`).

---

## 🔐 Notes on storage and limits

- **File uploads** are stored **inside Postgres** (`DatasetFile.data` as `BYTEA`). Default upload cap is **200MB** (tunable via `MAX_FILE_BYTES`).
- If you plan to upload very large files, consider moving to a blob store (S3, GCS) and changing `services/file.ts` + `app/(chat)/api/files/upload/route.ts` accordingly.
- Prisma client is emitted to `lib/generated/prisma/` by `prisma generate` (already configured in `schema.prisma`).

---

## 🧭 Useful Scripts

```bash
npm run dev          # start Next.js in dev mode
npm run build        # build
npm run start        # run production server
npx prisma studio    # open Prisma Studio
npx prisma migrate dev --name init
npx prisma migrate deploy
```

---

## 🐞 Troubleshooting

- **“ECONNREFUSED to Ollama”**: Make sure `ollama serve` is running and `OLLAMA_API_URL` is correct from the app’s point of view (Docker vs host). Test with `curl $OLLAMA_API_URL/tags`.
- **“prisma: error DATABASE_URL not set”**: Confirm `.env` is in the project root and that you restarted the app after creating it.
- **“model not found”**: Pull the model in Ollama first, e.g. `ollama pull qwen3:8b`.
- **Large uploads fail**: Lower or raise `MAX_FILE_BYTES` and verify your reverse proxy body size limits if any.
- **Migrations applied but pages error**: Run `npx prisma generate` again to refresh the client.

---

## 📄 License

Private / internal use for now. Adjust as needed.

---

## 🙌 Acknowledgements

- Next.js, React, Tailwind
- Prisma & PostgreSQL
- Vercel AI SDK (`ai`) + custom Ollama provider
- All model authors shipped via Ollama
