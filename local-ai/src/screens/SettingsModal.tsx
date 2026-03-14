import { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, Modal, ScrollView, Dimensions, Platform,
    FlatList
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Settings, useTheme } from '../store/settings';

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

export function SettingsModal({ visible, onClose }: Props) {
    const globalThemeIdx = useTheme();
    const [systemPrompt, setSystemPrompt] = useState(Settings.getSystemPrompt());
    const [voiceSpeed, setVoiceSpeed] = useState(Settings.getVoiceSpeed());
    const [threadCount, setThreadCount] = useState(Settings.getThreadCount());
    const [themeIdx, setThemeIdx] = useState(globalThemeIdx);
    const [showInterfacePicker, setShowInterfacePicker] = useState(false);
    const [pickerView, setPickerView] = useState<'collections' | 'variants'>('collections');
    const [selectedCollection, setSelectedCollection] = useState<number | null>(null);
    
    useEffect(() => {
        setThemeIdx(globalThemeIdx);
    }, [globalThemeIdx]);
    
    const dummyVolume = useSharedValue(0);

    const activeAccent = (INTERFACES[themeIdx] || INTERFACES[0]).accent || '#FFFFFF';

    function save() {
        Settings.setSystemPrompt(systemPrompt);
        Settings.setVoiceSpeed(voiceSpeed);
        Settings.setThreadCount(threadCount);
        Settings.setThemeIndex(themeIdx);
        onClose();
    }

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.sheet, { borderTopColor: activeAccent, borderTopWidth: 2 }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: activeAccent, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier' }]}>FOX AI CONFIG</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
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

                        <Text style={styles.label}>
                            Voice Speed: {voiceSpeed.toFixed(1)}x
                        </Text>
                        <Slider
                            style={{ width: '100%', height: 36 }}
                            minimumValue={0.5}
                            maximumValue={2.0}
                            step={0.1}
                            value={voiceSpeed}
                            onValueChange={setVoiceSpeed}
                            minimumTrackTintColor={activeAccent}
                            maximumTrackTintColor="#444"
                            thumbTintColor={activeAccent}
                        />
                        <View style={styles.sliderLabels}>
                            <Text style={styles.sliderLabel}>0.5x</Text>
                            <Text style={styles.sliderLabel}>2.0x</Text>
                        </View>

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

                        <Text style={styles.label}>CPU Threads</Text>
                        <View style={threadCount >= 8 ? styles.threadRowWrap : styles.threadRow}>
                            {[1, 2, 4, 6, 8].map(t => (
                                <TouchableOpacity
                                    key={t}
                                    style={[
                                        styles.threadButton,
                                        threadCount === t && { backgroundColor: activeAccent }
                                    ]}
                                    onPress={() => setThreadCount(t)}
                                >
                                    <Text style={[
                                        styles.threadText,
                                        threadCount === t ? { color: '#000' } : { color: '#999' }
                                    ]}>
                                        {t}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={styles.hint}>
                            Higher = faster responses but more CPU usage.
                        </Text>

                        <TouchableOpacity style={[styles.saveButton, { backgroundColor: activeAccent }]} onPress={save}>
                            <Text style={[styles.saveText, { color: '#000' }]}>Save Configuration</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <Modal visible={showInterfacePicker} transparent={false} animationType="slide">
                    <View style={styles.fullPickerContainer}>
                        <View style={styles.pickerHeader}>
                            <Text style={[styles.pickerTitle, { color: activeAccent, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier' }]}>SELECT_INTERFACE</Text>
                            <TouchableOpacity onPress={() => setShowInterfacePicker(false)} style={styles.closeButton}>
                                <Text style={styles.closeText}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <FlatList
                            key={pickerView}
                            data={(pickerView === 'collections' ? COLLECTIONS : COLL_VARIANTS[selectedCollection ?? 0]) as any[]}
                            numColumns={pickerView === 'collections' ? 2 : 2}
                            keyExtractor={(item, index) => index.toString()}
                            contentContainerStyle={styles.fullThemeGrid}
                            renderItem={({ item, index }) => {
                                const isColl = pickerView === 'collections';
                                return (
                                    <TouchableOpacity
                                        style={[
                                            isColl ? styles.fullThemeCell : styles.variantCell,
                                            { backgroundColor: item.bg },
                                            !isColl && themeIdx === item.realIdx && { borderColor: activeAccent, borderWidth: 2 }
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
                                            <Text style={[
                                                styles.themeName,
                                                { color: item.accent, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier' }
                                            ]}>{isColl ? item.name : item.variantName}</Text>
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
        maxHeight: '90%',
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
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#111',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeText: {
        color: '#fff',
        fontSize: 14,
    },
    content: {
        padding: 24,
    },
    label: {
        color: '#BBB',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 2,
        marginBottom: 6,
        marginTop: 18,
        textTransform: 'uppercase',
    },
    textArea: {
        backgroundColor: '#111',
        color: '#fff',
        borderRadius: 16,
        padding: 12,
        fontSize: 14,
        lineHeight: 20,
        minHeight: 60,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: '#222',
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: -8,
    },
    sliderLabel: {
        color: '#888',
        fontSize: 10,
        fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    },
    threadRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    threadRowWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
    },
    threadButton: {
        flex: 1,
        height: 50,
        marginHorizontal: 4,
        borderRadius: 12,
        backgroundColor: '#111',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#222',
        minWidth: 40,
        marginBottom: 8,
    },
    threadText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    hint: {
        color: '#666',
        fontSize: 10,
        marginTop: 12,
        lineHeight: 15,
        fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    },
    saveButton: {
        borderRadius: 30,
        padding: 16,
        alignItems: 'center',
        marginTop: 24,
    },
    saveText: {
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    fullPickerContainer: {
        flex: 1,
        backgroundColor: '#000',
        paddingTop: 60,
    },
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 30,
    },
    fullThemeGrid: {
        justifyContent: 'space-between',
        paddingHorizontal: PAD,
        paddingBottom: 40,
    },
    fullThemeCell: {
        width: CELL_W,
        height: Math.floor(CELL_W * 1.2),
        borderRadius: 24,
        marginBottom: GAP,
        borderWidth: 1,
        borderColor: '#111',
        overflow: 'hidden',
    },
    cellVisual: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
    },
    cellBar: {
        width: '100%',
        paddingVertical: 15,
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    themeName: {
        fontSize: 9,
        letterSpacing: 2,
        fontWeight: '600',
    },
    ind: {
        width: 10,
        height: 1,
        marginTop: 6,
        opacity: 0.5,
    },
    pickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        justifyContent: 'space-between',
        marginTop: 4,
    },
    pickerButtonText: {
        flex: 1,
        marginHorizontal: 12,
        fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
        fontSize: 12,
        letterSpacing: 2,
        fontWeight: 'bold',
    },
    themeColor: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    pickerTitle: {
        fontSize: 12,
        letterSpacing: 4,
        fontWeight: 'bold',
    },
    variantCell: {
        width: '48%',
        height: 160,
        borderRadius: 24,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#111',
        overflow: 'hidden',
        alignItems: 'center',
    },
    backButton: {
        padding: 24,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#222',
        marginTop: 20,
    }
});

const COLLECTIONS = [
    { name: 'GUARDIAN FOX', bg: '#080600', accent: '#FF6600', Component: INTERFACES[0].Component, variant: 'classic' as Variant, species: 'fox' as Species },
    { name: 'ORIGAMI SPANIEL', bg: '#080810', accent: '#00CCFF', Component: INTERFACES[4].Component, variant: 'classic' as Variant, species: 'spaniel' as Species },
    { name: 'THE VOID', bg: '#000', accent: '#666', Component: INTERFACES[8].Component, variant: 'classic' as Variant, species: undefined as any },
    { name: 'KINETIC GRID', bg: '#000', accent: '#00EEFF', Component: INTERFACES[12].Component, variant: 'classic' as Variant, species: undefined as any },
    { name: 'PRISM BARS', bg: '#000', accent: '#FFF', Component: INTERFACES[16].Component, variant: 'classic' as Variant, species: undefined as any },
    { name: 'CHRONOS', bg: '#000', accent: '#FFD700', Component: INTERFACES[20].Component, variant: 'classic' as Variant, species: undefined as any },
    { name: 'JELLYFISH', bg: '#000', accent: '#00FFAA', Component: INTERFACES[24].Component, variant: 'classic' as Variant, species: undefined as any },
    { name: 'NEBULA', bg: '#000', accent: '#6600FF', Component: INTERFACES[28].Component, variant: 'classic' as Variant, species: undefined as any },
];

const COLL_VARIANTS = Array(8).fill(0).map((_, i) => [
    { ...INTERFACES[i*4], realIdx: i*4 },
    { ...INTERFACES[i*4+1], realIdx: i*4+1 },
    { ...INTERFACES[i*4+2], realIdx: i*4+2 },
    { ...INTERFACES[i*4+3], realIdx: i*4+3 },
]);