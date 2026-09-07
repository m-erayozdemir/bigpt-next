# BiGPT-Next

A document-assisted AI chat application with web and mobile clients. Developed by
Mehmet Eray Ozdemir during an internship, it combines document retrieval, streamed
responses and automatic model selection behind an Express API.

**Technologies:** React, Express, Expo/React Native, Ollama, Transformers.js,
PDF extraction and server-sent events (SSE).

## Key capabilities

- Web chat with Markdown rendering, streamed responses and model selection.
- PDF text extraction and image descriptions through LLaVA.
- Retrieval over document chunks using multilingual embeddings and cosine similarity.
- Rule-based model routing using language, task keywords and available context.
- Expo mobile client for chat and document uploads.

## Architecture

| Component | Role |
| --- | --- |
| `frontend/` | React chat interface and streaming API client |
| `backend/routes/` | Chat, streaming and document upload endpoints |
| `backend/services/` | Model calls, automatic routing, embeddings and retrieval |
| `BiGPT-Mobile/` | Expo/React Native client |

The model menu includes LLaMA 3.1, Qwen 2.5, DeepSeek R1 and Mistral. Images are
processed with LLaVA; document embeddings use
`Xenova/paraphrase-multilingual-MiniLM-L12-v2`. Retrieved context is added to the
current prompt, and the response is streamed to the client.

## Runtime requirements

The project previously used RunPod-hosted inference. That environment is no
longer active. This repository contains the application source; model weights,
company documents, uploaded files and cached RAG records are excluded.

For full operation:

1. Configure an Ollama service with the required models.
2. Copy `backend/.env.example` to `backend/.env` and set `OLLAMA_URL`.
3. In `backend/`, run `npm install` and `npm start`.
4. In `frontend/`, copy `.env.example` to `.env.local`, set `VITE_PREVIEW=false`
   and configure `VITE_API_URL`. Run `pnpm install` and `pnpm dev`.

Optional system PDFs belong in `backend/docs/` and are indexed at startup.
Embedding weights may be downloaded on first use.

For mobile, configure `EXPO_PUBLIC_API_URL` using `BiGPT-Mobile/.env.example`,
install its dependencies and run `npm start`. A physical device needs an address
that can reach the backend.

### Interface-only preview

The frontend can also open without model infrastructure. With Node.js 22.12+
from `frontend/`:

```sh
pnpm install
cp .env.example .env.local
pnpm dev --host 127.0.0.1
```

The example sets `VITE_PREVIEW=true`. This clearly labeled mode disables backend
requests, messaging and uploads, while retaining the interface and model menu.
It does not simulate AI responses.

## Validation and limitations

The web production build and ESLint checks passed. The interface-only preview
was opened successfully. Model-backed chat, retrieval and the mobile client have
not been revalidated because the original inference environment is unavailable.

This is a single-user prototype: document stores are shared, mounting a client
resets the user store, and authentication and per-user isolation are not implemented.
Backend CORS is unrestricted and upload sizes are not capped. A public deployment
would require these controls and live integration testing. Model quality and
standards compliance have not been benchmarked.

## Author

Mehmet Eray Ozdemir. Published as an internship portfolio project.
No new project-wide license is assigned; existing dependency licenses apply.
