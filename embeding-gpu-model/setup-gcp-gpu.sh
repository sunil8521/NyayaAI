#!/usr/bin/env bash
# ==============================================================================
# 🚀 Rocky Legal GPU Server 1-Click Bootstrap Script for Google Cloud (GCP)
# Supports: Ubuntu 22.04 LTS / Ubuntu 24.04 LTS
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}   🚀 Rocky Legal - GPU Embedding & Reranker Server Setup       ${NC}"
echo -e "${CYAN}================================================================${NC}"

# Check for root / sudo
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ Please run this script with sudo:${NC} sudo bash setup-gcp-gpu.sh"
  exit 1
fi

# 1. Verify NVIDIA Driver & GPU Hardware
echo -e "\n${YELLOW}Step 1: Checking NVIDIA GPU Hardware...${NC}"
if ! command -v nvidia-smi &> /dev/null; then
  echo -e "${YELLOW}NVIDIA driver not detected. Installing recommended headless driver...${NC}"
  apt-get update
  apt-get install -y --no-install-recommends ubuntu-drivers-common
  ubuntu-drivers install --gpgpu || ubuntu-drivers install || apt-get install -y nvidia-driver-595-server-open nvidia-utils-595-server || apt-get install -y nvidia-driver-535 nvidia-utils-535
  echo -e "${GREEN}✅ NVIDIA drivers installed. Note: If nvidia-smi fails below, reboot VM once and re-run this script.${NC}"
fi

if command -v nvidia-smi &> /dev/null; then
  echo -e "${GREEN}✅ GPU detected:${NC}"
  nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
else
  echo -e "${RED}⚠️ Warning: nvidia-smi command not found. Please reboot VM ('sudo reboot') to load GPU modules.${NC}"
fi

# 2. Install Docker & Compose (if not installed)
echo -e "\n${YELLOW}Step 2: Checking Docker Installation...${NC}"
if ! command -v docker &> /dev/null; then
  echo -e "${CYAN}Installing Docker Engine...${NC}"
  apt-get update
  apt-get install -y ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  echo -e "${GREEN}✅ Docker installed successfully.${NC}"
else
  echo -e "${GREEN}✅ Docker is already installed.${NC}"
fi

# 3. Install NVIDIA Container Toolkit for Docker GPU Passthrough
echo -e "\n${YELLOW}Step 3: Setting up NVIDIA Container Toolkit...${NC}"
if ! command -v nvidia-ctk &> /dev/null; then
  echo -e "${CYAN}Configuring NVIDIA Container Toolkit repository...${NC}"
  curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
  curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

  apt-get update
  apt-get install -y nvidia-container-toolkit
  nvidia-ctk runtime configure --runtime=docker
  systemctl restart docker
  echo -e "${GREEN}✅ NVIDIA Container Toolkit installed and Docker configured.${NC}"
else
  echo -e "${GREEN}✅ NVIDIA Container Toolkit already present.${NC}"
fi

# 4. Verify GPU passthrough in Docker
echo -e "\n${YELLOW}Step 4: Testing Docker GPU access...${NC}"
if docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi &> /dev/null; then
  echo -e "${GREEN}✅ Docker can successfully access your NVIDIA GPU!${NC}"
else
  echo -e "${YELLOW}Configuring Docker runtime and restarting daemon...${NC}"
  nvidia-ctk runtime configure --runtime=docker || true
  systemctl restart docker
fi

# 5. Build and launch the GPU Embedding Microservice
echo -e "\n${YELLOW}Step 5: Building and starting GPU Embedding Microservice...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo -e "${CYAN}Created .env from .env.example${NC}"
  fi
fi

docker compose down --remove-orphans || true
docker compose up -d --build

# 6. Wait for service warmup & healthcheck
echo -e "\n${YELLOW}Step 6: Waiting for model initialization (downloading weights on first start)...${NC}"
echo -e "${CYAN}This may take 1-3 minutes on the first boot as BGE-M3 and Reranker are cached.${NC}"

HEALTHY=0
for i in {1..30}; do
  if curl -s http://127.0.0.1:8000/health | grep -q '"status":"ok"'; then
    HEALTHY=1
    break
  fi
  echo -n "."
  sleep 6
done
echo ""

if [ "$HEALTHY" -eq 1 ]; then
  echo -e "${GREEN}================================================================${NC}"
  echo -e "${GREEN}   🎉 Rocky Legal GPU Embedding Server is UP and RUNNING!       ${NC}"
  echo -e "${GREEN}================================================================${NC}"
  echo -e "\nService Health Details:"
  curl -s http://127.0.0.1:8000/health | python3 -m json.tool || true
  
  EXTERNAL_IP=$(curl -s -4 icanhazip.com || echo "<GCP_EXTERNAL_IP>")
  echo -e "\n${CYAN}----------------------------------------------------------------${NC}"
  echo -e "${CYAN}Next Step for Server 2 (NestJS Backend):${NC}"
  echo -e "Update ${YELLOW}/root/.env.backend${NC} on Server 2 with:"
  echo -e "${GREEN}EMBEDDING_SERVER_URL=http://${EXTERNAL_IP}:8000${NC}"
  echo -e "${CYAN}----------------------------------------------------------------${NC}"
else
  echo -e "${RED}⚠️ Healthcheck timed out. Check container logs with:${NC}"
  echo -e "docker logs -f embedding-gpu-server"
fi

