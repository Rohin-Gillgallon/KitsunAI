# KitsunAI

KitsunAI is a local, private AI assistant featuring a 3D animated companion. It allows you to run Large Language Models (LLMs) directly on your device, ensuring your conversations stay private and secure.

## Supported Models

KitsunAI supports multiple models that can be downloaded and switched between in the app's settings. All models are Q5_K_L quantised (Q8_0 embed/output weights) for the best quality-to-size ratio on mobile.

| Model | Size | Speed | Best for |
|---|---|---|---|
| Gemma 3 1B | 0.85GB | ⚡ Fastest | Voice mode, quick responses |
| Llama 3.2 3B | 2.42GB | ⚡ Fast | General use, edge-optimised |
| Qwen 2.5 3B | 2.30GB | ⚡ Fast | Reasoning, instruction following |
| Phi-4 Mini | 3.00GB | ◎ Medium | Math, logic, coding |
| Gemma 3 4B | 2.99GB | ◎ Medium | Best overall quality |
| Qwen 3 4B | 2.98GB | ◎ Medium | Latest benchmarks, top reasoning |

Try the default model on first install is **Gemma 3 1B**. All models are sourced from [bartowski on Hugging Face](https://huggingface.co/bartowski) and run entirely on-device with no internet required after download.

## Warnings

> **⚠️ EPILEPSY WARNING ⚠️**
> This application includes visualiser interfaces that react to audio. While previous strobing issues during chat interactions have been patched, please be aware that certain visualiser themes or audio patterns may still produce rapid flashing lights. Users with photosensitive epilepsy or other light sensitivities should use caution.

## Features

- **Local AI**: Run LLMs locally on your Android device for maximum privacy.
- **3D Companion**: Interactive animated fox companion that reacts to your voice and responses.
- **Visualiser Themes**: Multiple distinct visualiser interfaces (e.g., Guardian Kitsune, Origami Spaniel, Kinetic Grid) to match your style.
- **Voice Interaction**: Integrated speech-to-text and text-to-speech for seamless voice conversations, with support for custom system voices.
- **Model Management**: Download, switch, and delete models directly from the settings screen.
- **Customisable**: Adjust voice speed, system prompt, CPU threads, context size, and batch size.
- **Conversation History**: Persistent chat history with the ability to create, switch, and delete conversations.

## Tech Stack

- **Framework**: [Expo](https://expo.dev/) / React Native
- **AI Engine**: [llama.rn](https://github.com/Kudo/llama.rn) (local inference via llama.cpp)
- **3D Graphics**: [Three.js](https://threejs.org/) / [expo-three](https://github.com/expo/expo-three) / [expo-gl](https://docs.expo.dev/versions/latest/sdk/gl-view/)
- **UI & Animations**: [Reanimated](https://docs.swmansion.com/react-native-reanimated/)
- **Database**: [Drizzle ORM](https://orm.drizzle.team/) with [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- **Storage**: [react-native-mmkv](https://github.com/mrousavy/mmkv) for settings and preferences
- **Voice Input**: [expo-speech-recognition](https://github.com/jamsch/expo-speech-recognition)
- **Voice Output**: [expo-speech](https://docs.expo.dev/versions/latest/sdk/speech/)

## Credits & Attribution

**Fox 3D Model**
Fox v2 by Jake Blakeley [CC-BY] (https://creativecommons.org/licenses/by/3.0/) via Poly Pizza (https://poly.pizza/m/0-NaVqxdfRu)

## Android Build Environment

- **Gradle version**: The Android project is configured to use **Gradle 8.13** via `android/gradle/wrapper/gradle-wrapper.properties`, which matches the minimum supported version required by the Android Gradle Plugin in this Expo/React Native template.
- **JDK requirement**: Use a **standard JDK (not GraalVM)** for Android builds, for example **Eclipse Temurin JDK 17 or 21 (LTS)**.
  - Set `JAVA_HOME` to the install directory of that JDK (e.g. `C:\Program Files\Eclipse Adoptium\jdk-17.x.y_z`).
  - Ensure `%JAVA_HOME%\bin` is near the front of your `PATH` so Gradle and `pnpm expo run:android` pick it up.
- **Why this is required**:
  - Gradle 9 removed the `IBM_SEMERU` vendor constant, which caused the original error: `Class org.gradle.jvm.toolchain.JvmVendorSpec does not have member field 'org.gradle.jvm.toolchain.JvmVendorSpec IBM_SEMERU'`.
  - The wrapper now uses Gradle 8.13, which is compatible with the Android Gradle Plugin and avoids that error.
  - Using GraalVM as the JDK causes `jlink` failures during `:llama.rn:compileDebugJavaWithJavac` (Gradle tries to transform `core-for-system-modules.jar` with `graalvm-23\bin\jlink.exe`). Switching to a standard JDK resolves this.

Once a standard JDK is installed and `JAVA_HOME`/`PATH` are updated, run:
```bash
pnpm expo run:android
```

from the `kitsunai` directory to build and run the Android app. Append `--variant release` for a production build.