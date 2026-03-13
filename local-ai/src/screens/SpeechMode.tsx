import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    Dimensions, Modal, ScrollView, Platform
} from 'react-native';
import {
    Canvas, Circle, Group, Line, vec, BlurMask,
    DashPathEffect, RoundedRect, Oval
} from '@shopify/react-native-skia';
import Animated, {
    useSharedValue, withRepeat, withTiming, withSpring,
    useDerivedValue, Easing, useAnimatedStyle, runOnJS, SharedValue
} from 'react-native-reanimated';

import { ChatScreen } from './ChatScreen'; // No curly braces for default exports
const { width: W, height: H } = Dimensions.get('window');
const PAD = 14;
const GAP = 10;
const CELL_W = Math.floor((W - PAD * 2 - GAP) / 2);
const CELL_H = Math.floor(CELL_W * 1.25);
const FS_SZ = Math.min(W * 0.85, H * 0.45);
const MONO = Platform.OS === 'android' ? 'monospace' : 'Courier';

export type Mode = 'idle' | 'listening' | 'speaking';

type Props = {
    visible: boolean;
    listening: boolean;
    speaking: boolean;
    volume: SharedValue<number>; // New Prop
    onClose: () => void;
    onMicPress: () => void;
    onOpenSpeech?: () => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// VISUALIZERS
// ─────────────────────────────────────────────────────────────────────────────

const CompanionDog = ({ mode, sz, volume }: { mode: Mode; sz: number; volume: SharedValue<number> }) => {
    const sc = sz / 200;
    const cx = sz / 2;
    const cy = sz / 2;

    const earTilt = useSharedValue(0);
    const breathe = useSharedValue(0);

    useEffect(() => {
        // Constant gentle breathing
        breathe.value = withRepeat(withTiming(1, { duration: 2000 }), -1, true);

        // Ears perk up when listening
        earTilt.value = mode === 'listening' ? withSpring(-0.2) : withSpring(0);
    }, [mode]);

    // 1. DYNAMIC MOUTH: Height reacts directly to audio volume
    const mouthHeight = useDerivedValue(() => {
        // If idle, keep mouth closed (2px line). 
        // If speaking/listening, scale height based on volume (max 25px)
        if (mode === 'idle') return 2 * sc;
        return (volume.value * 25 * sc) + (2 * sc);
    });

    // 2. WIDE EYES: Eyes dilate slightly when "excited" by sound
    const eyeSize = useDerivedValue(() => {
        const base = mode === 'listening' ? 6 : 4;
        return (base * sc) + (volume.value * 3 * sc);
    });

    return (
        <Canvas style={{ width: sz, height: sz }}>
            {/* Main Body Group - breathes slightly */}
            <Group origin={vec(cx, cy)} transform={useDerivedValue(() => [{ scale: 1 + (breathe.value * 0.02) }])}>

                {/* Floppy Ears */}
                <Group origin={vec(cx - 30 * sc, cy - 20 * sc)} transform={useDerivedValue(() => [{ rotate: earTilt.value }])}>
                    <Oval x={cx - 55 * sc} y={cy - 60 * sc} width={30 * sc} height={60 * sc} color="#8D5524" />
                </Group>
                <Group origin={vec(cx + 30 * sc, cy - 20 * sc)} transform={useDerivedValue(() => [{ rotate: -earTilt.value }])}>
                    <Oval x={cx + 25 * sc} y={cy - 60 * sc} width={30 * sc} height={60 * sc} color="#8D5524" />
                </Group>

                {/* Face Shape */}
                <Circle cx={cx} cy={cy} r={50 * sc} color="#C68642" />

                {/* Eyes - size reacts to sound */}
                <Circle cx={cx - 18 * sc} cy={cy - 5 * sc} r={eyeSize} color="#222" />
                <Circle cx={cx + 18 * sc} cy={cy - 5 * sc} r={eyeSize} color="#222" />

                {/* Snout Area */}
                <Oval x={cx - 20 * sc} y={cy + 10 * sc} width={40 * sc} height={30 * sc} color="#E0AC69" />
                <Circle cx={cx} cy={cy + 15 * sc} r={7 * sc} color="#000" />

                {/* NEW: Reactive Mouth */}
                <Group origin={vec(cx, cy + 25 * sc)}>
                    <Oval
                        x={cx - 10 * sc}
                        y={cy + 25 * sc}
                        width={20 * sc}
                        height={mouthHeight}
                        color="#331a00"
                    />
                </Group>
            </Group>
        </Canvas>
    );
};

const JarvisHUD = ({ mode, sz, volume }: { mode: Mode; sz: number; volume: SharedValue<number> }) => {
    const cx = sz / 2;
    const rot = useSharedValue(0);

    useEffect(() => {
        rot.value = withRepeat(
            withTiming(Math.PI * 2, { duration: 4000, easing: Easing.linear }),
            -1
        );
    }, []);

    const color = mode === 'speaking' ? '#FF4444' : '#00D4FF';

    // 1. DYNAMIC SCALE: The ring expands when audio is louder
    const ringScale = useDerivedValue(() => {
        return 1 + (volume.value * 0.15); // Expands up to 115%
    });

    // 2. STROKE THICKNESS: The dash line gets "heavier" with volume
    const strokeW = useDerivedValue(() => {
        return 5 + (volume.value * 10); // Thicken from 5 to 15
    });

    // 3. GLOW INTENSITY: The blur gets stronger when speaking
    const blurAmount = useDerivedValue(() => {
        return 5 + (volume.value * 15);
    });

    return (
        <Canvas style={{ width: sz, height: sz }}>
            <Group
                origin={vec(cx, cx)}
                transform={useDerivedValue(() => [
                    { rotate: rot.value },
                    { scale: ringScale.value }
                ])}
            >
                {/* Outer HUD Ring */}
                <Circle
                    cx={cx}
                    cy={cx}
                    r={sz * 0.3}
                    style="stroke"
                    strokeWidth={strokeW}
                    color={color}
                >
                    <DashPathEffect intervals={[5, 15]} />
                    {/* The glow pulses with the volume */}
                    <BlurMask blur={blurAmount} style="outer" />
                </Circle>
            </Group>

            {/* Central Power Core */}
            <Circle cx={cx} cy={cx} r={6} color={color}>
                <BlurMask blur={blurAmount} style="normal" />
            </Circle>

            {/* Subtle inner ring that only appears when sound is detected */}
            <Circle
                cx={cx}
                cy={cx}
                r={useDerivedValue(() => sz * 0.15 * volume.value)}
                style="stroke"
                strokeWidth={1}
                color={color}
                opacity={0.5}
            />
        </Canvas>
    );
};

const PlasmaOrb = ({ mode, sz, volume }: { mode: Mode; sz: number; volume: SharedValue<number> }) => {
    const cx = sz / 2;
    const pulse = useSharedValue(0);

    useEffect(() => {
        // Keeps a baseline "heartbeat" even when silent
        pulse.value = withRepeat(
            withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
            -1,
            true
        );
    }, []);

    const color = mode === 'speaking' ? '#FF3030' : '#00FFB2';

    // 1. DYNAMIC RADIUS: The orb "explodes" outward with volume
    const dynamicRadius = useDerivedValue(() => {
        const base = sz * 0.25;
        const idlePulse = pulse.value * 10;
        const audioFlare = volume.value * (sz * 0.2); // Expands significantly with sound
        return base + idlePulse + audioFlare;
    });

    // 2. CORE OPACITY: The center gets brighter/more solid when talking
    const coreOpacity = useDerivedValue(() => {
        return 0.6 + (volume.value * 0.4); // Goes from 0.6 to 1.0
    });

    // 3. BLUR INTENSITY: The "plasma" looks more volatile with sound
    const blurAmount = useDerivedValue(() => {
        return 20 + (volume.value * 30);
    });

    return (
        <Canvas style={{ width: sz, height: sz }}>
            {/* The "Aura" - Large, soft glow that reacts heavily to volume */}
            <Circle
                cx={cx}
                cy={cx}
                r={dynamicRadius}
                color={color}
            >
                <BlurMask blur={blurAmount} style="normal" />
            </Circle>

            {/* The "Core" - Sharper center that gets solid when speaking */}
            <Circle
                cx={cx}
                cy={cx}
                r={sz * 0.18}
                color={color}
                opacity={coreOpacity}
            />

            {/* Optional: Add a white center for a "hot" energy look during loud sounds */}
            <Circle
                cx={cx}
                cy={cx}
                r={useDerivedValue(() => sz * 0.05 * volume.value)}
                color="#FFF"
                opacity={0.8}
            >
                <BlurMask blur={5} style="normal" />
            </Circle>
        </Canvas>
    );
};

const SignalWave = ({ mode, sz, volume }: { mode: Mode; sz: number; volume: SharedValue<number> }) => {
    const cx = sz / 2;
    const color = mode === 'listening' ? '#00FF41' : mode === 'speaking' ? '#00D4FF' : '#444';

    // Helper to create a unique reactive height for each bar
    const Bar = ({ index }: { index: number }) => {
        // We calculate an offset so the bars aren't all the same height
        // Middle bar (index 2) reacts 100%, outer bars react about 60%
        const sensitivity = 1 - (Math.abs(2 - index) * 0.2);

        const barHeight = useDerivedValue(() => {
            const base = 10 * (sz / 200); // Minimum height
            const activeHeight = volume.value * 80 * (sz / 200) * sensitivity;
            return base + activeHeight;
        });

        const yPos = useDerivedValue(() => cx - (barHeight.value / 2));

        return (
            <RoundedRect
                x={cx - 50 + index * 20}
                y={yPos}
                width={12}
                height={barHeight}
                r={6}
                color={color}
            >
                {/* Add a little glow to the active bars */}
                {mode !== 'idle' && <BlurMask blur={3} style="solid" />}
            </RoundedRect>
        );
    };

    return (
        <Canvas style={{ width: sz, height: sz }}>
            {[0, 1, 2, 3, 4].map((i) => (
                <Bar key={i} index={i} />
            ))}
        </Canvas>
    );
};

const NovaBurst = ({ mode, sz, volume }: { mode: Mode; sz: number; volume: SharedValue<number> }) => {
    const cx = sz / 2;
    const p = useSharedValue(0);

    useEffect(() => {
        // The background "heartbeat" expansion
        p.value = withRepeat(
            withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }),
            -1
        );
    }, []);

    // 1. REACTIVE SCALE: The burst gets much larger when volume is high
    const combinedScale = useDerivedValue(() => {
        const basePulse = p.value * 0.5; // The idle animation
        const audioFlare = volume.value * 1.5; // The explosion based on sound
        return basePulse + audioFlare;
    });

    // 2. STROKE WIDTH: The ring gets thicker/bolder with sound
    const strokeW = useDerivedValue(() => {
        return 1 + (volume.value * 8);
    });

    // 3. OPACITY: Fades out as it expands, but gets brighter with volume
    const opacity = useDerivedValue(() => {
        const fade = 1 - p.value;
        const flash = volume.value * 0.5;
        return Math.min(fade + flash, 1);
    });

    return (
        <Canvas style={{ width: sz, height: sz }}>
            <Group origin={vec(cx, cx)} transform={useDerivedValue(() => [{ scale: combinedScale.value }])}>
                <Circle
                    cx={cx}
                    cy={cx}
                    r={sz * 0.4}
                    style="stroke"
                    strokeWidth={strokeW}
                    color="#FFB700"
                    opacity={opacity}
                >
                    {/* Add a glow that only triggers on loud sounds */}
                    <BlurMask blur={useDerivedValue(() => volume.value * 15)} style="outer" />
                </Circle>
            </Group>

            {/* A small static center core that pulses with volume */}
            <Circle
                cx={cx}
                cy={cx}
                r={useDerivedValue(() => 4 + (volume.value * 10))}
                color="#FFB700"
            />
        </Canvas>
    );
};

