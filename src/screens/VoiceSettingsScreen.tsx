import { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, Platform, ActivityIndicator, Modal, TextInput
} from 'react-native';
import * as Speech from 'expo-speech';
import Slider from '@react-native-community/slider';
import { Settings } from '../store/settings';

const MONO = Platform.OS === 'android' ? 'monospace' : 'Courier';

type VoiceOption = {
    identifier: string;
    name: string;
    language: string;
    languageLabel: string;
    quality?: string;
    latency?: string;
};

type Props = {
    visible: boolean;
    accent: string;
    onClose: () => void;
};

const LANGUAGE_NAMES: Record<string, string> = {
    'en-us': 'English (US)',
    'en-gb': 'English (UK)',
    'en-au': 'English (Australia)',
    'en-in': 'English (India)',
    'en-ca': 'English (Canada)',
    'en-ie': 'English (Ireland)',
    'en-za': 'English (South Africa)',
    'fr-fr': 'French',
    'fr-ca': 'French (Canada)',
    'de-de': 'German',
    'es-es': 'Spanish (Spain)',
    'es-us': 'Spanish (US)',
    'es-mx': 'Spanish (Mexico)',
    'it-it': 'Italian',
    'pt-br': 'Portuguese (Brazil)',
    'pt-pt': 'Portuguese (Portugal)',
    'ja-jp': 'Japanese',
    'ko-kr': 'Korean',
    'zh-cn': 'Chinese (Simplified)',
    'zh-tw': 'Chinese (Traditional)',
    'zh-hk': 'Chinese (Hong Kong)',
    'nl-nl': 'Dutch',
    'nl-be': 'Dutch (Belgium)',
    'pl-pl': 'Polish',
    'ru-ru': 'Russian',
    'ar-xa': 'Arabic',
    'ar-001': 'Arabic',
    'hi-in': 'Hindi',
    'tr-tr': 'Turkish',
    'sv-se': 'Swedish',
    'da-dk': 'Danish',
    'fi-fi': 'Finnish',
    'nb-no': 'Norwegian',
    'cs-cz': 'Czech',
    'sk-sk': 'Slovak',
    'hu-hu': 'Hungarian',
    'ro-ro': 'Romanian',
    'uk-ua': 'Ukrainian',
    'el-gr': 'Greek',
    'he-il': 'Hebrew',
    'id-id': 'Indonesian',
    'ms-my': 'Malay',
    'th-th': 'Thai',
    'vi-vn': 'Vietnamese',
    'fil-ph': 'Filipino',
    'bn-in': 'Bengali (India)',
    'gu-in': 'Gujarati',
    'kn-in': 'Kannada',
    'ml-in': 'Malayalam',
    'mr-in': 'Marathi',
    'ta-in': 'Tamil',
    'te-in': 'Telugu',
    'ur-pk': 'Urdu',
    'af-za': 'Afrikaans',
    'ca-es': 'Catalan',
    'hr-hr': 'Croatian',
    'sr-rs': 'Serbian',
    'bg-bg': 'Bulgarian',
    'lv-lv': 'Latvian',
    'lt-lt': 'Lithuanian',
    'et-ee': 'Estonian',
    'sl-si': 'Slovenian',
    'is-is': 'Icelandic',
    'sq-al': 'Albanian',
    'mk-mk': 'Macedonian',
    'az-az': 'Azerbaijani',
    'ka-ge': 'Georgian',
    'hy-am': 'Armenian',
    'km-kh': 'Khmer',
    'lo-la': 'Lao',
    'my-mm': 'Burmese',
    'si-lk': 'Sinhala',
    'ne-np': 'Nepali',
    'sw-ke': 'Swahili',
    'zu-za': 'Zulu',
    'cy-gb': 'Welsh',
    'eu-es': 'Basque',
    'gl-es': 'Galician',
    'yue-hk': 'Cantonese',
};

function getLanguageName(locale: string): string {
    const key = locale?.toLowerCase().replace('_', '-') ?? '';
    if (LANGUAGE_NAMES[key]) return LANGUAGE_NAMES[key];
    const base = key.split('-')[0];
    const baseMatch = Object.entries(LANGUAGE_NAMES).find(([k]) => k.startsWith(base + '-'));
    if (baseMatch) return baseMatch[1];
    return locale ?? 'Unknown';
}

