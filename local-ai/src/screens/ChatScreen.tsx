import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, ActivityIndicator, Dimensions,
    KeyboardAvoidingView, Platform, Animated,
    ScrollView
} from 'react-native';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { generateReply } from '../model/inference';
import { db } from '../db';
import { messages, conversations } from '../db/schema';
import { eq } from 'drizzle-orm';
import { Settings } from '../store/settings';
import uuid from 'react-native-uuid';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { SettingsModal } from './SettingsModal';
import { ConversationDrawer } from './ConversationDrawer';
import { getModel } from '../model/llm';
import { SpeechMode } from './SpeechMode';


const SCREEN_WIDTH = Dimensions.get('window').width;

type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
};

// Helper to prevent Android text clipping that scales with message length
const getSafetyBuffer = (content: string, isUser: boolean) => {
    if (isUser) return '  ';
    // Add 1 extra newline for every ~250 characters to cover cumulative measurement errors
    const extraLines = Math.max(2, Math.floor(content.length / 500) + 1);
    return '\n'.repeat(extraLines) + ' ';
};

// 1. Extracted and memoized MessageBubble for better FlatList performance
const MessageBubble = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';

    return (
        <View style={{
            flexDirection: 'row',
            width: '100%',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            paddingHorizontal: 12,
            marginBottom: 8,
        }}>
            <View style={{
                backgroundColor: isUser ? '#2E75B6' : '#222',
                borderRadius: 18,
                paddingHorizontal: 14,
                paddingVertical: 10,
                maxWidth: '90%',
            }}>
                <Text
                    style={styles.bubbleText}
                    textBreakStrategy="simple"
                >
                    {item.content}{getSafetyBuffer(item.content, isUser)}
                </Text>
            </View>
        </View>
    );
};

