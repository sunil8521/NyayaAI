import { z } from 'zod';
import { DocumentType } from './classification.types';

export const ClassificationZodSchema = z.object({
  documentType: z.enum([
    DocumentType.COURT_JUDGMENT,
    DocumentType.COURT_ORDER,
    DocumentType.TRIBUNAL_ORDER,
    DocumentType.CENTRAL_ACT,
    DocumentType.STATE_ACT,
    DocumentType.RULES_REGULATIONS,
    DocumentType.AMENDMENT,
    DocumentType.CIRCULAR,
    DocumentType.NOTIFICATION,
    DocumentType.GAZETTE,
    DocumentType.PETITION,
    DocumentType.APPLICATION,
    DocumentType.LEGAL_NOTICE,
    DocumentType.LEGAL_CONTRACT,
    DocumentType.LEGAL_OPINION,
    DocumentType.OTHER_LEGAL_DOCUMENT,
    DocumentType.UNKNOWN,
  ]).describe('The primary legal category of the document.'),

  documentSubtype: z.string().nullable().optional().describe('Specific subtype e.g. writ_petition, bail_application, bare_act, commercial_contract, interim_order.'),

  court: z.string().nullable().optional().describe('Official name of the Court (e.g. Supreme Court of India, Delhi High Court). null if not a court document.'),

  tribunal: z.string().nullable().optional().describe('Official name of the Tribunal (e.g. NCLT, NCLAT, ITAT, DRT, NGT). null if not a tribunal document.'),

  issuingAuthority: z.string().nullable().optional().describe('Government ministry, regulator, or body (e.g. Reserve Bank of India, SEBI, Ministry of Finance). null if not applicable.'),

  jurisdiction: z.string().nullable().optional().describe('Territorial or legal jurisdiction (e.g. All_India, Delhi, Maharashtra).'),

  title: z.string().nullable().optional().describe('Official title of the Act, agreement name, or document heading.'),

  caseNumber: z.string().nullable().optional().describe('Official case number or petition number (e.g. Civil Appeal No. 1234 of 2022). null if not present.'),

  caseTitle: z.string().nullable().optional().describe('Parties title e.g. "ABC Ltd. v. Union of India". null if not applicable.'),

  parties: z.array(z.string()).default([]).describe('List of main parties (e.g. appellant, respondent, petitioner).'),

  decisionDate: z.string().nullable().optional().describe('Date of decision or enactment in YYYY-MM-DD format. null if date is not stated.'),

  confidence: z.number().min(0).max(1).describe('Confidence score between 0.0 and 1.0.'),

  evidence: z.array(
    z.object({
      field: z.string(),
      page: z.number().optional(),
      text: z.string().describe('Exact quote from the document supporting this classification.'),
    })
  ).default([]),
});

export type ValidatedClassification = z.infer<typeof ClassificationZodSchema>;