function guessGender(name: string): 'male' | 'female' | null {
    const lower = name.toLowerCase();
    if (lower.includes('female') || lower.includes('woman') || lower.includes('girl')) return 'female';
    if (lower.includes('male') || lower.includes('man') || lower.includes('boy')) return 'male';
    if (lower.includes('-c-') || lower.includes('-f-') || lower.includes('sfg') || lower.includes('tpc')) return 'female';
    if (lower.includes('-b-') || lower.includes('-d-') || lower.includes('sfq') || lower.includes('tpd')) return 'male';
    return null;
}

export function VoiceSettingsScreen({ visible, accent, onClose }: Props) {
    const [voices, setVoices] = useState<VoiceOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedVoice, setSelectedVoice] = useState<string | undefined>(Settings.getSelectedVoice());
    const [voiceSpeed, setVoiceSpeed] = useState(Settings.getVoiceSpeed());
    const [previewing, setPreviewing] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (visible) loadVoices();
    }, [visible]);

    async function loadVoices() {
        setLoading(true);
        try {
            const all = await Speech.getAvailableVoicesAsync();
            const filtered = all
                .filter(v => !(v as any).networkRequired)
                .map(v => ({
                    identifier: v.identifier,
                    name: v.name ?? v.identifier,
                    language: v.language,
                    languageLabel: getLanguageName(v.language),
                    quality: (v as any).quality ?? undefined,
                    latency: (v as any).latency ?? undefined,
                }))
                .sort((a, b) => {
                    const aEn = a.language?.startsWith('en') ? 0 : 1;
                    const bEn = b.language?.startsWith('en') ? 0 : 1;
                    if (aEn !== bEn) return aEn - bEn;
                    if (a.languageLabel !== b.languageLabel)
                        return a.languageLabel.localeCompare(b.languageLabel);
                    const qa = a.quality ?? '';
                    const qb = b.quality ?? '';
                    if (qa !== qb) return qb.localeCompare(qa);
                    return a.name.localeCompare(b.name);
                });
            setVoices(filtered);
        } catch (e) {
            console.error('Failed to load voices:', e);
        } finally {
            setLoading(false);
        }
    }

    async function preview(identifier: string) {
        Speech.stop();
        setPreviewing(identifier);
        Speech.speak('Hello, I am KitsunAI. How can I help?', {
            voice: identifier,
            rate: voiceSpeed,
            onDone: () => setPreviewing(null),
            onStopped: () => setPreviewing(null),
            onError: () => setPreviewing(null),
        });
    }

    function save() {
        if (selectedVoice) Settings.setSelectedVoice(selectedVoice);
        Settings.setVoiceSpeed(voiceSpeed);
        Speech.stop();
        onClose();
    }

    const filtered = voices.filter(v =>
        v.name.toLowerCase().includes(search.toLowerCase()) ||
        v.languageLabel.toLowerCase().includes(search.toLowerCase())
    );

    const grouped = filtered.reduce<Record<string, VoiceOption[]>>((acc, v) => {
        const key = v.languageLabel;
        if (!acc[key]) acc[key] = [];
        acc[key].push(v);
        return acc;
    }, {});

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
            <View style={styles.container}>
                <View style={[styles.header, { borderBottomColor: accent + '22' }]}>
                    <TouchableOpacity onPress={onClose} style={styles.backBtn}>
                        <Text style={{ color: accent, fontSize: 20 }}>←</Text>
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: accent, fontFamily: MONO }]}>
                        VOICE_CONFIG
                    </Text>
                    <TouchableOpacity
                        style={[styles.saveBtn, { backgroundColor: accent }]}
                        onPress={save}
                    >
                        <Text style={[styles.saveBtnText, { fontFamily: MONO }]}>SAVE</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                    <Text style={[styles.label, { color: '#BBB' }]}>SPEED: {voiceSpeed.toFixed(1)}x</Text>
                    <Slider
                        style={{ width: '100%', height: 36 }}
                        minimumValue={0.5}
                        maximumValue={2.0}
                        step={0.1}
                        value={voiceSpeed}
                        onValueChange={setVoiceSpeed}
                        minimumTrackTintColor={accent}
                        maximumTrackTintColor="#333"
                        thumbTintColor={accent}
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -8, marginBottom: 20 }}>
                        <Text style={styles.sliderLabel}>0.5x</Text>
                        <Text style={styles.sliderLabel}>2.0x</Text>
                    </View>

                    <Text style={[styles.sectionHint, { fontFamily: MONO }]}>
                        Tap to select · Long press to preview
                    </Text>
                    <Text style={[styles.sectionHint, { fontFamily: MONO, marginBottom: 20 }]}>
                        More voices: Android Settings → Accessibility → Text-to-Speech → Google TTS → Install voice data
                    </Text>
                    <View style={styles.searchRow}>
                        <TextInput
                            style={[styles.searchInput, { borderColor: accent + '33', color: '#CCC' }]}
                            value={search}
                            onChangeText={setSearch}
                            placeholder="Search voices..."
                            placeholderTextColor="#444"
                            autoCorrect={false}
                            autoCapitalize="none"
                        />
                        {search.length > 0 && (
                            <TouchableOpacity onPress={() => setSearch('')} style={styles.searchClear}>
                                <Text style={{ color: '#555', fontSize: 16 }}>✕</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color={accent} style={{ marginTop: 40 }} />
                    ) : voices.length === 0 ? (
                        <Text style={[styles.emptyText, { fontFamily: MONO }]}>
                            No offline voices found on device.
                        </Text>
                    ) : (
                        Object.entries(grouped).map(([lang, langVoices]) => (
                            <View key={lang}>
                                <Text style={[styles.groupLabel, { color: accent + '88', fontFamily: MONO }]}>
                                    {lang}
                                </Text>
                                {langVoices.map(v => {
                                    const isSelected = selectedVoice === v.identifier;
                                    const isPreviewing = previewing === v.identifier;
                                    const gender = guessGender(v.name);
                                    return (
                                        <TouchableOpacity
                                            key={v.identifier}
                                            style={[
                                                styles.voiceRow,
                                                isSelected && { borderColor: accent, backgroundColor: accent + '0D' },
                                            ]}
                                            onPress={() => setSelectedVoice(v.identifier)}
                                            onLongPress={() => preview(v.identifier)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.voiceInfo}>
                                                <Text style={[styles.voiceName, isSelected && { color: accent }]}>
                                                    {v.name}
                                                </Text>
                                                <View style={styles.voiceMeta}>
                                                    {v.quality && (
                                                        <View style={[styles.metaBadge, { borderColor: '#333' }]}>
                                                            <Text style={[styles.metaBadgeText, isSelected && { color: accent }]}>
                                                                {v.quality}
                                                            </Text>
                                                        </View>
                                                    )}
                                                    {gender && (
                                                        <View style={[styles.metaBadge, { borderColor: '#333' }]}>
                                                            <Text style={[styles.metaBadgeText, isSelected && { color: accent }]}>
                                                                {gender === 'female' ? '♀ female' : '♂ male'}
                                                            </Text>
                                                        </View>
                                                    )}
                                                    {v.latency && (
                                                        <View style={[styles.metaBadge, { borderColor: '#333' }]}>
                                                            <Text style={styles.metaBadgeText}>{v.latency}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                            <View style={styles.voiceRight}>
                                                {isPreviewing ? (
                                                    <Text style={[styles.previewingLabel, { color: accent }]}>▶</Text>
                                                ) : isSelected ? (
                                                    <View style={[styles.selectedDot, { backgroundColor: accent }]} />
                                                ) : null}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ))
                    )}
                    <View style={{ height: 40 }} />
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#050505',
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
    backBtn: {
        padding: 4,
        width: 36,
    },
    headerTitle: {
        fontSize: 14,
        letterSpacing: 6,
        fontWeight: '200',
        flex: 1,
        textAlign: 'center',
    },
    saveBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    saveBtnText: {
        color: '#000',
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    content: {
        padding: 20,
    },
    label: {
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 2,
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    sliderLabel: {
        color: '#555',
        fontSize: 10,
        fontFamily: MONO,
    },
    sectionHint: {
        color: '#444',
        fontSize: 10,
        lineHeight: 16,
        marginBottom: 4,
    },
    emptyText: {
        color: '#555',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 40,
    },
    groupLabel: {
        fontSize: 9,
        letterSpacing: 3,
        marginTop: 24,
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    voiceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0E0E0E',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1A1A1A',
        padding: 14,
        marginBottom: 6,
    },
    voiceInfo: {
        flex: 1,
    },
    voiceName: {
        color: '#CCC',
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 5,
    },
    voiceMeta: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
    },
    metaBadge: {
        borderWidth: 1,
        borderRadius: 4,
        paddingHorizontal: 5,
        paddingVertical: 2,
    },
    metaBadgeText: {
        color: '#555',
        fontSize: 8,
        fontFamily: MONO,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    voiceRight: {
        width: 24,
        alignItems: 'center',
    },
    selectedDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    previewingLabel: {
        fontSize: 12,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0E0E0E',
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        paddingHorizontal: 14,
    },
    searchInput: {
        flex: 1,
        height: 44,
        fontSize: 14,
        fontFamily: MONO,
        borderWidth: 0,
    },
    searchClear: {
        padding: 4,
    },
});