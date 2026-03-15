import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { Settings } from '../store/settings';
import { MODELS, DEFAULT_MODEL_ID } from '../model/models';
import { getModelPath } from '../model/llm';

type Props = {
    onComplete: () => void;
};

export function DownloadScreen({ onComplete }: Props) {
    const [progress, setProgress] = useState(0);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const modelId = Settings.getSelectedModelId() ?? DEFAULT_MODEL_ID;
    const model = MODELS.find(m => m.id === modelId) ?? MODELS.find(m => m.id === DEFAULT_MODEL_ID)!;

    async function startDownload() {
        try {
            setDownloading(true);
            setError(null);
            const dest = getModelPath(model.id);
            const download = FileSystem.createDownloadResumable(
                model.url,
                dest,
                {},
                ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
                    const pct = totalBytesExpectedToWrite > 0
                        ? Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100)
                        : 0;
                    setProgress(pct);
                },
            );
            await download.downloadAsync();
            Settings.setModelIdDownloaded(model.id, true);
            Settings.setModelDownloaded(true);
            onComplete();
        } catch (e) {
            setError('Download failed. Check your connection and try again.');
            setDownloading(false);
        }
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>KitsunAI</Text>
            <Text style={styles.subtitle}>
                The AI model needs to be downloaded once.{'\n'}
                Use Wi-Fi.
            </Text>

            <View style={styles.modelCard}>
                <Text style={styles.modelName}>{model.name}</Text>
                <Text style={styles.modelSize}>{model.sizeGB} GB</Text>
                <Text style={styles.modelDesc}>{model.description}</Text>
            </View>

            <Text style={styles.hint}>
                You can download additional models in Settings after setup.
            </Text>

            {!downloading && !error && (
                <TouchableOpacity style={styles.button} onPress={startDownload}>
                    <Text style={styles.buttonText}>Download Model</Text>
                </TouchableOpacity>
            )}

            {downloading && (
                <View style={styles.progressContainer}>
                    <ActivityIndicator size="large" color="#ffffff" />
                    <Text style={styles.progressText}>{progress}%</Text>
                    <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
                    </View>
                </View>
            )}

            {error && (
                <>
                    <Text style={styles.error}>{error}</Text>
                    <TouchableOpacity style={styles.button} onPress={startDownload}>
                        <Text style={styles.buttonText}>Retry</Text>
                    </TouchableOpacity>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    title: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: '#aaa',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
    },
    modelCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        padding: 20,
        width: '100%',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#2E75B6',
        alignItems: 'center',
        gap: 4,
    },
    modelName: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    modelSize: {
        color: '#2E75B6',
        fontSize: 14,
        fontWeight: '600',
    },
    modelDesc: {
        color: '#888',
        fontSize: 13,
        textAlign: 'center',
    },
    hint: {
        color: '#555',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 18,
    },
    button: {
        backgroundColor: '#2E75B6',
        paddingHorizontal: 40,
        paddingVertical: 16,
        borderRadius: 12,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    progressContainer: {
        alignItems: 'center',
        gap: 16,
        width: '100%',
    },
    progressText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    progressBar: {
        width: '100%',
        height: 8,
        backgroundColor: '#333',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#2E75B6',
        borderRadius: 4,
    },
    error: {
        color: '#ff6b6b',
        textAlign: 'center',
        marginBottom: 24,
        fontSize: 15,
    },
});