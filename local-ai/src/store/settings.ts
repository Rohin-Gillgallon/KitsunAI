import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV();

export const Settings = {
  getSystemPrompt: () =>
    storage.getString('systemPrompt') ?? 'You are a helpful assistant.',
  setSystemPrompt: (v: string) => storage.set('systemPrompt', v),

  getThreadCount: () => storage.getNumber('threads') ?? 4,
  setThreadCount: (v: number) => storage.set('threads', v),

  isModelDownloaded: () => storage.getBoolean('modelReady') ?? false,
  setModelDownloaded: (v: boolean) => storage.set('modelReady', v),
};