export function ChatScreen() {
    const [msgs, setMsgs] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [recording, setRecording] = useState(false);
    const [speaking, setSpeaking] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [dbReady, setDbReady] = useState(false);
    const [modelReady, setModelReady] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [speechModeOpen, setSpeechModeOpen] = useState(false);

    const conversationId = useRef<string>('');
    const scrollRef = useRef<ScrollView>(null);
    const inputRef = useRef('');
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const volume = useSharedValue(0);

    // Initialization Effect
    useEffect(() => {
        async function init() {
            try {
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
        }
        init();
    }, []);

    // 2. Added Unmount Cleanup Effect
    useEffect(() => {
        return () => {
            Speech.stop();
            ExpoSpeechRecognitionModule.stop();
            pulseAnim.stopAnimation();
        };
    }, []);

    async function createNewConversation() {
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
        setInput('');
        inputRef.current = '';
        setStreamingText('');
        setErrorMsg(null);
    }

    async function loadConversation(id: string) {
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
        setInput('');
        inputRef.current = '';
    }

    function startPulse() {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            ])
        ).start();
    }

    function stopPulse() {
        pulseAnim.stopAnimation();
        pulseAnim.setValue(1);
    }

    useSpeechRecognitionEvent('result', (event) => {
        if (event.results[0]?.transcript) {
            const transcript = event.results[0].transcript;
            setInput(transcript);
            inputRef.current = transcript;
        }
    });

    useSpeechRecognitionEvent('volumechange', (event) => {
        // This translates the mic input into the 'volume' shared value
        // damping: 20 keeps the movement snappy but smooth
        volume.value = withSpring(event.value, { damping: 20 });
    });

    useSpeechRecognitionEvent('end', () => {
        setRecording(false);
        stopPulse();
        volume.value = withSpring(0); // This ensures the dog/HUD stops moving when you're done
        if (inputRef.current.trim()) {
            send();
        }
    });

    useSpeechRecognitionEvent('error', (event) => {
        if (event.error === 'no-speech') {
            setRecording(false);
            stopPulse();
            volume.value = withSpring(0); // Reset volume on error too
            return;
        }
        console.error('Speech recognition error:', event.error);
        setRecording(false);
        stopPulse();
        volume.value = withSpring(0);
    });

    async function toggleRecording() {
        if (recording) {
            ExpoSpeechRecognitionModule.stop();
            setRecording(false);
            stopPulse();
        } else {
            Speech.stop();
            setSpeaking(false);
            const granted = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
            if (!granted.granted) {
                console.error('Microphone permission denied');
                return;
            }
            setInput('');
            inputRef.current = '';
            setRecording(true);
            startPulse();
            ExpoSpeechRecognitionModule.start({
                lang: 'en-US',
                interimResults: true,
                continuous: false,
            });
        }
    }

    async function send() {
        const text = inputRef.current.replace(/[\n\r]/g, ' ').trim();
        if (!text || loading) return;

        const userMessage: Message = {
            id: uuid.v4() as string,
            role: 'user',
            content: text,
        };

        setInput('');
        inputRef.current = '';
        setErrorMsg(null); // Clear any previous errors

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

        const speechQueueCount = { current: 0 };
        let sentenceBuffer = '';

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
                    if (speechQueueCount.current <= 0) {
                        setSpeaking(false);
                    }
                },
                onError: () => {
                    speechQueueCount.current--;
                    if (speechQueueCount.current <= 0) {
                        setSpeaking(false);
                    }
                },
            });
        };

        try {
            const fullReply = await generateReply(
                newMsgs,
                Settings.getSystemPrompt(),
                (token) => {
                    setStreamingText(prev => prev + token);
                    sentenceBuffer += token;

                    // Split by sentence boundaries: . ! ? followed by space, or newlines
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

            // Speak any remaining text in the buffer
            if (sentenceBuffer.trim()) {
                speakSentence(sentenceBuffer);
            }

            setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: true });
            }, 150);

        } catch (e) {
            // 4. Using proper error state instead of ghost messages
            setErrorMsg('Connection to Local AI failed. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    if (!dbReady || !modelReady) {
        return (
            <View style={[styles.container, styles.centre]}>
                <ActivityIndicator size="large" color="#2E75B6" />
                <Text style={styles.loadingText}>
                    {!dbReady ? 'Loading...' : 'Loading model...'}
                </Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.keyboardContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
        >
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Local AI</Text>
                <View style={styles.headerActions}>
                    {recording && (
                        <Text style={styles.recordingLabel}>Listening...</Text>
                    )}

                    <TouchableOpacity
                        onPress={createNewConversation}
                        disabled={loading}
                        style={styles.newChatButton}
                    >
                        <Text style={styles.newChatText}>+ New</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setSpeechModeOpen(true)}
                        style={styles.newChatButton}
                    >
                        <Text style={styles.newChatText}>🐶</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setSettingsOpen(true)}
                        style={styles.newChatButton}
                    >
                        <Text style={styles.newChatText}>⚙️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setDrawerOpen(true)}
                        style={styles.newChatButton}
                    >
                        <Text style={styles.newChatText}>☰</Text>
                    </TouchableOpacity>

                </View>
            </View>

            {msgs.length === 0 && !loading && !streamingText ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>Local AI</Text>
                    <Text style={styles.emptySubtitle}>Running fully on your device.{'\n'}No internet required.</Text>
                </View>
            ) : (
                <ScrollView
                    ref={scrollRef}
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                >
                    {msgs.map((m) => (
                        <MessageBubble key={m.id} item={m} />
                    ))}

                    {streamingText ? (
                        <View style={{
                            flexDirection: 'row',
                            width: '100%',
                            justifyContent: 'flex-start',
                            paddingHorizontal: 12,
                            marginBottom: 8,
                        }}>
                            <View style={{
                                backgroundColor: '#222',
                                borderRadius: 18,
                                paddingHorizontal: 14,
                                paddingVertical: 10,
                                maxWidth: '90%',
                            }}>
                                <Text
                                    style={styles.bubbleText}
                                    textBreakStrategy="simple"
                                >
                                    {streamingText}{getSafetyBuffer(streamingText, false)}
                                </Text>
                            </View>
                        </View>
                    ) : loading ? (
                        <View style={styles.loadingFooter}>
                            <ActivityIndicator size="small" color="#aaa" />
                        </View>
                    ) : null}
                </ScrollView>
            )}

            {/* Error Banner */}
            {errorMsg && (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{errorMsg}</Text>
                    <TouchableOpacity onPress={() => setErrorMsg(null)}>
                        <Text style={styles.errorBannerClose}>✕</Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    value={input}
                    onChangeText={(text) => {
                        setInput(text);
                        inputRef.current = text;
                    }}
                    placeholder={recording ? 'Listening...' : 'Message...'}
                    placeholderTextColor={recording ? '#ff4444' : '#666'}
                    multiline
                    editable={!loading && !recording}
                    blurOnSubmit={false}
                    returnKeyType="default"
                />

                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    {speaking ? (
                        <TouchableOpacity
                            style={styles.stopButton}
                            onPress={() => { Speech.stop(); setSpeaking(false); }}
                        >
                            <View style={styles.stopIcon} />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.micButton, recording && styles.micButtonActive]}
                            onPress={toggleRecording}
                            disabled={loading}
                        >
                            <Text style={styles.micIcon}>{recording ? '⏹' : '🎤'}</Text>
                        </TouchableOpacity>
                    )}
                </Animated.View>

                <TouchableOpacity
                    style={[styles.sendButton, (!input.trim() || loading) && styles.sendDisabled]}
                    onPress={send}
                    disabled={!input.trim() || loading}
                >
                    <Text style={styles.sendText}>↑</Text>
                </TouchableOpacity>
            </View>

            <SettingsModal
                visible={settingsOpen}
                onClose={() => setSettingsOpen(false)}
            />

            <ConversationDrawer
                visible={drawerOpen}
                currentId={conversationId.current}
                onSelect={loadConversation}
                onClose={() => setDrawerOpen(false)}
            />

            <SpeechMode
                visible={speechModeOpen}
                listening={recording}
                speaking={speaking}
                volume={volume}
                onClose={() => setSpeechModeOpen(false)}
                onMicPress={toggleRecording}
            />

        </KeyboardAvoidingView>
    );
}

