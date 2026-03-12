import React, { useEffect, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    Dimensions, Modal, FlatList, ActivityIndicator, Alert
} from 'react-native';
import { db } from '../db';
import { conversations, messages } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH * 0.80;

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

export function ConversationDrawer({ visible, currentId, onSelect, onClose }: Props) {
    const [convos, setConvos] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);

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
            "Delete Chat",
            "Are you sure you want to delete this conversation?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
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
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
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
                <View style={styles.drawer}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>History</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.centre}>
                            <ActivityIndicator size="small" color="#2E75B6" />
                        </View>
                    ) : convos.length === 0 ? (
                        <View style={styles.centre}>
                            <Text style={styles.emptyText}>No conversations yet</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={convos}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <View style={[styles.item, item.id === currentId && styles.itemActive]}>
                                    <TouchableOpacity
                                        style={styles.itemContent}
                                        onPress={() => {
                                            onSelect(item.id);
                                            onClose();
                                        }}
                                    >
                                        <Text style={styles.itemTitle} numberOfLines={1}>
                                            {item.preview}
                                        </Text>
                                        <Text style={styles.itemDate}>
                                            {formatDate(item.createdAt)}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.deleteButton}
                                        onPress={() => deleteConversation(item.id)}
                                    >
                                        <Text style={styles.deleteText}>🗑</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
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
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    drawer: {
        width: DRAWER_WIDTH,
        backgroundColor: '#171717',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeText: {
        color: '#fff',
        fontSize: 14,
    },
    centre: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    itemActive: {
        backgroundColor: '#222',
    },
    itemContent: {
        flex: 1,
        marginRight: 8,
    },
    itemTitle: {
        color: '#ececec',
        fontSize: 15,
        fontWeight: '500',
        marginBottom: 4,
    },
    itemDate: {
        color: '#888',
        fontSize: 12,
    },
    deleteButton: {
        padding: 8,
        borderRadius: 8,
    },
    deleteText: {
        fontSize: 18,
        opacity: 0.6,
    },
    activeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#2E75B6',
        marginLeft: 8,
    },
});