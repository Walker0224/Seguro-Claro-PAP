// routes/config.js — Configurações gerais SeguroClaro
const express = require('express');
const router  = express.Router();
const db      = require('../database');

function get(sql, params) {
  return new Promise((res, rej) => db.get(sql, params, (err, row) => { if(err) rej(err); else res(row); }));
}
function run(sql, params) {
  return new Promise((res, rej) => db.run(sql, params, function(err) { if(err) rej(err); else res(this); }));
}

// GET /api/config/:chave
router.get('/:chave', async (req, res) => {
  try {
    const row = await get('SELECT valor FROM config WHERE chave = ?', [req.params.chave]);
    res.json({ chave: req.params.chave, valor: row?.valor || null });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// POST /api/config/:chave  — body: { valor: "email@exemplo.com" }
router.post('/:chave', async (req, res) => {
  try {
    const { valor } = req.body;
    if (!valor) return res.status(400).json({ erro: 'valor obrigatorio' });
    await run(
      `INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor`,
      [req.params.chave, valor]
    );
    res.json({ sucesso: true, chave: req.params.chave, valor });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
