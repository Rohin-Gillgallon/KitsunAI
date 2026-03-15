import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { ensureModelDownloaded } from '../model/download';
import { Settings } from '../store/settings';

type Props = {
    onComplete: () => void;
};

export function DownloadScreen({ onComplete }: Props) {
    const [progress, setProgress] = useState(0);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function startDownload() {
        try {
            setDownloading(true);
            setError(null);
            await ensureModelDownloaded((pct) => setProgress(pct));
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
                It is 2.3GB — use Wi-Fi.
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
                        <View style={[styles.progressFill, { width: `${progress}%` }]} />
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
        marginBottom: 40,
        lineHeight: 24,
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