import { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, Modal, ScrollView, Dimensions, Platform,
    FlatList, ActivityIndicator, Alert,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import Svg, { Path, Rect, Line, Circle } from 'react-native-svg';
import { Settings, useTheme, storage } from '../store/settings';
import { MODELS, ModelDef } from '../model/models';
import { releaseModel, getModelPath } from '../model/llm';
import { VoiceSettingsScreen } from './VoiceSettingsScreen';

const SCREEN_WIDTH = Dimensions.get('window').width;

type Props = {
    visible: boolean;
    onClose: () => void;
};

import { INTERFACES, Variant, Species } from './SpeechMode';
import { useSharedValue } from 'react-native-reanimated';

const PAD = 14;
const GAP = 10;
const GRID_W = SCREEN_WIDTH;
const CELL_W = Math.floor((GRID_W - PAD * 2 - GAP) / 2);

const MONO = Platform.OS === 'android' ? 'monospace' : 'Courier';

type VoiceOption = {
    identifier: string;
    name: string;
    language: string;
    quality?: string;
};

export function SettingsModal({ visible, onClose }: Props) {
    const globalThemeIdx = useTheme();
    const [systemPrompt, setSystemPrompt] = useState(Settings.getSystemPrompt());
    const [voiceSpeed, setVoiceSpeed] = useState(Settings.getVoiceSpeed());
    const [threadCount, setThreadCount] = useState(Settings.getThreadCount());
    const [contextSize, setContextSize] = useState(Settings.getContextSize());
    const [batchSize, setBatchSize] = useState(Settings.getBatchSize());
    const [themeIdx, setThemeIdx] = useState(globalThemeIdx);
    const [showInterfacePicker, setShowInterfacePicker] = useState(false);
    const [pickerView, setPickerView] = useState<'collections' | 'variants'>('collections');
    const [selectedCollection, setSelectedCollection] = useState<number | null>(null);
    const [showVoiceSettings, setShowVoiceSettings] = useState(false);

    // Voice state
    const [selectedVoice, setSelectedVoice] = useState<string | undefined>(Settings.getSelectedVoice());

    // Model state
    const [selectedModelId, setSelectedModelId] = useState(Settings.getSelectedModelId());
    const [downloadedIds, setDownloadedIds] = useState<string[]>(Settings.getDownloadedModelIds());
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

    useEffect(() => { setThemeIdx(globalThemeIdx); }, [globalThemeIdx]);

    useEffect(() => {
        if (visible) {
            refreshDownloaded();
        }
    }, [visible]);



    const dummyVolume = useSharedValue(0);
    const activeAccent = (INTERFACES[themeIdx] || INTERFACES[0]).accent || '#FFFFFF';

    const refreshDownloaded = useCallback(() => {
        setDownloadedIds(Settings.getDownloadedModelIds());
    }, []);

    async function downloadModel(model: ModelDef) {
        if (downloadingId) return;
        setDownloadingId(model.id);
        setDownloadProgress(p => ({ ...p, [model.id]: 0 }));

        const dest = getModelPath(model.id);
        const resumeKey = `download_resume_${model.id}`;

        try {
            const savedState = storage.getString(resumeKey);
            let download: FileSystem.DownloadResumable;

            if (savedState && savedState.length > 0) {
                console.log(`Resuming download for ${model.id}`);
                download = FileSystem.createDownloadResumable(
                    model.url,
                    dest,
                    {},
                    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
                        const pct = totalBytesExpectedToWrite > 0
                            ? Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100)
                            : 0;
                        setDownloadProgress(p => ({ ...p, [model.id]: pct }));
                    },
                    JSON.parse(savedState),
                );
            } else {
                await FileSystem.deleteAsync(dest, { idempotent: true });
                download = FileSystem.createDownloadResumable(
                    model.url,
                    dest,
                    {},
                    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
                        const pct = totalBytesExpectedToWrite > 0
                            ? Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100)
                            : 0;
                        setDownloadProgress(p => ({ ...p, [model.id]: pct }));
                        if (pct % 5 === 0) {
                            try {
                                const state = download.savable();
                                storage.set(resumeKey, JSON.stringify(state));
                            } catch { }
                        }
                    },
                );
            }

            const result = await download.downloadAsync();

            if (!result || result.status !== 200) {
                await FileSystem.deleteAsync(dest, { idempotent: true });
                storage.set(resumeKey, '');
                throw new Error(`HTTP ${result?.status ?? 'unknown'} — bad URL`);
            }

            const info = await FileSystem.getInfoAsync(dest);
            const minExpectedBytes = model.sizeGB * 1024 * 1024 * 1024 * 0.85;
            if (!info.exists || (info as any).size < minExpectedBytes) {
                await FileSystem.deleteAsync(dest, { idempotent: true });
                storage.set(resumeKey, '');
                throw new Error(`File too small — download may have returned an error page`);
            }

            storage.set(resumeKey, '');
            Settings.setModelIdDownloaded(model.id, true);
            refreshDownloaded();

        } catch (e) {
            Alert.alert('Download failed', `${String(e)}\n\nTap download again to resume.`);
            Settings.setModelIdDownloaded(model.id, false);
        } finally {
            setDownloadingId(null);
        }
    }

    async function deleteModel(model: ModelDef) {
        Alert.alert(
            'Delete model',
            `Remove ${model.name} (${model.sizeGB}GB) from device?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive',
                    onPress: async () => {
                        try {
                            const path = getModelPath(model.id);
                            await FileSystem.deleteAsync(path, { idempotent: true });
                            Settings.setModelIdDownloaded(model.id, false);
                            if (selectedModelId === model.id) {
                                const fallback = downloadedIds.find(id => id !== model.id);
                                const newId = fallback ?? 'gemma3-1b';
                                setSelectedModelId(newId);
                                Settings.setSelectedModelId(newId);
                                await releaseModel();
                            }
                            refreshDownloaded();
                        } catch (e) {
                            Alert.alert('Delete failed', String(e));
                        }
                    },
                },
            ],
        );
    }

    async function save() {
        Settings.setSystemPrompt(systemPrompt);
        Settings.setThreadCount(threadCount);
        Settings.setContextSize(contextSize);
        Settings.setBatchSize(batchSize);
        Settings.setThemeIndex(themeIdx);
        Settings.setSelectedModelId(selectedModelId);
        if (selectedVoice) Settings.setSelectedVoice(selectedVoice);
        await releaseModel();
        onClose();
    }

    const SPEED_LABELS: Record<string, string> = { fast: '⚡', medium: '◎', slow: '○' };

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.sheet, { borderTopColor: activeAccent, borderTopWidth: 2 }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: activeAccent, fontFamily: MONO }]}>
                            KITSUNAI CONFIG
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <TouchableOpacity
                                style={[styles.saveButtonSmall, { backgroundColor: activeAccent }]}
                                onPress={save}
                            >
                                <Text style={styles.saveButtonSmallText}>SAVE</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Text style={styles.closeText}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                        <Text style={[styles.label, { marginTop: 0 }]}>System Prompt</Text>
                        <TextInput
                            style={styles.textArea}
                            value={systemPrompt}
                            onChangeText={setSystemPrompt}
                            multiline
                            numberOfLines={3}
                            placeholderTextColor="#666"
                            placeholder="Enter system prompt..."
                        />

                        {/* ── VOICE ── */}
                        {/* TODO: Replace expo-speech voices with ONNX neural TTS (Kokoro ~82MB or Piper ~60MB per voice)
                        for fully offline high-quality voices. Integration: onnxruntime-react-native + expo-av.
                        See: https://github.com/thewh1teagle/kokoro-onnx
                        and: https://github.com/rhasspy/piper */}
                        <Text style={styles.label}>Voice</Text>
                        <TouchableOpacity
                            style={[styles.pickerButton, { borderColor: activeAccent }]}
                            onPress={() => setShowVoiceSettings(true)}
                        >
                            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                                <Rect x="9" y="2" width="6" height="12" rx="3" stroke={activeAccent} strokeWidth="1.5" />
                                <Path d="M5 10a7 7 0 0 0 14 0" stroke={activeAccent} strokeWidth="1.5" strokeLinecap="round" />
                                <Line x1="12" y1="17" x2="12" y2="21" stroke={activeAccent} strokeWidth="1.5" strokeLinecap="round" />
                                <Line x1="8" y1="21" x2="16" y2="21" stroke={activeAccent} strokeWidth="1.5" strokeLinecap="round" />
                            </Svg>
                            <Text style={[styles.pickerButtonText, { color: activeAccent }]}>
                                {Settings.getSelectedVoice() ? 'Custom voice selected' : 'Default voice'}
                            </Text>
                            <Text style={{ color: activeAccent, fontSize: 12 }}>❯</Text>
                        </TouchableOpacity>

                        {/* ── VISUALIZER ── */}
                        <Text style={styles.label}>Visualizer Interface</Text>
                        <TouchableOpacity
                            style={[styles.pickerButton, { borderColor: activeAccent }]}
                            onPress={() => {
                                setPickerView('collections');
                                setSelectedCollection(null);
                                setShowInterfacePicker(true);
                            }}
                        >
                            <View style={[styles.themeColor, { backgroundColor: activeAccent, marginBottom: 0 }]} />
                            <Text style={[styles.pickerButtonText, { color: activeAccent }]}>
                                {INTERFACES[themeIdx].name}
                            </Text>
                            <Text style={{ color: activeAccent, fontSize: 12 }}>❯</Text>
                        </TouchableOpacity>

                        {/* ── MODEL SELECTION ── */}
                        <Text style={styles.label}>AI Model</Text>
                        {MODELS.map(model => {
                            const isSelected = selectedModelId === model.id;
                            const isDownloaded = downloadedIds.includes(model.id);
                            const isDownloading = downloadingId === model.id;
                            const progress = downloadProgress[model.id] ?? 0;

                            return (
                                <View key={model.id} style={[
                                    styles.modelCard,
                                    isSelected && { borderColor: activeAccent },
                                ]}>
                                    <View style={styles.modelTop}>
                                        <View style={styles.modelInfo}>
                                            <View style={styles.modelNameRow}>
                                                <Text style={styles.modelName}>{model.name}</Text>
                                                {model.tag && (
                                                    <View style={[styles.modelTag, { borderColor: activeAccent + '88' }]}>
                                                        <Text style={[styles.modelTagText, { color: activeAccent }]}>{model.tag}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.modelDesc}>{model.description}</Text>
                                            <View style={styles.modelMeta}>
                                                <Text style={styles.modelMetaText}>{SPEED_LABELS[model.speed]} {model.speed}</Text>
                                                <Text style={styles.modelMetaDot}>·</Text>
                                                <Text style={styles.modelMetaText}>{model.sizeGB}GB</Text>
                                            </View>
                                        </View>

                                        <View style={styles.modelActions}>
                                            {isSelected && isDownloaded && (
                                                <View style={[styles.selectedBadge, { backgroundColor: activeAccent + '22', borderColor: activeAccent }]}>
                                                    <Text style={[styles.selectedBadgeText, { color: activeAccent }]}>✓</Text>
                                                </View>
                                            )}
                                            {!isDownloaded && !isDownloading && (
                                                <TouchableOpacity
                                                    style={styles.dlButton}
                                                    onPress={() => downloadModel(model)}
                                                >
                                                    <Text style={styles.dlButtonText}>↓</Text>
                                                </TouchableOpacity>
                                            )}
                                            {isDownloaded && !isSelected && (
                                                <TouchableOpacity
                                                    style={[styles.selectButton, { borderColor: activeAccent + '66' }]}
                                                    onPress={() => setSelectedModelId(model.id)}
                                                >
                                                    <Text style={[styles.selectButtonText, { color: activeAccent }]}>USE</Text>
                                                </TouchableOpacity>
                                            )}
                                            {isDownloaded && (
                                                <TouchableOpacity
                                                    style={styles.deleteModelButton}
                                                    onPress={() => deleteModel(model)}
                                                >
                                                    <Text style={styles.deleteModelText}>🗑</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>

                                    {isDownloading && (
                                        <View style={styles.progressRow}>
                                            <View style={styles.progressTrack}>
                                                <View style={[styles.progressFill, {
                                                    width: `${progress}%` as any,
                                                    backgroundColor: activeAccent,
                                                }]} />
                                            </View>
                                            <Text style={[styles.progressText, { color: activeAccent }]}>{progress}%</Text>
                                        </View>
                                    )}
                                </View>
                            );
                        })}

                        {/* ── CPU THREADS ── */}
                        <Text style={styles.label}>CPU Threads</Text>
                        <View style={threadCount >= 8 ? styles.threadRowWrap : styles.threadRow}>
                            {[1, 2, 4, 6, 8].map(t => (
                                <TouchableOpacity
                                    key={t}
                                    style={[styles.threadButton, threadCount === t && { backgroundColor: activeAccent }]}
                                    onPress={() => setThreadCount(t)}
                                >
                                    <Text style={[styles.threadText, threadCount === t ? { color: '#000' } : { color: '#999' }]}>
                                        {t}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={styles.hint}>Higher = faster responses but more CPU usage.</Text>

                        {/* ── CONTEXT SIZE ── */}
                        <Text style={styles.label}>Context Size (Tokens)</Text>
                        <View style={styles.threadRow}>
                            {[1024, 2048, 4096, 8192].map(v => (
                                <TouchableOpacity
                                    key={v}
                                    style={[styles.threadButton, contextSize === v && { backgroundColor: activeAccent }]}
                                    onPress={() => setContextSize(v)}
                                >
                                    <Text style={[styles.threadText, contextSize === v ? { color: '#000' } : { color: '#999' }]}>
                                        {v >= 1024 ? `${v / 1024}k` : v}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={styles.hint}>
                            Larger = longer conversation memory but more RAM. 2k tokens is safe for most phones.
                        </Text>

                        {/* ── BATCH SIZE ── */}
                        <Text style={styles.label}>Batch Size (Tokens)</Text>
                        <View style={styles.threadRow}>
                            {[128, 256, 512, 1024].map(v => (
                                <TouchableOpacity
                                    key={v}
                                    style={[styles.threadButton, batchSize === v && { backgroundColor: activeAccent }]}
                                    onPress={() => setBatchSize(v)}
                                >
                                    <Text style={[styles.threadText, batchSize === v ? { color: '#000' } : { color: '#999' }]}>
                                        {v}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={styles.hint}>
                            Larger = faster prompt processing but more RAM. 512 tokens is the safe default.
                        </Text>

                        <View style={{ height: 64 }} />
                    </ScrollView>
                </View>

                <Modal visible={showInterfacePicker} transparent={false} animationType="slide">
                    <View style={styles.fullPickerContainer}>
                        <View style={styles.pickerHeader}>
                            <Text style={[styles.pickerTitle, { color: activeAccent, fontFamily: MONO }]}>
                                SELECT_INTERFACE
                            </Text>
                            <TouchableOpacity onPress={() => setShowInterfacePicker(false)} style={styles.closeButton}>
                                <Text style={styles.closeText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            key={pickerView}
                            data={(pickerView === 'collections' ? COLLECTIONS : COLL_VARIANTS[selectedCollection ?? 0]) as any[]}
                            numColumns={2}
                            keyExtractor={(item, index) => index.toString()}
                            contentContainerStyle={styles.fullThemeGrid}
                            renderItem={({ item, index }) => {
                                const isColl = pickerView === 'collections';
                                return (
                                    <TouchableOpacity
                                        style={[
                                            isColl ? styles.fullThemeCell : styles.variantCell,
                                            { backgroundColor: item.bg },
                                            !isColl && themeIdx === item.realIdx && { borderColor: activeAccent, borderWidth: 2 },
                                        ]}
                                        onPress={() => {
                                            if (isColl) {
                                                setSelectedCollection(index);
                                                setPickerView('variants');
                                            } else {
                                                setThemeIdx(item.realIdx);
                                                setShowInterfacePicker(false);
                                            }
                                        }}
                                    >
                                        <View style={styles.cellVisual}>
                                            <item.Component
                                                mode="idle"
                                                sz={CELL_W * 0.8}
                                                volume={dummyVolume}
                                                variant={item.variant}
                                                species={item.species as Species}
                                                isList={true}
                                            />
                                        </View>
                                        <View style={styles.cellBar}>
                                            <Text style={[styles.themeName, { color: item.accent, fontFamily: MONO }]}>
                                                {isColl ? item.name : item.variantName}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                        {pickerView === 'variants' && (
                            <TouchableOpacity style={styles.backButton} onPress={() => setPickerView('collections')}>
                                <Text style={{ color: activeAccent, fontWeight: 'bold' }}>❮ BACK TO COLLECTIONS</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </Modal>
                <VoiceSettingsScreen
                    visible={showVoiceSettings}
                    accent={activeAccent}
                    onClose={() => {
                        setShowVoiceSettings(false);
                        setVoiceSpeed(Settings.getVoiceSpeed());
                    }}
                />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#050505',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        maxHeight: '92%',
        minHeight: '100%',
    },
    scroll: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        paddingBottom: 0,
    },
    title: {
        fontSize: 14,
        fontWeight: '200',
        letterSpacing: 4,
    },
    closeButton: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: '#111',
        justifyContent: 'center', alignItems: 'center',
    },
    closeText: { color: '#fff', fontSize: 14 },
    content: { padding: 24 },
    label: {
        color: '#BBB', fontSize: 10, fontWeight: 'bold',
        letterSpacing: 2, marginBottom: 6, marginTop: 18,
        textTransform: 'uppercase',
    },
    saveButtonSmall: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    saveButtonSmallText: {
        color: '#000',
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 2,
        fontFamily: MONO,
    },
    textArea: {
        backgroundColor: '#111', color: '#fff', borderRadius: 16,
        padding: 12, fontSize: 14, lineHeight: 20, minHeight: 60,
        textAlignVertical: 'top', borderWidth: 1, borderColor: '#222',
    },
    sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -8 },
    sliderLabel: { color: '#888', fontSize: 10, fontFamily: MONO },
    voiceGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
    },
    voiceCard: {
        backgroundColor: '#0E0E0E',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1E1E1E',
        padding: 10,
        width: '47%',
        position: 'relative',
    },
    voiceName: {
        color: '#CCC',
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 2,
    },
    voiceLang: {
        color: '#555',
        fontSize: 9,
        fontFamily: MONO,
    },
    voiceQuality: {
        color: '#444',
        fontSize: 8,
        fontFamily: MONO,
        marginTop: 2,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    voiceSelectedDot: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    modelCard: {
        backgroundColor: '#0E0E0E',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#1E1E1E',
        padding: 14,
        marginBottom: 8,
    },
    modelTop: { flexDirection: 'row', alignItems: 'flex-start' },
    modelInfo: { flex: 1 },
    modelNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
    modelName: { color: '#EEE', fontSize: 14, fontWeight: '600' },
    modelTag: {
        borderWidth: 1, borderRadius: 4,
        paddingHorizontal: 5, paddingVertical: 1,
    },
    modelTagText: { fontSize: 8, letterSpacing: 1.5, fontFamily: MONO },
    modelDesc: { color: '#666', fontSize: 11, marginBottom: 5 },
    modelMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    modelMetaText: { color: '#555', fontSize: 10, fontFamily: MONO },
    modelMetaDot: { color: '#333', fontSize: 10 },
    modelActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 },
    selectedBadge: {
        width: 32, height: 32, borderRadius: 16,
        borderWidth: 1, justifyContent: 'center', alignItems: 'center',
    },
    selectedBadgeText: { fontSize: 14, fontWeight: 'bold' },
    dlButton: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333',
        justifyContent: 'center', alignItems: 'center',
    },
    dlButtonText: { color: '#AAA', fontSize: 18 },
    selectButton: {
        paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: 8, borderWidth: 1,
    },
    selectButtonText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5 },
    deleteModelButton: {
        width: 30, height: 30, justifyContent: 'center', alignItems: 'center',
    },
    deleteModelText: { fontSize: 14, opacity: 0.5 },
    progressRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
    },
    progressTrack: {
        flex: 1, height: 3, backgroundColor: '#1A1A1A', borderRadius: 2, overflow: 'hidden',
    },
    progressFill: { height: 3, borderRadius: 2 },
    progressText: { fontSize: 10, fontFamily: MONO, minWidth: 32 },
    pickerButton: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#111',
        borderRadius: 16, padding: 16, borderWidth: 1,
        justifyContent: 'space-between', marginTop: 4,
    },
    pickerButtonText: {
        flex: 1, marginHorizontal: 12,
        fontFamily: MONO,
        fontSize: 12, letterSpacing: 2, fontWeight: 'bold',
    },
    themeColor: { width: 12, height: 12, borderRadius: 6 },
    threadRow: { flexDirection: 'row', justifyContent: 'space-between' },
    threadRowWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
    threadButton: {
        flex: 1, height: 50, marginHorizontal: 4, borderRadius: 12,
        backgroundColor: '#111', justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: '#222', minWidth: 40, marginBottom: 8,
    },
    threadText: { fontSize: 16, fontWeight: 'bold' },
    hint: {
        color: '#666', fontSize: 10, marginTop: 12, lineHeight: 15,
        fontFamily: MONO,
    },
    saveButton: { borderRadius: 30, padding: 16, alignItems: 'center', marginTop: 24 },
    saveText: { fontSize: 14, fontWeight: 'bold', letterSpacing: 2, textTransform: 'uppercase' },
    fullPickerContainer: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
    pickerHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', paddingHorizontal: 24, marginBottom: 30,
    },
    pickerTitle: { fontSize: 12, letterSpacing: 4, fontWeight: 'bold' },
    fullThemeGrid: { justifyContent: 'space-between', paddingHorizontal: PAD, paddingBottom: 40 },
    fullThemeCell: {
        width: CELL_W, height: Math.floor(CELL_W * 1.2), borderRadius: 24,
        marginBottom: GAP, borderWidth: 1, borderColor: '#111', overflow: 'hidden',
    },
    variantCell: {
        width: '48%', height: 160, borderRadius: 24, marginBottom: 10,
        borderWidth: 1, borderColor: '#111', overflow: 'hidden', alignItems: 'center',
    },
    cellVisual: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
    cellBar: { width: '100%', paddingVertical: 15, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    themeName: { fontSize: 9, letterSpacing: 2, fontWeight: '600' },
    backButton: { padding: 24, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#222', marginTop: 20 },
});

const COLLECTIONS = [
    { name: 'GUARDIAN KITSUNE', bg: '#080600', accent: '#FF6600', Component: INTERFACES[0].Component, variant: 'classic' as Variant, species: 'fox' as Species },
    { name: 'ORIGAMI SPANIEL', bg: '#080810', accent: '#00CCFF', Component: INTERFACES[4].Component, variant: 'classic' as Variant, species: 'spaniel' as Species },
    { name: 'THE VOID', bg: '#000', accent: '#666', Component: INTERFACES[8].Component, variant: 'classic' as Variant, species: undefined as any },
    { name: 'KINETIC GRID', bg: '#000', accent: '#00EEFF', Component: INTERFACES[12].Component, variant: 'classic' as Variant, species: undefined as any },
    { name: 'PRISM BARS', bg: '#000', accent: '#FFF', Component: INTERFACES[16].Component, variant: 'classic' as Variant, species: undefined as any },
    { name: 'CHRONOS', bg: '#000', accent: '#FFD700', Component: INTERFACES[20].Component, variant: 'classic' as Variant, species: undefined as any },
    { name: 'JELLYFISH', bg: '#000', accent: '#00FFAA', Component: INTERFACES[24].Component, variant: 'classic' as Variant, species: undefined as any },
    { name: 'NEBULA', bg: '#000', accent: '#6600FF', Component: INTERFACES[28].Component, variant: 'classic' as Variant, species: undefined as any },
];

const COLL_VARIANTS = Array(8).fill(0).map((_, i) => [
    { ...INTERFACES[i * 4], realIdx: i * 4 },
    { ...INTERFACES[i * 4 + 1], realIdx: i * 4 + 1 },
    { ...INTERFACES[i * 4 + 2], realIdx: i * 4 + 2 },
    { ...INTERFACES[i * 4 + 3], realIdx: i * 4 + 3 },
]);