import { initLlama } from 'llama.rn';
import { ensureModelDownloaded, MODEL_PATH } from './download';

export type LlamaContext = Awaited<ReturnType<typeof initLlama>>;

let context: LlamaContext | null = null;
let initPromise: Promise<LlamaContext> | null = null;

/**
 * Returns the shared LLM context, initializing and downloading the model if needed.
 * Safe to call from multiple places; concurrent callers share the same init.
 */
export async function getModel(
  onDownloadProgress?: (pct: number) => void,
): Promise<LlamaContext> {
  if (context) return context;

  if (!initPromise) {
    initPromise = (async () => {
      await ensureModelDownloaded(onDownloadProgress);
      context = await initLlama({
        model: MODEL_PATH!,
        use_mlock: false,
        n_ctx: 2048,
        n_threads: 4,
        n_batch: 512,
        n_gpu_layers: 0,
      });
      console.log('Model initialized, warming up...');
      await warmupModel(context);
      console.log('Model warm-up complete.');
      return context;
    })();
  }

  return initPromise;
}

/**
 * Performs a small inference to 'warm up' the model.
 */
async function warmupModel(ctx: LlamaContext) {
  try {
    await ctx.completion({
      prompt: 'Hello',
      n_predict: 1,
    });
  } catch (e) {
    console.warn('Warm-up failed:', e);
  }
}

/**
 * Releases the model and clears the shared context so it can be re-initialized later.
 */
export async function releaseModel(): Promise<void> {
  await context?.release();
  context = null;
  initPromise = null;
}
