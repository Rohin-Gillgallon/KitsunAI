import { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, Modal, ScrollView, Dimensions
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Settings } from '../store/settings';

const SCREEN_WIDTH = Dimensions.get('window').width;

type Props = {
    visible: boolean;
    onClose: () => void;
};

export function SettingsModal({ visible, onClose }: Props) {
    const [systemPrompt, setSystemPrompt] = useState(Settings.getSystemPrompt());
    const [voiceSpeed, setVoiceSpeed] = useState(Settings.getVoiceSpeed());
    const [threadCount, setThreadCount] = useState(Settings.getThreadCount());

    function save() {
        Settings.setSystemPrompt(systemPrompt);
        Settings.setVoiceSpeed(voiceSpeed);
        Settings.setThreadCount(threadCount);
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
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Settings</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

                        {/* System Prompt */}
                        <Text style={styles.label}>System Prompt</Text>
                        <TextInput
                            style={styles.textArea}
                            value={systemPrompt}
                            onChangeText={setSystemPrompt}
                            multiline
                            numberOfLines={5}
                            placeholderTextColor="#666"
                            placeholder="Enter system prompt..."
                        />

                        {/* Voice Speed */}
                        <Text style={styles.label}>
                            Voice Speed: {voiceSpeed.toFixed(1)}x
                        </Text>
                        <Slider
                            style={{ width: '100%', height: 40 }}
                            minimumValue={0.5}
                            maximumValue={2.0}
                            step={0.1}
                            value={voiceSpeed}
                            onValueChange={setVoiceSpeed}
                            minimumTrackTintColor="#2E75B6"
                            maximumTrackTintColor="#444"
                            thumbTintColor="#2E75B6"
                        />
                        <View style={styles.sliderLabels}>
                            <Text style={styles.sliderLabel}>0.5x</Text>
                            <Text style={styles.sliderLabel}>2.0x</Text>
                        </View>

                        {/* Thread Count */}
                        <Text style={styles.label}>CPU Threads</Text>
                        <View style={styles.threadRow}>
                            {[1, 2, 4, 6, 8].map(t => (
                                <TouchableOpacity
                                    key={t}
                                    style={[styles.threadButton, threadCount === t && styles.threadButtonActive]}
                                    onPress={() => setThreadCount(t)}
                                >
                                    <Text style={[styles.threadText, threadCount === t && styles.threadTextActive]}>
                                        {t}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={styles.hint}>
                            Higher = faster responses but more CPU usage. Restart app after changing.
                        </Text>

                        {/* Save */}
                        <TouchableOpacity style={styles.saveButton} onPress={save}>
                            <Text style={styles.saveText}>Save</Text>
                        </TouchableOpacity>

                        <View style={{ height: 32 }} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#1a1a1a',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '85%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    title: {
        color: '#fff',
        fontSize: 18,
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
    content: {
        padding: 20,
    },
    label: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 8,
        marginTop: 20,
    },
    textArea: {
        backgroundColor: '#222',
        color: '#fff',
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        lineHeight: 20,
        minHeight: 120,
        textAlignVertical: 'top',
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: -8,
    },
    sliderLabel: {
        color: '#666',
        fontSize: 12,
    },
    threadRow: {
        flexDirection: 'row',
        gap: 8,
    },
    threadButton: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#222',
        justifyContent: 'center',
        alignItems: 'center',
    },
    threadButtonActive: {
        backgroundColor: '#2E75B6',
    },
    threadText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '600',
    },
    threadTextActive: {
        color: '#fff',
    },
    hint: {
        color: '#555',
        fontSize: 12,
        marginTop: 8,
        lineHeight: 18,
    },
    saveButton: {
        backgroundColor: '#2E75B6',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 28,
    },
    saveText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});