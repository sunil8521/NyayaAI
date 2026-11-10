export enum DocumentType {
  COURT_JUDGMENT = 'court_judgment',
  COURT_ORDER = 'court_order',
  TRIBUNAL_ORDER = 'tribunal_order',

  CENTRAL_ACT = 'central_act',
  STATE_ACT = 'state_act',
  RULES_REGULATIONS = 'rules_regulations',
  AMENDMENT = 'amendment',

  CIRCULAR = 'circular',
  NOTIFICATION = 'notification',
  GAZETTE = 'gazette',

  PETITION = 'petition',
  APPLICATION = 'application',
  LEGAL_NOTICE = 'legal_notice',
  LEGAL_CONTRACT = 'legal_contract',

  LEGAL_OPINION = 'legal_opinion',
  OTHER_LEGAL_DOCUMENT = 'other_legal_document',
  UNKNOWN = 'unknown',
}

export interface ClassificationEvidence {
  field: string;
  page?: number;
  text: string;
}

export interface ClassificationResult {
  documentType: DocumentType;
  documentSubtype: string | null;

  court: string | null;
  tribunal: string | null;
  issuingAuthority: string | null;
  jurisdiction: string | null;

  title: string | null;
  caseNumber: string | null;
  caseTitle: string | null;
  parties: string[];
  decisionDate: string | null; // ISO string YYYY-MM-DD

  confidence: number;
  method: 'rules' | 'bge_m3' | 'llm';
  evidence: ClassificationEvidence[];
  needsReview?: boolean;
}

