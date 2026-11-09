import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'fs'
import path from 'path'
import { getSettings } from '@/lib/settings'
import { formatCurrencyBRL } from '@/lib/format'

// marcadores de dado sensível: o que o formulário preencheu vira negrito no PDF.
// \x01/\x02 são invisíveis e sobrevivem ao sanitize (dentro de WinAnsi).
const MARK = '\x01'
const MARK_END = '\x02'

const A4_W = 595.28
const A4_H = 841.89
const MARGIN = 56
const FONT_SIZE = 11
const LINE_H = 16
// linha das assinaturas/rubricas, medida da base da página; o rodapé fica em y=46
const SIG_LINE_Y = 82

// ----- papel timbrado -----
const LETTERHEAD_COMPANY = 'Mérito Becas'
const LETTERHEAD_ADDRESS = 'Endereço: R. Toufic El Awar, 15 - Juliana, Belo Horizonte - MG, 31744-637'
const BRAND_GOLD = rgb(0.72, 0.58, 0.16)
const BRAND_GRAY = rgb(0.45, 0.42, 0.38)
// arquivo vem de public/ (copiado junto no build standalone); ausência não
// quebra a geração — o contrato sai sem logo
function readLogo(): Buffer | null {
  const candidates = [
    path.join(process.cwd(), 'public', 'contrato-logo.png'),
    path.join(process.cwd(), '..', 'public', 'contrato-logo.png'),
  ]
  for (const p of candidates) {
    try {
      return fs.readFileSync(p)
    } catch {
      // tenta o próximo
    }
  }
  return null
}

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
  const d: ContractData = {}
  // caractere de controle digitado quebraria o pareamento dos marcadores de
  // negrito (\x01/\x02); dados legítimos nunca têm \n (removido no form)
  for (const [k, v] of Object.entries(formData)) d[k] = v.replace(/[\x00-\x1F\x7F]/g, '')
  d.processo_nome = process.name
  d.data_referencia = process.referenceDate
  d.valor = process.amount ? formatCurrencyBRL(process.amount) : 'valor conforme negociação'
  d.data_contrato = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  d.contratado_nome = adminName || 'Administrador da plataforma'
  d.rg_campo = formData.rg ? `, RG nº ${MARK}${formData.rg}${MARK_END}` : ''
  d.telefone_campo = formData.telefone ? `, telefone ${MARK}${formData.telefone}${MARK_END}` : ''
  d.nascimento_campo = formData.data_nascimento ? `, nascido(a) em ${MARK}${formData.data_nascimento.split('-').reverse().join('/')}${MARK_END}` : ''
  d.complemento_campo = formData.complemento ? `, ${MARK}${formData.complemento}${MARK_END}` : ''
  d.endereco_completo = [formData.rua, formData.numero, formData.complemento, formData.bairro, formData.cidade, formData.estado, formData.cep]
    .filter(Boolean)
    .join(', ')
  return d
}

/** Substitui as variáveis; todo valor preenchido é envolto nos marcadores de
 * negrito — EXCETO fragmentos `_campo`, que chegam com marcadores próprios
 * (conectivo normal + valor em negrito) e não podem ser re-embrulhados, ou o
 * pareamento \x01/\x02 quebra e o marcador vaza pro desenho do PDF.
 * Variável vazia vira linha de preenchimento (sem marcador). */
function fill(template: string, data: ContractData): string {
  return template.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, key: string) => {
    const v = data[key]
    if (v === undefined || v === null || v === '') return '____________'
    if (v.includes(MARK) || v.includes(MARK_END)) return v
    return `${MARK}${v}${MARK_END}`
  })
}

/** Posições de assinatura/rubrica para a Autentique carimbar sobre o PDF,
 * derivadas do layout do bloco (linha fixa em SIG_LINE_Y do rodapé da última
 * página; contratante na metade esquerda, contratado na direita; páginas
 * anteriores têm as linhas de rubrica nas mesmas alturas). Sem isso, a
 * assinatura eletrônica aparece apenas na página de auditoria deles.
 * Calibração empírica: a âncora (x,y) é o canto SUPERIOR ESQUERDO do carimbo
 * (~5pt de folga) e o traço desce ~26pt — por isso y fica acima da linha. */
export function contractSignaturePositions(pageCount: number) {
  const y = (((A4_H - SIG_LINE_Y) / A4_H) * 100 - 3.3).toFixed(1) // ~87.0 do topo
  const pos = (xLeftPct: number, z: number, element: 'SIGNATURE' | 'INITIALS') => ({
    x: xLeftPct.toFixed(1),
    y,
    z,
    element,
  })
  const build = (sigX: number, rubricaX: number) => ({
    rubricas: Array.from({ length: Math.max(0, pageCount - 1) }, (_, i) => pos(rubricaX, i + 1, 'INITIALS')),
    assinatura: pos(sigX, pageCount, 'SIGNATURE'),
  })
  // início de cada linha, medido no layout: assinaturas 66/307.6pt,
  // rubricas 133.2/382.9pt (rótulo de 73.2/71.2pt + linha de 74pt);
  // x já compensa a âncora: SIGNATURE desloca +5pt e INITIALS +39.5pt
  return { contratante: build(11.5, 18.5), contratado: build(51.8, 60.5) }
}

