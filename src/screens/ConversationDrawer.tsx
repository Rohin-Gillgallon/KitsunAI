import React, { useEffect, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    Dimensions, Modal, FlatList, ActivityIndicator, Alert
} from 'react-native';
import { db } from '../db';
import { conversations, messages } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH * 0.85;
const MONO = Platform.OS === 'android' ? 'monospace' : 'Courier';

type Conversation = {
    id: string;
    title: string;
    createdAt: Date;
    preview: string;
};

type Props = {
    visible: boolean;
    currentId: string;
    onSelect: (id: string) => void;
    onClose: () => void;
};

import { Settings } from '../store/settings';
import { Platform } from 'react-native';
import { INTERFACES } from './SpeechMode';

export function ConversationDrawer({ visible, currentId, onSelect, onClose }: Props) {
    const [convos, setConvos] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);

    const themeIdx = Settings.getThemeIndex();
    const activeAccent = (INTERFACES[themeIdx] || INTERFACES[0]).accent || '#FFFFFF';

    useEffect(() => {
        if (visible) loadConversations();
    }, [visible]);

    async function loadConversations() {
        setLoading(true);
        try {
            const rows = await db
                .select()
                .from(conversations)
                .orderBy(desc(conversations.createdAt));

            const withPreviews = await Promise.all(rows.map(async (c) => {
                const firstMsg = await db
                    .select()
                    .from(messages)
                    .where(eq(messages.conversationId, c.id))
                    .limit(1);
                return {
                    id: c.id,
                    title: c.title,
                    createdAt: c.createdAt,
                    preview: firstMsg[0]?.content ?? 'Empty conversation',
                };
            }));

            setConvos(withPreviews);
        } catch (e) {
            console.error('Load conversations error:', e);
        } finally {
            setLoading(false);
        }
    }

    async function deleteConversation(id: string) {
        Alert.alert(
            "DELETE SESSION",
            "Are you sure you want to terminate this memory sequence?",
            [
                { text: "CANCEL", style: "cancel" },
                {
                    text: "TERMINATE",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await db.delete(conversations).where(eq(conversations.id, id));
                            setConvos(prev => prev.filter(c => c.id !== id));
                            if (id === currentId) {
                                onSelect('');
                            }
                        } catch (e) {
                            console.error('Delete conversation error:', e);
                        }
                    }
                }
            ]
        );
    }

    function formatDate(date: Date) {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) return 'TODAY';
        if (days === 1) return 'YESTERDAY';
        if (days < 7) return `${days} DAYS AGO`;
        return date.toLocaleDateString();
    }

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
                <View style={[styles.drawer, { borderRightColor: activeAccent + '22', borderRightWidth: 1 }]}>
                    <View style={[styles.header, { borderBottomColor: activeAccent + '22' }]}>
                        <Text style={[styles.headerTitle, { color: activeAccent, fontFamily: MONO }]}>DATA_LOGS</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={[styles.closeText, { color: activeAccent }]}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.centre}>
                            <ActivityIndicator size="small" color={activeAccent} />
                        </View>
                    ) : convos.length === 0 ? (
                        <View style={styles.centre}>
                            <Text style={[styles.emptyText, { fontFamily: MONO }]}>[NO_DATA_LOGS_FOUND]</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={convos}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <View style={[styles.item, item.id === currentId && { backgroundColor: activeAccent + '08' }]}>
                                    <TouchableOpacity
                                        style={styles.itemContent}
                                        onPress={() => {
                                            onSelect(item.id);
                                            onClose();
                                        }}
                                    >
                                        <Text style={[styles.itemTitle, { fontFamily: MONO }]} numberOfLines={1}>
                                            {item.preview}
                                        </Text>
                                        <Text style={[styles.itemDate, { fontFamily: MONO, color: '#555' }]}>
                                            {formatDate(item.createdAt)}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.deleteButton}
                                        onPress={() => deleteConversation(item.id)}
                                    >
                                        <Text style={{ color: '#444', fontSize: 14 }}>✕</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            contentContainerStyle={{ paddingBottom: 40 }}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        flexDirection: 'row',
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
    },
    drawer: {
        width: DRAWER_WIDTH,
        backgroundColor: '#050505',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
    },
    header: {
        paddingTop: 60,
        paddingBottom: 24,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: {
        fontSize: 14,
        letterSpacing: 4,
        fontWeight: '200',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#111',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeText: {
        fontSize: 14,
    },
    centre: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: '#444',
        fontSize: 10,
        letterSpacing: 2,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#111',
    },
    itemContent: {
        flex: 1,
        marginRight: 12,
    },
    itemTitle: {
        color: '#BBB',
        fontSize: 12,
        letterSpacing: 1,
        marginBottom: 6,
    },
    itemDate: {
        fontSize: 9,
        letterSpacing: 1,
    },
    deleteButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#0A0A0A',
    },
    deleteText: {
        fontSize: 18,
        opacity: 0.6,
    },
});