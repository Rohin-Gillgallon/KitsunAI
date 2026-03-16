import { createMMKV, useMMKVNumber } from 'react-native-mmkv';
import { DEFAULT_MODEL_ID } from '../model/models';

export const storage = createMMKV();

export const Settings = {
  getSystemPrompt: () =>
    storage.getString('systemPrompt') ??
    'You are a helpful assistant. Keep your responses concise and complete — always finish your sentences and never trail off mid-thought. Aim for responses under 200 words unless the user explicitly asks for more detail.',
  setSystemPrompt: (v: string) => storage.set('systemPrompt', v),

  getThreadCount: () => storage.getNumber('threads') ?? 4,
  setThreadCount: (v: number) => storage.set('threads', v),

  getContextSize: () => storage.getNumber('contextSize') ?? 2048,
  setContextSize: (v: number) => storage.set('contextSize', v),

  getBatchSize: () => storage.getNumber('batchSize') ?? 512,
  setBatchSize: (v: number) => storage.set('batchSize', v),

  getVoiceSpeed: () => storage.getNumber('voiceSpeed') ?? 1.0,
  setVoiceSpeed: (v: number) => storage.set('voiceSpeed', v),

  // Legacy single-model flag — kept for DownloadScreen compatibility
  isModelDownloaded: () => storage.getBoolean('modelReady') ?? false,
  setModelDownloaded: (v: boolean) => storage.set('modelReady', v),

  getCurrentConversationId: () => storage.getString('currentConversationId') ?? null,
  setCurrentConversationId: (id: string) => storage.set('currentConversationId', id),

  getSelectedVoice: () => storage.getString('selectedVoice') ?? undefined,
  setSelectedVoice: (id: string) => storage.set('selectedVoice', id),

  getThemeIndex: () => storage.getNumber('themeIndex') ?? 0,
  setThemeIndex: (v: number) => storage.set('themeIndex', v),

  // Model selection
  getSelectedModelId: (): string =>
    storage.getString('selectedModelId') ?? DEFAULT_MODEL_ID,
  setSelectedModelId: (id: string) => storage.set('selectedModelId', id),

  // Track which models have been downloaded
  getDownloadedModelIds: (): string[] => {
    try {
      return JSON.parse(storage.getString('downloadedModels') ?? '[]');
    } catch { return []; }
  },
  setModelIdDownloaded: (id: string, downloaded: boolean) => {
    const current = Settings.getDownloadedModelIds();
    const updated = downloaded
      ? [...new Set([...current, id])]
      : current.filter(m => m !== id);
    storage.set('downloadedModels', JSON.stringify(updated));
  },
  isModelIdDownloaded: (id: string): boolean =>
    Settings.getDownloadedModelIds().includes(id),
};

export function useTheme() {
  const [themeIndex] = useMMKVNumber('themeIndex', storage);
  return themeIndex ?? 0;
}