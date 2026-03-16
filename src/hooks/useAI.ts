import { useState, useRef, useEffect, useCallback } from 'react';
import * as Speech from 'expo-speech';
import uuid from 'react-native-uuid';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { runMigrations } from '../db/migrate';
import { messages, conversations } from '../db/schema';
import { Settings } from '../store/settings';
import { generateReply } from '../model/inference';
import { getModel } from '../model/llm';

export type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
};

export function useAI(shouldLoadModel: boolean = true) {
    const [msgs, setMsgs] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [speaking, setSpeaking] = useState(false);
    const [dbReady, setDbReady] = useState(false);
    const [modelReady, setModelReady] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const conversationId = useRef<string>('');
    const speechQueueCount = useRef(0);
    const streamingRef = useRef('');
    const streamingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const initDb = useCallback(async () => {
        try {
            await runMigrations();
            const existingId = Settings.getCurrentConversationId();
            if (existingId) {
                conversationId.current = existingId;
                const rows = await db
                    .select()
                    .from(messages)
                    .where(eq(messages.conversationId, existingId));
                const loaded: Message[] = rows.map(r => ({
                    id: r.id,
                    role: r.role as 'user' | 'assistant',
                    content: r.content,
                }));
                setMsgs(loaded);
            } else {
                await createNewConversation();
            }
        } catch (e) {
            console.error('Init error:', e);
            await createNewConversation();
        } finally {
            setDbReady(true);
        }
    }, []);

    const initModel = useCallback(async () => {
        if (!shouldLoadModel) return;
        try {
            await getModel();
            setModelReady(true);
        } catch (e) {
            console.error('Model load error:', e);
            setErrorMsg('Failed to load model. Please re-download it in Settings.');
            setModelReady(true);
        }
    }, [shouldLoadModel]);

    useEffect(() => {
        initDb();
    }, [initDb]);

    useEffect(() => {
        initModel();
    }, [initModel]);

    const createNewConversation = async () => {
        Speech.stop();
        setSpeaking(false);
        const newId = uuid.v4() as string;
        conversationId.current = newId;
        Settings.setCurrentConversationId(newId);
        await db.insert(conversations).values({
            id: newId,
            title: 'New conversation',
            createdAt: new Date(),
        });
        setMsgs([]);
        setStreamingText('');
        setErrorMsg(null);
    };

    const loadConversation = async (id: string) => {
        if (!id) {
            await createNewConversation();
            return;
        }
        Speech.stop();
        setSpeaking(false);
        conversationId.current = id;
        Settings.setCurrentConversationId(id);
        const rows = await db
            .select()
            .from(messages)
            .where(eq(messages.conversationId, id));
        const loaded: Message[] = rows.map(r => ({
            id: r.id,
            role: r.role as 'user' | 'assistant',
            content: r.content,
        }));
        setMsgs(loaded);
        setStreamingText('');
    };

    const speakSentence = (text: string) => {
        const clean = text.trim();
        if (!clean) return;
        speechQueueCount.current++;
        Speech.speak(clean, {
            voice: Settings.getSelectedVoice(),
            language: 'en-US',
            rate: Settings.getVoiceSpeed(),
            pitch: 1.0,
            onStart: () => setSpeaking(true),
            onDone: () => {
                speechQueueCount.current--;
                if (speechQueueCount.current <= 0) setSpeaking(false);
            },
            onError: () => {
                speechQueueCount.current--;
                if (speechQueueCount.current <= 0) setSpeaking(false);
            },
        });
    };

    const send = async (text: string) => {
        const cleanText = text.replace(/[\n\r]/g, ' ').trim();
        if (!cleanText || loading) return;

        const userMessage: Message = {
            id: uuid.v4() as string,
            role: 'user',
            content: cleanText,
        };

        setErrorMsg(null);
        setLoading(true);
        Speech.stop();
        setSpeaking(false);

        await db.insert(messages).values({
            ...userMessage,
            conversationId: conversationId.current,
            createdAt: new Date(),
        });

        const newMsgs = [...msgs, userMessage];
        setMsgs(newMsgs);

        // Reset streaming
        streamingRef.current = '';
        setStreamingText('');

        // Update display at 5fps max to prevent strobe
        streamingIntervalRef.current = setInterval(() => {
            setStreamingText(streamingRef.current);
        }, 200);

        let sentenceBuffer = '';

        try {
            const fullReply = await generateReply(
                newMsgs,
                Settings.getSystemPrompt(),
                (token) => {
                    streamingRef.current += token;
                    sentenceBuffer += token;
                    const match = sentenceBuffer.match(/[.!?](\s+|$)|(\n+)/);
                    if (match) {
                        const index = match.index! + match[0].length;
                        const sentence = sentenceBuffer.substring(0, index);
                        sentenceBuffer = sentenceBuffer.substring(index);
                        speakSentence(sentence);
                    }
                }
            );

            if (streamingIntervalRef.current) {
                clearInterval(streamingIntervalRef.current);
                streamingIntervalRef.current = null;
            }

            const assistantMessage: Message = {
                id: uuid.v4() as string,
                role: 'assistant',
                content: fullReply,
            };

            await db.insert(messages).values({
                ...assistantMessage,
                conversationId: conversationId.current,
                createdAt: new Date(),
            });

            setMsgs(prev => [...prev, assistantMessage]);
            setStreamingText('');

            if (sentenceBuffer.trim()) {
                speakSentence(sentenceBuffer);
            }

        } catch (e) {
            if (streamingIntervalRef.current) {
                clearInterval(streamingIntervalRef.current);
                streamingIntervalRef.current = null;
            }
            console.error('Send error:', e);
            setErrorMsg('System override error. Connection failed.');
        } finally {
            setLoading(false);
        }
    };

    return {
        msgs,
        loading,
        streamingText,
        speaking,
        dbReady,
        modelReady,
        errorMsg,
        send,
        createNewConversation,
        loadConversation,
        conversationId: conversationId.current,
        stopSpeech: () => {
            Speech.stop();
            setSpeaking(false);
        }
    };
}

/*---

**ONNX voices (future)**

The most practical on-device neural TTS options via ONNX Runtime:

**Kokoro** (~82MB) — highest quality open source TTS model, multiple voice styles, runs at realtime on mobile. Uses ONNX Runtime Mobile. Voices include: American female, American male, British female, British male. Would need `onnxruntime-react-native` package and a custom inference wrapper that takes text → audio buffer → plays via `expo-av`.

**Piper TTS** (~60MB per voice) — used by Home Assistant, very fast, designed for edge devices. ONNX format. Many community voices available. Same integration path as Kokoro.

**Integration path when you're ready:**
```
pnpm add onnxruntime-react-native
pnpm add expo-av*/