const SynapticMind = ({ mode, sz, volume }: { mode: Mode; sz: number; volume: SharedValue<number> }) => {
    const cx = sz / 2;
    const color = "#7C3AED"; // Deep purple/violet

    // 1. DYNAMIC NUCLEUS: The center point grows and "jitters" with sound
    const coreRadius = useDerivedValue(() => {
        return (sz * 0.05) + (volume.value * 20);
    });

    // 2. SYNAPTIC GLOW: The outer ring gets a "charge" when talking
    const outerOpacity = useDerivedValue(() => {
        return 0.3 + (volume.value * 0.7);
    });

    const blurIntensity = useDerivedValue(() => {
        return volume.value * 15;
    });

    return (
        <Canvas style={{ width: sz, height: sz }}>
            {/* Outer Neural Boundary */}
            <Circle
                cx={cx}
                cy={cx}
                r={sz * 0.3}
                style="stroke"
                strokeWidth={1}
                color={color}
                opacity={outerOpacity}
            >
                {/* Glow that appears only when sound is detected */}
                <BlurMask blur={blurIntensity} style="outer" />
            </Circle>

            {/* Faint secondary ring for complexity */}
            <Circle
                cx={cx}
                cy={cx}
                r={useDerivedValue(() => sz * 0.35 + (volume.value * 10))}
                style="stroke"
                strokeWidth={0.5}
                color={color}
                opacity={useDerivedValue(() => volume.value * 0.5)}
            />

            {/* The Central Firing Nucleus */}
            <Circle
                cx={cx}
                cy={cx}
                r={coreRadius}
                color={color}
            >
                <BlurMask blur={useDerivedValue(() => 5 + volume.value * 10)} style="normal" />
            </Circle>
        </Canvas>
    );
};

