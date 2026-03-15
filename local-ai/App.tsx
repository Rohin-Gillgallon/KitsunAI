import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { runMigrations } from './src/db/migrate';
import { Settings } from './src/store/settings';
import { View } from 'react-native';

// 1. IMPORT FIX: Use curly braces because ChatScreen is a named export
import { ChatScreen } from './src/screens/ChatScreen';
import { DownloadScreen } from './src/screens/DownloadScreen';
import { SpeechMode } from './src/screens/SpeechMode';
import { SettingsModal } from './src/screens/SettingsModal';
import { getModel } from './src/model/llm';
import { BootingScreen } from './src/components/BootingScreen';
import { useTheme } from './src/store/settings';
import { useAI } from './src/hooks/useAI';
import { useVoice } from './src/hooks/useVoice';

const queryClient = new QueryClient();

import { INTERFACES } from './src/screens/SpeechMode';

export default function App() {
  const [ready, setReady] = useState(false);
  const [needsDownload, setNeedsDownload] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showSpeech, setShowSpeech] = useState(false);

  const ai = useAI(ready);
  const voice = useVoice(ai.speaking, (transcript) => {
    // Optional: handle interim results if needed in App level
  });
  const themeIdx = useTheme();

  const activeAccent = (INTERFACES[themeIdx] || INTERFACES[0]).accent || '#FFFFFF';

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
          !ai.modelReady ? (
            <BootingScreen accent={activeAccent} />
          ) : (
            <SpeechMode
              visible={true} 
              isHome={true}
              onOpenTranscript={() => setShowSpeech(true)} 
              onOpenSettings={() => setSettingsOpen(true)}
              onSend={(text) => ai.send(text)}
              speaking={ai.speaking}
              listening={voice.recording}
              volume={voice.volume}
              onMicPress={voice.toggleRecording}
            />
          )
        ) : null}

        {/* ChatScreen is now the 'transcript' accessible from SpeechMode */}
        {showSpeech && (
            <ChatScreen 
                onClose={() => setShowSpeech(false)} 
                ai={ai}
            />
        )}

        <SettingsModal 
            visible={settingsOpen}
            onClose={() => setSettingsOpen(false)}
        />
      </View>
    </QueryClientProvider>
  );
}