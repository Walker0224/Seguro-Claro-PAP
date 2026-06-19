// routes/comparacao.js — Proxy para API Anthropic (Comparação de PDFs)
const express = require('express');
const router  = express.Router();
const https   = require('https');

// POST /api/comparacao/analisar
router.post('/analisar', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !messages.length) {
    return res.status(400).json({ erro: 'Mensagens em falta' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ erro: 'ANTHROPIC_API_KEY não configurada no servidor' });
  }

  const payload = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages
  });

  const options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  try {
    const data = await new Promise((resolve, reject) => {
      const req = https.request(options, (response) => {
        let body = '';
        response.on('data', chunk => body += chunk);
        response.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error('Resposta inválida da API')); }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    res.json(data);
  } catch (e) {
    console.error('Erro Anthropic API:', e.message);
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
