import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, ActivityIndicator, Dimensions,
    KeyboardAvoidingView, Platform, Animated,
    ScrollView
} from 'react-native';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '../store/settings';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { ConversationDrawer } from './ConversationDrawer';
import { BootingScreen } from '../components/BootingScreen';
import { useAI } from '../hooks/useAI';
import { useVoice } from '../hooks/useVoice';
import { INTERFACES } from './SpeechMode';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Helper to prevent Android text clipping that scales with message length
const getSafetyBuffer = (content: string, isUser: boolean) => {
    if (isUser) return '  ';
    // Add 1 extra newline for every ~250 characters to cover cumulative measurement errors
    const extraLines = Math.max(1, Math.floor(content.length / 500) + 1);
    return '\n'.repeat(extraLines) + ' ';
};

const MONO = Platform.OS === 'android' ? 'monospace' : 'Courier';

// 1. Theme-aware MessageBubble
const MessageBubble = ({ item, accent }: { item: Message; accent: string }) => {
    const isUser = item.role === 'user';

    return (
        <View style={{
            flexDirection: 'row',
            width: '100%',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            paddingHorizontal: 16,
            marginBottom: 12,
        }}>
            <View style={[
                styles.bubbleWrapper,
                isUser ? { backgroundColor: '#111', borderColor: accent + '44', borderWidth: 1 } : { backgroundColor: 'transparent' }
            ]}>
                {!isUser && <Text style={[styles.roleLabel, { color: accent }]}>KITSUNAI_OS v1.0</Text>}
                <Text
                    style={[
                        styles.bubbleText,
                        !isUser && { fontFamily: MONO, fontSize: 13, color: '#DDD' }
                    ]}
                    textBreakStrategy="simple"
                >
                    {item.content}{getSafetyBuffer(item.content, isUser)}
                </Text>
            </View>
        </View>
    );
};

export type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
};

