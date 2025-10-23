#!/usr/bin/env bash
set -euo pipefail

# EasyPanel installer helper for Debian/Ubuntu
# - Installs Docker (official repo)
# - Optionally configures UFW for 22/80/443
# - Runs EasyPanel official installer

if [[ $(id -u) -ne 0 ]]; then
  echo "[ERRO] Execute como root (use sudo -i ou sudo bash)." >&2
  exit 1
fi

echo "[INFO] Detectando sistema..."
if [[ -f /etc/os-release ]]; then
  . /etc/os-release
else
  echo "[ERRO] /etc/os-release não encontrado. Sistema não suportado por este script." >&2
  exit 1
fi

if [[ "${ID:-}" != "ubuntu" && "${ID:-}" != "debian" ]]; then
  echo "[ERRO] Script preparado para Ubuntu/Debian. Detectado: ${ID:-desconhecido}." >&2
  echo "       Me avise a distro exata que envio comandos equivalentes."
  exit 1
fi

echo "[INFO] Atualizando pacotes..."
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

echo "[INFO] Instalando dependências para Docker..."
apt-get install -y ca-certificates curl gnupg lsb-release

install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
  curl -fsSL https://download.docker.com/linux/${ID}/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
fi

echo "[INFO] Registrando repositório Docker..."
ARCH=$(dpkg --print-architecture)
CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${ID} ${CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -y

echo "[INFO] Instalando Docker Engine e Compose..."
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

echo "[OK] Docker instalado: $(docker --version)"
echo "[OK] Compose plugin: $(docker compose version || echo 'compose-plugin não encontrado')"

if command -v ufw >/dev/null 2>&1; then
  echo "[INFO] UFW já instalado. Ajustando regras..."
else
  echo "[INFO] Instalando UFW (firewall)..."
  apt-get install -y ufw || true
fi

if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH || true
  ufw allow 80 || true
  ufw allow 443 || true
  yes | ufw enable || true
  ufw status || true
else
  echo "[WARN] UFW não disponível. Certifique-se de liberar as portas 22, 80 e 443."
fi

echo "[INFO] Instalando EasyPanel via instalador oficial..."
echo "[INFO] Este comando baixa e executa o instalador do fornecedor."
set +e
curl -fsSL https://get.easypanel.io | bash
EP_STATUS=$?
set -e

if [[ ${EP_STATUS} -ne 0 ]]; then
  echo "[ERRO] Falha ao executar o instalador automático do EasyPanel."
  echo "       Verifique sua conectividade ou consulte a documentação oficial: https://easypanel.io"
  echo "       Caso a URL do instalador tenha mudado, atualize o comando acima."
  exit ${EP_STATUS}
fi

echo "[SUCESSO] EasyPanel instalado."
echo "Próximos passos:"
echo "- Acesse o painel no domínio/IP configurado e finalize o onboarding."
echo "- Configure HTTPS (Let’s Encrypt) no próprio painel, se aplicável."
echo "- Mantenha o sistema e o Docker atualizados."

