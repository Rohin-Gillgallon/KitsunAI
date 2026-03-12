import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV();

export const Settings = {
  getSystemPrompt: () =>
    storage.getString('systemPrompt') ??
    'You are a helpful assistant. Keep your responses concise and complete — always finish your sentences and never trail off mid-thought. Aim for responses under 200 words unless the user explicitly asks for more detail.',
  setSystemPrompt: (v: string) => storage.set('systemPrompt', v),

  getThreadCount: () => storage.getNumber('threads') ?? 4,
  setThreadCount: (v: number) => storage.set('threads', v),

  getVoiceSpeed: () => storage.getNumber('voiceSpeed') ?? 1.0,
  setVoiceSpeed: (v: number) => storage.set('voiceSpeed', v),

  isModelDownloaded: () => storage.getBoolean('modelReady') ?? false,
  setModelDownloaded: (v: boolean) => storage.set('modelReady', v),

  getCurrentConversationId: () => storage.getString('currentConversationId') ?? null,
  setCurrentConversationId: (id: string) => storage.set('currentConversationId', id),
};