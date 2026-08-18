# 🚀 Nexus Link — Guia de Deploy Completo

## Visão geral

| Serviço | Plataforma | URL final |
|---|---|---|
| Frontend (Next.js) | Vercel | `https://nexus.vercel.app` |
| Backend (NestJS) | Railway | `https://nexus-server.up.railway.app` |
| Banco de dados | Neon ✅ já na nuvem | — |
| Redis | Upstash ✅ já na nuvem | — |
| Voz/Vídeo | LiveKit Cloud | `wss://nexus.livekit.cloud` |

---

## PASSO 1 — LiveKit Cloud (voz/vídeo)

1. Acesse **https://cloud.livekit.io** e crie uma conta gratuita
2. Clique em **"New Project"** → dê um nome (ex: `nexus`)
3. No painel do projeto, copie:
   - **WebSocket URL** → algo como `wss://nexus-abc123.livekit.cloud`
   - **API Key** → `APIxxxxxxxx`
   - **API Secret** → `xxxxxxxxxxxxxxxxxx`
4. Guarde esses 3 valores — você vai precisar deles nos próximos passos

> **Free tier**: 10.000 minutos/mês de participantes — suficiente para testes e pequenas comunidades.

---

## PASSO 2 — GitHub (necessário para Vercel e Railway)

O código precisa estar no GitHub. Se ainda não está:

1. Crie uma conta em **https://github.com**
2. Crie um novo repositório (pode ser privado)
3. Rode no terminal, dentro de `D:\NExuscall\nexus`:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/SEU_USUARIO/nexus.git
git push -u origin main
```

---

## PASSO 3 — Deploy do Backend (Railway)

1. Acesse **https://railway.app** e faça login com GitHub
2. Clique em **"New Project"** → **"Deploy from GitHub repo"**
3. Selecione o repositório `nexus`
4. Railway vai detectar o projeto. Configure:
   - **Root Directory**: `apps/server`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npm run start`
5. Vá em **Variables** e adicione todas as variáveis do arquivo `.env.production.backend`
   - Substitua `SEU-PROJETO.livekit.cloud` pela URL real do LiveKit Cloud
   - Substitua `COLE_API_KEY_AQUI` e `COLE_API_SECRET_AQUI` pelas credenciais do LiveKit
6. Aguarde o deploy. Copie a URL gerada (ex: `nexus-server.up.railway.app`)

---

## PASSO 4 — Deploy do Frontend (Vercel)

1. Acesse **https://vercel.com** e faça login com GitHub
2. Clique em **"New Project"** → selecione o repositório `nexus`
3. Configure:
   - **Root Directory**: `apps/web`
   - **Framework Preset**: Next.js (detectado automático)
4. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_API_URL` = `https://nexus-server.up.railway.app` (URL do Railway)
5. Clique em **Deploy**
6. Copie a URL gerada (ex: `nexus.vercel.app`)

---

## PASSO 5 — Atualizar CORS no Backend

Depois de ter a URL da Vercel, volte no Railway e atualize a variável:
```
APP_URL=https://nexus.vercel.app
```

O Railway vai reiniciar automaticamente.

---

## PASSO 6 — Testar

1. Acesse `https://nexus.vercel.app`
2. Faça login com `admin@nexus.local` / `Admin@123456`
3. Entre em uma sala de voz
4. Peça para um amigo acessar a mesma URL e entrar na mesma sala

---

## Arquivos entregues

| Arquivo | Onde colocar |
|---|---|
| `railway.json` | `apps/server/railway.json` |
| `nixpacks.toml` | `apps/server/nixpacks.toml` |
| `vercel.json` | `apps/web/vercel.json` |
| `.env.production.backend` | referência para variáveis no Railway |
| `.env.production.frontend` | referência para variáveis na Vercel |

---

## Dúvidas frequentes

**O LiveKit vai funcionar com amigos em qualquer lugar?**  
Sim. LiveKit Cloud tem TURN servers globais — funciona em qualquer rede, incluindo corporativas e com NAT.

**Precisa de cartão de crédito?**  
Railway pede cartão para verificação, mas dá $5/mês grátis (suficiente para o backend). Vercel e LiveKit são grátis sem cartão.

**E os uploads de arquivo?**  
Por enquanto vão falhar (S3 desabilitado). Depois do deploy básico, adicione Cloudflare R2 (gratuito para 10GB).
