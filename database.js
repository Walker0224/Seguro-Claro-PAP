// database.js — Base de dados SeguroClaro (PostgreSQL)
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function init() {
  const client = await pool.connect();
  try {
    // ── TABELAS EXISTENTES ──────────────────────────────────────────────────────
    await client.query(`CREATE TABLE IF NOT EXISTS visitas (id SERIAL PRIMARY KEY, sessao_id TEXT NOT NULL, data TEXT NOT NULL, hora TEXT NOT NULL, timestamp BIGINT NOT NULL, dispositivo TEXT DEFAULT 'desktop')`);
    await client.query(`CREATE TABLE IF NOT EXISTS eventos (id SERIAL PRIMARY KEY, sessao_id TEXT NOT NULL, tipo TEXT NOT NULL, ramo TEXT, data TEXT NOT NULL, hora TEXT NOT NULL, timestamp BIGINT NOT NULL)`);
    await client.query(`CREATE TABLE IF NOT EXISTS simulacoes (id SERIAL PRIMARY KEY, sessao_id TEXT NOT NULL, ramo TEXT NOT NULL, data TEXT NOT NULL, hora TEXT NOT NULL, timestamp BIGINT NOT NULL, melhor_seguradora TEXT, melhor_preco REAL)`);
    await client.query(`CREATE TABLE IF NOT EXISTS sim_auto (id SERIAL PRIMARY KEY, sim_id INTEGER NOT NULL, nome TEXT, nif TEXT, nasc TEXT, carta TEXT, cp TEXT, profissao TEXT, telemovel TEXT, email TEXT, matricula TEXT, marca TEXT, modelo TEXT, versao TEXT, ano INTEGER, cilindrada TEXT, combustivel TEXT, valor REAL, importado TEXT, tipo_veiculo TEXT, cobertura TEXT, franquia TEXT, pagamento TEXT, sinistros TEXT, data_sinistro TEXT, extras TEXT)`);
    await client.query(`CREATE TABLE IF NOT EXISTS sim_habitacao (id SERIAL PRIMARY KEY, sim_id INTEGER NOT NULL, nome TEXT, nif TEXT, cp TEXT, telemovel TEXT, email TEXT, ano_construcao INTEGER, area REAL, area_dep REAL, tipo_imovel TEXT, construcao TEXT, wc TEXT, sismo INTEGER, rc INTEGER, furto INTEGER, assistencia INTEGER)`);
    await client.query(`CREATE TABLE IF NOT EXISTS sim_vida (id SERIAL PRIMARY KEY, sim_id INTEGER NOT NULL, capital REAL, inicio TEXT, fim TEXT, meses INTEGER, tipo_premio TEXT, risco TEXT, pessoas TEXT)`);
    await client.query(`CREATE TABLE IF NOT EXISTS sim_saude (id SERIAL PRIMARY KEY, sim_id INTEGER NOT NULL, plano TEXT, doencas_pre INTEGER, dental INTEGER, saude_mental INTEGER, maternidade INTEGER, pessoas TEXT)`);
    await client.query(`CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)`);

    // ── RESUMO DIÁRIO — colunas base + novas ──────────────────────────────────
    await client.query(`CREATE TABLE IF NOT EXISTS resumo_diario (
      data TEXT PRIMARY KEY,
      total_visitas INTEGER DEFAULT 0,
      visitantes_unicos INTEGER DEFAULT 0,
      cliques_auto INTEGER DEFAULT 0,
      cliques_habitacao INTEGER DEFAULT 0,
      cliques_vida INTEGER DEFAULT 0,
      cliques_saude INTEGER DEFAULT 0,
      sim_auto INTEGER DEFAULT 0,
      sim_habitacao INTEGER DEFAULT 0,
      sim_vida INTEGER DEFAULT 0,
      sim_saude INTEGER DEFAULT 0,
      cliques_vida_credito INTEGER DEFAULT 0,
      cliques_saude_empresas INTEGER DEFAULT 0,
      cliques_mrc INTEGER DEFAULT 0,
      cliques_mre INTEGER DEFAULT 0,
      sim_vida_credito INTEGER DEFAULT 0,
      sim_saude_empresas INTEGER DEFAULT 0,
      sim_mrc INTEGER DEFAULT 0,
      sim_mre INTEGER DEFAULT 0
    )`);

    // ── NOVAS TABELAS DE DETALHE ─────────────────────────────────────────────

    // Vida Crédito (Allianz — projeção de prémios 2026-2030)
    await client.query(`CREATE TABLE IF NOT EXISTS sim_vida_credito (
      id SERIAL PRIMARY KEY,
      sim_id INTEGER NOT NULL,
      nome TEXT, nif TEXT, nasc TEXT, telemovel TEXT, email TEXT,
      capital REAL, prazo INTEGER, taxa REAL,
      inicio TEXT, fim TEXT,
      tipo_reembolso TEXT,
      pessoas TEXT
    )`);

    // Saúde Empresas (Tranquilidade — caracterização por faixas etárias)
    await client.query(`CREATE TABLE IF NOT EXISTS sim_saude_empresas (
      id SERIAL PRIMARY KEY,
      sim_id INTEGER NOT NULL,
      nome_empresa TEXT, nif_empresa TEXT, cae TEXT,
      n_trabalhadores INTEGER,
      plano TEXT,
      faixas_etarias TEXT,
      coberturas TEXT,
      email TEXT, telemovel TEXT
    )`);

    // MRC — Multirriscos Condomínio (Allianz)
    await client.query(`CREATE TABLE IF NOT EXISTS sim_mrc (
      id SERIAL PRIMARY KEY,
      sim_id INTEGER NOT NULL,
      nome TEXT, nif TEXT, email TEXT, telemovel TEXT,
      morada TEXT, cp TEXT,
      ano_construcao INTEGER,
      n_fraccoes INTEGER,
      area_total REAL,
      valor_edificio REAL,
      valor_rc_partes_comuns REAL,
      coberturas TEXT
    )`);

    // MRE — Multirriscos Empresas (Tranquilidade)
    await client.query(`CREATE TABLE IF NOT EXISTS sim_mre (
      id SERIAL PRIMARY KEY,
      sim_id INTEGER NOT NULL,
      nome_empresa TEXT, nif TEXT, email TEXT, telemovel TEXT,
      cae TEXT, n_trabalhadores INTEGER,
      morada TEXT, cp TEXT,
      ano_construcao INTEGER, area_imovel REAL,
      materiais_estrutura TEXT, materiais_cobertura TEXT,
      dist_agua_km REAL, zona_arborizada TEXT,
      tempo_bombeiros_min INTEGER,
      protecao_incendio TEXT, protecao_intrusion TEXT,
      valor_imovel REAL, valor_recheio REAL,
      coberturas_imovel TEXT, coberturas_recheio TEXT
    )`);

    // ── ALTER para garantir colunas novas em tabelas existentes ──────────────
    const alters = [
      `ALTER TABLE sim_auto ADD COLUMN IF NOT EXISTS telemovel TEXT`,
      `ALTER TABLE sim_auto ADD COLUMN IF NOT EXISTS email TEXT`,
      `ALTER TABLE sim_habitacao ADD COLUMN IF NOT EXISTS telemovel TEXT`,
      `ALTER TABLE sim_habitacao ADD COLUMN IF NOT EXISTS email TEXT`,
      `ALTER TABLE sim_auto ADD COLUMN IF NOT EXISTS precos_seguradoras TEXT`,
      `ALTER TABLE sim_habitacao ADD COLUMN IF NOT EXISTS precos_seguradoras TEXT`,
      `ALTER TABLE sim_vida ADD COLUMN IF NOT EXISTS precos_seguradoras TEXT`,
      `ALTER TABLE sim_saude ADD COLUMN IF NOT EXISTS precos_seguradoras TEXT`,
      // colunas novas no resumo_diario (para BDs já existentes)
      `ALTER TABLE resumo_diario ADD COLUMN IF NOT EXISTS cliques_vida_credito INTEGER DEFAULT 0`,
      `ALTER TABLE resumo_diario ADD COLUMN IF NOT EXISTS cliques_saude_empresas INTEGER DEFAULT 0`,
      `ALTER TABLE resumo_diario ADD COLUMN IF NOT EXISTS cliques_mrc INTEGER DEFAULT 0`,
      `ALTER TABLE resumo_diario ADD COLUMN IF NOT EXISTS cliques_mre INTEGER DEFAULT 0`,
      `ALTER TABLE resumo_diario ADD COLUMN IF NOT EXISTS sim_vida_credito INTEGER DEFAULT 0`,
      `ALTER TABLE resumo_diario ADD COLUMN IF NOT EXISTS sim_saude_empresas INTEGER DEFAULT 0`,
      `ALTER TABLE resumo_diario ADD COLUMN IF NOT EXISTS sim_mrc INTEGER DEFAULT 0`,
      `ALTER TABLE resumo_diario ADD COLUMN IF NOT EXISTS sim_mre INTEGER DEFAULT 0`,
    ];
    for (const q of alters) { await client.query(q).catch(() => {}); }

    console.log('✅ Base de dados PostgreSQL iniciada (com novos ramos)');
  } finally { client.release(); }
}

init().catch(err => console.error('Erro ao iniciar BD:', err));

function toParams(sql, params) {
  params = params || [];
  let i = 0;
  const text = sql.replace(/\?/g, () => `$${++i}`);
  return { text, values: params };
}

const db = {
  all: (sql, params, cb) => {
    const q = toParams(sql, params);
    pool.query(q.text, q.values).then(r => cb(null, r.rows)).catch(e => cb(e));
  },
  get: (sql, params, cb) => {
    const q = toParams(sql, params);
    pool.query(q.text, q.values).then(r => cb(null, r.rows[0] || null)).catch(e => cb(e));
  },
  run: (sql, params, cb) => {
    const q = toParams(sql, params);
    pool.query(q.text, q.values).then(r => {
      const ctx = { lastID: r.rows[0]?.id || null, changes: r.rowCount };
      if (cb) cb.call(ctx, null);
    }).catch(e => { if (cb) cb(e); else console.error(e); });
  },
  serialize: (fn) => fn && fn(),
  pool
};

module.exports = db;
