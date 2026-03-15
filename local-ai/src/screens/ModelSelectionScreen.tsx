import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { MODELS, ModelDef } from '../model/models';

type Props = {
    onComplete: (modelId: string) => void;
};

const SPEED_LABEL: Record<string, string> = {
    fast: '⚡ Fast',
    medium: '◎ Medium',
    slow: '○ Slow',
};

const MONO = Platform.OS === 'android' ? 'monospace' : 'Courier';

export function ModelSelectionScreen({ onComplete }: Props) {
    return (
        <View style={styles.container}>
            <View style={styles.top}>
                <Text style={styles.appName}>KitsunAI</Text>
                <Text style={styles.heading}>Choose your model</Text>
                <Text style={styles.sub}>
                    Downloaded once to your device.{'\n'}You can change this later in Settings.
                </Text>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
            >
                {MODELS.map((model) => (
                    <TouchableOpacity
                        key={model.id}
                        style={styles.card}
                        onPress={() => onComplete(model.id)}
                        activeOpacity={0.75}
                    >
                        <View style={styles.cardLeft}>
                            <View style={styles.nameRow}>
                                <Text style={styles.modelName}>{model.name}</Text>
                                {model.tag && (
                                    <View style={[styles.tag, tagColor(model.tag)]}>
                                        <Text style={[styles.tagText, tagTextColor(model.tag)]}>
                                            {model.tag}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.desc}>{model.description}</Text>
                            <View style={styles.meta}>
                                <Text style={styles.metaText}>{SPEED_LABEL[model.speed]}</Text>
                                <Text style={styles.dot}>·</Text>
                                <Text style={styles.metaText}>{model.sizeGB} GB</Text>
                            </View>
                        </View>
                        <Text style={styles.arrow}>›</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <Text style={styles.footer}>Use Wi-Fi for download</Text>
        </View>
    );
}

function tagColor(tag: string) {
    if (tag === 'FASTEST') return { backgroundColor: '#0A2A0A', borderColor: '#00AA44' };
    if (tag === 'DEFAULT') return { backgroundColor: '#0A1A2A', borderColor: '#2E75B6' };
    if (tag === 'BEST') return { backgroundColor: '#2A1A00', borderColor: '#FF8800' };
    if (tag === 'LATEST') return { backgroundColor: '#1A0A2A', borderColor: '#9933FF' };
    return { backgroundColor: '#1A1A1A', borderColor: '#444' };
}

function tagTextColor(tag: string) {
    if (tag === 'FASTEST') return { color: '#00AA44' };
    if (tag === 'DEFAULT') return { color: '#2E75B6' };
    if (tag === 'BEST') return { color: '#FF8800' };
    if (tag === 'LATEST') return { color: '#9933FF' };
    return { color: '#888' };
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#080808',
    },
    top: {
        paddingTop: 72,
        paddingHorizontal: 28,
        paddingBottom: 24,
    },
    appName: {
        color: '#FF6600',
        fontSize: 13,
        letterSpacing: 6,
        fontFamily: MONO,
        marginBottom: 16,
        opacity: 0.8,
    },
    heading: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 10,
        letterSpacing: -0.5,
    },
    sub: {
        color: '#666',
        fontSize: 14,
        lineHeight: 22,
    },
    scroll: {
        flex: 1,
    },
    list: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 10,
    },
    card: {
        backgroundColor: '#0F0F0F',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#1C1C1C',
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardLeft: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 5,
    },
    modelName: {
        color: '#F0F0F0',
        fontSize: 17,
        fontWeight: '600',
    },
    tag: {
        borderWidth: 1,
        borderRadius: 5,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    tagText: {
        fontSize: 8,
        letterSpacing: 1.5,
        fontWeight: '700',
        fontFamily: MONO,
    },
    desc: {
        color: '#555',
        fontSize: 13,
        marginBottom: 8,
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    metaText: {
        color: '#444',
        fontSize: 12,
        fontFamily: MONO,
    },
    dot: {
        color: '#333',
        fontSize: 12,
    },
    arrow: {
        color: '#333',
        fontSize: 28,
        marginLeft: 12,
    },
    footer: {
        color: '#333',
        fontSize: 11,
        textAlign: 'center',
        fontFamily: MONO,
        paddingVertical: 20,
        letterSpacing: 2,
    },
});