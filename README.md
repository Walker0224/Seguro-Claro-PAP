# SeguroClaro — Servidor

## Deploy no Render (Servidor + Base de Dados)

### 1. Criar conta e repositório
- Cria conta em https://github.com (se não tiveres)
- Cria um repositório privado chamado `seguroclaro-server`
- Faz upload de todos estes ficheiros

### 2. Criar a Base de Dados no Render
- https://render.com → New → PostgreSQL
- Name: `seguroclaro-db`
- Plan: Free
- Clica "Create Database"
- Copia a **Internal Database URL**

### 3. Criar o Web Service no Render
- New → Web Service
- Liga ao repositório GitHub
- Build Command: `npm install`
- Start Command: `node server.js`
- Plan: Free

### 4. Variáveis de Ambiente (obrigatórias)
Adiciona em Environment Variables:
- DATABASE_URL = (Internal URL da BD)
- SMTP_HOST = (host do teu email)
- SMTP_PORT = 465
- SMTP_USER = (email remetente)
- SMTP_PASS = (password email)
- NOTIFICATION_EMAIL = (email para receber notificações)
- ANTHROPIC_API_KEY = (chave Anthropic para comparação PDFs)
- TZ = Europe/Lisbon

### 5. Deploy do Cloudflare Worker (emails Brevo)
```
npm install -g wrangler
wrangler login
wrangler deploy
wrangler secret put BREVO_API_KEY
```
