# Rocky Legal GPU Embedding & Reranker Service

High-throughput, GPU-accelerated microservice for dense & sparse vector embeddings and cross-encoder re-ranking using **BGE-M3** and **BGE-Reranker-v2-m3**.

---

## 📋 Features

- **Dense & Sparse Embedding**: Generates 1024-dim dense vectors + lexical weights (BGE-M3) in a single pass.
- **Cross-Encoder Reranker**: High-precision semantic reranking using `bge-reranker-v2-m3` in FP16.
- **Fast Legal Document Classification**: Cosine similarity against 14 precomputed Indian legal document categories.
- **GPU Accelerated**: Optimized for NVIDIA T4, L4, A100, and RTX cards. Up to **50x faster** than CPU execution.
- **Persistent Weight Cache**: Hugging Face model weights are stored in a Docker volume, so subsequent boots take seconds.
- **Optional API Key Security**: Protects the endpoint against unauthorized public access.

---

## 🛠️ Recommended Google Cloud VM Configuration

1. **GPU Model**: 1x NVIDIA T4 (16 GB GDDR6) or 1x NVIDIA L4 (24 GB)
2. **Machine Type**: `n1-standard-4` (4 vCPUs, 15 GB RAM) for T4, or `g2-standard-4` for L4
3. **Boot Disk**: 80 GB SSD (Ubuntu 22.04 LTS)
4. **Firewall Rule**: Allow incoming TCP traffic on port `8000` (or restrict to Server 2 IP: `82.41.67.195`)

---

## 🚀 1-Click Setup on Google Cloud VM

### 1. Copy or Clone the Code to your GCP VM
```bash
# Example using scp or git:
scp -r embeding-gpu-model user@<GCP_EXTERNAL_IP>:~/
```

### 2. Run the Bootstrap Script
```bash
cd ~/embeding-gpu-model
sudo bash setup-gcp-gpu.sh
```

The script will automatically:
- Check and install NVIDIA GPU drivers.
- Install Docker and NVIDIA Container Toolkit.
- Build the CUDA container.
- Download BGE-M3 and Reranker models into persistent volume cache.
- Start the server on port `8000`.

---

## 🔌 Connecting to Server 2 (NestJS Backend)

On **Server 2 (`82.41.67.195`)**:

1. Edit `/root/.env.backend`:
   ```bash
   EMBEDDING_SERVER_URL=http://<GCP_GPU_EXTERNAL_IP>:8000
   ```
2. If you set an `API_KEY` in `.env` on the GPU server, pass it or leave blank for open internal access.
3. Restart the backend container:
   ```bash
   docker rm -f nyayaai-backend
   docker run -d --name nyayaai-backend --restart unless-stopped --network host --env-file /root/.env.backend saga8521/backend:latest
   ```

---

## 🧪 Testing the Service

```bash
# Health Check (displays GPU memory and model status)
curl http://<GCP_EXTERNAL_IP>:8000/health

# Embedding Test
curl -X POST http://<GCP_EXTERNAL_IP>:8000/embed \
  -H "Content-Type: application/json" \
  -d '{"texts": ["Section 302 of Indian Penal Code deals with punishment for murder."]}'

# Rerank Test
curl -X POST http://<GCP_EXTERNAL_IP>:8000/rerank \
  -H "Content-Type: application/json" \
  -d '{
    "query": "punishment for murder under BNS",
    "documents": [
      "Section 103 of Bharatiya Nyaya Sanhita 2023 prescribes punishment for murder.",
      "The Income Tax Act deals with taxation of individuals and corporations."
    ]
  }'
```
