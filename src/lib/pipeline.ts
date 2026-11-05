import { db } from '@/lib/db'
import { getSettings } from '@/lib/settings'
import { renderContractPdf, buildContractData } from '@/lib/contract'
import * as autentique from '@/lib/autentique'
import * as asaas from '@/lib/asaas'
import {
  emailFormLink,
  emailSignLink,
  emailSignedCopy,
  emailPaymentLink,
  emailPaid,
} from '@/lib/mailer'

type RecipientWithProcess = Awaited<ReturnType<typeof getRecipientWithProcess>>

async function getRecipientWithProcess(id: string) {
  return db.recipient.findUnique({ where: { id }, include: { process: true } })
}

async function fail(recipientId: string, stage: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  await db.recipient.update({ where: { id: recipientId }, data: { status: 'erro', stage, error: message } })
}

function formDataOf(recipient: RecipientWithProcess): Record<string, string> {
  try {
    return JSON.parse(recipient.formData || '{}') as Record<string, string>
  } catch {
    return {}
  }
}

// ---------- etapa 1: disparo do e-mail com link do formulário ----------

export async function stepDispatchForm(recipientId: string): Promise<void> {
  const recipient = await getRecipientWithProcess(recipientId)
  if (!recipient) return
  const claimed = await db.recipient.updateMany({
    where: { id: recipient.id, status: 'fila' },
    data: { status: 'form_enviado' },
  })
  if (claimed.count !== 1) return
  try {
    const result = await emailFormLink({
      name: recipient.name,
      email: recipient.email,
      token: recipient.token,
      processName: recipient.process.name,
    })
    if (!result.ok) throw new Error(result.error || 'Falha no envio do e-mail')
  } catch (err) {
    await fail(recipient.id, 'form', err)
  }
}

// ---------- etapa 2: form recebido -> gerar contrato -> Autentique -> e-mail de assinatura ----------

export async function stepCreateContract(recipientId: string): Promise<void> {
  const recipient = await getRecipientWithProcess(recipientId)
  if (!recipient) return

  // documento já existe: NUNCA regenerar (evita segundo documento na Autentique
  // e contratos recriados com dados alterados) — apenas reenvia o link
  if (recipient.autentiqueDocId) {
    const claimed = await db.recipient.updateMany({
      where: { id: recipient.id, status: 'form_recebido' },
      data: { status: 'contrato_enviado', stage: null, error: null },
    })
    if (claimed.count !== 1) return
    await emailSignLink({
      name: recipient.name,
      email: recipient.email,
      signUrl: recipient.signUrl,
      processName: recipient.process.name,
    })
    return
  }

  const claimed = await db.recipient.updateMany({
    where: { id: recipient.id, status: 'form_recebido' },
    data: { status: 'gerando_contrato' },
  })
  if (claimed.count !== 1) return
  try {
    const settings = await getSettings()
    if (!settings.autentiqueToken) throw new Error('Token da Autentique não configurado (Configurações).')
    if (!settings.adminSignerEmail) throw new Error('E-mail do assinante administrador não configurado (Configurações).')
    if (!settings.adminSignerName) throw new Error('Nome do assinante administrador não configurado (Configurações).')

    const formData = formDataOf(recipient)
    const data = buildContractData(formData, recipient.process, settings.adminSignerName)
    const template = recipient.process.contractTemplate || settings.contractTemplate
    const pdf = await renderContractPdf(template, data)

    const doc = await autentique.createDocument(settings.autentiqueToken, {
      name: `Contrato - ${recipient.name} (${recipient.process.name})`,
      pdf,
      signers: [
        { email: recipient.email, action: 'SIGN', name: recipient.name },
        { email: settings.adminSignerEmail, action: 'SIGN', name: settings.adminSignerName, ...(settings.adminSignerCpf ? { cpf: settings.adminSignerCpf } : {}) },
      ],
    })

    // assinatura automática do administrador (dono do token)
    let adminSigned = false
    try {
      await autentique.signDocument(settings.autentiqueToken, doc.id)
      adminSigned = true
    } catch {
      adminSigned = false // segue; pode ser assinado depois manualmente no painel Autentique
    }

    const personSig = doc.signatures.find((s) => s.email.toLowerCase() === recipient.email.toLowerCase())
    const signUrl = personSig?.link?.short_link || null

    await db.recipient.update({
      where: { id: recipient.id },
      data: {
        status: 'contrato_enviado',
        stage: null,
        error: null,
        autentiqueDocId: doc.id,
        signUrl,
        adminSigned,
        contractSentAt: new Date(),
        generatedPdfB64: Buffer.from(pdf).toString('base64'),
      },
    })

    const emailResult = await emailSignLink({
      name: recipient.name,
      email: recipient.email,
      signUrl,
      processName: recipient.process.name,
    })
    if (!emailResult.ok) throw new Error(emailResult.error || 'Falha ao enviar e-mail de assinatura')
  } catch (err) {
    await fail(recipient.id, 'contract', err)
  }
}

