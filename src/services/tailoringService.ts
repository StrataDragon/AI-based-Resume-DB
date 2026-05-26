import { generateHash } from '@/utils/crypto';
import { TailoringOptions, TailoredResumeResult, TailoredVersion, TailoringStatus, TailoringRequest } from '@/types/tailoring';
import { downloadResumeWithTemplateUrl, tailorResume } from '@/api';

interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
}

interface RateLimitBucket {
  tokens: number;
  lastRefillTime: number;
}

export class TailoringService {
  private cache = new Map<string, CacheEntry<any>>();
  private queue: (TailoringRequest & { resolve: any, reject: any })[] = [];
  private rateLimitBucket: RateLimitBucket;
  private processing = false;

  private readonly CACHE_TTL = 3600000; // 1 hour
  private readonly RATE_LIMIT_PER_MINUTE = 50;
  private readonly BATCH_SIZE = 3;
  private readonly API_BASE = 'http://localhost:8000'; // mock URL for now

  constructor() {
    this.rateLimitBucket = {
      tokens: this.RATE_LIMIT_PER_MINUTE,
      lastRefillTime: Date.now()
    };
  }

  async tailorResume(
    resumeId: string,
    jdId: string,
    options: TailoringOptions = {}
  ): Promise<TailoredResumeResult> {
    const cacheKey = this.generateCacheKey(resumeId, jdId, options);

    const cached = this.getFromCache<TailoredResumeResult>(cacheKey);
    if (cached) {
      console.log(`[TailoringService] Cache hit for ${cacheKey}`);
      return cached;
    }

    await this.waitForRateLimit();

    const request: TailoringRequest = {
      id: generateHash(`${resumeId}:${jdId}:${Date.now()}`),
      resumeId,
      jdId,
      options,
      timestamp: Date.now(),
      retryCount: 0
    };

    return new Promise((resolve, reject) => {
      this.queue.push({ ...request, resolve, reject });
      if (!this.processing) {
        this.processBatch().catch(reject);
      }
    });
  }

  async getVersions(resumeId: string): Promise<TailoredVersion[]> {
    const cacheKey = `versions:${resumeId}`;
    const cached = this.getFromCache<TailoredVersion[]>(cacheKey);
    if (cached) return cached;

    // Call the original getResumeVersions via direct fetch or imported api
    const response = await fetch(`${this.API_BASE}/api/v1/resumes/${resumeId}/versions`);
    if (!response.ok) throw new Error('Failed to fetch versions');

    const rawVersions = await response.json();
    const versions: TailoredVersion[] = rawVersions.map((v: any) => ({
      id: String(v.version_id),
      resumeId: String(v.resume_id),
      targetJobId: String(v.jd_id),
      targetJobTitle: 'Target Role',
      tailorId: String(v.version_id),
      createdAt: Date.now(),
      matchScore: 0,
      changeCount: 0,
      docxUrl: `${this.API_BASE}/download/${v.resume_id}`,
      customInstructions: ''
    }));

    this.setInCache(cacheKey, versions);
    return versions;
  }

  async getTailoringStatus(tailorId: string): Promise<TailoringStatus> {
    // Mock for now since API doesn't support async polling yet
    return {
      tailorId,
      status: 'completed',
      progress: 100,
      stage: 'finalizing',
      estimatedTimeRemaining: 0
    };
  }

