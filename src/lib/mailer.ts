import nodemailer from 'nodemailer'
import { db } from '@/lib/db'
import { getSettings, getAppUrl } from '@/lib/settings'
import { formatCurrencyBRL, formatDateBR } from '@/lib/format'

type SendArgs = {
  to: string
  subject: string
  html: string
  attachments?: { filename: string; content: Buffer }[]
}

export async function createTransporter() {
  const s = await getSettings()
  if (!s.smtpUser || !s.smtpPass) {
    throw new Error('SMTP não configurado. Vá em Configurações e informe o e-mail do Gmail e a senha de app.')
  }
  return nodemailer.createTransport({
    host: s.smtpHost,
    port: s.smtpPort,
    secure: s.smtpPort === 465,
    auth: { user: s.smtpUser, pass: s.smtpPass },
  })
}

export async function sendMail(args: SendArgs, meta: { recipientId?: string; kind: string } ): Promise<{ ok: boolean; error?: string }> {
  const s = await getSettings()
  try {
    const transporter = await createTransporter()
    await transporter.sendMail({
      from: `"${s.smtpFromName}" <${s.smtpUser}>`,
      to: args.to,
      subject: args.subject,
      html: args.html,
      attachments: args.attachments,
    })
    await db.emailLog.create({
      data: { recipientId: meta.recipientId, to: args.to, subject: args.subject, kind: meta.kind, ok: true },
    })
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db.emailLog.create({
      data: { recipientId: meta.recipientId, to: args.to, subject: args.subject, kind: meta.kind, ok: false, error: message },
    })
    return { ok: false, error: message }
  }
}

// ---------- templates HTML ----------

function wrap(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr><td style="background:#059669;padding:20px 28px;">
          <span style="color:#ffffff;font-size:18px;font-weight:bold;">Central de Documentos</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px;font-size:20px;color:#18181b;">${title}</h1>
          <div style="font-size:14px;color:#3f3f46;line-height:1.6;">${bodyHtml}</div>
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #e4e4e7;">
          <span style="font-size:12px;color:#a1a1aa;">E-mail automático — não responda esta mensagem.</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function button(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr><td style="background:#059669;border-radius:8px;">
    <a href="${url}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;">${label}</a>
  </td></tr></table>`
}

function greeting(name: string | null | undefined): string {
  const primeiro = (name || '').trim().split(/\s+/)[0] || 'Olá'
  return `<p>Olá, <strong>${primeiro}</strong>!</p>`
}

export async function emailFormLink(recipient: { name: string; email: string; token: string; processName: string }) {
  const base = await getAppUrl()
  const url = `${base}/f/${recipient.token}`
  const html = wrap(
    'Preenchimento de formulário',
    `${greeting(recipient.name)}
    <p>Você recebeu o processo <strong>${recipient.processName}</strong>. Para gerarmos o seu contrato, preencha o formulário com os seus dados clicando no botão abaixo:</p>
    ${button(url, 'Preencher formulário')}
    <p style="font-size:12px;color:#71717a;">Se o botão não funcionar, copie e cole este endereço no navegador:<br><a href="${url}" style="color:#059669;">${url}</a></p>`
  )
  return sendMail({ to: recipient.email, subject: `Formulário pendente — ${recipient.processName}`, html }, { kind: 'form' })
}

export async function emailSignLink(recipient: { name: string; email: string; signUrl: string | null; processName: string }) {
  const url = recipient.signUrl
  if (!url) throw new Error('Link de assinatura indisponível')
  const html = wrap(
    'Seu contrato está pronto para assinatura',
    `${greeting(recipient.name)}
    <p>Recebemos os seus dados do processo <strong>${recipient.processName}</strong> e o seu contrato já foi gerado. Para assinar eletronicamente, clique no botão abaixo:</p>
    ${button(url, 'Assinar contrato')}
    <p>Após a assinatura de ambas as partes, você receberá uma cópia do contrato assinado em seu e-mail.</p>
    <p style="font-size:12px;color:#71717a;">Se o botão não funcionar, copie e cole este endereço no navegador:<br><a href="${url}" style="color:#059669;">${url}</a></p>`
  )
  return sendMail({ to: recipient.email, subject: `Assine seu contrato — ${recipient.processName}`, html }, { kind: 'contract' })
}

export async function emailSignedCopy(recipient: { name: string; email: string; processName: string; signedPdf: Buffer }) {
  const base = await getAppUrl()
  const pageUrl = `${base}/p/${recipient.token}`
  const html = wrap(
    'Contrato assinado por ambas as partes',
    `${greeting(recipient.name)}
    <p>O contrato do processo <strong>${recipient.processName}</strong> foi assinado por você e pelo contratado. A cópia assinada está anexada a este e-mail e também disponível no botão abaixo:</p>
    ${button(pageUrl, 'Ver segunda via do contrato')}`
  )
  return sendMail(
    {
      to: recipient.email,
      subject: `Contrato assinado — ${recipient.processName}`,
      html,
      attachments: [{ filename: 'contrato-assinado.pdf', content: recipient.signedPdf }],
    },
    { recipientId: undefined, kind: 'copy' }
  )
}

export async function emailPaymentLink(recipient: { name: string; email: string; paymentUrl: string | null; processName: string; amount: number | null; dueDate: string | null }) {
  if (!recipient.paymentUrl) throw new Error('Link de pagamento indisponível')
  const valor = recipient.amount ? formatCurrencyBRL(recipient.amount) : null
  const html = wrap(
    'Link de pagamento',
    `${greeting(recipient.name)}
    <p>Seu contrato do processo <strong>${recipient.processName}</strong> foi assinado. Realize o pagamento clicando no botão abaixo${valor ? ` — valor: <strong>${valor}</strong>` : ''}${recipient.dueDate ? `, vencimento em <strong>${recipient.dueDate.split('-').reverse().join('/')}</strong>` : ''}:</p>
    ${button(recipient.paymentUrl, 'Pagar agora')}
    <p>No link você escolhe a forma de pagamento: <strong>PIX, cartão de crédito ou boleto</strong>.</p>`
  )
  return sendMail({ to: recipient.email, subject: `Pagamento — ${recipient.processName}`, html }, { kind: 'payment' })
}

export async function emailPaid(recipient: { name: string; email: string; processName: string; token: string; amount: number | null }) {
  const base = await getAppUrl()
  const pageUrl = `${base}/p/${recipient.token}`
  const valor = recipient.amount ? formatCurrencyBRL(recipient.amount) : null
  const html = wrap(
    'Pagamento confirmado',
    `${greeting(recipient.name)}
    <p>Recebemos o pagamento do processo <strong>${recipient.processName}</strong>${valor ? ` no valor de <strong>${valor}</strong>` : ''} em ${formatDateBR(new Date())}. Tudo certo por aqui!</p>
    ${button(pageUrl, 'Acessar meus documentos')}`
  )
  return sendMail({ to: recipient.email, subject: `Pagamento confirmado — ${recipient.processName}`, html }, { kind: 'paid' })
}

export async function emailTest(to: string) {
  const html = wrap('E-mail de teste', '<p>Parabéns! A configuração do SMTP está funcionando. Os disparos desta plataforma serão enviados a partir desta conta.</p>')
  return sendMail({ to, subject: 'E-mail de teste da plataforma', html }, { kind: 'test' })
}
