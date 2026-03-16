import { initLlama } from 'llama.rn';
import * as FileSystem from 'expo-file-system/legacy';
import { MODELS } from './models';
import { Settings } from '../store/settings';

export type LlamaContext = Awaited<ReturnType<typeof initLlama>>;

let context: LlamaContext | null = null;
let loadedModelId: string | null = null;
let initPromise: Promise<LlamaContext> | null = null;

export function getModelPath(modelId: string): string {
  const model = MODELS.find(m => m.id === modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);
  return `${FileSystem.documentDirectory}${model.filename}`;
}

// Legacy path for DownloadScreen compatibility
export const MODEL_PATH = `${FileSystem.documentDirectory}phi3-mini-q4.gguf`;

export async function getModel(): Promise<LlamaContext> {
  const modelId = Settings.getSelectedModelId();

  // If same model already loaded, return it
  if (context && loadedModelId === modelId) return context;

  // Different model or stale promise — reset everything
  if (context || initPromise) {
    await releaseModel();
  }

  initPromise = (async () => {
    let path = getModelPath(modelId);
    let info = await FileSystem.getInfoAsync(path);

    if (!info.exists) {
      // Fall back to legacy Phi-3
      const legacyInfo = await FileSystem.getInfoAsync(MODEL_PATH);
      if (legacyInfo.exists) {
        path = MODEL_PATH;
      } else {
        throw new Error(`No model file found for ${modelId}. Please download it in Settings.`);
      }
    }

    const threads = Settings.getThreadCount();
    const nCtx = Settings.getContextSize();
    const nBatch = Settings.getBatchSize();

    context = await initLlama({
      model: path,
      use_mlock: false,
      n_ctx: nCtx,
      n_threads: threads,
      n_batch: nBatch,
      n_gpu_layers: 0,
    });
    loadedModelId = modelId;
    console.log(`Model loaded: ${modelId}`);
    await warmupModel(context);
    return context;
  })();

  return initPromise;
}

async function warmupModel(ctx: LlamaContext) {
  try {
    await ctx.completion({ prompt: 'Hello', n_predict: 1 });
  } catch (e) {
    console.warn('Warm-up failed:', e);
  }
}

export async function releaseModel(): Promise<void> {
  await context?.release();
  context = null;
  initPromise = null;
  loadedModelId = null;
}