// routes/track.js — Recebe eventos e simulacoes (PostgreSQL)
const express  = require('express');
const router   = express.Router();
const db       = require('../database');

function agora() {
  const n = new Date();
  return { data: n.toISOString().split('T')[0], hora: n.toTimeString().split(' ')[0], ts: Math.floor(n.getTime()/1000) };
}
function run(sql, params) {
  return new Promise((res, rej) => db.run(sql, params, function(err) { if(err) rej(err); else res(this); }));
}
function get(sql, params) {
  return new Promise((res, rej) => db.get(sql, params, (err, row) => { if(err) rej(err); else res(row); }));
}
async function garantirDia(data) {
  await run(`INSERT INTO resumo_diario (data) VALUES (?) ON CONFLICT (data) DO NOTHING`, [data]);
}
async function incrementar(data, campo) {
  await garantirDia(data);
  await run(`UPDATE resumo_diario SET ${campo} = ${campo} + 1 WHERE data = ?`, [data]);
}

router.post('/visita', async (req, res) => {
  try {
    const { sessao_id, dispositivo } = req.body;
    if (!sessao_id) return res.status(400).json({ erro: 'sessao_id obrigatorio' });
    const { data, hora, ts } = agora();

    // Verificar se este sessao_id já visitou hoje
    const jaVisitouHoje = await get(`SELECT id FROM visitas WHERE sessao_id = ? AND data = ? LIMIT 1`, [sessao_id, data]);

    // Inserir registo de visita (para histórico completo)
    await run(`INSERT INTO visitas (sessao_id, data, hora, timestamp, dispositivo) VALUES (?,?,?,?,?)`, [sessao_id, data, hora, ts, dispositivo || 'desktop']);

    // Só incrementar contadores se for a primeira visita do dia desta sessão
    if (!jaVisitouHoje) {
      await incrementar(data, 'total_visitas');
      const row = await get(`SELECT COUNT(DISTINCT sessao_id) as n FROM visitas WHERE data = ?`, [data]);
      await run(`UPDATE resumo_diario SET visitantes_unicos = ? WHERE data = ?`, [row.n, data]);
    }

    res.json({ ok: true });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.post('/evento', async (req, res) => {
  try {
    const { sessao_id, tipo, ramo } = req.body;
    if (!sessao_id) return res.status(400).json({ erro: 'sessao_id obrigatorio' });
    const { data, hora, ts } = agora();
    await run(`INSERT INTO eventos (sessao_id, tipo, ramo, data, hora, timestamp) VALUES (?,?,?,?,?,?)`, [sessao_id, tipo, ramo || null, data, hora, ts]);
    const mapa = {
      auto:           'cliques_auto',
      habitacao:      'cliques_habitacao',
      vida:           'cliques_vida',
      saude:          'cliques_saude',
      vida_credito:   'cliques_vida_credito',
      saude_empresas: 'cliques_saude_empresas',
      mrc:            'cliques_mrc',
      mre:            'cliques_mre',
    };
    if (tipo === 'clique_ramo' && mapa[ramo]) await incrementar(data, mapa[ramo]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.post('/simulacao', async (req, res) => {
  try {
    const { sessao_id, ramo, dados, melhor_seguradora, melhor_preco } = req.body;
    if (!sessao_id || !ramo || !dados) return res.status(400).json({ erro: 'campos obrigatorios em falta' });
    const { data, hora, ts } = agora();

    // Inserir simulacao principal e obter ID
    let i = 0;
    const sqlSim = `INSERT INTO simulacoes (sessao_id, ramo, data, hora, timestamp, melhor_seguradora, melhor_preco) VALUES ($${++i},$${++i},$${++i},$${++i},$${++i},$${++i},$${++i}) RETURNING id`;
    const result = await db.pool.query(sqlSim, [sessao_id, ramo, data, hora, ts, melhor_seguradora||null, melhor_preco||null]);
    const simId = result.rows[0].id;

    // ── RAMOS EXISTENTES ───────────────────────────────────────────────────────
    if (ramo === 'auto') {
      await run(`INSERT INTO sim_auto (sim_id,nome,nif,nasc,carta,cp,profissao,telemovel,email,matricula,marca,modelo,versao,ano,cilindrada,combustivel,valor,importado,tipo_veiculo,cobertura,franquia,pagamento,sinistros,data_sinistro,extras) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [simId, dados.nome||null, dados.nif||null, dados.nasc||null, dados.carta||null, dados.cp||null, dados.profissao||null, dados.telemovel||null, dados.email||null, dados.matr||null, dados.marca||null, dados.modelo||null, dados.versao||null, dados.ano?parseInt(dados.ano):null, dados.cil||null, dados.combustivel||null, dados.valor?parseFloat(dados.valor):null, dados.importado||null, dados.veicTipo||null, dados.cobertura||null, dados.franquia||null, dados.pagamento||null, dados.sinistros||null, dados.dataSinistro||null, dados.extras?JSON.stringify(dados.extras):null]);
    } else if (ramo === 'habitacao') {
      await run(`INSERT INTO sim_habitacao (sim_id,nome,nif,cp,telemovel,email,ano_construcao,area,area_dep,tipo_imovel,construcao,wc,sismo,rc,furto,assistencia) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [simId, dados.nome||null, dados.nif||null, dados.cp||null, dados.telemovel||null, dados.email||null, dados.ano?parseInt(dados.ano):null, dados.area?parseFloat(dados.area):null, dados.areaDep?parseFloat(dados.areaDep):null, dados.tipo||null, dados.construcao||null, dados.wc||null, dados.sismo?1:0, dados.rc?1:0, dados.furto?1:0, dados.assist?1:0]);
    } else if (ramo === 'vida') {
      await run(`INSERT INTO sim_vida (sim_id,capital,inicio,fim,meses,tipo_premio,risco,pessoas) VALUES (?,?,?,?,?,?,?,?)`,
        [simId, dados.capital?parseFloat(dados.capital):null, dados.inicio||null, dados.fim||null, dados.meses?parseInt(dados.meses):null, dados.tipo_premio||null, dados.risco||null, dados.pessoas?JSON.stringify(dados.pessoas):null]);
    } else if (ramo === 'saude') {
      await run(`INSERT INTO sim_saude (sim_id,plano,doencas_pre,dental,saude_mental,maternidade,pessoas) VALUES (?,?,?,?,?,?,?)`,
        [simId, dados.plano||null, dados.doencas?1:0, dados.dental?1:0, dados.mental?1:0, dados.maternidade?1:0, dados.pessoas?JSON.stringify(dados.pessoas):null]);

    // ── NOVOS RAMOS ────────────────────────────────────────────────────────────
    } else if (ramo === 'vida_credito') {
      await run(`INSERT INTO sim_vida_credito (sim_id,nome,nif,nasc,telemovel,email,capital,prazo,taxa,inicio,fim,tipo_reembolso,pessoas) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [simId, dados.nome||null, dados.nif||null, dados.nasc||null, dados.telemovel||null, dados.email||null,
         dados.capital?parseFloat(dados.capital):null, dados.prazo?parseInt(dados.prazo):null,
         dados.taxa?parseFloat(dados.taxa):null, dados.inicio||null, dados.fim||null,
         dados.tipo_reembolso||null, dados.pessoas?JSON.stringify(dados.pessoas):null]);
    } else if (ramo === 'saude_empresas') {
      await run(`INSERT INTO sim_saude_empresas (sim_id,nome_empresa,nif_empresa,cae,n_trabalhadores,plano,faixas_etarias,coberturas,email,telemovel) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [simId, dados.nome_empresa||null, dados.nif_empresa||null, dados.cae||null,
         dados.n_trabalhadores?parseInt(dados.n_trabalhadores):null, dados.plano||null,
         dados.faixas_etarias?JSON.stringify(dados.faixas_etarias):null,
         dados.coberturas?JSON.stringify(dados.coberturas):null,
         dados.email||null, dados.telemovel||null]);
    } else if (ramo === 'mre') {
      await run(`INSERT INTO sim_mre (sim_id,nome_empresa,nif,email,telemovel,cae,n_trabalhadores,morada,cp,ano_construcao,area_imovel,materiais_estrutura,materiais_cobertura,dist_agua_km,zona_arborizada,tempo_bombeiros_min,protecao_incendio,protecao_intrusion,valor_imovel,valor_recheio,coberturas_imovel,coberturas_recheio) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [simId, dados.nome_empresa||null, dados.nif||null, dados.email||null, dados.telemovel||null,
         dados.cae||null, dados.n_trabalhadores?parseInt(dados.n_trabalhadores):null,
         dados.morada||null, dados.cp||null,
         dados.ano_construcao?parseInt(dados.ano_construcao):null,
         dados.area_imovel?parseFloat(dados.area_imovel):null,
         dados.materiais_estrutura||null, dados.materiais_cobertura||null,
         dados.dist_agua_km?parseFloat(dados.dist_agua_km):null,
         dados.zona_arborizada||null, dados.tempo_bombeiros_min?parseInt(dados.tempo_bombeiros_min):null,
         dados.protecao_incendio?JSON.stringify(dados.protecao_incendio):null,
         dados.protecao_intrusion?JSON.stringify(dados.protecao_intrusion):null,
         dados.valor_imovel?parseFloat(dados.valor_imovel):null,
         dados.valor_recheio?parseFloat(dados.valor_recheio):null,
         dados.coberturas_imovel?JSON.stringify(dados.coberturas_imovel):null,
         dados.coberturas_recheio?JSON.stringify(dados.coberturas_recheio):null]);
    }

    // ── INCREMENTAR CONTADORES ────────────────────────────────────────────────
    const mapa = {
      auto:           'sim_auto',
      habitacao:      'sim_habitacao',
      vida:           'sim_vida',
      saude:          'sim_saude',
      vida_credito:   'sim_vida_credito',
      saude_empresas: 'sim_saude_empresas',
      mrc:            'sim_mrc',
      mre:            'sim_mre',
    };
    if (mapa[ramo]) await incrementar(data, mapa[ramo]);

    res.json({ ok: true, id: simId });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