export async function renderContractPdf(template: string, data: ContractData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle('Contrato')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const logoBytes = readLogo()
  let logo: Awaited<ReturnType<typeof pdf.embedPng>> | null = null
  if (logoBytes) {
    try {
      logo = await pdf.embedPng(logoBytes)
    } catch {
      logo = null
    }
  }

  const text = sanitize(fill(template, data))
  // preserva o layout digitado: cada linha do texto vira uma linha do PDF e
  // linhas em branco viram espaço vertical (não colapsa o \n\n em quebra simples)
  const sourceLines = text.split(/\r?\n/).map((l) => l.trim())
  // linhas em branco no fim não têm efeito visual, mas baixariam o y e
  // empurrariam as assinaturas para uma página extra
  while (sourceLines.length > 0 && !sourceLines[sourceLines.length - 1]) sourceLines.pop()

  let page = pdf.addPage([A4_W, A4_H])
  let y = A4_H - MARGIN
  const maxW = A4_W - MARGIN * 2

  // ----- cabeçalho timbrado (1ª página): logo pequena no canto esquerdo -----
  if (logo) {
    const logoW = 110
    const logoH = (logo.height / logo.width) * logoW
    page.drawImage(logo, { x: MARGIN, y: A4_H - MARGIN - logoH + 8, width: logoW, height: logoH })
    const ruleY = A4_H - MARGIN - logoH - 6
    page.drawLine({ start: { x: MARGIN, y: ruleY }, end: { x: A4_W - MARGIN, y: ruleY }, thickness: 1.4, color: BRAND_GOLD })
    y = ruleY - 28
  }

  const newPageIfNeeded = (needed = LINE_H) => {
    if (y - needed < MARGIN + 40) {
      page = pdf.addPage([A4_W, A4_H])
      y = A4_H - MARGIN
    }
  }

  /** Quebra o parágrafo em tokens com flag de negrito, preservando colagem de
   * pontuação (ex.: "{{cep}}, cidade" → "01310-930" + ", cidade" sem espaço). */
  const tokenizeRuns = (para: string): { text: string; bold: boolean; sp: boolean }[] => {
    const parts = para.split(/([\x01][^\x02]*\x02)/)
    const toks: { text: string; bold: boolean; sp: boolean }[] = []
    let ws = false
    for (const part of parts) {
      if (!part) continue
      const isMarked = part.charCodeAt(0) === 1 && part.charCodeAt(part.length - 1) === 2
      const seg = isMarked ? part.slice(1, -1) : part
      for (const ch of seg) {
        if (/\s/.test(ch)) {
          ws = true
          continue
        }
        const last = toks[toks.length - 1]
        if (!last || ws || last.bold !== isMarked) {
          toks.push({ text: ch, bold: isMarked, sp: ws && toks.length > 0 })
          ws = false
        } else {
          last.text += ch
        }
      }
    }
    return toks
  }

  const drawParagraph = (para: string, opts?: { bold?: boolean; center?: boolean; size?: number }) => {
    const size = opts?.size ?? FONT_SIZE
    // espaço natural da Helvetica (~3pt @ 11) fica visualmente colado e some
    // na extração de texto; alarga para leitura confortável
    const spaceW = font.widthOfTextAtSize(' ', size) * 2.2
    const toks = tokenizeRuns(para).map((t) => (opts?.bold ? { ...t, bold: true } : t))
    const lines: { text: string; bold: boolean; sp: boolean; w: number }[][] = []
    let line: { text: string; bold: boolean; sp: boolean; w: number }[] = []
    let lineW = 0
    for (const t of toks) {
      const w = (t.bold ? bold : font).widthOfTextAtSize(t.text, size)
      const addW = (t.sp && line.length > 0 ? spaceW : 0) + w
      if (lineW + addW > maxW && line.length > 0) {
        lines.push(line)
        line = [{ text: t.text, bold: t.bold, sp: false, w }]
        lineW = w
      } else {
        line.push({ text: t.text, bold: t.bold, sp: t.sp, w })
        lineW += addW
      }
    }
    if (line.length) lines.push(line)
    for (const ln of lines) {
      newPageIfNeeded()
      const totalW = ln.reduce((s, t) => s + t.w + (t.sp ? spaceW : 0), 0)
      let x = opts?.center ? (A4_W - totalW) / 2 : MARGIN
      for (const t of ln) {
        if (t.sp) x += spaceW
        page.drawText(t.text, { x, y: y - size, size, font: t.bold ? bold : font, color: rgb(0.1, 0.1, 0.12) })
        x += t.w
      }
      y -= LINE_H + (size > FONT_SIZE ? 4 : 0)
    }
    y += 6 // respiro entre parágrafos
  }

  let firstDrawn = false
  sourceLines.forEach((line) => {
    if (!line) {
      y -= LINE_H * 0.7 // linha em branco digitada: respiro fiel ao original
      return
    }
    const isTitle = !firstDrawn && line === line.toUpperCase() && line.length < 80
    const isClauseHead = /^(CLÁUSULA|IDENTIFICAÇÃO|PROCESSO|CLAUSULA|LOCAL|PARA FINS)/i.test(line) && line.length < 120
    drawParagraph(line, { bold: isTitle || isClauseHead, center: isTitle })
    firstDrawn = true
  })

  // ----- bloco de assinaturas -----
  // Ancorado no pé da página onde o texto terminou (nunca página solitária de
  // assinatura); só ganha página nova quando o texto encheu a página até a
  // zona de assinatura — nesse caso a página anterior fica com rubricas.
  const colW = maxW / 2
  const drawSig = (x: number, baseY: number, name: string, role: string) => {
    page.drawLine({
      start: { x: x + 10, y: baseY },
      end: { x: x + colW - 10, y: baseY },
      thickness: 1,
      color: rgb(0.55, 0.55, 0.58),
    })
    page.drawText(sanitize(name).slice(0, 42), { x: x + 10, y: baseY - 14, size: 10, font: bold, color: rgb(0.1, 0.1, 0.12) })
    page.drawText(sanitize(role), { x: x + 10, y: baseY - 26, size: 9, font, color: rgb(0.4, 0.4, 0.45) })
  }
  const drawSignatureBlock = (base: number) => {
    // local e data: "Cidade/UF" informados pela pessoa (um tolera falta do outro)
    const local = [data.cidade, data.estado].filter(Boolean).join('/') || 'Cidade'
    const dataHoje = data.data_contrato
    y = base + 31
    drawParagraph(`${MARK}${local}${MARK_END}, ${MARK}${dataHoje}${MARK_END}.`, { center: true })
    drawSig(MARGIN, base, data.nome_completo || 'CONTRATANTE', 'Contratante(a)')
    drawSig(MARGIN + colW, base, data.contratado_nome, 'Contratado(a) — Administrador')
  }
  // +38 = altura do bloco acima da linha (data) + folga de ~6pt do texto
  if (y >= SIG_LINE_Y + 38) {
    drawSignatureBlock(SIG_LINE_Y)
  } else {
    page = pdf.addPage([A4_W, A4_H])
    drawSignatureBlock(SIG_LINE_Y)
  }
  const signaturePageIndex = pdf.getPages().indexOf(page)

  // ----- rodapé timbrado (todas as páginas): empresa + endereço + paginação -----
  // páginas sem o bloco de assinaturas ganham rubricas dos signatários
  const pages = pdf.getPages()
  pages.forEach((p, i) => {
    if (i !== signaturePageIndex) {
      const label1 = sanitize('Rubrica Contratante(a):')
      const label2 = sanitize('Rubrica Contratado(a):')
      p.drawText(label1, { x: MARGIN, y: 82, size: 7, font, color: BRAND_GRAY })
      const lx1 = MARGIN + font.widthOfTextAtSize(label1, 7) + 4
      p.drawLine({ start: { x: lx1, y: 82 }, end: { x: lx1 + 74, y: 82 }, thickness: 0.8, color: rgb(0.55, 0.55, 0.58) })
      const x2 = A4_W / 2 + 10
      p.drawText(label2, { x: x2, y: 82, size: 7, font, color: BRAND_GRAY })
      const lx2 = x2 + font.widthOfTextAtSize(label2, 7) + 4
      p.drawLine({ start: { x: lx2, y: 82 }, end: { x: lx2 + 74, y: 82 }, thickness: 0.8, color: rgb(0.55, 0.55, 0.58) })
    }
    p.drawLine({ start: { x: MARGIN, y: 46 }, end: { x: A4_W - MARGIN, y: 46 }, thickness: 1, color: BRAND_GOLD })
    p.drawText(sanitize(`${LETTERHEAD_COMPANY} · ${LETTERHEAD_ADDRESS}`), { x: MARGIN, y: 34, size: 7.5, font, color: BRAND_GRAY })
    const label = `Página ${i + 1} de ${pages.length}`
    p.drawText(label, { x: A4_W - MARGIN - font.widthOfTextAtSize(label, 8), y: 34, size: 8, font, color: BRAND_GRAY })
  })

  return pdf.save()
}
