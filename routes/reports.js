// routes/reports.js — Relatorios (PostgreSQL)
const express = require('express');
const router  = express.Router();
const db      = require('../database');

function hoje()      { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Lisbon' }); }
function diasAtras(n){ return new Date(Date.now()-n*86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Lisbon' }); }

function all(sql, params) {
  return new Promise((res, rej) => db.all(sql, params, (err, rows) => { if(err) rej(err); else res(rows); }));
}
function get(sql, params) {
  return new Promise((res, rej) => db.get(sql, params, (err, row) => { if(err) rej(err); else res(row); }));
}
function run(sql, params) {
  return new Promise((res, rej) => db.run(sql, params, function(err) { if(err) rej(err); else res(this); }));
}

function agregar(rows) {
  return rows.reduce((a,d) => ({
    total_visitas:          a.total_visitas          + (parseInt(d.total_visitas)          ||0),
    visitantes_unicos:      a.visitantes_unicos      + (parseInt(d.visitantes_unicos)      ||0),
    cliques_auto:           a.cliques_auto           + (parseInt(d.cliques_auto)           ||0),
    cliques_habitacao:      a.cliques_habitacao      + (parseInt(d.cliques_habitacao)      ||0),
    cliques_vida:           a.cliques_vida           + (parseInt(d.cliques_vida)           ||0),
    cliques_saude:          a.cliques_saude          + (parseInt(d.cliques_saude)          ||0),
    cliques_vida_credito:   a.cliques_vida_credito   + (parseInt(d.cliques_vida_credito)   ||0),
    cliques_saude_empresas: a.cliques_saude_empresas + (parseInt(d.cliques_saude_empresas) ||0),
    cliques_mrc:            a.cliques_mrc            + (parseInt(d.cliques_mrc)            ||0),
    cliques_mre:            a.cliques_mre            + (parseInt(d.cliques_mre)            ||0),
    sim_auto:               a.sim_auto               + (parseInt(d.sim_auto)               ||0),
    sim_habitacao:          a.sim_habitacao          + (parseInt(d.sim_habitacao)          ||0),
    sim_vida:               a.sim_vida               + (parseInt(d.sim_vida)               ||0),
    sim_saude:              a.sim_saude              + (parseInt(d.sim_saude)              ||0),
    sim_vida_credito:       a.sim_vida_credito       + (parseInt(d.sim_vida_credito)       ||0),
    sim_saude_empresas:     a.sim_saude_empresas     + (parseInt(d.sim_saude_empresas)     ||0),
    sim_mrc:                a.sim_mrc                + (parseInt(d.sim_mrc)                ||0),
    sim_mre:                a.sim_mre                + (parseInt(d.sim_mre)                ||0),
  }), {
    total_visitas:0, visitantes_unicos:0,
    cliques_auto:0, cliques_habitacao:0, cliques_vida:0, cliques_saude:0,
    cliques_vida_credito:0, cliques_saude_empresas:0, cliques_mrc:0, cliques_mre:0,
    sim_auto:0, sim_habitacao:0, sim_vida:0, sim_saude:0,
    sim_vida_credito:0, sim_saude_empresas:0, sim_mrc:0, sim_mre:0,
  });
}

router.get('/hoje', async (req, res) => {
  try {
    const h = hoje();
    const dias = await all(`SELECT * FROM resumo_diario WHERE data = ?`, [h]);
    res.json({ periodo:'hoje', data:h, totais:agregar(dias), dias });
  } catch(e){ res.status(500).json({erro:e.message}); }
});

router.get('/semana', async (req, res) => {
  try {
    const fim=hoje(), inicio=diasAtras(6);
    const dias = await all(`SELECT * FROM resumo_diario WHERE data BETWEEN ? AND ? ORDER BY data`, [inicio,fim]);
    res.json({ periodo:'semana', inicio, fim, totais:agregar(dias), dias });
  } catch(e){ res.status(500).json({erro:e.message}); }
});

router.get('/mes', async (req, res) => {
  try {
    const ano = req.query.ano || new Date().getFullYear();
    const mes = String(req.query.mes || (new Date().getMonth()+1)).padStart(2,'0');
    const dias = await all(`SELECT * FROM resumo_diario WHERE data LIKE ?`, [`${ano}-${mes}%`]);
    res.json({ periodo:'mes', ano, mes, totais:agregar(dias), dias });
  } catch(e){ res.status(500).json({erro:e.message}); }
});

router.get('/ano', async (req, res) => {
  try {
    const ano = req.query.ano || new Date().getFullYear();
    const dias = await all(`SELECT * FROM resumo_diario WHERE data LIKE ?`, [`${ano}%`]);
    const porMes = {};
    dias.forEach(d => { const m=d.data.slice(0,7); if(!porMes[m]) porMes[m]=[]; porMes[m].push(d); });
    const meses = Object.entries(porMes).map(([mes,rows]) => ({ mes, ...agregar(rows) }));
    res.json({ periodo:'ano', ano, totais:agregar(dias), meses });
  } catch(e){ res.status(500).json({erro:e.message}); }
});

router.get('/total', async (req, res) => {
  try {
    const dias = await all(`SELECT * FROM resumo_diario ORDER BY data`, []);
    const porAno = {};
    dias.forEach(d => { const a=d.data.slice(0,4); if(!porAno[a]) porAno[a]=[]; porAno[a].push(d); });
    const anos = Object.entries(porAno).map(([ano,rows]) => ({ ano, ...agregar(rows) }));
    res.json({ periodo:'total', primeira_data:dias[0]?.data||'—', ultima_data:dias[dias.length-1]?.data||'—', totais:agregar(dias), anos });
  } catch(e){ res.status(500).json({erro:e.message}); }
});

router.get('/personalizado', async (req, res) => {
  try {
    const { inicio, fim } = req.query;
    if (!inicio||!fim) return res.status(400).json({erro:'inicio e fim obrigatorios'});
    const dias = await all(`SELECT * FROM resumo_diario WHERE data BETWEEN ? AND ? ORDER BY data`, [inicio,fim]);
    res.json({ periodo:'personalizado', inicio, fim, totais:agregar(dias), dias });
  } catch(e){ res.status(500).json({erro:e.message}); }
});

router.get('/simulacoes', async (req, res) => {
  try {
    const pagina = Math.max(1, parseInt(req.query.pagina)||1);
    const limite = Math.min(100, parseInt(req.query.limite)||20);
    const offset = (pagina-1)*limite;
    const ramo   = req.query.ramo  || null;
    const inicio = req.query.inicio|| null;
    const fim    = req.query.fim   || null;

    let where = 'WHERE 1=1'; const params = [];
    if (ramo)  { where += ' AND ramo = ?';  params.push(ramo); }
    if (inicio){ where += ' AND data >= ?'; params.push(inicio); }
    if (fim)   { where += ' AND data <= ?'; params.push(fim); }

    const countRow = await get(`SELECT COUNT(*) as n FROM simulacoes ${where}`, params);
    const total    = parseInt(countRow.n);
    const rows     = await all(`SELECT * FROM simulacoes ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`, [...params, limite, offset]);

    const simulacoes = await Promise.all(rows.map(async s => {
      let det = null;
      if      (s.ramo==='auto')           det = await get(`SELECT * FROM sim_auto            WHERE sim_id=?`,[s.id]);
      else if (s.ramo==='habitacao')      det = await get(`SELECT * FROM sim_habitacao        WHERE sim_id=?`,[s.id]);
      else if (s.ramo==='vida')           det = await get(`SELECT * FROM sim_vida             WHERE sim_id=?`,[s.id]);
      else if (s.ramo==='saude')          det = await get(`SELECT * FROM sim_saude            WHERE sim_id=?`,[s.id]);
      else if (s.ramo==='vida_credito')   det = await get(`SELECT * FROM sim_vida_credito     WHERE sim_id=?`,[s.id]);
      else if (s.ramo==='saude_empresas') det = await get(`SELECT * FROM sim_saude_empresas   WHERE sim_id=?`,[s.id]);
      else if (s.ramo==='mrc')            det = await get(`SELECT * FROM sim_mrc              WHERE sim_id=?`,[s.id]);
      else if (s.ramo==='mre')            det = await get(`SELECT * FROM sim_mre              WHERE sim_id=?`,[s.id]);

      // Parse JSON fields
      for (const f of ['extras','pessoas','faixas_etarias','coberturas','coberturas_imovel','coberturas_recheio','protecao_incendio','protecao_intrusion']) {
        if (det?.[f]) try { det[f] = JSON.parse(det[f]); } catch{}
      }
      return { ...s, detalhes: det };
    }));

    res.json({ total, pagina, limite, paginas:Math.ceil(total/limite), simulacoes });
  } catch(e){ res.status(500).json({erro:e.message}); }
});

router.get('/simulacao/:id', async (req, res) => {
  try {
    const s = await get(`SELECT * FROM simulacoes WHERE id=?`,[req.params.id]);
    if (!s) return res.status(404).json({erro:'Nao encontrado'});
    let det = null;
    if      (s.ramo==='auto')           det = await get(`SELECT * FROM sim_auto            WHERE sim_id=?`,[s.id]);
    else if (s.ramo==='habitacao')      det = await get(`SELECT * FROM sim_habitacao        WHERE sim_id=?`,[s.id]);
    else if (s.ramo==='vida')           det = await get(`SELECT * FROM sim_vida             WHERE sim_id=?`,[s.id]);
    else if (s.ramo==='saude')          det = await get(`SELECT * FROM sim_saude            WHERE sim_id=?`,[s.id]);
    else if (s.ramo==='vida_credito')   det = await get(`SELECT * FROM sim_vida_credito     WHERE sim_id=?`,[s.id]);
    else if (s.ramo==='saude_empresas') det = await get(`SELECT * FROM sim_saude_empresas   WHERE sim_id=?`,[s.id]);
    else if (s.ramo==='mrc')            det = await get(`SELECT * FROM sim_mrc              WHERE sim_id=?`,[s.id]);
    else if (s.ramo==='mre')            det = await get(`SELECT * FROM sim_mre              WHERE sim_id=?`,[s.id]);

    for (const f of ['extras','pessoas','faixas_etarias','coberturas','coberturas_imovel','coberturas_recheio','protecao_incendio','protecao_intrusion']) {
      if (det?.[f]) try { det[f] = JSON.parse(det[f]); } catch{}
    }
    res.json({ ...s, detalhes: det });
  } catch(e){ res.status(500).json({erro:e.message}); }
});

// DELETE — reiniciar todas as estatísticas (resumo_diario)
router.delete('/estatisticas', async (req, res) => {
  try {
    await run(`DELETE FROM resumo_diario`, []);
    res.json({ sucesso: true });
  } catch(e){ res.status(500).json({ erro: e.message }); }
});

// DELETE — apagar simulações (uma ou várias)
router.delete('/simulacoes', async (req, res) => {
  try {
    let ids = req.body?.ids || [];
    if (!ids.length && req.query.ids) {
      ids = req.query.ids.split(',').map(Number).filter(Boolean);
    }
    if (!ids.length) return res.status(400).json({ erro: 'ids obrigatorio' });

    const placeholders = ids.map(() => '?').join(',');

    // Apagar detalhes de todos os ramos
    for (const tbl of ['sim_auto','sim_habitacao','sim_vida','sim_saude','sim_vida_credito','sim_saude_empresas','sim_mrc','sim_mre']) {
      await run(`DELETE FROM ${tbl} WHERE sim_id IN (${placeholders})`, ids);
    }

    const result = await run(`DELETE FROM simulacoes WHERE id IN (${placeholders})`, ids);
    res.json({ sucesso: true, apagadas: result.changes });
  } catch(e){ res.status(500).json({ erro: e.message }); }
});

module.exports = router;