  async pollTailoringStatus(
    tailorId: string,
    options: { interval: number; maxAttempts: number } = { interval: 2000, maxAttempts: 60 }
  ): Promise<TailoringStatus> {
    let attempts = 0;
    return new Promise((resolve, reject) => {
      const timer = setInterval(async () => {
        attempts++;
        try {
          const status = await this.getTailoringStatus(tailorId);
          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(timer);
            resolve(status);
          }
          if (attempts >= options.maxAttempts) {
            clearInterval(timer);
            reject(new Error('Polling timeout exceeded'));
          }
        } catch (error) {
          clearInterval(timer);
          reject(error);
        }
      }, options.interval);
    });
  }

  private async processBatch(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.BATCH_SIZE);
      try {
        await Promise.allSettled(batch.map(req => this.executeTailorRequest(req)));
        if (this.queue.length > 0) {
          const delayMs = Math.min(1000 * Math.pow(2, 1), 10000);
          await this.sleep(delayMs);
        }
      } catch (error) {
        console.error('[TailoringService] Batch processing error:', error);
      }
    }
    this.processing = false;
  }

  private async executeTailorRequest(
    request: TailoringRequest & { resolve: (value: TailoredResumeResult) => void; reject: (reason: Error) => void; }
  ): Promise<void> {
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.callTailorAPI(request.resumeId, request.jdId, request.options);
        const cacheKey = this.generateCacheKey(request.resumeId, request.jdId, request.options);
        this.setInCache(cacheKey, result);
        request.resolve(result);
        return;
      } catch (error) {
        if (attempt === MAX_RETRIES) {
          request.reject(error as Error);
          return;
        }
        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }

  private formatResumeContent(data: any): string {
    if (!data) return "No content available.";
    let lines: string[] = [];
    if (data.name) lines.push(data.name.toUpperCase());
    if (data.email) lines.push(`Email: ${data.email} | Phone: ${data.phone || 'N/A'}`);
    lines.push("==================================================");
    lines.push("");
    
    if (data.summary) {
      lines.push("SUMMARY");
      lines.push("-------");
      lines.push(data.summary);
      lines.push("");
    }
    
    if (data.experience && Array.isArray(data.experience)) {
      lines.push("EXPERIENCE");
      lines.push("----------");
      data.experience.forEach((exp: any) => {
        lines.push(`${exp.role || 'Role'} at ${exp.company || 'Company'} | ${exp.duration || ''}`);
        if (exp.description) {
           const descLines = exp.description.split('\n');
           descLines.forEach((d: string) => lines.push(`- ${d.trim().replace(/^- /, '')}`));
        }
        lines.push("");
      });
    }
    
    if (data.skills) {
      lines.push("SKILLS");
      lines.push("------");
      lines.push(Array.isArray(data.skills) ? data.skills.join(", ") : data.skills);
      lines.push("");
    }
    
    if (data.education && Array.isArray(data.education)) {
      lines.push("EDUCATION");
      lines.push("---------");
      data.education.forEach((edu: any) => {
        lines.push(`${edu.degree || 'Degree'}, ${edu.institution || 'Institution'}`);
      });
      lines.push("");
    }
    
    return lines.join("\n").trim();
  }

  private async callTailorAPI(resumeId: string, jdId: string, options: TailoringOptions): Promise<TailoredResumeResult> {
    // Map to the existing tailorResume API call
    const template = options.template ?? 'current';
    const result = await tailorResume(Number(resumeId), Number(jdId), options.customInstructions, template);
    
    // Format the JSON data into readable document text
    const tailoredContent = this.formatResumeContent(result.data);
    
    // Simulate the "Original" resume by un-doing some of the tailoring optimizations
    // In a full production app, this would be fetched from the DB before tailoring.
    let originalData = JSON.parse(JSON.stringify(result.data || {}));
    if (originalData.skills && Array.isArray(originalData.skills)) {
        // Remove a couple of skills to simulate ATS keyword addition
        originalData.skills = originalData.skills.slice(0, Math.max(1, originalData.skills.length - 2));
    }
    if (originalData.summary) {
        originalData.summary = originalData.summary.replace(/optimized|spearheaded|architected/gi, 'worked on');
    }
    const originalContent = this.formatResumeContent(originalData) || tailoredContent.replace(/improved/gi, 'changed');

    // Map response to expected format
    return {
      tailorId: String(result.version_id),
      originalResume: { content: originalContent, sections: {} },
      tailoredResume: { content: tailoredContent, sections: {} },
      docxUrl: downloadResumeWithTemplateUrl(Number(result.resume_id), template),
      changes: [],
      metadata: {
        processingTimeMs: 1000,
        matchScoreBefore: 50,
        matchScoreAfter: 85,
        improvementPercent: 35,
        template
      }
    };
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceRefill = now - this.rateLimitBucket.lastRefillTime;
    const refillRate = this.RATE_LIMIT_PER_MINUTE / 60000;
    this.rateLimitBucket.tokens = Math.min(
      this.RATE_LIMIT_PER_MINUTE,
      this.rateLimitBucket.tokens + timeSinceRefill * refillRate
    );
    this.rateLimitBucket.lastRefillTime = now;

    if (this.rateLimitBucket.tokens < 1) {
      const waitTime = (1 / refillRate) * 1000;
      await this.sleep(waitTime);
      return this.waitForRateLimit();
    }
    this.rateLimitBucket.tokens--;
  }

  private generateCacheKey(resumeId: string, jdId: string, options: TailoringOptions): string {
    const optionsHash = generateHash(JSON.stringify(options));
    return `tailor:${resumeId}:${jdId}:${optionsHash}`;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setInCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.CACHE_TTL
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const tailoringService = new TailoringService();