// ---------- etapa 3: pessoa assinou -> baixar cópia -> e-mail ----------

export async function stepFinalizeSignature(recipientId: string): Promise<void> {
  const recipient = await getRecipientWithProcess(recipientId)
  if (!recipient) return
  const claimed = await db.recipient.updateMany({
    where: { id: recipient.id, status: 'contrato_enviado' },
    data: { status: 'finalizando_assinatura' },
  })
  if (claimed.count !== 1) return
  try {
    const settings = await getSettings()
    if (!settings.autentiqueToken || !recipient.autentiqueDocId) throw new Error('Documento da Autentique não encontrado')

    const doc = await autentique.getDocument(settings.autentiqueToken, recipient.autentiqueDocId)
    const signedPdfUrl = doc.files?.signed
    if (!signedPdfUrl) throw new Error('PDF assinado ainda indisponível na Autentique')

    const bytes = await autentique.downloadSignedPdf(settings.autentiqueToken, signedPdfUrl)
    const buffer = Buffer.from(bytes)

    await db.recipient.update({
      where: { id: recipient.id },
      data: {
        status: 'assinado',
        stage: null,
        error: null,
        signedAt: new Date(),
        signedPdfB64: buffer.toString('base64'),
      },
    })

    const emailResult = await emailSignedCopy({
      name: recipient.name,
      email: recipient.email,
      processName: recipient.process.name,
      signedPdf: buffer,
    })
    // a cópia é um extra: falha no envio não trava o fluxo de cobrança
    if (emailResult.ok) {
      await db.recipient.update({ where: { id: recipient.id }, data: { copySentAt: new Date() } })
    }
  } catch (err) {
    await fail(recipient.id, 'sign', err)
  }
}

// ---------- etapa 4: assinado -> criar cobrança Asaas -> e-mail do link ----------

export async function stepCreatePayment(recipientId: string): Promise<void> {
  const recipient = await getRecipientWithProcess(recipientId)
  if (!recipient) return
  const claimed = await db.recipient.updateMany({
    where: { id: recipient.id, status: 'assinado' },
    data: { status: 'gerando_cobranca' },
  })
  if (claimed.count !== 1) return
  try {
    const settings = await getSettings()
    const amount = recipient.process.amount
    if (!amount) throw new Error('Processo sem valor de cobrança definido')
    const dueDate = recipient.process.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

    const formData = formDataOf(recipient)
    const customer = await asaas.createCustomer({
      name: recipient.name,
      email: recipient.email,
      cpfCnpj: formData.cpf || '00000000000',
      phone: formData.telefone,
    })
    const payment = await asaas.createPayment({
      customerId: customer.id,
      value: amount,
      dueDate,
      description: recipient.process.description || `Processo ${recipient.process.name}`,
      externalReference: recipient.id,
    })

    await db.recipient.update({
      where: { id: recipient.id },
      data: {
        status: 'pagamento_enviado',
        stage: null,
        error: null,
        asaasCustomerId: customer.id,
        asaasPaymentId: payment.id,
        paymentUrl: payment.invoiceUrl,
        paymentSentAt: new Date(),
      },
    })

    const emailResult = await emailPaymentLink({
      name: recipient.name,
      email: recipient.email,
      paymentUrl: payment.invoiceUrl,
      processName: recipient.process.name,
      amount: recipient.process.amount,
      dueDate: recipient.process.dueDate,
    })
    if (!emailResult.ok) throw new Error(emailResult.error || 'Falha ao enviar e-mail do pagamento')
  } catch (err) {
    await fail(recipient.id, 'payment', err)
  }
}

// ---------- etapa 5: pagamento confirmado ----------

