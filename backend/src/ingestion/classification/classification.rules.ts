import { DocumentType, ClassificationResult, ClassificationEvidence } from './classification.types';
import { KNOWN_COURTS, KNOWN_TRIBUNALS, KNOWN_AUTHORITIES } from './classification.constants';

/**
 * High-precision, evidence-based rule classifier for Indian legal documents.
 * Never decides on loose words (like "v.", "mumbai", or "circular" anywhere in body).
 * Only triggers when explicit document headings, numbers, or standard legal front-matter are found.
 */
export class ClassificationRules {
  /**
   * Evaluates high-confidence rules against the filename and the text of the first 2-3 pages.
   * Returns a ClassificationResult if a definitive rule triggers, or null if uncertain.
   */
  static evaluate(
    fileName: string,
    frontText: string,
  ): ClassificationResult | null {
    const textLower = frontText.toLowerCase();
    const fileNameLower = fileName.toLowerCase();
    const combined = `${fileNameLower}\n${textLower}`;

    const evidence: ClassificationEvidence[] = [];

    // 1. Identify Authority / Court / Tribunal
    const court = this.detectCourt(combined, evidence);
    const tribunal = this.detectTribunal(combined, evidence);
    const authority = this.detectAuthority(combined, evidence);

    const jurisdiction =
      court?.jurisdiction ||
      tribunal?.jurisdiction ||
      authority?.jurisdiction ||
      'All_India';

    // 2. Extract potential Case Number from front matter
    const caseNumber = this.extractCaseNumber(frontText, evidence);

    // 3. Document Type rules (Strict & High Precision)

    // --- Gazette of India ---
    if (
      combined.includes('the gazette of india') ||
      combined.includes('gazette of india extraordinary') ||
      /regd\.\s*no\.\s*d\.\s*l\./i.test(frontText)
    ) {
      evidence.push({ field: 'documentType', text: 'The Gazette of India' });
      return {
        documentType: DocumentType.GAZETTE,
        documentSubtype: 'official_gazette',
        court: null,
        tribunal: null,
        issuingAuthority: authority?.name || 'Government of India',
        jurisdiction: 'All_India',
        title: this.extractFirstLineTitle(frontText) || fileName,
        caseNumber: null,
        caseTitle: null,
        parties: [],
        decisionDate: null,
        confidence: 0.95,
        method: 'rules',
        evidence,
      };
    }

    // --- Bare Acts / Statutes (Central or State Act) ---
    const actMatch = frontText.match(/\b(act\s+no\.?\s+\d+\s+of\s+(?:18|19|20)\d{2})\b/i);
    if (actMatch || /bare\s*act/i.test(fileNameLower) || /^the\s+[A-Za-z\s]+act,\s*(?:18|19|20)\d{2}/im.test(frontText)) {
      const isState = /\b(state\s+of\s+[A-Za-z]+|delhi\s+act|maharashtra\s+act|karnataka\s+act)\b/i.test(combined);
      evidence.push({ field: 'documentType', text: actMatch ? actMatch[1] : 'Bare Act identifier' });
      return {
        documentType: isState ? DocumentType.STATE_ACT : DocumentType.CENTRAL_ACT,
        documentSubtype: isState ? 'state_legislation' : 'central_statute',
        court: null,
        tribunal: null,
        issuingAuthority: isState ? 'State Legislature' : 'Parliament of India',
        jurisdiction: isState ? (court?.jurisdiction || 'State_Specific') : 'All_India',
        title: this.extractFirstLineTitle(frontText) || fileName,
        caseNumber: null,
        caseTitle: null,
        parties: [],
        decisionDate: null,
        confidence: 0.95,
        method: 'rules',
        evidence,
      };
    }

    // --- Rules & Regulations ---
    if (
      /\b(?:rules|regulations),\s*(?:19|20)\d{2}\b/i.test(frontText) &&
      !/\bsection\b/i.test(fileNameLower) // avoid section quotes
    ) {
      evidence.push({ field: 'documentType', text: 'Rules/Regulations pattern' });
      return {
        documentType: DocumentType.RULES_REGULATIONS,
        documentSubtype: 'delegated_legislation',
        court: null,
        tribunal: null,
        issuingAuthority: authority?.name || 'Regulatory Authority',
        jurisdiction: 'All_India',
        title: this.extractFirstLineTitle(frontText) || fileName,
        caseNumber: null,
        caseTitle: null,
        parties: [],
        decisionDate: null,
        confidence: 0.9,
        method: 'rules',
        evidence,
      };
    }

    // --- Official Notifications & Circulars ---
    const notifMatch = frontText.match(/\b(?:notification\s*no\.?|circular\s*no\.?)\s*[:\s]*([A-Z0-9\/\-\(\)]+)/i);
    if (notifMatch || (authority && /\b(circular|notification|guidelines|master direction)\b/i.test(fileNameLower))) {
      const isCircular = /\bcircular\b/i.test(fileNameLower) || /\bcircular\s*no\b/i.test(frontText);
      evidence.push({ field: 'documentType', text: notifMatch ? notifMatch[0] : 'Official Circular/Notification header' });
      return {
        documentType: isCircular ? DocumentType.CIRCULAR : DocumentType.NOTIFICATION,
        documentSubtype: isCircular ? 'regulatory_circular' : 'official_notification',
        court: null,
        tribunal: null,
        issuingAuthority: authority?.name || 'Government Authority',
        jurisdiction: 'All_India',
        title: this.extractFirstLineTitle(frontText) || fileName,
        caseNumber: notifMatch ? notifMatch[1] : null,
        caseTitle: null,
        parties: [],
        decisionDate: null,
        confidence: 0.92,
        method: 'rules',
        evidence,
      };
    }

    // --- Court Judgment vs Court Order ---
    // Requires BOTH explicit judgment/order keyword AND evidence of court/parties/coram
    const hasCoramOrBench = /\b(coram|bench|hon'ble\s*mr\.\s*justice|honble\s*justice)\b/i.test(frontText);
    const hasParties = /\bversus\b|\bv\/s\b|\bappellant\b|\brespondent\b|\bpetitioner\b/i.test(frontText);
    const hasExplicitJudgmentHeader = /^\s*(?:JUDGMENT|JUDGEMENT)\s*$/im.test(frontText) || /\bjudgment\s+dated\b/i.test(frontText);
    const hasExplicitOrderHeader = /^\s*(?:ORDER|COURT\s*ORDER)\s*$/im.test(frontText) || /\border\s+dated\b/i.test(frontText);

    if (court && (hasCoramOrBench || hasParties)) {
      if (hasExplicitJudgmentHeader) {
        evidence.push({ field: 'documentType', text: 'Explicit JUDGMENT header with Coram/Parties' });
        return {
          documentType: DocumentType.COURT_JUDGMENT,
          documentSubtype: 'final_judgment',
          court: court.name,
          tribunal: null,
          issuingAuthority: null,
          jurisdiction,
          title: fileName,
          caseNumber,
          caseTitle: null,
          parties: [],
          decisionDate: null,
          confidence: 0.93,
          method: 'rules',
          evidence,
        };
      }

      if (hasExplicitOrderHeader) {
        evidence.push({ field: 'documentType', text: 'Explicit ORDER header with Coram/Parties' });
        return {
          documentType: DocumentType.COURT_ORDER,
          documentSubtype: 'interim_or_final_order',
          court: court.name,
          tribunal: null,
          issuingAuthority: null,
          jurisdiction,
          title: fileName,
          caseNumber,
          caseTitle: null,
          parties: [],
          decisionDate: null,
          confidence: 0.91,
          method: 'rules',
          evidence,
        };
      }
    }

    // --- Tribunal Order ---
    if (tribunal && (hasExplicitOrderHeader || hasExplicitJudgmentHeader || hasCoramOrBench)) {
      evidence.push({ field: 'documentType', text: `Explicit order header in ${tribunal.name}` });
      return {
        documentType: DocumentType.TRIBUNAL_ORDER,
        documentSubtype: hasExplicitJudgmentHeader ? 'tribunal_judgment' : 'tribunal_order',
        court: null,
        tribunal: tribunal.name,
        issuingAuthority: null,
        jurisdiction,
        title: fileName,
        caseNumber,
        caseTitle: null,
        parties: [],
        decisionDate: null,
        confidence: 0.92,
        method: 'rules',
        evidence,
      };
    }

    // --- Petitions & Filings ---
    if (
      /\b(writ\s+petition|special\s+leave\s+petition|slp\s*\(c\)|slp\s*\(crl\)|criminal\s+appeal|civil\s+appeal)\b/i.test(combined) &&
      !hasExplicitJudgmentHeader // not the judgment itself
    ) {
      evidence.push({ field: 'documentType', text: 'Writ/Special Leave Petition header' });
      return {
        documentType: DocumentType.PETITION,
        documentSubtype: 'writ_petition_or_slp',
        court: court?.name || null,
        tribunal: tribunal?.name || null,
        issuingAuthority: null,
        jurisdiction,
        title: fileName,
        caseNumber,
        caseTitle: null,
        parties: [],
        decisionDate: null,
        confidence: 0.88,
        method: 'rules',
        evidence,
      };
    }

    // --- Commercial Agreements & Contracts ---
    if (
      /\b(this\s+agreement\s+is\s+made|non-disclosure\s+agreement|master\s+service\s+agreement|lease\s+deed|sale\s+deed|memorandum\s+of\s+understanding)\b/i.test(frontText)
    ) {
      evidence.push({ field: 'documentType', text: 'Contractual introductory clause' });
      return {
        documentType: DocumentType.LEGAL_CONTRACT,
        documentSubtype: 'commercial_agreement',
        court: null,
        tribunal: null,
        issuingAuthority: null,
        jurisdiction: 'Commercial',
        title: this.extractFirstLineTitle(frontText) || fileName,
        caseNumber: null,
        caseTitle: null,
        parties: [],
        decisionDate: null,
        confidence: 0.9,
        method: 'rules',
        evidence,
      };
    }

    // --- Legal Notice ---
    if (/^\s*(?:LEGAL\s*NOTICE|NOTICE\s*UNDER\s*SECTION\s*138)\b/im.test(frontText) || /\blegal\s+notice\b/i.test(fileNameLower)) {
      evidence.push({ field: 'documentType', text: 'Legal notice header' });
      return {
        documentType: DocumentType.LEGAL_NOTICE,
        documentSubtype: 'statutory_notice',
        court: null,
        tribunal: null,
        issuingAuthority: null,
        jurisdiction: 'Civil_Criminal',
        title: fileName,
        caseNumber: null,
        caseTitle: null,
        parties: [],
        decisionDate: null,
        confidence: 0.9,
        method: 'rules',
        evidence,
      };
    }

    // No high-confidence rule matched — return null to proceed to BGE-M3 / LLM
    return null;
  }

  private static detectCourt(text: string, evidence: ClassificationEvidence[]): { name: string; jurisdiction: string } | null {
    for (const c of KNOWN_COURTS) {
      for (const alias of c.aliases) {
        if (text.includes(alias)) {
          evidence.push({ field: 'court', text: c.name });
          return { name: c.name, jurisdiction: c.jurisdiction || 'All_India' };
        }
      }
    }
    return null;
  }

  private static detectTribunal(text: string, evidence: ClassificationEvidence[]): { name: string; jurisdiction: string } | null {
    for (const t of KNOWN_TRIBUNALS) {
      for (const alias of t.aliases) {
        if (text.includes(alias)) {
          evidence.push({ field: 'tribunal', text: t.name });
          return { name: t.name, jurisdiction: t.jurisdiction || 'All_India' };
        }
      }
    }
    return null;
  }

  private static detectAuthority(text: string, evidence: ClassificationEvidence[]): { name: string; jurisdiction: string } | null {
    for (const a of KNOWN_AUTHORITIES) {
      for (const alias of a.aliases) {
        if (text.includes(alias)) {
          evidence.push({ field: 'issuingAuthority', text: a.name });
          return { name: a.name, jurisdiction: a.jurisdiction || 'All_India' };
        }
      }
    }
    return null;
  }

  private static extractCaseNumber(text: string, evidence: ClassificationEvidence[]): string | null {
    const casePatterns = [
      /\b(?:case\s*no\.?|petition\s*no\.?|appeal\s*no\.?|c\.?a\.?\s*no\.?|w\.?p\.?\s*\(c\)?\s*no\.?|slp\s*\(c\)?\s*no\.?)\s*[:\s]*([0-9\/\-\(\)\s]+of\s+(?:19|20)\d{2})/i,
      /\b(?:no\.\s*)([0-9\/\-]+\s+of\s+(?:19|20)\d{2})/i,
    ];

    for (const pattern of casePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const found = match[1].trim().replace(/\s+/g, ' ');
        evidence.push({ field: 'caseNumber', text: found });
        return found;
      }
    }
    return null;
  }

  private static extractFirstLineTitle(text: string): string | null {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5 && l.length < 150);
    return lines.length > 0 ? lines[0] : null;
  }
}

