# BiGPT-Next

A document-assisted chat prototype developed by Mehmet Eray Ozdemir during an
internship, combining a React web interface, Express backend and Expo/React Native
mobile client with Ollama-based model access.

| Component | Responsibilities |
| --- | --- |
| `frontend/` | Model selection, Markdown chat, streamed responses, attachments |
| `backend/` | Model routing, PDF extraction, image descriptions, retrieval, SSE |
| `BiGPT-Mobile/` | Mobile chat and document upload client |

The author previously ran model inference on RunPod. That environment is no
longer configured. Full model-backed operation has not been tested in this
preparation; this is a source-code portfolio, not a verified runnable AI demo.
This repository preserves the application source, without
model weights, original documents, uploaded files or stored RAG vectors.

## Optional interface-only preview

Use Node.js 22.12+ and pnpm. From `frontend/`:

```sh
pnpm install
cp .env.example .env.local
pnpm dev --host 127.0.0.1
```

Open the URL printed by Vite. `VITE_PREVIEW=true` disables backend reset requests,
messaging and uploads. The view is clearly labeled as a preview; it shows the
original interface and model selector without simulating AI answers. No model
or RunPod installation is needed. Build with `pnpm build`.

## Full application requirements (not provisioned here)

1. Configure an Ollama service and the models you intend to use.
2. Copy `backend/.env.example` to `backend/.env` and set `OLLAMA_URL`.
3. Install backend dependencies with `npm install`, then run `npm start`.
4. Set `VITE_PREVIEW=false` and `VITE_API_URL` in the frontend environment and
   restart Vite.

The menu offers `llama3.1:latest`, `qwen2.5:latest`, `deepseek-r1:latest` and
`mistral:latest`. Image uploads use `llava:latest`. Document embeddings use
`Xenova/paraphrase-multilingual-MiniLM-L12-v2`, which may download weights on
first use. None of these models were installed during portfolio preparation.

The automatic router uses language and keyword rules, rather than a trained
router. PDFs are parsed for text; image uploads are described with LLaVA.
Retrieval uses text chunks and vectors in local JSON stores. Optional system
PDFs belong in `backend/docs/` and are indexed at backend startup.

For mobile, configure `EXPO_PUBLIC_API_URL` using `BiGPT-Mobile/.env.example`.
A physical device needs a reachable backend address; its localhost refers to
the device itself. Backend inference and the mobile app have not been revalidated.

## Limitations and preparation changes

- Single-user prototype: no authentication or per-user document isolation.
  Mounting a client resets the shared user RAG store.
- Unrestricted backend CORS and no upload size limit; public deployment requires
  additional work. Streaming and model quality need live integration testing.
- No benchmark or standards-compliance claim is made.
- Original prompts and algorithms are retained. Preparation adds configurable
  client URLs and a backend-free interface preview.
- Company PDFs, uploads and RAG records are omitted. The unused `rag(1).js`
  duplicate is excluded; active routes use `rag.js`.

No new project license is assigned. Existing dependency licenses still apply.
