/**
 * Legislation Search Engine
 * Zero-latency, 100% offline lexical & semantic retrieval for Sri Lankan tax legislation.
 */

export interface LegislationChunk {
  id: string;
  actName: string;
  type: 'section' | 'schedule' | 'preamble';
  number: string;
  title: string;
  chapter?: string;
  part?: string;
  content: string;
  keywords: string[];
}

export interface LegislationSearchResult {
  chunk: LegislationChunk;
  score: number;
  matchedTerms: string[];
}

/**
 * Stopwords to ignore in general queries
 */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'from',
  'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'can', 'could', 'should', 'would', 'will', 'what', 'how', 'when',
  'where', 'why', 'who', 'which', 'about', 'tell', 'me', 'tax', 'sri', 'lanka', 'lankan'
]);

/**
 * Tokenize query text into clean search terms
 */
export function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));
}

/**
 * Check if the query asks for a specific section number (e.g. "section 52", "sec 5", "s52", "s. 83")
 */
export function extractRequestedSectionNumber(query: string): string | null {
  const match = query.match(/(?:section|sec\.?|s\.?)\s*(\d+[a-z]?)\b/i);
  if (match) return match[1].toLowerCase();

  const scheduleMatch = query.match(/(first|second|third|fourth|fifth|sixth)\s+schedule/i);
  if (scheduleMatch) {
    return `${scheduleMatch[1].toUpperCase()} SCHEDULE`;
  }

  return null;
}

/**
 * Search legislation chunks for the most relevant sections based on a query
 */
export function searchLegislationChunks(
  chunks: LegislationChunk[],
  query: string,
  options: { maxResults?: number; minScore?: number } = {}
): LegislationSearchResult[] {
  const { maxResults = 5, minScore = 5 } = options;
  const terms = tokenizeQuery(query);
  const requestedNumber = extractRequestedSectionNumber(query);

  if (terms.length === 0 && !requestedNumber) {
    return [];
  }

  const results: LegislationSearchResult[] = [];

  for (const chunk of chunks) {
    let score = 0;
    const matchedTerms: string[] = [];
    const chunkNumLower = chunk.number.toLowerCase();
    const titleLower = chunk.title.toLowerCase();
    const contentLower = chunk.content.toLowerCase();

    // 1. Direct section/schedule number match
    if (requestedNumber) {
      if (chunkNumLower === requestedNumber || chunkNumLower.includes(requestedNumber)) {
        score += 150;
        matchedTerms.push(`Section ${chunk.number}`);
      }
    }

    // 2. Term matching in title, keywords, and content
    for (const term of terms) {
      let termMatched = false;

      // Title matches have highest relevance
      if (titleLower.includes(term)) {
        score += 25;
        termMatched = true;
      }

      // Keyword matches
      if (chunk.keywords.some((k) => k.includes(term))) {
        score += 15;
        termMatched = true;
      }

      // Content term frequency
      if (contentLower.includes(term)) {
        // Approximate term frequency with simple regex
        const termRegex = new RegExp(`\\b${term}\\b`, 'gi');
        const count = (chunk.content.match(termRegex) || []).length;
        if (count > 0) {
          score += Math.min(count * 2, 20); // Cap at 20 points per term
          termMatched = true;
        }
      }

      if (termMatched) {
        matchedTerms.push(term);
      }
    }

    if (score >= minScore) {
      results.push({
        chunk,
        score,
        matchedTerms: Array.from(new Set(matchedTerms)),
      });
    }
  }

  // Sort descending by score
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, maxResults);
}

/**
 * Format retrieved sections into a clean context prompt for Gemini
 */
export function formatSectionsForPrompt(
  results: LegislationSearchResult[],
  maxTotalChars: number = 25000
): string {
  if (results.length === 0) {
    return '';
  }

  let totalChars = 0;
  const formattedSections: string[] = [];

  for (const { chunk } of results) {
    const header = `### ${chunk.type === 'schedule' ? chunk.number : `Section ${chunk.number}`}: ${chunk.title}`;
    // Limit individual section length if very large
    const sectionBody = chunk.content.length > 8000 ? `${chunk.content.slice(0, 8000)}... [truncated]` : chunk.content;
    const block = `${header}\n${sectionBody}`;

    if (totalChars + block.length > maxTotalChars) {
      // Fit partial if space remains
      const remaining = maxTotalChars - totalChars - header.length - 20;
      if (remaining > 500) {
        formattedSections.push(`${header}\n${sectionBody.slice(0, remaining)}...`);
      }
      break;
    }

    formattedSections.push(block);
    totalChars += block.length;
  }

  return formattedSections.join('\n\n---\n\n');
}

/**
 * Pre-select key sections based on financial profile (for initial advisory report)
 */
export function getRecommendedSectionNumbersForContext(profile: {
  hasEmploymentIncome?: boolean;
  hasBusinessIncome?: boolean;
  hasInvestmentIncome?: boolean;
  hasCertificates?: boolean;
  hasAuditRisk?: boolean;
}): string[] {
  const sections: string[] = ['3', '52', 'FIRST SCHEDULE']; // Baseline: Taxable Income, Reliefs, Tax Rates

  if (profile.hasEmploymentIncome) {
    sections.push('5', '83'); // Employment income, APIT
  }
  if (profile.hasBusinessIncome) {
    sections.push('6', '10', '11'); // Business income, deductions
  }
  if (profile.hasInvestmentIncome) {
    sections.push('7', '48', '84'); // Investment income, Capital gains, WHT
  }
  if (profile.hasCertificates) {
    sections.push('87', '90'); // Certificates, credit for withholding
  }
  if (profile.hasAuditRisk) {
    sections.push('21', '116', '152'); // Cost of asset, default assessment, penalties
  }

  return Array.from(new Set(sections));
}
