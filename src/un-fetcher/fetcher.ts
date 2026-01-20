import WordExtractor from 'word-extractor'
import { extractText } from 'unpdf'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

export interface UNDocument {
  symbol: string
  text: string
  lines: string[]
  lineCount: number
  format: 'doc' | 'pdf'
}

export interface UNDocumentMetadata {
  symbol: string
  title: string
  date: string | null
  year: number | null
  subjects: string[]
  vote?: {
    inFavour: number
    against: number
    abstaining: number
  }
  agendaInfo?: string
}

/**
 * Fetch document metadata from UN Digital Library
 * Returns title, date, year, subjects, vote info, and agenda for the given symbol
 */
export async function fetchDocumentMetadata(symbol: string): Promise<UNDocumentMetadata> {
  const encodedSymbol = encodeURIComponent(symbol)
  const url = `https://digitallibrary.un.org/search?ln=en&p=${encodedSymbol}&f=&rm=&sf=&so=d&rg=50&c=Resource+Type&c=UN+Bodies&c=&of=xm&fti=0&fti=0`

  // Use curl user-agent to bypass AWS WAF challenge
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'curl/8.7.1',
      'Accept': '*/*',
    },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch metadata for ${symbol}`)
  }

  const xml = await response.text()
  
  // Split into records using regex to handle whitespace
  const recordMatches = xml.match(/<record>[\s\S]*?<\/record>/g)
  if (!recordMatches) {
    return { symbol, title: symbol, date: null, year: null, subjects: [] }
  }
  
  for (const record of recordMatches) {
    // Extract symbol from tag 191$a - look for the subfield within the datafield
    const tag191Match = record.match(/<datafield tag="191"[^>]*>([\s\S]*?)<\/datafield>/)
    if (!tag191Match) continue
    
    const symbolSubfieldMatch = tag191Match[1].match(/<subfield code="a">([^<]+)<\/subfield>/)
    if (!symbolSubfieldMatch || symbolSubfieldMatch[1] !== symbol) {
      continue // Not an exact match, skip
    }

    // Extract title from tag 245$a
    const tag245Match = record.match(/<datafield tag="245"[^>]*>([\s\S]*?)<\/datafield>/)
    let title = symbol
    if (tag245Match) {
      const titleSubfieldMatch = tag245Match[1].match(/<subfield code="a">([^<]+)<\/subfield>/)
      if (titleSubfieldMatch) {
        title = titleSubfieldMatch[1].replace(/ :$/, '').trim()
      }
    }

    // Extract date from tag 269$a (format: YYYY-MM-DD)
    const tag269Match = record.match(/<datafield tag="269"[^>]*>([\s\S]*?)<\/datafield>/)
    let date: string | null = null
    let year: number | null = null
    if (tag269Match) {
      const dateSubfieldMatch = tag269Match[1].match(/<subfield code="a">(\d{4}-\d{2}-\d{2})<\/subfield>/)
      if (dateSubfieldMatch) {
        date = dateSubfieldMatch[1]
        year = parseInt(date.substring(0, 4))
      }
    }

    // Extract subjects from tag 650$a (can be multiple)
    const subjects: string[] = []
    const tag650Matches = record.matchAll(/<datafield tag="650"[^>]*>([\s\S]*?)<\/datafield>/g)
    for (const match of tag650Matches) {
      const subjectMatch = match[1].match(/<subfield code="a">([^<]+)<\/subfield>/)
      if (subjectMatch) {
        subjects.push(subjectMatch[1].trim())
      }
    }

    // Extract vote info from tag 996 (subfields b=in favour, c=against, d=abstaining)
    let vote: UNDocumentMetadata['vote'] = undefined
    const tag996Match = record.match(/<datafield tag="996"[^>]*>([\s\S]*?)<\/datafield>/)
    if (tag996Match) {
      const inFavourMatch = tag996Match[1].match(/<subfield code="b">(\d+)<\/subfield>/)
      const againstMatch = tag996Match[1].match(/<subfield code="c">(\d+)<\/subfield>/)
      const abstainingMatch = tag996Match[1].match(/<subfield code="d">(\d+)<\/subfield>/)
      if (inFavourMatch || againstMatch || abstainingMatch) {
        vote = {
          inFavour: inFavourMatch ? parseInt(inFavourMatch[1]) : 0,
          against: againstMatch ? parseInt(againstMatch[1]) : 0,
          abstaining: abstainingMatch ? parseInt(abstainingMatch[1]) : 0,
        }
      }
    }

    // Extract agenda info from tag 991$d or 991$e
    let agendaInfo: string | undefined = undefined
    const tag991Match = record.match(/<datafield tag="991"[^>]*>([\s\S]*?)<\/datafield>/)
    if (tag991Match) {
      const agendaMatch = tag991Match[1].match(/<subfield code="[de]">([^<]+)<\/subfield>/)
      if (agendaMatch) {
        agendaInfo = agendaMatch[1].trim()
      }
    }

    return { symbol, title, date, year, subjects, vote, agendaInfo }
  }

  // No exact match found, return with null values
  return { symbol, title: symbol, date: null, year: null, subjects: [] }
}

/**
 * Fetch and parse a UN document by its symbol
 * Tries DOC format first, falls back to PDF
 */
export async function fetchUNDocument(symbol: string): Promise<UNDocument> {
  // Try doc format first (docx gives same results)
  const docUrl = `https://documents.un.org/api/symbol/access?s=${symbol}&l=en&t=doc`

  const docResponse = await fetch(docUrl)
  if (docResponse.ok) {
    try {
      const result = await extractWordDocument(docResponse, symbol)
      console.log(`[${symbol}] Loaded as DOC (${result.lineCount} lines)`)
      return result
    } catch {
      // DOC extraction failed, try PDF
    }
  }

  // Fall back to PDF if doc fails
  const pdfUrl = `https://documents.un.org/api/symbol/access?s=${symbol}&l=en&t=pdf`

  const pdfResponse = await fetch(pdfUrl, { redirect: 'follow' })
  if (pdfResponse.ok) {
    try {
      const result = await extractPdfDocument(pdfResponse, symbol)
      console.log(`[${symbol}] Loaded as PDF (${result.lineCount} lines)`)
      return result
    } catch (err) {
      console.error(`[${symbol}] PDF extraction failed:`, err)
    }
  }

  throw new Error(
    `Failed to fetch document ${symbol}: No available format (tried doc, pdf)`
  )
}

