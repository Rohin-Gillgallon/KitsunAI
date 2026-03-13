import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { runMigrations } from './src/db/migrate';
import { Settings } from './src/store/settings';
import { View } from 'react-native';

// 1. IMPORT FIX: Use curly braces because ChatScreen is a named export
import { ChatScreen } from './src/screens/ChatScreen';
import { DownloadScreen } from './src/screens/DownloadScreen';
import { SpeechMode } from './src/screens/SpeechMode';

const queryClient = new QueryClient();

export default function App() {
  const [ready, setReady] = useState(false);
  const [needsDownload, setNeedsDownload] = useState(false);

  // Note: These are redundant if ChatScreen manages them internally,
  // but keeping them prevents breaking the SpeechMode render below.
  const [showSpeech, setShowSpeech] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    async function init() {
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
          /* 2. PROP FIX: Removed onOpenSpeech since your fixed ChatScreen 
             function doesn't accept props yet. */
          <ChatScreen />
        ) : null}

        {/* 3. This SpeechMode is currently a 'ghost' in App.tsx. 
           Since your fixed ChatScreen already has its own <SpeechMode /> inside its return,
           you can eventually remove this one to avoid duplicate modals.
        */}
        <SpeechMode
          visible={showSpeech}
          listening={isListening}
          speaking={isSpeaking}
          onClose={() => setShowSpeech(false)}
          onMicPress={() => setIsListening(!isListening)}
        />
      </View>
    </QueryClientProvider>
  );
}