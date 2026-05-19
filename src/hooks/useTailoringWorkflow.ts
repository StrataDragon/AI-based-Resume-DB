import { useState, useCallback } from 'react';
import { tailoringService } from '@/services/tailoringService';
import { TailoringOptions, TailoredResumeResult, TailoringStatus } from '@/types/tailoring';

interface UseTailoringWorkflowState {
  stage: 'idle' | 'form' | 'processing' | 'preview' | 'complete' | 'error';
  progress: number;
  result: TailoredResumeResult | null;
  error: Error | null;
  estimatedTimeRemaining: number | null;
  processingStatus: TailoringStatus | null;
}

export function useTailoringWorkflow() {
  const [state, setState] = useState<UseTailoringWorkflowState>({
    stage: 'idle',
    progress: 0,
    result: null,
    error: null,
    estimatedTimeRemaining: null,
    processingStatus: null
  });

  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const startTailoring = useCallback(
    async (
      resumeId: string,
      jdId: string,
      options: TailoringOptions = {}
    ) => {
      setState(prev => ({ ...prev, stage: 'form', error: null }));
      const controller = new AbortController();
      setAbortController(controller);

      try {
        setState(prev => ({ ...prev, stage: 'processing', progress: 10 }));
        const result = await tailoringService.tailorResume(resumeId, jdId, options);

        if (result.tailorId) {
          await pollTailoringProgress(result.tailorId);
        }

        setState(prev => ({
          ...prev,
          stage: 'preview',
          progress: 100,
          result,
          error: null,
          estimatedTimeRemaining: null
        }));
      } catch (error) {
        if (!controller.signal.aborted) {
          setState(prev => ({
            ...prev,
            stage: 'error',
            error: error instanceof Error ? error : new Error(String(error))
          }));
        }
      } finally {
        setAbortController(null);
      }
    },
    []
  );

  const pollTailoringProgress = useCallback(
    async (tailorId: string) => {
      try {
        const status = await tailoringService.pollTailoringStatus(tailorId, {
          interval: 1500,
          maxAttempts: 80
        });

        const stageProgress: Record<string, number> = {
          'analyzing': 20,
          'tailoring': 50,
          'generating_docx': 75,
          'finalizing': 90
        };

        const progress = stageProgress[status.stage] || 10;

        setState(prev => ({
          ...prev,
          progress: Math.max(prev.progress, progress),
          processingStatus: status,
          estimatedTimeRemaining: status.estimatedTimeRemaining ?? null
        }));
      } catch (error) {
        console.error('Polling error:', error);
      }
    },
    []
  );

  const cancelTailoring = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setState(prev => ({
        ...prev,
        stage: 'idle',
        progress: 0,
        result: null,
        error: new Error('Tailoring cancelled by user')
      }));
    }
  }, [abortController]);

  const downloadResume = useCallback(async () => {
    if (!state.result?.docxUrl) {
      throw new Error('No tailored resume available');
    }
    
    // Fallback since it's an external URL mostly, but try blob if possible
    window.open(state.result.docxUrl, '_blank');
  }, [state.result]);

  const reset = useCallback(() => {
    setState({
      stage: 'idle',
      progress: 0,
      result: null,
      error: null,
      estimatedTimeRemaining: null,
      processingStatus: null
    });
  }, []);

  return {
    ...state,
    startTailoring,
    cancelTailoring,
    downloadResume,
    reset
  };
}
