# 🌐 Nexus — Plataforma de Comunicação

Plataforma de comunicação privada em tempo real com chat, voz, vídeo e compartilhamento de tela. Inspirada no Discord, com identidade visual própria e arquitetura moderna.

---

## 🚀 Início rápido (desenvolvimento local)

### Pré-requisitos

- **Node.js** 20+
- **Docker** e **Docker Compose**
- **npm** ou **pnpm**

### 1. Clonar e configurar

```bash
git clone https://github.com/seu-usuario/nexus.git
cd nexus

# Copiar variáveis de ambiente
cp .env.example .env
# Edite .env se necessário (as padrões funcionam para dev)
```

### 2. Subir serviços de infraestrutura

```bash
# Sobe PostgreSQL, Redis, MinIO, LiveKit, coturn e Mailhog
docker compose up -d

# Aguarda ~30s e verifica se todos estão saudáveis
docker compose ps
```

### 3. Instalar dependências e configurar o banco

```bash
# Backend
cd apps/server
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed          # Cria admin e dados de demo

# Frontend
cd ../web
npm install
```

### 4. Iniciar os servidores

```bash
# Terminal 1 — Backend (porta 4000)
cd apps/server
npm run start:dev

# Terminal 2 — Frontend (porta 3000)
cd apps/web
npm run dev
```

### 5. Acessar

| URL | Serviço |
|---|---|
| http://localhost:3000 | Frontend Nexus |
| http://localhost:4000/api/docs | Swagger API |
| http://localhost:9001 | MinIO Console |
| http://localhost:8025 | Mailhog (e-mails dev) |

**Credenciais de demo:**
- Admin: `admin@nexus.local` / `Admin@123456`
- Demo: `demo@nexus.local` / `Demo@123456`

---

## 🏗️ Arquitetura

```
nexus/
├── apps/
│   ├── web/        # Next.js 14 + TypeScript + Tailwind CSS
│   └── server/     # NestJS + TypeScript + Prisma
├── infra/
│   ├── nginx/      # Proxy reverso (produção)
│   ├── livekit/    # Configuração do SFU
│   └── coturn/     # Servidor STUN/TURN
└── docker-compose.yml
```

**Stack principal:**
- **Frontend:** Next.js 14, Tailwind CSS, Zustand, React Query, LiveKit Web SDK
- **Backend:** NestJS, Socket.IO, Prisma ORM
- **Banco:** PostgreSQL 16
- **Cache/Presença:** Redis 7
- **SFU (voz/vídeo):** LiveKit
- **TURN:** coturn
- **Storage:** MinIO (dev) / S3 compatível (prod)
- **Auth:** JWT + refresh token HTTP-only cookie
- **Senhas:** Argon2

---

## 🐳 Deploy em produção

### Docker Compose completo

```bash
# Configure todas as variáveis em .env
# IMPORTANTE: troque todos os secrets!

# Build
docker compose -f docker-compose.prod.yml build

# Subir
docker compose -f docker-compose.prod.yml up -d

# Migrations
docker compose exec server npm run prisma:migrate:prod
docker compose exec server npm run seed
```

### Variáveis críticas para produção

```env
NODE_ENV=production
APP_URL=https://seu-dominio.com
API_URL=https://seu-dominio.com

# Troque por valores aleatórios longos:
JWT_ACCESS_SECRET=<gere com: openssl rand -hex 64>
JWT_REFRESH_SECRET=<gere com: openssl rand -hex 64>
LIVEKIT_API_SECRET=<mínimo 32 chars>
TURN_CREDENTIAL=<senha forte>

# Banco de dados de produção:
DATABASE_URL=postgresql://user:pass@host:5432/nexus

# Storage S3/R2:
S3_ENDPOINT=https://...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

---

## 🛡️ Segurança

- Senhas hasheadas com **Argon2** (não MD5/SHA-1/bcrypt simples)
- Tokens JWT de acesso com validade curta (15min) + refresh rotation
- Refresh token em cookie **HTTP-only, Secure, SameSite=Lax**
- Rate limiting em todas as rotas críticas (register, login, reset)
- Validação e sanitização de todos os inputs (class-validator + whitelist)
- Upload: validação de MIME type + limite de tamanho + conversão WebP
- CORS configurado explicitamente (sem wildcard em produção)
- Headers de segurança via Helmet
- Verificação de membership no backend antes de qualquer operação
- Links de convite com token aleatório (nanoid) e expiração
- HTTPS obrigatório em produção (Nginx + SSL)
- Permissões do navegador para câmera/mic/tela nunca são contornadas

---

## 📡 Serviços externos necessários

| Serviço | Uso | Custo estimado |
|---|---|---|
| **Servidor VPS** | Hospedar backend, LiveKit, coturn | ~$12-20/mês (2 vCPU, 4GB) |
| **PostgreSQL** | Banco de dados | Incluso na VPS ou Neon free |
| **Redis** | Presença, cache | Incluso na VPS ou Upstash free |
| **LiveKit Cloud** (opcional) | SFU gerenciado sem servidor | $0,02/min/participante |
| **Cloudflare R2** | Storage de arquivos | $0,015/GB/mês |
| **Vercel** | Frontend | Free tier |
| **Domínio** | DNS + SSL | ~$12/ano |
| **Total mínimo self-hosted** | | **~$20-35/mês** |

---

## ⚠️ Limitações conhecidas

| Limitação | Detalhe |
|---|---|
| Screen share com áudio do sistema | Apenas Chrome/Edge desktop. Safari iOS: não suporta |
| Screen share por janela | Não disponível em mobile (limitação do navegador) |
| Câmera/mic em iOS Safari | Funciona, mas exige HTTPS e gesto do usuário |
| WebRTC sem TURN | ~15-20% das conexões em redes corporativas falham sem coturn |
| Múltiplas telas simultâneas | Suportado; o navegador pede permissão a cada share |
| Gravação de chamadas | **Intencionalmente não implementada** sem consentimento explícito |

---

## 🧪 Testes básicos

```bash
# Backend
cd apps/server
npm test

# Verificar que a API está respondendo
curl http://localhost:4000/api/auth/me
# Deve retornar 401 (correto, não autenticado)
```

---

## 📬 Suporte

Para dúvidas ou problemas, abra uma issue no repositório.
