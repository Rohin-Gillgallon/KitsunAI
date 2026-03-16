import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, ActivityIndicator, Dimensions,
    Platform, Animated, ScrollView, Keyboard
} from 'react-native';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import { useTheme } from '../store/settings';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { ConversationDrawer } from './ConversationDrawer';
import { BootingScreen } from '../components/BootingScreen';
import { useAI } from '../hooks/useAI';
import { useVoice } from '../hooks/useVoice';
import { INTERFACES } from './SpeechMode';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MONO = Platform.OS === 'android' ? 'monospace' : 'Courier';

const getSafetyBuffer = (content: string, isUser: boolean) => {
    if (isUser) return '   ';
    const extraLines = Math.max(1, Math.floor(content.length / 500) + 1);
    return '\n'.repeat(extraLines) + ' ';
};

const MessageBubble = React.memo(({ item, accent }: { item: Message; accent: string }) => {
    const isUser = item.role === 'user';
    return (
        <View style={{
            alignItems: isUser ? 'flex-end' : 'flex-start',
            paddingHorizontal: 16,
            marginBottom: 12,
        }}>
            <View style={[
                styles.bubbleWrapper,
                isUser
                    ? { backgroundColor: '#111', borderColor: accent + '44', borderWidth: 1 }
                    : { backgroundColor: 'transparent' }
            ]}>
                {!isUser && <Text style={[styles.roleLabel, { color: accent }]}>KITSUNAI_OS v1.0</Text>}
                <Text
                    style={[
                        styles.bubbleText,
                        !isUser && { fontFamily: MONO, fontSize: 13, color: '#DDD' }
                    ]}
                    textBreakStrategy="simple"
                    numberOfLines={0}
                >
                    {item.content}{getSafetyBuffer(item.content, isUser)}
                </Text>
            </View>
        </View>
    );
});

export type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
};

export function ChatScreen({ onClose, ai }: { onClose?: () => void; ai: ReturnType<typeof useAI> }) {
    const [input, setInput] = useState('');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const inputRef = useRef('');

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

    const voice = useVoice(ai.speaking, (transcript) => {
        setInput(transcript);
        inputRef.current = transcript;
    });
    const { recording, toggleRecording } = voice;

    useEffect(() => {
        const show = Keyboard.addListener('keyboardDidShow', (e) => {
            setKeyboardHeight(e.endCoordinates.height);
        });
        const hide = Keyboard.addListener('keyboardDidHide', () => {
            setKeyboardHeight(0);
        });
        return () => {
            show.remove();
            hide.remove();
            ai.stopSpeech();
            ExpoSpeechRecognitionModule.stop();
            pulseAnim.stopAnimation();
        };
    }, []);

    useEffect(() => {
        if (msgs.length > 0) {
            setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: true });
            }, 80);
        }
    }, [msgs.length]);

    const createNewConversation = async () => {
        await ai.createNewConversation();
        setInput('');
        inputRef.current = '';
    };

    const loadConversation = async (id: string) => {
        await ai.loadConversation(id);
        setInput('');
        inputRef.current = '';
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
            inputRef.current = transcript;
        }
    });

    useSpeechRecognitionEvent('end', () => {
        stopPulse();
        if (inputRef.current.trim()) send(inputRef.current);
    });

    useSpeechRecognitionEvent('error', (event) => {
        if (event.error === 'no-speech') { stopPulse(); return; }
        stopPulse();
    });

    async function handleMicPress() {
        if (!recording) {
            ai.stopSpeech();
            startPulse();
        } else {
            stopPulse();
            if (inputRef.current.trim()) send(inputRef.current);
        }
        await toggleRecording();
    }

    async function send(overrideText?: string) {
        const text = overrideText ?? inputRef.current;
        if (!text.trim() || loading) return;
        setInput('');
        inputRef.current = '';
        await ai.send(text);
        setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }

    if (!dbReady || !modelReady) {
        return <BootingScreen accent={activeAccent} />;
    }

    return (
        <View style={[styles.keyboardContainer, { paddingBottom: keyboardHeight }]}>
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
                        style={[styles.headerIconBtn, { borderColor: activeAccent + '33' }]}
                    >
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                            <Line x1="12" y1="5" x2="12" y2="19" stroke={activeAccent} strokeWidth="1.8" strokeLinecap="round" />
                            <Line x1="5" y1="12" x2="19" y2="12" stroke={activeAccent} strokeWidth="1.8" strokeLinecap="round" />
                        </Svg>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setDrawerOpen(true)}
                        style={[styles.headerIconBtn, { borderColor: activeAccent + '33' }]}
                    >
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                            <Line x1="4" y1="7" x2="20" y2="7" stroke={activeAccent} strokeWidth="1.8" strokeLinecap="round" />
                            <Line x1="4" y1="12" x2="20" y2="12" stroke={activeAccent} strokeWidth="1.8" strokeLinecap="round" />
                            <Line x1="4" y1="17" x2="20" y2="17" stroke={activeAccent} strokeWidth="1.8" strokeLinecap="round" />
                        </Svg>
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
                    keyboardShouldPersistTaps="handled"
                >
                    {msgs.map((m) => (
                        <MessageBubble key={m.id} item={m} accent={activeAccent} />
                    ))}

                    {streamingText && (
                        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                            <View style={styles.bubbleWrapper}>
                                <Text style={[styles.roleLabel, { color: activeAccent }]}>KITSUNAI_OS [STREAMING]</Text>
                                <Text style={[styles.bubbleText, { fontFamily: MONO, fontSize: 13, color: '#DDD' }]}
                                    numberOfLines={0}>
                                    {streamingText}
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
                        inputRef.current = text;
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
                            style={[styles.micButton, { backgroundColor: activeAccent }]}
                            onPress={() => ai.stopSpeech()}
                        >
                            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                                <Rect x="4" y="4" width="16" height="16" rx="3" fill="#000" />
                            </Svg>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[
                                styles.micButton,
                                { borderColor: recording ? '#ff4444' : activeAccent + '44', borderWidth: 1 },
                                recording && { backgroundColor: '#ff444422' },
                            ]}
                            onPress={handleMicPress}
                            disabled={loading}
                        >
                            {recording ? (
                                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                                    <Rect x="5" y="5" width="14" height="14" rx="2" fill="#ff4444" />
                                </Svg>
                            ) : (
                                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                                    <Rect x="9" y="2" width="6" height="12" rx="3" stroke={activeAccent} strokeWidth="1.8" />
                                    <Path d="M5 10a7 7 0 0 0 14 0" stroke={activeAccent} strokeWidth="1.8" strokeLinecap="round" />
                                    <Line x1="12" y1="17" x2="12" y2="21" stroke={activeAccent} strokeWidth="1.8" strokeLinecap="round" />
                                    <Line x1="8" y1="21" x2="16" y2="21" stroke={activeAccent} strokeWidth="1.8" strokeLinecap="round" />
                                </Svg>
                            )}
                        </TouchableOpacity>
                    )}
                </Animated.View>

                <TouchableOpacity
                    style={[
                        styles.sendButton,
                        { backgroundColor: activeAccent },
                        (!input.trim() || loading) && styles.sendDisabled,
                    ]}
                    onPress={() => send()}
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
        </View>
    );
}

const styles = StyleSheet.create({
    keyboardContainer: {
        flex: 1,
        backgroundColor: '#000',
        width: SCREEN_WIDTH,
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
        flexShrink: 1,
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
    headerIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#0A0A0A',
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
});