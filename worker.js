const SENDER_EMAIL = "murillo.31992@aeams.education";
const SENDER_NAME = "SeguroClaro";
const ADMIN_EMAIL = "pja.teixeira@jotosegur.pt";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/email/simulacao") {
      return handleSimulacao(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/email/contato") {
      return handleContato(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};

async function sendEmail(apiKey, to, subject, htmlContent, replyTo) {
  const body = {
    sender: { name: SENDER_NAME, email: SENDER_EMAIL },
    to: [{ email: to }],
    bcc: [{ email: ADMIN_EMAIL }],
    subject,
    htmlContent,
  };

  if (replyTo) {
    body.replyTo = { email: replyTo };
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  return response;
}

async function handleSimulacao(request, env) {
  try {
    const data = await request.json();

    // Suporta tanto email_cliente (novo) como email (antigo)
    const emailCliente = data.email_cliente || data.email || '';
    const nome = data.nome || 'Cliente';
    const ramo = data.ramo || data.tipoSeguro || '—';
    const dataSim = data.data_sim || new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' });
    const melhorSeg = data.melhor_seg || data.resultado || '—';
    const melhorPreco = data.melhor_preco || '—';
    const tabelaPrecos = data.tabela_precos || '—';

    // Email para o admin com os dados completos
    const adminHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1a3c5e;border-bottom:2px solid #1a3c5e;padding-bottom:10px;">
          Nova Simulação — SeguroClaro
        </h2>
        <table style="border-collapse:collapse;width:100%;margin-top:16px;">
          <tr style="background:#f5f7fa;">
            <td style="padding:10px 12px;border:1px solid #ddd;font-weight:700;width:35%;">Nome</td>
            <td style="padding:10px 12px;border:1px solid #ddd;">${nome}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border:1px solid #ddd;font-weight:700;">Email</td>
            <td style="padding:10px 12px;border:1px solid #ddd;">${emailCliente || '—'}</td>
          </tr>
          <tr style="background:#f5f7fa;">
            <td style="padding:10px 12px;border:1px solid #ddd;font-weight:700;">Telefone</td>
            <td style="padding:10px 12px;border:1px solid #ddd;">${data.telefone || '—'}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border:1px solid #ddd;font-weight:700;">Ramo</td>
            <td style="padding:10px 12px;border:1px solid #ddd;">${ramo}</td>
          </tr>
          <tr style="background:#f5f7fa;">
            <td style="padding:10px 12px;border:1px solid #ddd;font-weight:700;">Data</td>
            <td style="padding:10px 12px;border:1px solid #ddd;">${dataSim}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border:1px solid #ddd;font-weight:700;">Melhor Seguradora</td>
            <td style="padding:10px 12px;border:1px solid #ddd;">${melhorSeg}</td>
          </tr>
          <tr style="background:#f5f7fa;">
            <td style="padding:10px 12px;border:1px solid #ddd;font-weight:700;">Melhor Preço</td>
            <td style="padding:10px 12px;border:1px solid #ddd;">${melhorPreco}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border:1px solid #ddd;font-weight:700;">Todos os Preços</td>
            <td style="padding:10px 12px;border:1px solid #ddd;white-space:pre-line;">${tabelaPrecos}</td>
          </tr>
        </table>
        <p style="color:#888;font-size:12px;margin-top:24px;">Enviado automaticamente pelo SeguroClaro</p>
      </div>
    `;

    // Envia sempre para o admin
    await sendEmail(
      env.BREVO_API_KEY,
      ADMIN_EMAIL,
      `Nova Simulação ${ramo} — ${nome}`,
      adminHtml,
      emailCliente || undefined
    );

    // Envia confirmação para o cliente SE tiver email
    if (emailCliente) {
      const userHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#1a3c5e;border-bottom:2px solid #1a3c5e;padding-bottom:10px;">
            Simulação Recebida!
          </h2>
          <p style="font-size:15px;">Olá <strong>${nome}</strong>,</p>
          <p style="font-size:15px;line-height:1.6;">
            Recebemos a sua simulação de seguro <strong>${ramo}</strong> com sucesso.
          </p>
          <div style="background:#f0f6ff;border-left:4px solid #1a3c5e;padding:14px 18px;border-radius:4px;margin:20px 0;">
            <p style="margin:0;font-weight:700;color:#1a3c5e;">Melhor opção encontrada:</p>
            <p style="margin:6px 0 0;font-size:16px;">${melhorSeg} — <strong>${melhorPreco}</strong></p>
          </div>
          <p style="font-size:15px;line-height:1.6;">
            A nossa equipa irá analisar os resultados e entrar em contacto consigo brevemente para esclarecer qualquer dúvida.
          </p>
          <br>
          <p style="font-size:15px;">Com os melhores cumprimentos,</p>
          <p style="font-size:15px;"><strong>Equipa SeguroClaro</strong></p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
          <p style="color:#aaa;font-size:11px;">Este email foi enviado automaticamente. Por favor não responda diretamente a este email.</p>
        </div>
      `;

      await sendEmail(
        env.BREVO_API_KEY,
        emailCliente,
        `A sua Simulação de Seguro ${ramo} — SeguroClaro`,
        userHtml
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
}

async function handleContato(request, env) {
  try {
    const data = await request.json();

    const adminHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1a3c5e;border-bottom:2px solid #1a3c5e;padding-bottom:10px;">
          Novo Contacto — SeguroClaro
        </h2>
        <table style="border-collapse:collapse;width:100%;margin-top:16px;">
          <tr style="background:#f5f7fa;">
            <td style="padding:10px 12px;border:1px solid #ddd;font-weight:700;width:35%;">Nome</td>
            <td style="padding:10px 12px;border:1px solid #ddd;">${data.nome || '—'}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border:1px solid #ddd;font-weight:700;">Email</td>
            <td style="padding:10px 12px;border:1px solid #ddd;">${data.email || '—'}</td>
          </tr>
          <tr style="background:#f5f7fa;">
            <td style="padding:10px 12px;border:1px solid #ddd;font-weight:700;">Telefone</td>
            <td style="padding:10px 12px;border:1px solid #ddd;">${data.telefone || '—'}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border:1px solid #ddd;font-weight:700;">Mensagem</td>
            <td style="padding:10px 12px;border:1px solid #ddd;">${data.mensagem || '—'}</td>
          </tr>
        </table>
        <p style="color:#888;font-size:12px;margin-top:24px;">Enviado automaticamente pelo SeguroClaro</p>
      </div>
    `;

    await sendEmail(
      env.BREVO_API_KEY,
      ADMIN_EMAIL,
      "Novo Contacto — SeguroClaro",
      adminHtml,
      data.email || undefined
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
}
