import { useState, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, ActivityIndicator, Dimensions,
    KeyboardAvoidingView, Platform
} from 'react-native';
import { generateReply } from '../model/inference';
import { db } from '../db';
import { messages } from '../db/schema';
import { Settings } from '../store/settings';
import uuid from 'react-native-uuid';
import { ScrollView } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
};

export function ChatScreen() {
    const [msgs, setMsgs] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const conversationId = useRef(uuid.v4() as string);
    const flatListRef = useRef<ScrollView>(null);
    const inputRef = useRef('');

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

        await db.insert(messages).values({
            ...userMessage,
            conversationId: conversationId.current,
            createdAt: new Date(),
        });

        const newMsgs = [...msgs, userMessage];
        setMsgs(newMsgs);
        setLoading(true);
        setStreamingText('');

        try {
            let fullReply = '';

            await generateReply(
                newMsgs,
                Settings.getSystemPrompt(),
                (token) => {
                    fullReply += token;
                    setStreamingText(fullReply);
                    flatListRef.current?.scrollToEnd({ animated: false });
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

            setMsgs([...newMsgs, assistantMessage]);
            setStreamingText('');
        } catch (e) {
            setMsgs([...newMsgs, {
                id: uuid.v4() as string,
                role: 'assistant',
                content: 'Something went wrong. Please try again.',
            }]);
        } finally {
            setLoading(false);
        }
    }

    function renderItem({ item }: { item: Message }) {
        const isUser = item.role === 'user';
        const bubbleWidth = SCREEN_WIDTH * 0.75;
        return (
            <View style={{
                width: bubbleWidth,
                marginLeft: isUser ? SCREEN_WIDTH - bubbleWidth - 16 : 16,
                marginBottom: 8,
                backgroundColor: isUser ? '#2E75B6' : '#222',
                padding: 12,
                borderRadius: 16,
            }}>
                <Text style={{
                    color: '#fff',
                    fontSize: 16,
                    lineHeight: 22,
                    textAlign: isUser ? 'right' : 'left',
                }} numberOfLines={0}>
                    {item.content}
                </Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={[styles.container, { width: SCREEN_WIDTH }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
        >
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Local AI</Text>
            </View>

            <ScrollView
                ref={flatListRef}
                style={{ flex: 1, width: SCREEN_WIDTH }}
                contentContainerStyle={{ flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            >
                {msgs.map(item => renderItem({ item }))}
                {streamingText ? (
                    <View style={{
                        width: SCREEN_WIDTH * 0.75,
                        marginLeft: 16,
                        marginBottom: 8,
                        backgroundColor: '#222',
                        padding: 12,
                        borderRadius: 16,
                    }}>
                        <Text style={{ color: '#fff', fontSize: 16, lineHeight: 22 }}>
                            {streamingText}
                        </Text>
                    </View>
                ) : loading ? (
                    <View style={{ padding: 16 }}>
                        <ActivityIndicator size="small" color="#aaa" />
                    </View>
                ) : null}
            </ScrollView>

            <View style={[styles.inputRow, { width: SCREEN_WIDTH }]}>
                <TextInput
                    style={styles.input}
                    value={input}
                    onChangeText={(text) => {
                        setInput(text);
                        inputRef.current = text;
                    }}
                    placeholder="Message..."
                    placeholderTextColor="#666"
                    multiline
                    editable={!loading}
                    blurOnSubmit={false}
                    returnKeyType="default"
                />
                <TouchableOpacity
                    style={[styles.sendButton, (!input.trim() || loading) && styles.sendDisabled]}
                    onPress={send}
                    disabled={!input.trim() || loading}
                >
                    <Text style={styles.sendText}>↑</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111',
    },
    header: {
        paddingTop: 56,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    inputRow: {
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
});