import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getSettings } from '@/lib/settings'
import { formatCurrencyBRL } from '@/lib/format'
import { fieldDef } from '@/lib/fields'

const A4_W = 595.28
const A4_H = 841.89
const MARGIN = 56
const FONT_SIZE = 11
const LINE_H = 16

/** Caracteres fora do WinAnsi (Helvética) precisam ser normalizados. */
function sanitize(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x00-\xFF]/g, (ch) => {
      // remove qualquer coisa fora do WinAnsi (emojis etc.)
      const winAnsiSafe = ch.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      return winAnsiSafe.length === 1 && winAnsiSafe.codePointAt(0)! < 256 ? winAnsiSafe : ''
    })
}

export type ContractData = Record<string, string>

export function buildContractData(
  formData: Record<string, string>,
  process: { name: string; referenceDate: string; amount: number | null },
  adminName: string | null
): ContractData {
  const d: ContractData = { ...formData }
  d.processo_nome = process.name
  d.data_referencia = process.referenceDate
  d.valor = process.amount ? formatCurrencyBRL(process.amount) : 'valor conforme negociação'
  d.data_contrato = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  d.contratado_nome = adminName || 'Administrador da plataforma'
  d.rg_campo = formData.rg ? `, RG nº ${formData.rg}` : ''
  d.telefone_campo = formData.telefone ? `, telefone ${formData.telefone}` : ''
  d.nascimento_campo = formData.data_nascimento ? `, nascido(a) em ${formData.data_nascimento.split('-').reverse().join('/')}` : ''
  d.endereco_completo = [formData.rua, formData.numero, formData.bairro, formData.cidade, formData.estado, formData.cep]
    .filter(Boolean)
    .join(', ')
  return d
}

function fill(template: string, data: ContractData): string {
  return template.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, key: string) => {
    const v = data[key]
    return v === undefined || v === null || v === '' ? '____________' : v
  })
}

export async function renderContractPdf(template: string, data: ContractData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle('Contrato')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const text = sanitize(fill(template, data))
  const paragraphs = text.split(/\n+/).map((p) => p.trim()).filter(Boolean)

  let page = pdf.addPage([A4_W, A4_H])
  let y = A4_H - MARGIN
  const maxW = A4_W - MARGIN * 2

  const newPageIfNeeded = (needed = LINE_H) => {
    if (y - needed < MARGIN + 40) {
      page = pdf.addPage([A4_W, A4_H])
      y = A4_H - MARGIN
    }
  }

  const drawParagraph = (para: string, opts?: { bold?: boolean; center?: boolean; size?: number }) => {
    const isBold = opts?.bold ?? false
    const size = opts?.size ?? FONT_SIZE
    const f = isBold ? bold : font
    const words = para.split(/\s+/)
    let line = ''
    const lines: string[] = []
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (f.widthOfTextAtSize(test, size) > maxW && line) {
        lines.push(line)
        line = w
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
    for (const l of lines) {
      newPageIfNeeded()
      const x = opts?.center ? (A4_W - f.widthOfTextAtSize(l, size)) / 2 : MARGIN
      page.drawText(l, { x, y: y - size, size, font: f, color: rgb(0.1, 0.1, 0.12) })
      y -= LINE_H + (size > FONT_SIZE ? 4 : 0)
    }
    y += 6 // respiro entre parágrafos
  }

  paragraphs.forEach((para, i) => {
    const isTitle = i === 0 && para === para.toUpperCase() && para.length < 80
    const isClauseHead = /^(CLÁUSULA|IDENTIFICAÇÃO|PROCESSO|CLAUSULA|LOCAL|PARA FINS)/i.test(para) && para.length < 120
    drawParagraph(para, { bold: isTitle || isClauseHead, center: isTitle })
  })

  // ----- bloco de assinaturas -----
  y -= 10
  newPageIfNeeded(150)

  const cidade = data.cidade || 'Cidade'
  const dataHoje = data.data_contrato
  drawParagraph(`${cidade}, ${dataHoje}.`, { center: true })

  y -= 40
  const colW = maxW / 2
  const drawSig = (x: number, name: string, role: string) => {
    page.drawLine({
      start: { x: x + 10, y },
      end: { x: x + colW - 10, y },
      thickness: 1,
      color: rgb(0.55, 0.55, 0.58),
    })
    y -= 14
    page.drawText(sanitize(name).slice(0, 42), { x: x + 10, y, size: 10, font: bold, color: rgb(0.1, 0.1, 0.12) })
    y -= 12
    page.drawText(sanitize(role), { x: x + 10, y, size: 9, font, color: rgb(0.4, 0.4, 0.45) })
    y -= 6
  }

  const sigY = y
  drawSig(MARGIN, data.nome_completo || 'CONTRATANTE', 'Contratante(a)')
  y = sigY
  drawSig(MARGIN + colW, data.contratado_nome, 'Contratado(a) — Administrador')

  // ----- dados declarados -----
  y -= 24
  newPageIfNeeded(120)
  drawParagraph('DADOS DECLARADOS NO FORMULÁRIO', { bold: true, size: 10 })
  y -= 4
  const entries = Object.entries(data).filter(([k]) => fieldDef(k))
  for (const [k, v] of entries) {
    const def = fieldDef(k)
    if (!def || !v) continue
    newPageIfNeeded()
    const label = `${def.label}:`
    page.drawText(sanitize(label), { x: MARGIN, y: y - FONT_SIZE, size: 9, font: bold, color: rgb(0.25, 0.25, 0.3) })
    const lx = MARGIN + font.widthOfTextAtSize(label, 9) + 6
    const maxValW = maxW - (lx - MARGIN)
    let val = sanitize(v)
    if (font.widthOfTextAtSize(val, 9) > maxValW) {
      while (val.length > 0 && font.widthOfTextAtSize(val, 9) > maxValW) val = val.slice(0, -2)
      val += '…'
    }
    page.drawText(val, { x: lx, y: y - FONT_SIZE, size: 9, font, color: rgb(0.25, 0.25, 0.3) })
    y -= 13
  }

  return pdf.save()
}
