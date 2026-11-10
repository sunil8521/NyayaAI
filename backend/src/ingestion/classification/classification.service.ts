import { Injectable, Logger } from '@nestjs/common';
import { ChatService } from '../../chat/chat.service';
import { EmbeddingService } from '../embedding.service';
import { DocumentType, ClassificationResult } from './classification.types';
import { ClassificationRules } from './classification.rules';
import { ClassificationZodSchema, ValidatedClassification } from './classification.validator';
import { CLASSIFICATION_SYSTEM_PROMPT } from './classification.prompt';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import type { PageText } from '../chunking.util';

@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * Main classification orchestrator:
   *  1. Inspects filename + first 2-3 pages.
   *  2. Runs high-precision rules (Stage 1).
   *  3. Runs BGE-M3 embedding classifier (Stage 2).
   *  4. If uncertain or conflicting, invokes Gemini LLM with structured output (Stage 3).
   *  5. Validates with Zod schema.
   */
  async classifyDocument(
    fileName: string,
    fullText: string,
    pages?: PageText[],
  ): Promise<ClassificationResult> {
    // Extract front matter text (first 2-3 pages or first 6000 chars)
    let frontText = '';
    if (pages && pages.length > 0) {
      frontText = pages
        .slice(0, 3)
        .map((p) => `--- PAGE ${p.pageNum} ---\n${p.text}`)
        .join('\n\n');
    } else {
      frontText = fullText.slice(0, 6000);
    }

    // ── STAGE 1: High-Precision Rules ─────────────────────────────
    const ruleResult = ClassificationRules.evaluate(fileName, frontText);
    if (ruleResult && ruleResult.confidence >= 0.88) {
      this.logger.log(
        `⚡ [Classifier: Rules] "${fileName}" → ${ruleResult.documentType} (${(ruleResult.confidence * 100).toFixed(0)}%)`,
      );
      return ruleResult;
    }

    // ── STAGE 2: BGE-M3 Embedding Classifier ──────────────────────
    let bgeType: DocumentType = DocumentType.UNKNOWN;
    let bgeConfidence = 0.0;

    try {
      const sample = frontText.slice(0, 4000);
      const bgeResponse = await this.embeddingService.classify(sample);
      if (bgeResponse && bgeResponse.docType) {
        bgeType = this.mapBgeTypeToEnum(bgeResponse.docType);
        bgeConfidence = bgeResponse.confidence || 0.0;
        this.logger.log(
          `🤖 [Classifier: BGE-M3] "${fileName}" → ${bgeType} (${(bgeConfidence * 100).toFixed(1)}%)`,
        );
      }
    } catch (err: any) {
      this.logger.warn(`⚠️ BGE-M3 classifier failed: ${err.message}`);
    }

    // If BGE-M3 is very confident (>= 0.75) and not UNKNOWN, use it
    if (bgeConfidence >= 0.75 && bgeType !== DocumentType.UNKNOWN) {
      return {
        documentType: bgeType,
        documentSubtype: null,
        court: null,
        tribunal: null,
        issuingAuthority: null,
        jurisdiction: 'All_India',
        title: fileName,
        caseNumber: null,
        caseTitle: null,
        parties: [],
        decisionDate: null,
        confidence: bgeConfidence,
        method: 'bge_m3',
        evidence: [{ field: 'documentType', text: `BGE-M3 embedding similarity (${(bgeConfidence * 100).toFixed(1)}%)` }],
      };
    }

    // ── STAGE 3: Gemini LLM Fallback (Ambiguous or Low Confidence) ─
    this.logger.log(
      `🧠 [Classifier: LLM] Ambiguous classification for "${fileName}" (rules: ${ruleResult?.documentType || 'none'}, BGE: ${bgeType} @ ${bgeConfidence.toFixed(2)}). Invoking Gemini fallback...`,
    );

    try {
      const llmResult = await this.classifyWithLlm(fileName, frontText);
      if (llmResult) {
        this.logger.log(
          `✅ [Classifier: LLM] "${fileName}" → ${llmResult.documentType} (confidence: ${llmResult.confidence})`,
        );
        return llmResult;
      }
    } catch (llmErr: any) {
      this.logger.error(`❌ LLM classification failed: ${llmErr.message}`);
    }

    // ── FALLBACK: Use best available result or UNKNOWN ────────────
    if (ruleResult) {
      return ruleResult;
    }

    return {
      documentType: bgeType !== DocumentType.UNKNOWN ? bgeType : DocumentType.UNKNOWN,
      documentSubtype: null,
      court: null,
      tribunal: null,
      issuingAuthority: null,
      jurisdiction: 'All_India',
      title: fileName,
      caseNumber: null,
      caseTitle: null,
      parties: [],
      decisionDate: null,
      confidence: bgeConfidence || 0.1,
      method: bgeConfidence > 0 ? 'bge_m3' : 'rules',
      evidence: [],
      needsReview: true,
    };
  }

  /**
   * Invokes Gemini with structured JSON output validated by Zod schema.
   */
  private async classifyWithLlm(
    fileName: string,
    frontText: string,
  ): Promise<ClassificationResult | null> {
    const llm = this.chatService.getLlm();

    // Use withStructuredOutput if supported, or structured prompt with JSON response
    const prompt = [
      new SystemMessage(
        `${CLASSIFICATION_SYSTEM_PROMPT}\n\nRespond ONLY with a valid JSON object matching this schema:\n` +
          JSON.stringify({
            documentType: 'string (one of allowed enum values)',
            documentSubtype: 'string or null',
            court: 'string or null',
            tribunal: 'string or null',
            issuingAuthority: 'string or null',
            jurisdiction: 'string or null',
            title: 'string or null',
            caseNumber: 'string or null',
            caseTitle: 'string or null',
            parties: ['string'],
            decisionDate: 'YYYY-MM-DD or null',
            confidence: 'number between 0 and 1',
            evidence: [{ field: 'string', text: 'string' }],
          }),
      ),
      new HumanMessage(
        `File Name: "${fileName}"\n\nDocument Front Pages Text:\n"""\n${frontText.slice(0, 7000)}\n"""`,
      ),
    ];

    const response = await llm.invoke(prompt);
    let rawContent = typeof response.content === 'string' ? response.content : '';

    // Strip markdown code fences if LLM wrapped in ```json ... ```
    rawContent = rawContent.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

    try {
      const parsed = JSON.parse(rawContent);
      const validated: ValidatedClassification = ClassificationZodSchema.parse(parsed);

      return {
        documentType: validated.documentType,
        documentSubtype: validated.documentSubtype || null,
        court: validated.court || null,
        tribunal: validated.tribunal || null,
        issuingAuthority: validated.issuingAuthority || null,
        jurisdiction: validated.jurisdiction || 'All_India',
        title: validated.title || fileName,
        caseNumber: validated.caseNumber || null,
        caseTitle: validated.caseTitle || null,
        parties: validated.parties || [],
        decisionDate: validated.decisionDate || null,
        confidence: validated.confidence,
        method: 'llm',
        evidence: validated.evidence || [],
        needsReview: validated.confidence < 0.6,
      };
    } catch (parseErr: any) {
      this.logger.warn(`Failed to parse LLM structured classification JSON: ${parseErr.message}`);
      return null;
    }
  }

  private mapBgeTypeToEnum(bgeType: string): DocumentType {
    const map: Record<string, DocumentType> = {
      court_judgment: DocumentType.COURT_JUDGMENT,
      court_order: DocumentType.COURT_ORDER,
      tribunal_order: DocumentType.TRIBUNAL_ORDER,
      central_act: DocumentType.CENTRAL_ACT,
      state_act: DocumentType.STATE_ACT,
      rules_regulations: DocumentType.RULES_REGULATIONS,
      amendment: DocumentType.AMENDMENT,
      circular: DocumentType.CIRCULAR,
      circular_notification: DocumentType.CIRCULAR,
      notification: DocumentType.NOTIFICATION,
      gazette: DocumentType.GAZETTE,
      writ_petition: DocumentType.PETITION,
      petition: DocumentType.PETITION,
      application: DocumentType.APPLICATION,
      criminal_complaint: DocumentType.APPLICATION,
      commercial_contract: DocumentType.LEGAL_CONTRACT,
      legal_contract: DocumentType.LEGAL_CONTRACT,
      legal_draft: DocumentType.LEGAL_NOTICE,
      legal_notice: DocumentType.LEGAL_NOTICE,
      legal_opinion: DocumentType.LEGAL_OPINION,
      other_legal_document: DocumentType.OTHER_LEGAL_DOCUMENT,
    };
    return map[bgeType] || DocumentType.UNKNOWN;
  }
}

