// Use the legacy expo-file-system API, which provides documentDirectory and
// the familiar getInfoAsync/createDownloadResumable/deleteAsync helpers.
import * as FileSystem from 'expo-file-system/legacy';

const MODEL_URL =
  'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf' +
  '/resolve/main/Phi-3-mini-4k-instruct-q4.gguf';

export const MODEL_PATH = `${FileSystem.documentDirectory}phi3-mini-q4.gguf`;

/**
 * Ensure the local model file is present in the app's document directory.
 * - Skips download if a non‑empty file already exists.
 * - Reports progress via the optional onProgress callback (0–100).
 * - Cleans up partial files if the download fails.
 */
export async function ensureModelDownloaded(
  onProgress?: (pct: number) => void,
): Promise<void> {
  // TEMPORARY - delete partial file and re-download
  //await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
  //console.log('Deleted existing file, re-downloading...');
  const info = await FileSystem.getInfoAsync(MODEL_PATH);
  //console.log('Model info:', JSON.stringify(info));

  if (info.exists && typeof info.size === 'number' && info.size > 0) {
    //console.log('Model already exists, size:', info.size);
    return;
  }

  console.log('Starting download...');

  const download = FileSystem.createDownloadResumable(
    MODEL_URL,
    MODEL_PATH,
    {},
    (progress) => {
      const { totalBytesExpectedToWrite, totalBytesWritten } = progress;
      if (!totalBytesExpectedToWrite || totalBytesExpectedToWrite <= 0) {
        return;
      }

      const pct = totalBytesWritten / totalBytesExpectedToWrite;
      onProgress?.(Math.round(pct * 100));
    },
  );

  try {
    const result = await download.downloadAsync();

    if (!result) {
      throw new Error('Model download failed: no result returned');
    }

    if (result.status !== 200) {
      throw new Error(`Model download failed with HTTP status ${result.status}`);
    }

    if (!result.uri) {
      throw new Error('Model download failed: no file URI returned');
    }
  } catch (error) {
    // Clean up any partially written file so a future attempt can retry cleanly.
    try {
      await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
    } catch {
      // ignore secondary delete errors
    }
    throw error;
  }
}

