export type OcrProviderName = "LocalOCRProvider" | "CloudOCRProvider" | "ManualReviewProvider";

export type OcrExtractionResult = {
  providerName: OcrProviderName;
  text: string | null;
  confidenceScore: number;
  requiresReview: boolean;
  notes?: string;
};

export interface OcrProvider {
  providerName: OcrProviderName;
  extractText(input: { localFilePath: string; mimeType?: string | null }): Promise<OcrExtractionResult>;
  healthCheck(): Promise<{ ok: boolean; message: string }>;
}

export class LocalOCRProvider implements OcrProvider {
  providerName = "LocalOCRProvider" as const;

  async extractText(): Promise<OcrExtractionResult> {
    return {
      providerName: this.providerName,
      text: null,
      confidenceScore: 0,
      requiresReview: true,
      notes: "Local OCR is scaffolded but not enabled. Send scanned documents to manual review.",
    };
  }

  async healthCheck() {
    return { ok: false, message: "Local OCR provider is not configured yet." };
  }
}

export class CloudOCRProvider implements OcrProvider {
  providerName = "CloudOCRProvider" as const;

  async extractText(): Promise<OcrExtractionResult> {
    return {
      providerName: this.providerName,
      text: null,
      confidenceScore: 0,
      requiresReview: true,
      notes: "Cloud OCR is a future adapter and is not configured.",
    };
  }

  async healthCheck() {
    return { ok: false, message: "Cloud OCR provider is not configured yet." };
  }
}

export class ManualReviewProvider implements OcrProvider {
  providerName = "ManualReviewProvider" as const;

  async extractText(): Promise<OcrExtractionResult> {
    return {
      providerName: this.providerName,
      text: null,
      confidenceScore: 0,
      requiresReview: true,
      notes: "Manual review required for scanned, handwritten, or low-confidence documents.",
    };
  }

  async healthCheck() {
    return { ok: true, message: "Manual review queue is available." };
  }
}
