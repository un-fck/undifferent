export interface ParsedSymbol {
  body: string
  session: number | null
  number: number | null
  type: 'resolution' | 'document' | 'unknown'
}

/**
 * Parse a UN document symbol into its components
 * Examples:
 *   A/RES/77/16 -> { body: 'A', session: 77, number: 16, type: 'resolution' }
 *   A/C.2/79/L.8 -> { body: 'A/C.2', session: 79, number: 8, type: 'document' }
 */
export function parseUNSymbol(symbol: string): ParsedSymbol {
  // Resolution pattern: A/RES/XX/YY or S/RES/XXXX
  const resMatch = symbol.match(/^([A-Z])\/RES\/(\d+)\/(\d+)$/)
  if (resMatch) {
    return {
      body: resMatch[1],
      session: parseInt(resMatch[1] === 'S' ? '0' : resMatch[2]),
      number: parseInt(resMatch[3]),
      type: 'resolution',
    }
  }

  // Security Council resolution: S/RES/XXXX (no session)
  const scResMatch = symbol.match(/^S\/RES\/(\d+)/)
  if (scResMatch) {
    return {
      body: 'S',
      session: null,
      number: parseInt(scResMatch[1]),
      type: 'resolution',
    }
  }

  // Committee/other document pattern: A/C.X/XX/L.Y
  const docMatch = symbol.match(/^([A-Z](?:\/C\.\d+)?)\/(\d+)\/[A-Z]+\.(\d+)/)
  if (docMatch) {
    return {
      body: docMatch[1],
      session: parseInt(docMatch[2]),
      number: parseInt(docMatch[3]),
      type: 'document',
    }
  }

  return {
    body: symbol.split('/')[0],
    session: null,
    number: null,
    type: 'unknown',
  }
}

/**
 * Extract year from UN document symbol using session number calculation
 * 
 * NOTE: This is a heuristic that only works reliably for GA resolutions:
 *   - GA session N → year 1945 + N (e.g., session 77 = 2022)
 *   - Does NOT work for HRC resolutions (multiple sessions per year)
 * 
 * For accurate years, use fetchDocumentMetadata() instead.
 */
export function extractYear(symbol: string): number | null {
  const parsed = parseUNSymbol(symbol)
  if (parsed.session !== null && parsed.session < 200) {
    // Assume it's a session number, not a year
    return 1945 + parsed.session
  }
  if (parsed.session !== null && parsed.session > 1900) {
    // Already a year
    return parsed.session
  }
  return null
}
