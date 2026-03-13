import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, ActivityIndicator, Dimensions,
    KeyboardAvoidingView, Platform, Animated,
    FlatList
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

// 1. Extracted and memoized MessageBubble for better FlatList performance
const MessageBubble = React.memo(({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    const bubbleWidth = SCREEN_WIDTH * 0.75;

    return (
        <View style={[
            styles.bubbleBase,
            {
                maxWidth: bubbleWidth,
                marginLeft: isUser ? SCREEN_WIDTH - bubbleWidth - 16 : 16,
                marginRight: isUser ? 16 : 0,
                backgroundColor: isUser ? '#2E75B6' : '#222',
            }
        ]}>
            <Text
                style={[styles.bubbleText, { textAlign: isUser ? 'right' : 'left' }]}
                numberOfLines={0}
            >
                {item.content}
            </Text>
        </View>
    );
});

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
    const flatListRef = useRef<FlatList>(null);
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
        const trimmed = inputRef.current.replace(/[\n\r]/g, ' ').trim();
        if (!trimmed || loading) return;

        const userMessage: Message = {
            id: uuid.v4() as string,
            role: 'user',
            content: trimmed,
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

        try {
            const fullReply = await generateReply(
                newMsgs,
                Settings.getSystemPrompt(),
                (token) => {
                    setStreamingText(prev => prev + token);
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
            // 3. Removed redundant setTimeout scroll here. onContentSizeChange handles it.

            Speech.speak(fullReply, {
                language: 'en-US',
                rate: Settings.getVoiceSpeed(),
                pitch: 1.0,
                onStart: () => setSpeaking(true),
                onDone: () => setSpeaking(false),
                onStopped: () => setSpeaking(false),
                onError: () => setSpeaking(false),
            });

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
                    {speaking && (
                        <TouchableOpacity
                            onPress={() => { Speech.stop(); setSpeaking(false); }}
                            style={styles.newChatButton}
                        >
                            <Text style={styles.newChatText}>⏹ Stop</Text>
                        </TouchableOpacity>
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

            {msgs.length === 0 && !loading ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>Local AI</Text>
                    <Text style={styles.emptySubtitle}>Running fully on your device.{'\n'}No internet required.</Text>
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={msgs}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <MessageBubble item={item} />}
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    ListFooterComponent={
                        streamingText ? (
                            <View style={styles.streamingBubble}>
                                <Text style={styles.bubbleText} numberOfLines={0}>
                                    {streamingText}
                                </Text>
                            </View>
                        ) : loading ? (
                            <View style={styles.loadingFooter}>
                                <ActivityIndicator size="small" color="#aaa" />
                            </View>
                        ) : null
                    }
                />
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
                    <TouchableOpacity
                        style={[styles.micButton, recording && styles.micButtonActive]}
                        onPress={toggleRecording}
                        disabled={loading}
                    >
                        <Text style={styles.micIcon}>{recording ? '⏹' : '🎤'}</Text>
                    </TouchableOpacity>
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
        paddingHorizontal: 20,
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
        gap: 12,
    },
    recordingLabel: {
        color: '#ff4444',
        fontSize: 14,
        fontWeight: '600',
    },
    newChatButton: {
        backgroundColor: '#222',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    newChatText: {
        color: '#fff',
        fontSize: 14,
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
    bubbleBase: {
        marginBottom: 16,
        padding: 12,
        borderRadius: 16,
    },
    bubbleText: {
        color: '#fff',
        fontSize: 16,
        lineHeight: 22,
    },
    streamingBubble: {
        maxWidth: SCREEN_WIDTH * 0.75,
        marginLeft: 16,
        marginBottom: 8,
        backgroundColor: '#222',
        padding: 12,
        borderRadius: 16,
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