async function extractWordDocument(
  response: Response,
  symbol: string
): Promise<UNDocument> {
  const format = 'doc'
  const buffer = await response.arrayBuffer()
  const tempFilePath = join(
    tmpdir(),
    `${symbol.replace(/\//g, '_')}_${Date.now()}.${format}`
  )

  try {
    // Write buffer to temporary file
    await writeFile(tempFilePath, Buffer.from(buffer))

    // Extract text using word-extractor
    const extractor = new WordExtractor()
    const extracted = await extractor.extract(tempFilePath)
    const text = extracted.getBody()

    // Clean up temporary file
    await unlink(tempFilePath)

    // Process text into lines (similar to Python processing)
    const lines = text
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line)

    return {
      symbol,
      text,
      lines,
      lineCount: lines.length,
      format,
    }
  } catch (extractError) {
    // Clean up temp file even if extraction fails
    try {
      await unlink(tempFilePath)
    } catch {}

    throw extractError
  }
}

async function extractPdfDocument(
  response: Response,
  symbol: string
): Promise<UNDocument> {
  const buffer = await response.arrayBuffer()

  // Extract text from PDF using unpdf (server-side compatible)
  // mergePages: true returns a single string instead of array of pages
  const { text } = await extractText(new Uint8Array(buffer), {
    mergePages: true,
  })

  // Process text into lines
  // PDF extraction from scanned documents often returns text without proper line breaks
  // Use aggressive segmentation patterns for UN resolutions
  const processedText = text
    // Normalize whitespace first (OCR often has broken words)
    .replace(/\s+/g, ' ')
    // Add line breaks before numbered items (1. 2. etc) - must be followed by uppercase
    .replace(/ (\d+)\. ([A-Z])/g, '\n$1. $2')
    // Add line breaks before section markers (A, B, C, D, E as standalone)
    .replace(/ ([A-E]) (\d+)/g, '\n$1\n$2')
    // Add line breaks before "The General Assembly"
    .replace(/ (The General Assembly)/g, '\n$1')
    // Add line breaks after semicolons followed by numbered items
    .replace(/; (\d+)\./g, ';\n$1.')
    // Add line breaks before letter items (a) (b) etc
    .replace(/ (\([a-z]\) )/g, '\n$1')

  const lines = processedText
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line && line.length > 15) // Filter out very short segments

  return {
    symbol,
    text,
    lines,
    lineCount: lines.length,
    format: 'pdf',
  }
}
