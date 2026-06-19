// routes/email.js — Envio de emails com PDF SeguroClaro (SMTP Jotosegur via nodemailer)
const express    = require('express');
const router     = express.Router();
const nodemailer = require('nodemailer');

const FROM_EMAIL = process.env.SMTP_USER;
const FROM_NAME  = 'SeguroClaro';
const REPLY_TO   = 'geral@jotosegur.pt';

function emailValido(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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

async function enviarEmail({ to, toName, subject, html, anexos = [] }) {
  const transporter = criarTransport();

  const mailOptions = {
    from:     `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to:       toName ? `"${toName}" <${to}>` : to,
    replyTo:  REPLY_TO,
    subject,
    html,
  };

  if (anexos.length > 0) {
    mailOptions.attachments = anexos.map(a => ({
      filename: a.name,
      content:  a.content,
      encoding: 'base64',
    }));
  }

  return transporter.sendMail(mailOptions);
}

// POST /api/email/simulacao
router.post('/simulacao', async (req, res) => {
  try {
    const {
      nome, email_cliente, email_seguradora, ramo, data_sim,
      melhor_seg, melhor_preco, tabela_precos,
      pdf_base64, pdf_nome
    } = req.body;

    if (!ramo) {
      return res.status(400).json({ erro: 'Dados incompletos' });
    }

    const assunto = `Simulação SeguroClaro — ${ramo} — ${nome}`;

    const corpoHTML = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#0a4b78;padding:24px;border-radius:8px 8px 0 0;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">SeguroClaro</h1>
          <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:13px">Comparador Independente de Seguros</p>
        </div>
        <div style="background:#fff;padding:28px;border:1px solid #dde4ed;border-top:none">
          <p style="font-size:15px;color:#121a26">Olá <strong>${nome}</strong>,</p>
          <p style="font-size:14px;color:#2d3e52">Aqui está o resumo da sua simulação de seguro:</p>
          <div style="background:#f4f7fb;border-radius:8px;padding:16px;margin:16px 0">
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <tr><td style="padding:6px 0;color:#6b7e94;width:140px">Ramo</td><td style="color:#121a26;font-weight:600">${ramo}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7e94">Data</td><td style="color:#121a26">${data_sim}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7e94">Melhor opção</td><td style="color:#0a4b78;font-weight:700">${melhor_seg} — ${melhor_preco}</td></tr>
            </table>
          </div>
          <p style="font-size:13px;font-weight:600;color:#121a26;margin-bottom:8px">Comparação completa:</p>
          <div style="background:#f4f7fb;border-radius:8px;padding:14px;font-size:13px;color:#2d3e52;white-space:pre-line">${tabela_precos}</div>
          <p style="font-size:12px;color:#6b7e94;margin-top:20px">O PDF completo da simulação segue em anexo.</p>
        </div>
        <div style="background:#f4f7fb;padding:14px;border-radius:0 0 8px 8px;text-align:center;border:1px solid #dde4ed;border-top:none">
          <p style="font-size:11px;color:#6b7e94;margin:0">© 2025 SeguroClaro · Comparador independente de seguros em Portugal</p>
        </div>
      </div>
    `;

    const corpoAdminHTML = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#0a4b78;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="color:#fff;margin:0;font-size:18px">Nova Simulação Recebida</h1>
        </div>
        <div style="background:#fff;padding:28px;border:1px solid #dde4ed;border-top:none">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="padding:7px 0;color:#6b7e94;width:150px">Nome</td><td style="color:#121a26;font-weight:600">${nome}</td></tr>
            <tr><td style="padding:7px 0;color:#6b7e94">Email cliente</td><td style="color:#121a26">${emailValido(email_cliente) ? email_cliente : '(não fornecido)'}</td></tr>
            <tr><td style="padding:7px 0;color:#6b7e94">Ramo</td><td style="color:#121a26">${ramo}</td></tr>
            <tr><td style="padding:7px 0;color:#6b7e94">Data</td><td style="color:#121a26">${data_sim}</td></tr>
            <tr><td style="padding:7px 0;color:#6b7e94">Melhor seguradora</td><td style="color:#0a4b78;font-weight:700">${melhor_seg}</td></tr>
            <tr><td style="padding:7px 0;color:#6b7e94">Melhor preço</td><td style="color:#0a4b78;font-weight:700">${melhor_preco}</td></tr>
          </table>
          <hr style="border:none;border-top:1px solid #dde4ed;margin:16px 0"/>
          <p style="font-size:13px;font-weight:600;color:#121a26;margin-bottom:8px">Tabela completa:</p>
          <div style="background:#f4f7fb;border-radius:8px;padding:14px;font-size:13px;color:#2d3e52;white-space:pre-line">${tabela_precos}</div>
        </div>
      </div>
    `;

    const anexos = [];
    if (pdf_base64 && pdf_nome) {
      anexos.push({ name: pdf_nome, content: pdf_base64 });
    }

    // Email para o CLIENTE (só se tiver email válido)
    if (emailValido(email_cliente)) {
      await enviarEmail({
        to:      email_cliente.trim(),
        toName:  nome,
        subject: assunto,
        html:    corpoHTML,
        anexos,
      });
    }

    // Email para o ADMIN (sempre)
    const destinoAdmin = emailValido(email_seguradora)
      ? email_seguradora.trim()
      : (process.env.NOTIFICATION_EMAIL || FROM_EMAIL);

    await enviarEmail({
      to:      destinoAdmin,
      subject: `[Nova Simulação] ${assunto}`,
      html:    corpoAdminHTML,
      anexos,
    });

    res.json({ sucesso: true, mensagem: 'Emails enviados com sucesso' });

  } catch (err) {
    console.error('Erro ao enviar email:', err);
    res.status(500).json({ erro: 'Falha ao enviar email', detalhe: err.message });
  }
});

// POST /api/email/contato
router.post('/contato', async (req, res) => {
  try {
    const { nome, email, telefone, mensagem } = req.body;

    if (!nome || !mensagem) {
      return res.status(400).json({ erro: 'Dados incompletos' });
    }

    const destinoAdmin = process.env.NOTIFICATION_EMAIL || FROM_EMAIL;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#0a4b78;padding:24px;border-radius:8px 8px 0 0">
          <h1 style="color:#fff;margin:0;font-size:18px">Novo Contacto — SeguroClaro</h1>
        </div>
        <div style="background:#fff;padding:28px;border:1px solid #dde4ed;border-top:none">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="padding:7px 0;color:#6b7e94;width:130px">Nome</td><td style="color:#121a26;font-weight:600">${nome}</td></tr>
            <tr><td style="padding:7px 0;color:#6b7e94">Email</td><td style="color:#121a26">${email || '—'}</td></tr>
            <tr><td style="padding:7px 0;color:#6b7e94">Telefone</td><td style="color:#121a26">${telefone || '—'}</td></tr>
            <tr><td style="padding:7px 0;color:#6b7e94">Mensagem</td><td style="color:#121a26">${mensagem}</td></tr>
          </table>
        </div>
        <div style="background:#f4f7fb;padding:12px 24px;border-radius:0 0 8px 8px;border:1px solid #dde4ed;border-top:none;text-align:center">
          <p style="font-size:11px;color:#6b7e94;margin:0">© 2025 SeguroClaro · Notificação automática</p>
        </div>
      </div>
    `;

    await enviarEmail({
      to:      destinoAdmin,
      subject: `[Contacto] ${nome} — SeguroClaro`,
      html,
    });

    res.json({ sucesso: true, mensagem: 'Mensagem enviada com sucesso' });

  } catch (err) {
    console.error('Erro ao enviar contacto:', err);
    res.status(500).json({ erro: 'Falha ao enviar mensagem', detalhe: err.message });
  }
});

module.exports = router;
