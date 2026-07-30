# FastAPI AI Server API Documentation

## Endpoints

- `GET /health` - Health check status
- `POST /api/v1/generation/generate` - Generate logo from text prompt via FLUX model
- `POST /api/v1/embedding/extract` - Extract feature vector via DINOv2
- `POST /api/v1/similarity/search` - Search top-K similar trademark vectors in FAISS