export async function stepMarkPaid(recipientId: string): Promise<void> {
  const recipient = await getRecipientWithProcess(recipientId)
  if (!recipient) return
  const claimed = await db.recipient.updateMany({
    where: { id: recipient.id, status: 'pagamento_enviado' },
    data: { status: 'pago', paidAt: new Date(), stage: null, error: null },
  })
  if (claimed.count !== 1) return
  try {
    await emailPaid({
      name: recipient.name,
      email: recipient.email,
      processName: recipient.process.name,
      token: recipient.token,
      amount: recipient.process.amount,
    })
  } catch {
    // e-mail de confirmação é informativo; não reverte o status pago
  }
}

// ---------- sondagem (fallback dos webhooks) ----------

export async function pollAutentique(): Promise<void> {
  const settings = await getSettings()
  if (!settings.autentiqueToken) return
  const pendings = await db.recipient.findMany({
    where: { status: 'contrato_enviado', autentiqueDocId: { not: null } },
    take: 10,
    orderBy: { updatedAt: 'asc' },
  })
  for (const r of pendings) {
    try {
      const doc = await autentique.getDocument(settings.autentiqueToken, r.autentiqueDocId!)
      const byEmail = (email: string) => doc.signatures.find((s) => (s.email || '').toLowerCase() === email.toLowerCase())
      const personSigned = !!byEmail(r.email)?.signed
      const adminEmail = settings.adminSignerEmail || ''
      const adminSignedNow = adminEmail ? !!byEmail(adminEmail)?.signed : false
      if (adminSignedNow && !r.adminSigned) {
        await db.recipient.update({ where: { id: r.id }, data: { adminSigned: true } })
      }
      if (personSigned && !r.signedAt) {
        await db.recipient.update({ where: { id: r.id }, data: { signedAt: new Date() } })
      }
      const allSigned = doc.signatures.length > 0 && doc.signatures.every((s) => !!s.signed)
      if (allSigned || (doc.files && doc.files.signed)) {
        await stepFinalizeSignature(r.id)
      }
    } catch {
      // silencioso: próxima sondagem tenta de novo
    }
  }
}

export async function pollAsaas(): Promise<void> {
  const settings = await getSettings()
  if (!settings.asaasApiKey) return
  const pendings = await db.recipient.findMany({
    where: { status: 'pagamento_enviado', asaasPaymentId: { not: null } },
    take: 20,
    orderBy: { updatedAt: 'asc' },
  })
  for (const r of pendings) {
    try {
      const payment = await asaas.getPayment(r.asaasPaymentId!)
      if (asaas.isPaidStatus(payment.status)) {
        await stepMarkPaid(r.id)
      }
    } catch {
      // silencioso
    }
  }
}

/** Reprocessa a etapa onde o destinatário falhou. */
export async function retryRecipient(recipientId: string): Promise<void> {
  const r = await db.recipient.findUnique({ where: { id: recipientId } })
  if (!r || r.status !== 'erro') return
  const stage = r.stage
  const back: Record<string, string> = {
    form: 'fila',
    contract: 'form_recebido',
    sign: 'contrato_enviado',
    payment: 'assinado',
  }
  const next = stage ? back[stage] : null
  if (!next) return
  await db.recipient.update({
    where: { id: recipientId },
    data: { status: next, stage: null, error: null },
  })
}

/** Chamado quando a pessoa envia o formulário público.
 * O status já foi clamado para 'form_recebido' atomicamente na rota — aqui só
 * gravamos metadados. Nunca regredir estado: uma regressão reabriria o fluxo
 * e permitiria recriar contrato/cobrança com dados alterados. */
export async function onFormSubmitted(recipientId: string): Promise<void> {
  await db.recipient.update({
    where: { id: recipientId },
    data: { submittedAt: new Date(), stage: null, error: null },
  })
  // tenta criar o contrato imediatamente; se falhar, a fila retenta
  await stepCreateContract(recipientId).catch(() => undefined)
}

/** Reenvio manual da cópia assinada (segunda via por e-mail). */
export async function resendSignedCopy(recipientId: string): Promise<{ ok: boolean; error?: string }> {
  const r = await getRecipientWithProcess(recipientId)
  if (!r?.signedPdfB64) return { ok: false, error: 'Cópia assinada não disponível' }
  const { emailSignedCopy } = await import('@/lib/mailer')
  return emailSignedCopy({
    name: r.name,
    email: r.email,
    processName: r.process.name,
    signedPdf: Buffer.from(r.signedPdfB64, 'base64'),
  }).then((res) => ({ ok: res.ok, error: res.error }))
}
