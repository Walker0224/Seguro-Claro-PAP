// notifier.js — Notificações automáticas por email (nova simulação) — SMTP Jotosegur via nodemailer
const nodemailer = require('nodemailer');
const db = require('./database');

const FROM_NAME = 'SeguroClaro';
const REPLY_TO  = 'geral@jotosegur.pt';

function getConfigEmail() {
  return new Promise((res) => {
    db.get('SELECT valor FROM config WHERE chave = ?', ['notif_email'], (err, row) => {
      res(row?.valor || null);
    });
  });
}

function criarTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function notificarNovaSimulacao({ ramo, nome, melhor_seg, melhor_preco, sim_id, email_cliente }) {
  try {
    const fromEmail   = process.env.SMTP_USER;
    const emailConfig = await getConfigEmail();
    const notifEmail  = process.env.NOTIFICATION_EMAIL || fromEmail;

    const destinos = [notifEmail];
    if (emailConfig && emailConfig !== notifEmail) destinos.push(emailConfig);
    if (email_cliente && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_cliente)) destinos.push(email_cliente);

    const ramo_pt  = { auto: 'Automóvel', habitacao: 'Habitação', vida: 'Vida', saude: 'Saúde', vida_credito: 'Vida Crédito', saude_empresas: 'Saúde Empresas', mrc: 'Habitação MRC', mre: 'Habitação MRE' }[ramo] || ramo;
    const data_sim = new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' });
    const precoStr = melhor_preco ? melhor_preco.toFixed(2) + '€/mês' : '—';

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto">
        <div style="background:#0a4b78;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="color:#fff;margin:0;font-size:16px">Nova Simulação Recebida</h2>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #dde4ed;border-top:none">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="padding:7px 0;color:#6b7e94;width:130px">Ramo</td><td style="color:#121a26;font-weight:700">${ramo_pt}</td></tr>
            <tr><td style="padding:7px 0;color:#6b7e94">Cliente</td><td style="color:#121a26">${nome || '—'}</td></tr>
            <tr><td style="padding:7px 0;color:#6b7e94">Data</td><td style="color:#121a26">${data_sim}</td></tr>
            <tr><td style="padding:7px 0;color:#6b7e94">Melhor opção</td><td style="color:#0a4b78;font-weight:700">${melhor_seg || '—'} — ${precoStr}</td></tr>
            <tr><td style="padding:7px 0;color:#6b7e94">Referência</td><td style="color:#6b7e94;font-size:11px">#${sim_id}</td></tr>
          </table>
          <div style="margin-top:18px;padding:12px 14px;background:#f4f7fb;border-radius:8px;font-size:12px;color:#6b7e94">
            Aceda ao <a href="https://seguroclaro-server.onrender.com" style="color:#0a4b78;font-weight:700">Dashboard SeguroClaro</a> para consultar os detalhes completos.
          </div>
        </div>
        <div style="background:#f4f7fb;padding:12px 24px;border-radius:0 0 8px 8px;border:1px solid #dde4ed;border-top:none;text-align:center">
          <p style="font-size:11px;color:#6b7e94;margin:0">© 2025 SeguroClaro · Notificação automática</p>
        </div>
      </div>
    `;

    const transporter = criarTransport();

    await transporter.sendMail({
      from:    `"${FROM_NAME}" <${fromEmail}>`,
      to:      destinos.join(', '),
      replyTo: REPLY_TO,
      subject: `[SeguroClaro] Nova simulação — ${ramo_pt} — ${nome || 'Cliente'}`,
      html,
    });

    console.log(`✅ Notificação enviada → ${destinos.join(', ')}`);
  } catch (err) {
    console.error('⚠️ Erro na notificação:', err.message);
  }
}

module.exports = { notificarNovaSimulacao };