export function ChatScreen({ onClose, ai }: { onClose?: () => void, ai: ReturnType<typeof useAI> }) {
    const [input, setInput] = useState('');
    const [drawerOpen, setDrawerOpen] = useState(false);

    const msgs = ai.msgs;
    const loading = ai.loading;
    const streamingText = ai.streamingText;
    const speaking = ai.speaking;
    const dbReady = ai.dbReady;
    const modelReady = ai.modelReady;
    const errorMsg = ai.errorMsg;

    const themeIdx = useTheme();
    const activeAccent = (INTERFACES[themeIdx] || INTERFACES[0]).accent || '#FFFFFF';

    const scrollRef = useRef<ScrollView>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    
    // Wire up voice hook
    const voice = useVoice(ai.speaking, (transcript) => {
        setInput(transcript);
    });
    const { recording, volume, toggleRecording } = voice;

    // Cleanup Effect
    useEffect(() => {
        return () => {
            ai.stopSpeech();
            ExpoSpeechRecognitionModule.stop();
            pulseAnim.stopAnimation();
        };
    }, []);

    const createNewConversation = async () => {
        await ai.createNewConversation();
        setInput('');
    };

    const loadConversation = async (id: string) => {
        await ai.loadConversation(id);
        setInput('');
    };

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
        }
    });

    // Removed stray volumechange listener, handled by useVoice.ts

    useSpeechRecognitionEvent('end', () => {
        stopPulse();
        if (input.trim()) {
            send();
        }
    });

    useSpeechRecognitionEvent('error', (event) => {
        if (event.error === 'no-speech') {
            stopPulse();
            return;
        }
        stopPulse();
    });

    async function handleMicPress() {
        if (!recording) {
            ai.stopSpeech();
            startPulse();
        } else {
            stopPulse();
            if (input.trim()) {
                send();
            }
        }
        await toggleRecording();
    }

    async function send() {
        const text = input;
        if (!text.trim() || loading) return;
        
        setInput('');
        await ai.send(text);
        
        setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }

    if (!dbReady || !modelReady) {
        return <BootingScreen accent={activeAccent} />;
    }

    return (
        <KeyboardAvoidingView
            style={styles.keyboardContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
        >
            <View style={[styles.header, { borderBottomColor: activeAccent + '22' }]}>
                {onClose && (
                    <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                        <Text style={{ color: activeAccent, fontSize: 18, fontFamily: MONO }}>✕</Text>
                    </TouchableOpacity>
                )}
                <Text style={[styles.headerTitle, { color: activeAccent, fontFamily: MONO }]}>TRANSCRIPT</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        onPress={createNewConversation}
                        disabled={loading}
                        style={[styles.newChatButton, { borderColor: activeAccent + '44', borderWidth: 1 }]}
                    >
                        <Text style={[styles.newChatText, { color: activeAccent, fontFamily: MONO }]}>NEW_SESSION</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setDrawerOpen(true)}
                        style={[styles.newChatButton, { borderColor: activeAccent + '44', borderWidth: 1 }]}
                    >
                        <Text style={[styles.newChatText, { color: activeAccent, fontFamily: MONO }]}>☰</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {msgs.length === 0 && !loading && !streamingText ? (
                <View style={styles.emptyState}>
                    <Text style={[styles.emptyTitle, { color: activeAccent, fontFamily: MONO }]}>KITSUNAI</Text>
                    <Text style={[styles.emptySubtitle, { fontFamily: MONO }]}>
                        [LOCATION: LOCAL_DEVICE]
                    </Text>
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
                        <MessageBubble key={m.id} item={m} accent={activeAccent} />
                    ))}

                    {streamingText && (
                        <View style={{ flexDirection: 'row', width: '100%', paddingHorizontal: 16, marginBottom: 12 }}>
                            <View style={styles.bubbleWrapper}>
                                <Text style={[styles.roleLabel, { color: activeAccent }]}>KITSUNAI_OS [STREAMING]</Text>
                                <Text style={[styles.bubbleText, { fontFamily: MONO, fontSize: 13, color: '#DDD' }]}>
                                    {streamingText}{getSafetyBuffer(streamingText, false)}
                                </Text>
                            </View>
                        </View>
                    )}

                    {loading && !streamingText && (
                        <View style={styles.loadingFooter}>
                            <ActivityIndicator size="small" color={activeAccent} />
                        </View>
                    )}
                </ScrollView>
            )}

            {errorMsg && (
                <View style={[styles.errorBanner, { borderColor: '#ff444455' }]}>
                    <Text style={[styles.errorBannerText, { fontFamily: MONO }]}>{errorMsg}</Text>
                    <TouchableOpacity onPress={() => ai.send('retry')}>
                        <Text style={styles.errorBannerClose}>✕</Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={[styles.inputRow, { borderTopColor: activeAccent + '22' }]}>
                <TextInput
                    style={[styles.input, { borderColor: activeAccent + '44', borderWidth: 1, fontFamily: MONO }]}
                    value={input}
                    onChangeText={(text) => {
                        setInput(text);
                    }}
                    placeholder={recording ? 'LISTENING...' : 'Type here...'}
                    placeholderTextColor={recording ? '#ff4444' : '#444'}
                    multiline
                    editable={!loading && !recording}
                    blurOnSubmit={false}
                    returnKeyType="default"
                />

                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    {speaking ? (
                        <TouchableOpacity
                            style={[styles.stopButton, { backgroundColor: activeAccent }]}
                            onPress={() => ai.stopSpeech()}
                        >
                            <View style={styles.stopIcon} />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.micButton, recording && styles.micButtonActive, { borderColor: activeAccent + '44', borderWidth: 1 }]}
                            onPress={handleMicPress}
                            disabled={loading}
                        >
                            <Text style={[styles.micIcon, { color: activeAccent }]}>{recording ? '⏹' : '🎤'}</Text>
                        </TouchableOpacity>
                    )}
                </Animated.View>

                <TouchableOpacity
                    style={[styles.sendButton, { backgroundColor: activeAccent }, (!input.trim() || loading) && styles.sendDisabled]}
                    onPress={send}
                    disabled={!input.trim() || loading}
                >
                    <Text style={[styles.sendText, { color: '#000' }]}>↑</Text>
                </TouchableOpacity>
            </View>

            <ConversationDrawer
                visible={drawerOpen}
                currentId={ai.conversationId}
                onSelect={loadConversation}
                onClose={() => setDrawerOpen(false)}
            />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    keyboardContainer: {
        flex: 1,
        backgroundColor: '#000',
        width: SCREEN_WIDTH,
    },
    centre: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#666',
        marginTop: 16,
        fontSize: 10,
        letterSpacing: 4,
        textAlign: 'center',
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerBtn: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 14,
        letterSpacing: 6,
        fontWeight: '200',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    newChatButton: {
        backgroundColor: '#111',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    newChatText: {
        fontSize: 10,
        letterSpacing: 1,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 32,
        letterSpacing: 16,
        fontWeight: '200',
        marginBottom: 20,
        opacity: 0.8,
    },
    emptySubtitle: {
        color: '#444',
        fontSize: 10,
        textAlign: 'center',
        lineHeight: 20,
        letterSpacing: 2,
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingVertical: 20,
    },
    bubbleWrapper: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
        maxWidth: '85%',
    },
    roleLabel: {
        fontSize: 8,
        letterSpacing: 2,
        marginBottom: 4,
        fontWeight: 'bold',
        opacity: 0.9,
    },
    bubbleText: {
        color: '#fff',
        fontSize: 15,
        lineHeight: 22,
    },
    loadingFooter: {
        padding: 20,
    },
    errorBanner: {
        backgroundColor: '#ff444410',
        padding: 12,
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
    },
    errorBannerText: {
        color: '#ff4444',
        fontSize: 12,
        flex: 1,
    },
    errorBannerClose: {
        color: '#ff4444',
        fontSize: 16,
        paddingLeft: 12,
    },
    inputRow: {
        width: SCREEN_WIDTH,
        flexDirection: 'row',
        padding: 16,
        gap: 12,
        borderTopWidth: 1,
        alignItems: 'flex-end',
        backgroundColor: '#000',
    },
    input: {
        flex: 1,
        backgroundColor: '#0A0A0A',
        color: '#FFF',
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        maxHeight: 120,
    },
    micButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#0A0A0A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    micButtonActive: {
        backgroundColor: '#ff444433',
        borderColor: '#ff4444',
    },
    stopButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stopIcon: {
        width: 14,
        height: 14,
        backgroundColor: '#000',
        borderRadius: 2,
    },
    sendButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendDisabled: {
        backgroundColor: '#222',
        opacity: 0.5,
    },
    sendText: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    micIcon: {
        fontSize: 18,
    },
});