import { describe, it, expect } from 'vitest';
import {
  tokenizeQuery,
  extractRequestedSectionNumber,
  searchLegislationChunks,
  formatSectionsForPrompt,
  getRecommendedSectionNumbersForContext,
  LegislationChunk,
} from '@/utils/legislationSearch';

describe('Legislation Search Utilities', () => {
  const mockChunks: LegislationChunk[] = [
    {
      id: 'ira-sec-3',
      actName: 'Inland Revenue Act No. 24 of 2017',
      type: 'section',
      number: '3',
      title: 'Taxable income',
      content: 'Subject to subsection (2), the taxable income of a person for a year of assessment shall be equal to assessable income.',
      keywords: ['taxable', 'income', 'assessable', 'person'],
    },
    {
      id: 'ira-sec-5',
      actName: 'Inland Revenue Act No. 24 of 2017',
      type: 'section',
      number: '5',
      title: 'Employment income',
      content: 'An individual gains and profits from an employment shall include payments of salary, wages, bonus and leave pay.',
      keywords: ['employment', 'salary', 'wages', 'bonus', 'individual'],
    },
    {
      id: 'ira-sec-52',
      actName: 'Inland Revenue Act No. 24 of 2017',
      type: 'section',
      number: '52',
      title: 'Qualifying payments and reliefs',
      content: 'In arriving at the taxable income, qualifying payments and reliefs referred to in Fifth Schedule shall be deducted.',
      keywords: ['qualifying', 'payments', 'reliefs', 'deducted'],
    },
    {
      id: 'ira-sec-83',
      actName: 'Inland Revenue Act No. 24 of 2017',
      type: 'section',
      number: '83',
      title: 'Advance Personal Income Tax (APIT) withholding by employers',
      content: 'An employer shall withhold Advance Personal Income Tax from employment payments.',
      keywords: ['advance', 'personal', 'apit', 'withholding', 'employer'],
    },
    {
      id: 'ira-first-schedule',
      actName: 'Inland Revenue Act No. 24 of 2017',
      type: 'schedule',
      number: 'FIRST SCHEDULE',
      title: 'Tax Rates for Individuals',
      content: 'The taxable income of an individual shall be taxed at progressive rate brackets starting from 6% up to 36%.',
      keywords: ['rates', 'brackets', 'progressive', 'individual'],
    },
  ];

  describe('tokenizeQuery', () => {
    it('should split and remove stopwords and short terms', () => {
      const tokens = tokenizeQuery('How is employment salary taxed in Sri Lanka?');
      expect(tokens).toContain('employment');
      expect(tokens).toContain('salary');
      expect(tokens).not.toContain('how');
      expect(tokens).not.toContain('is');
      expect(tokens).not.toContain('in');
      expect(tokens).not.toContain('tax');
    });
  });

  describe('extractRequestedSectionNumber', () => {
    it('should extract section number from query variations', () => {
      expect(extractRequestedSectionNumber('What does section 52 say?')).toBe('52');
      expect(extractRequestedSectionNumber('Details on sec 5')).toBe('5');
      expect(extractRequestedSectionNumber('s. 83 apit rules')).toBe('83');
      expect(extractRequestedSectionNumber('Check first schedule rates')).toBe('FIRST SCHEDULE');
      expect(extractRequestedSectionNumber('General tax question')).toBeNull();
    });
  });

  describe('searchLegislationChunks', () => {
    it('should prioritize exact section matches', () => {
      const results = searchLegislationChunks(mockChunks, 'What is section 52?');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].chunk.number).toBe('52');
      expect(results[0].score).toBeGreaterThan(100);
    });

    it('should match keywords and content terms', () => {
      const results = searchLegislationChunks(mockChunks, 'employment salary bonus');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].chunk.number).toBe('5');
    });

    it('should return empty array if no terms match', () => {
      const results = searchLegislationChunks(mockChunks, 'cryptocurrency mining');
      expect(results).toHaveLength(0);
    });
  });

  describe('formatSectionsForPrompt', () => {
    it('should format retrieved sections with citation headers', () => {
      const results = searchLegislationChunks(mockChunks, 'section 5');
      const formatted = formatSectionsForPrompt(results);
      expect(formatted).toContain('### Section 5: Employment income');
      expect(formatted).toContain('An individual gains and profits');
    });

    it('should return empty string for empty results', () => {
      expect(formatSectionsForPrompt([])).toBe('');
    });
  });

  describe('getRecommendedSectionNumbersForContext', () => {
    it('should include baseline sections plus profile-specific sections', () => {
      const sections = getRecommendedSectionNumbersForContext({
        hasEmploymentIncome: true,
        hasAuditRisk: true,
      });

      expect(sections).toContain('3');
      expect(sections).toContain('52');
      expect(sections).toContain('FIRST SCHEDULE');
      expect(sections).toContain('5'); // Employment income
      expect(sections).toContain('83'); // APIT
      expect(sections).toContain('116'); // Audit risk / default assessment
    });
  });
});