const INTERFACES = [
    { name: 'COMPANION', bg: '#120D08', accent: '#C68642', Component: CompanionDog },
    { name: 'J.A.R.V.I.S', bg: '#000508', accent: '#00BFFF', Component: JarvisHUD },
    { name: 'PLASMA', bg: '#0A0015', accent: '#FF3030', Component: PlasmaOrb },
    { name: 'SIGNAL', bg: '#050A05', accent: '#00FF41', Component: SignalWave },
    { name: 'NOVA', bg: '#0D0800', accent: '#FFB700', Component: NovaBurst },
    { name: 'NEURAL', bg: '#06040F', accent: '#7C3AED', Component: SynapticMind },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function SpeechMode({ visible, listening, speaking, volume, onClose, onMicPress }: Props) {
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const transition = useSharedValue(0);
    const mode: Mode = speaking ? 'speaking' : listening ? 'listening' : 'idle';

    const selectInterface = (idx: number) => {
        setSelectedIdx(idx);
        transition.value = withSpring(1, { damping: 15 });
    };

    const backToGrid = () => {
        transition.value = withTiming(0, { duration: 300 }, (finished) => {
            if (finished) { 'worklet'; runOnJS(setSelectedIdx)(null); }
        });
    };

    const gridStyle = useAnimatedStyle(() => ({
        opacity: 1 - transition.value,
        transform: [{ scale: 1 - (transition.value * 0.1) }],
        display: transition.value > 0.99 ? 'none' : 'flex'
    }));

    const fullStyle = useAnimatedStyle(() => ({
        opacity: transition.value,
        transform: [{ scale: 0.9 + (transition.value * 0.1) }],
    }));

    const selected = selectedIdx !== null ? INTERFACES[selectedIdx] : null;

    return (
        <Modal visible={visible} animationType="none" transparent={false} onRequestClose={onClose}>
            <View style={[styles.root, { backgroundColor: selected?.bg ?? '#080808' }]}>
                <Animated.View style={[styles.abs, gridStyle]}>
                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        <Text style={styles.gridTitle}>VOICE INTERFACES</Text>
                        <View style={styles.gridWrap}>
                            {INTERFACES.map((iface, idx) => (
                                <TouchableOpacity key={idx} style={[styles.cell, { backgroundColor: iface.bg }]} onPress={() => selectInterface(idx)}>
                                    <iface.Component mode={mode} sz={CELL_W} volume={volume} />
                                    <View style={styles.cellBar}><Text style={[styles.cellName, { color: iface.accent }]}>{iface.name}</Text></View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                </Animated.View>
                {selectedIdx !== null && (
                    <Animated.View style={[styles.fullScreen, fullStyle]}>
                        {selected && <selected.Component mode={mode} sz={FS_SZ} volume={volume} />}
                        <View style={styles.controls}>
                            <TouchableOpacity style={[styles.micBtn, { borderColor: selected?.accent }]} onPress={onMicPress}>
                                <Text style={{ fontSize: 28 }}>{listening ? '⏹' : '🎤'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={backToGrid}><Text style={[styles.backText, { color: selected?.accent }]}>← BACK TO GRID</Text></TouchableOpacity>
                        </View>
                    </Animated.View>
                )}
                <TouchableOpacity style={styles.closeX} onPress={onClose}><Text style={{ color: '#666', fontSize: 20 }}>✕</Text></TouchableOpacity>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    abs: { ...StyleSheet.absoluteFillObject },
    scrollContent: { paddingTop: 80, paddingHorizontal: PAD, paddingBottom: 40 },
    gridTitle: { color: '#444', fontSize: 10, letterSpacing: 4, textAlign: 'center', marginBottom: 30, fontFamily: MONO },
    gridWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    cell: { width: CELL_W, height: CELL_H, borderRadius: 20, marginBottom: GAP, borderWidth: 1, borderColor: '#1A1A1A', overflow: 'hidden' },
    cellBar: { position: 'absolute', bottom: 0, width: '100%', padding: 12, backgroundColor: 'rgba(0,0,0,0.3)' },
    cellName: { fontSize: 9, fontFamily: MONO, letterSpacing: 2 },
    fullScreen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    controls: { alignItems: 'center', marginTop: 50 },
    micBtn: { width: 90, height: 90, borderRadius: 45, borderWidth: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
    backText: { fontFamily: MONO, fontSize: 10, letterSpacing: 2, marginTop: 30 },
    closeX: { position: 'absolute', top: 50, right: 25, zIndex: 10 }
});