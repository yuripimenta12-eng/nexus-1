# 🚀 Nexus — Deploy Completo (Passo a Passo)

## Resumo do que já está pronto

| Item | Status |
|---|---|
| Backend NestJS (REST + WebSocket) | ✅ |
| `railway.json` + `nixpacks.toml` | ✅ |
| `vercel.json` com região `gru1` (São Paulo) | ✅ |
| Endpoint `/api/health` para Railway | ✅ |
| CORS flexível (aceita qualquer `.vercel.app`) | ✅ |
| DMs (sidebar + conversa) | ✅ |
| Chat em tempo real (WebSocket) | ✅ |
| Voz/Vídeo real com LiveKit | ✅ |

---

## PASSO 1 — Subir no GitHub

Abra o terminal dentro de `D:\NExuscall\nexus` e rode:

```bash
git add .
git commit -m "feat: DMs, real-time chat, live video, deploy configs"
git push origin main
```

> Se ainda não tem repositório remoto:
> ```bash
> git remote add origin https://github.com/SEU_USUARIO/nexus.git
> git push -u origin main
> ```

---

## PASSO 2 — LiveKit Cloud (voz/vídeo em produção)

1. Acesse **https://cloud.livekit.io** → crie conta grátis
2. Clique **New Project** → nomeie `nexus`
3. Copie os 3 valores:
   - **WebSocket URL** → ex: `wss://nexus-abc123.livekit.cloud`
   - **API Key** → ex: `APIxxxxxxxx`
   - **API Secret** → ex: `xxxxxxxxxxxxxxxx`

---

## PASSO 3 — Backend no Railway

1. Acesse **https://railway.app** → login com GitHub
2. **New Project** → **Deploy from GitHub repo** → selecione `nexus`
3. Configure:
   - **Root Directory**: `apps/server`
   - O Railway detecta `railway.json` automaticamente
4. Em **Variables**, adicione (abra o arquivo `.env.production.backend` entregue):

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `DATABASE_URL` | sua connection string do Neon |
| `REDIS_URL` | sua URL do Upstash (rediss://) |
| `JWT_ACCESS_SECRET` | string aleatória longa (32+ chars) |
| `JWT_REFRESH_SECRET` | string aleatória diferente (32+ chars) |
| `LIVEKIT_URL` | `wss://nexus-abc123.livekit.cloud` |
| `LIVEKIT_API_KEY` | sua API Key do LiveKit Cloud |
| `LIVEKIT_API_SECRET` | seu API Secret do LiveKit Cloud |
| `APP_URL` | (preencha depois com a URL da Vercel) |

5. Aguarde o deploy terminar e copie a URL gerada
   → ex: `https://nexus-production.up.railway.app`

---

## PASSO 4 — Frontend na Vercel

1. Acesse **https://vercel.com** → login com GitHub
2. **New Project** → selecione o repositório `nexus`
3. Configure:
   - **Root Directory**: `apps/web`
   - **Framework**: Next.js (automático)
4. Em **Environment Variables**:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL do Railway (ex: `https://nexus-production.up.railway.app`) |
| `NEXT_PUBLIC_LIVEKIT_URL` | `wss://nexus-abc123.livekit.cloud` |

5. Clique **Deploy** — aguarde ~2 minutos
6. Copie a URL gerada → ex: `https://nexus-app.vercel.app`

---

## PASSO 5 — Atualizar APP_URL no Railway

Volte no Railway → Variables → atualize:
```
APP_URL=https://nexus-app.vercel.app
```
O Railway reinicia automaticamente.

---

## PASSO 6 — Rodar migrations no banco de produção

No painel do Railway, abra o terminal do serviço e rode:
```bash
npx prisma migrate deploy
```
Ou configure como parte do build command no Railway:
```
npx prisma generate && npx prisma migrate deploy && npm run build
```

---

## PASSO 7 — Testar

1. Acesse `https://nexus-app.vercel.app`
2. Login: `admin@nexus.local` / `Admin@123456`
3. Crie um servidor, entre em um canal de texto → deve funcionar em tempo real
4. Entre em uma sala de voz → vídeo e áudio reais via LiveKit Cloud
5. Mande uma DM para outro usuário

---

## Gerar strings JWT seguras (Windows PowerShell)

```powershell
# Copie e cole no PowerShell:
[System.Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) | ForEach-Object { [byte]$_ })
```

Rode duas vezes — uma para `JWT_ACCESS_SECRET` e outra para `JWT_REFRESH_SECRET`.

---

## Dúvidas

| Problema | Solução |
|---|---|
| Railway falha no build | Verifique se `DATABASE_URL` está correto |
| CORS error no browser | Verifique se `APP_URL` no Railway aponta para a URL certa da Vercel |
| Voz não conecta | Verifique `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` no Railway |
| Chat não atualiza em tempo real | Verifique `NEXT_PUBLIC_API_URL` na Vercel (deve ser `https://`, não `http://`) |
