import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { runMigrations } from './src/db/migrate';
import { Settings } from './src/store/settings';
import { ChatScreen } from './src/screens/ChatScreen';
import { DownloadScreen } from './src/screens/DownloadScreen';
import { View } from 'react-native';

const queryClient = new QueryClient();

export default function App() {
  const [ready, setReady] = useState(false);
  const [needsDownload, setNeedsDownload] = useState(false);

  useEffect(() => {
    async function init() {
      //Settings.setModelDownloaded(false); // temporary - remove after download
      await runMigrations();
      if (!Settings.isModelDownloaded()) {
        setNeedsDownload(true);
      } else {
        setReady(true);
      }
    }
    init();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <View style={{ flex: 1 }}>
        {needsDownload ? (
          <DownloadScreen onComplete={() => {
            setNeedsDownload(false);
            setReady(true);
          }} />
        ) : ready ? (
          <ChatScreen />
        ) : null}
      </View>
    </QueryClientProvider>
  );
}