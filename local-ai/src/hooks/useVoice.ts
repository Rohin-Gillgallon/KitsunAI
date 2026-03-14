import { useState, useRef, useEffect } from 'react';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

export function useVoice(speaking: boolean, onSpeechResult?: (transcript: string) => void) {
    const [recording, setRecording] = useState(false);
    const volume = useSharedValue(0);
    const lastResult = useRef('');

    useSpeechRecognitionEvent('result', (event) => {
        if (event.results[0]?.transcript) {
            lastResult.current = event.results[0].transcript;
            onSpeechResult?.(lastResult.current);
        }
    });

    useSpeechRecognitionEvent('volumechange', (event) => {
        // Only use real volume when listening
        if (recording) {
            volume.value = withSpring(event.value, { damping: 20 });
        }
    });

    useSpeechRecognitionEvent('end', () => {
        setRecording(false);
        if (!speaking) volume.value = withSpring(0);
    });

    useSpeechRecognitionEvent('error', () => {
        setRecording(false);
        if (!speaking) volume.value = withSpring(0);
    });

    // Simulated volume for when the AI is speaking
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (speaking && !recording) {
            interval = setInterval(() => {
                // Generate a random-ish volume pulse between 0.3 and 0.8
                volume.value = withSpring(0.3 + Math.random() * 0.5, { damping: 10, stiffness: 100 });
            }, 150);
        } else if (!speaking && !recording) {
            volume.value = withSpring(0);
        }
        return () => clearInterval(interval);
    }, [speaking, recording]);

    async function toggleRecording() {
        if (recording) {
            ExpoSpeechRecognitionModule.stop();
            setRecording(false);
        } else {
            const granted = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
            if (!granted.granted) return;
            
            lastResult.current = '';
            setRecording(true);
            ExpoSpeechRecognitionModule.start({
                lang: 'en-US',
                interimResults: true,
                continuous: false,
            });
        }
    }

    return {
        recording,
        volume,
        toggleRecording,
        lastResult: lastResult.current
    };
}
