import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View, Modal } from 'react-native';
import { runMigrations } from './src/db/migrate';
import { Settings } from './src/store/settings';

import { ChatScreen } from './src/screens/ChatScreen';
import { DownloadScreen } from './src/screens/DownloadScreen';
import { ModelSelectionScreen } from './src/screens/ModelSelectionScreen';
import { SpeechMode } from './src/screens/SpeechMode';
import { SettingsModal } from './src/screens/SettingsModal';
import { BootingScreen } from './src/components/BootingScreen';
import { useTheme } from './src/store/settings';
import { useAI } from './src/hooks/useAI';
import { useVoice } from './src/hooks/useVoice';
import { INTERFACES } from './src/screens/SpeechMode';

const queryClient = new QueryClient();

export default function App() {
  const [ready, setReady] = useState(false);
  const [needsModelSelect, setNeedsModelSelect] = useState(false);
  const [needsDownload, setNeedsDownload] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showSpeech, setShowSpeech] = useState(false);

  const ai = useAI(ready);
  const voice = useVoice(ai.speaking, (transcript) => { });
  const themeIdx = useTheme();
  const activeAccent = (INTERFACES[themeIdx] || INTERFACES[0]).accent || '#FFFFFF';

  useEffect(() => {
    async function init() {
      await runMigrations();
      const hasAnyModel =
        Settings.getDownloadedModelIds().length > 0 || Settings.isModelDownloaded();
      if (!hasAnyModel) {
        setNeedsModelSelect(true);
      } else {
        setReady(true);
      }
    }
    init();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <View style={{ flex: 1 }}>
        {needsModelSelect ? (
          <ModelSelectionScreen
            onComplete={(modelId) => {
              Settings.setSelectedModelId(modelId);
              setNeedsModelSelect(false);
              setNeedsDownload(true);
            }}
          />
        ) : needsDownload ? (
          <DownloadScreen
            onComplete={() => {
              setNeedsDownload(false);
              setReady(true);
            }}
          />
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

        <Modal
          visible={showSpeech}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowSpeech(false)}
        >
          <ChatScreen
            onClose={() => setShowSpeech(false)}
            ai={ai}
          />
        </Modal>

        <SettingsModal
          visible={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </View>
    </QueryClientProvider>
  );
}