// 5. Consolidated all inline styles into the StyleSheet
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111',
    },
    keyboardContainer: {
        flex: 1,
        backgroundColor: '#111',
        width: SCREEN_WIDTH,
    },
    centre: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#666',
        marginTop: 16,
        fontSize: 16,
        width: SCREEN_WIDTH,
        textAlign: 'center',
    },
    header: {
        paddingTop: 56,
        paddingBottom: 16,
        paddingHorizontal: 20, // Restored to 20
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12, // Restored to 12
    },
    recordingLabel: {
        color: '#ff4444',
        fontSize: 14,
        fontWeight: '600',
    },
    newChatButton: {
        backgroundColor: '#222',
        paddingHorizontal: 10, // Reduced from 12
        paddingVertical: 6,
        borderRadius: 12,
    },
    newChatText: {
        color: '#fff',
        fontSize: 13, // Slightly smaller fonts for buttons
        fontWeight: '600',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    emptyTitle: {
        color: '#fff',
        fontSize: 28,
        fontWeight: 'bold',
    },
    emptySubtitle: {
        color: '#666',
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
    },
    list: {
        flex: 1,
        width: SCREEN_WIDTH,
    },
    listContent: {
        flexGrow: 1,
        paddingTop: 12,
        paddingBottom: 40,
    },
    bubbleContainer: {
        width: '100%',
        paddingHorizontal: 16,
        marginBottom: 10,
    },
    bubbleWrapper: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 18,
        maxWidth: '85%',
    },
    userBubble: {
        backgroundColor: '#2E75B6',
    },
    assistantBubble: {
        backgroundColor: '#222',
    },
    bubbleText: {
        color: '#fff',
        fontSize: 16,
        includeFontPadding: true, // Native padding helps height calculation consistency
    },
    streamingBubble: {
        marginBottom: 0, // Reset since container handles spacing
    },
    loadingFooter: {
        padding: 16,
    },
    errorBanner: {
        backgroundColor: '#ff444420',
        padding: 12,
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ff444450',
    },
    errorBannerText: {
        color: '#ff4444',
        fontSize: 14,
        flex: 1,
    },
    errorBannerClose: {
        color: '#ff4444',
        fontSize: 16,
        fontWeight: 'bold',
        paddingLeft: 12,
    },
    inputRow: {
        width: SCREEN_WIDTH,
        flexDirection: 'row',
        padding: 12,
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: '#222',
        alignItems: 'flex-end',
    },
    input: {
        flex: 1,
        backgroundColor: '#222',
        color: '#fff',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 16,
        maxHeight: 120,
    },
    micButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    micButtonActive: {
        backgroundColor: '#ff4444',
    },
    stopButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#ff4444',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stopIcon: {
        width: 14,
        height: 14,
        backgroundColor: '#fff',
        borderRadius: 2,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#2E75B6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendDisabled: {
        backgroundColor: '#333',
    },
    sendText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    micIcon: {
        fontSize: 20,
    },
});