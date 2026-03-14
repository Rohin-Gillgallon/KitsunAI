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

export function useAI(initialText?: string) {
    const [msgs, setMsgs] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [speaking, setSpeaking] = useState(false);
    const [dbReady, setDbReady] = useState(false);
    const [modelReady, setModelReady] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const conversationId = useRef<string>('');
    const speechQueueCount = useRef(0);

    const init = useCallback(async () => {
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

        try {
            await getModel();
        } catch (e) {
            console.error('Model load error:', e);
        } finally {
            setModelReady(true);
        }
    }, []);

    useEffect(() => {
        init();
    }, [init]);

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

        await db.insert(messages).values({
            ...userMessage,
            conversationId: conversationId.current,
            createdAt: new Date(),
        });

        const newMsgs = [...msgs, userMessage];
        setMsgs(newMsgs);
        setLoading(true);
        setStreamingText('');
        Speech.stop();
        setSpeaking(false);

        let sentenceBuffer = '';

        try {
            const fullReply = await generateReply(
                newMsgs,
                Settings.getSystemPrompt(),
                (token) => {
                    setStreamingText(prev => prev + token);
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
