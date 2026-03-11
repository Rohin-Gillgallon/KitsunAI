## Android build environment

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

from the `local-ai` directory to build and run the Android app.

