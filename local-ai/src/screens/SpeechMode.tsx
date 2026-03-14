import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    Dimensions, Modal, ScrollView, Platform
} from 'react-native';
import { GLView } from 'expo-gl';
import * as THREE from 'three';
import { Renderer } from 'expo-three';
import {
    Canvas, Circle, Group, Line, vec, BlurMask,
    RoundedRect
} from '@shopify/react-native-skia';
import Animated, {
    useSharedValue, withRepeat, withTiming, withSpring,
    useDerivedValue, Easing, useAnimatedStyle, runOnJS, SharedValue
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');
const PAD = 14;
const GAP = 10;
const CELL_W = Math.floor((W - PAD * 2 - GAP) / 2);
const GRID_H = H - 240; // Accounting for header and padding
const CELL_H = Math.floor(GRID_H / 3);
const FS_SZ = Math.min(W * 0.85, H * 0.45);
const MONO = Platform.OS === 'android' ? 'monospace' : 'Courier';

export type Mode = 'idle' | 'listening' | 'speaking';

type Props = {
    visible: boolean;
    listening: boolean;
    speaking: boolean;
    volume: SharedValue<number>;
    onClose: () => void;
    onMicPress: () => void;
    onOpenSpeech?: () => void;
};

// ─────────────────────────────────────────────────────────────────────────────
// VISUALIZERS
// ─────────────────────────────────────────────────────────────────────────────

/** 1. THE VOID: SDF-based morphing sphere (Skia) */
const TheVoid = ({ mode, sz, volume }: { mode: Mode; sz: number; volume: SharedValue<number> }) => {
    const cx = sz / 2;
    const breathe = useSharedValue(0);

    useEffect(() => {
        breathe.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }), -1, true);
    }, []);

    const radius = useDerivedValue(() => (sz * 0.25) + (volume.value * sz * 0.15) + (breathe.value * 5));
    const blur = useDerivedValue(() => 10 + (volume.value * 40));

    return (
        <Canvas style={{ width: sz, height: sz }}>
            <Circle cx={cx} cy={cx} r={radius} color="#000">
                <BlurMask blur={blur} style="normal" />
            </Circle>
            <Circle cx={cx} cy={cx} r={useDerivedValue(() => radius.value * 0.8)} color="#111">
                <BlurMask blur={5} style="inner" />
            </Circle>
            <Circle cx={cx} cy={cx} r={useDerivedValue(() => radius.value * 0.3)} color="#FFF" opacity={0.1}>
                <BlurMask blur={20} style="normal" />
            </Circle>
        </Canvas>
    );
};

/** 2. KINETIC GRID */
const KineticGrid = ({ mode, sz, volume }: { mode: Mode; sz: number; volume: SharedValue<number> }) => {
    const step = sz / 8;
    const scroll = useSharedValue(0);

    useEffect(() => {
        scroll.value = withRepeat(withTiming(sz, { duration: 5000, easing: Easing.linear }), -1, false);
    }, []);

    const strokeWidth = useDerivedValue(() => 0.5 + volume.value * 2);
    const opacity = useDerivedValue(() => 0.1 + volume.value * 0.5);

    return (
        <Canvas style={{ width: sz, height: sz }}>
            <Group transform={useDerivedValue(() => [{ translateY: scroll.value - sz }])}>
                {[...Array(16)].map((_, i) => (
                    <Line key={`v-${i}`} p1={vec(i * step, 0)} p2={vec(i * step, sz * 2)} color="#00EEFF" strokeWidth={strokeWidth} opacity={opacity} />
                ))}
                {[...Array(16)].map((_, i) => (
                    <Line key={`h-${i}`} p1={vec(0, i * step)} p2={vec(sz, i * step)} color="#00EEFF" strokeWidth={strokeWidth} opacity={opacity} />
                ))}
            </Group>
            <BlurMask blur={5} style="outer" />
        </Canvas>
    );
};

/** 1. GUARDIAN: High-Fidelity Robotic Companion (Three.js) */
const Guardian = ({ mode, sz, volume }: { mode: Mode; sz: number; volume: SharedValue<number> }) => {
    const onContextCreate = async (gl: any) => {
        const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
        const renderer = new Renderer({ gl });
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000, 0);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(0, 0, 8);

        // Lighting for Premium 3D look
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);
        const pointLight = new THREE.PointLight(0xffffff, 1.2);
        pointLight.position.set(5, 5, 10);
        scene.add(pointLight);

        const dogGroup = new THREE.Group();
        scene.add(dogGroup);

        // Materials: Retro N64/PS1 Flat-Shaded Meshes
        const flatMat = new THREE.MeshStandardMaterial({ 
            flatShading: true, 
            vertexColors: false,
            metalness: 0,
            roughness: 0.8
        });
        
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00FFFF }); // Glowing Cyan Eyes

        const cOrange = 0xFF6600;
        const cBackground = 0x080600;

        // --- THE CUSTOM ORIGAMI HEAD ---
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 0, 0);
        dogGroup.add(headGroup);

        // Custom Origami Geometry using BufferGeometry for a unique 'mine' look
        const vertices = new Float32Array([
            0, -2.5, 2.5,  // 0: Snout Tip
            0, 0, 1.5,     // 1: Bridge
            -2, 0.5, 0.5,  // 2: Left Cheek
            2, 0.5, 0.5,   // 3: Right Cheek
            -1.2, 2.2, 0,  // 4: Forehead Left
            1.2, 2.2, 0,   // 5: Forehead Right
            0, 0, -1.5     // 6: Back
        ]);
        const indices = [
            1, 2, 0,  1, 0, 3, // Snout Top
            2, 4, 1,  1, 4, 5,  1, 5, 3, // Face/Forehead
            4, 6, 5, // Back Top
            2, 6, 4,  3, 5, 6, // Sides
            2, 0, 6,  0, 3, 6  // Bottom
        ];

        const headGeo = new THREE.BufferGeometry();
        headGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        headGeo.setIndex(indices);
        headGeo.computeVertexNormals();
        
        const headMesh = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ 
            color: cOrange, 
            flatShading: true,
            side: THREE.DoubleSide
        }));
        headGroup.add(headMesh);

        // Nose (Matching background color)
        const noseGeo = new THREE.IcosahedronGeometry(0.5, 0);
        const nose = new THREE.Mesh(noseGeo, new THREE.MeshBasicMaterial({ color: cBackground }));
        nose.position.set(0, -2.3, 2.3);
        headGroup.add(nose);

        // Eyes (Happy Closed Torus)
        const makeEye = (x: number, z: number) => {
            const eye = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.05, 8, 8, Math.PI), new THREE.MeshBasicMaterial({ color: 0x000000 }));
            eye.position.set(x, 0.7, z);
            eye.rotation.x = -Math.PI / 6;
            headGroup.add(eye);
            return eye;
        };
        const eyeL = makeEye(-0.8, 1.1);
        const eyeR = makeEye(0.8, 1.1);

        // Sharp Origami Ears
        const earGeo = new THREE.ConeGeometry(0.8, 3, 3);
        const makeEar = (x: number, rotZ: number) => {
            const eGroup = new THREE.Group();
            eGroup.position.set(x, 1.8, 0);
            headGroup.add(eGroup);
            const e = new THREE.Mesh(earGeo, new THREE.MeshStandardMaterial({ color: 0xFF4500, flatShading: true }));
            e.position.set(0, 1.5, 0);
            e.rotation.z = rotZ;
            eGroup.add(e);
            return eGroup;
        };
        const leftEarGroup = makeEar(-1, 0.2);
        const rightEarGroup = makeEar(1, -0.2);

        let earVel = 0, earPos = 0;

        const render = () => {
            requestAnimationFrame(render);
            const v = volume.value;
            const time = Date.now() * 0.001;
            
            // Retro floaty movement
            const s = 1.2 + v * 0.15;
            dogGroup.scale.set(s, s, s);
            
            // "Floating Head" idle
            dogGroup.position.y = Math.sin(time * 2) * 0.3;
            dogGroup.rotation.y = Math.sin(time * 0.5) * 0.2;
            dogGroup.rotation.z = Math.cos(time * 0.8) * 0.05;

            // N64-style jitter on volume
            if (v > 0.3) {
                dogGroup.position.x = (Math.random() - 0.5) * v * 0.2;
                dogGroup.position.y += (Math.random() - 0.5) * v * 0.2;
            }

            // Ear Physics
            const targetEarPos = dogGroup.rotation.y * 1.5 + v * 0.6;
            earVel += (targetEarPos - earPos) * 0.1;
            earVel *= 0.85;
            earPos += earVel;
            leftEarGroup.rotation.z = 0.2 + earPos;
            rightEarGroup.rotation.z = -0.2 - earPos;

            renderer.render(scene, camera);
            gl.endFrameEXP();
        };
        render();
    };

    return (
        <View style={{ width: sz, height: sz }}>
            <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
        </View>
    );
};

/** 4. PRISM BARS: 3D Pillar Spectrum */
const PrismBars = ({ mode, sz, volume }: { mode: Mode; sz: number; volume: SharedValue<number> }) => {
    const cx = sz / 2;
    const count = 5;
    const spacing = 24;

    const Pillar = ({ i }: { i: number }) => {
        const dist = Math.abs(i - 2);
        const sensitivity = 1 - (dist * 0.25);
        const h = useDerivedValue(() => 30 + volume.value * 100 * sensitivity);
        const x = cx - (count * spacing) / 2 + i * spacing;

        return (
            <Group>
                {/* Left Shadow/Side face */}
                <RoundedRect
                    x={x - 4}
                    y={useDerivedValue(() => cx - h.value / 2 + 4)}
                    width={12} height={h} r={4} color="#000" opacity={0.3}
                />
                {/* Main Front Face */}
                <RoundedRect
                    x={x}
                    y={useDerivedValue(() => cx - h.value / 2)}
                    width={12} height={h} r={4} color="#FFFFFF" opacity={useDerivedValue(() => 0.4 + volume.value * 0.6)}
                >
                    <BlurMask blur={2} style="inner" />
                </RoundedRect>
                {/* Glowing Core */}
                <RoundedRect
                    x={x + 4}
                    y={useDerivedValue(() => cx - h.value / 3)}
                    width={4} height={useDerivedValue(() => h.value / 2)} r={2} color="#FFF" opacity={useDerivedValue(() => volume.value)}
                >
                    <BlurMask blur={5} style="normal" />
                </RoundedRect>
            </Group>
        );
    };

    return (
        <Canvas style={{ width: sz, height: sz }}>
            {[0,1,2,3,4].map((i) => <Pillar key={i} i={i} />)}
        </Canvas>
    );
};

/** 5. CHRONOS */
const Chronos = ({ mode, sz, volume }: { mode: Mode; sz: number; volume: SharedValue<number> }) => {
    const cx = sz / 2;
    const rot = useSharedValue(0);
    useEffect(() => {
        rot.value = withRepeat(withTiming(Math.PI * 2, { duration: 12000, easing: Easing.linear }), -1, false);
    }, []);

    return (
        <Canvas style={{ width: sz, height: sz }}>
            <Group origin={vec(cx, cx)} transform={useDerivedValue(() => [{ rotate: rot.value }])}>
                {[...Array(12)].map((_, i) => (
                    <Group key={i} origin={vec(cx, cx)} transform={[{ rotate: (i * Math.PI * 2) / 12 }]}>
                        <RoundedRect x={cx - 2} y={cx - sz * 0.35} width={4} height={useDerivedValue(() => 10 + volume.value * 30)} r={2} color="#FFDD00" />
                    </Group>
                ))}
            </Group>
            <Circle cx={cx} cy={cx} r={useDerivedValue(() => 5 + volume.value * 15)} color="#FFDD00" />
        </Canvas>
    );
};

/** 6. JELLYFISH: 3D Organic Specimen (Three.js) */
const Jellyfish = ({ mode, sz, volume }: { mode: Mode; sz: number; volume: SharedValue<number> }) => {
    const onContextCreate = async (gl: any) => {
        const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
        const renderer = new Renderer({ gl });
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000, 0);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.z = 8;

        const group = new THREE.Group();
        scene.add(group);

        // 1. The Bell (Hemisphere)
        const bellGeo = new THREE.SphereGeometry(2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const bellMat = new THREE.PointsMaterial({ color: 0x00FFAA, size: 0.08, transparent: true, opacity: 0.8 });
        const bell = new THREE.Points(bellGeo, bellMat);
        group.add(bell);

        // 2. Tentacles (Lines)
        const tentacleCount = 8;
        const tentacles: THREE.Line[] = [];
        const tentacleMaterial = new THREE.LineBasicMaterial({ color: 0x00FFAA, transparent: true, opacity: 0.3 });

        for (let i = 0; i < tentacleCount; i++) {
            const points: THREE.Vector3[] = [];
            for (let j = 0; j < 15; j++) {
                points.push(new THREE.Vector3(0, -j * 0.4, 0));
            }
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, tentacleMaterial);
            
            const angle = (i / tentacleCount) * Math.PI * 2;
            line.position.set(Math.cos(angle) * 1.5, 0, Math.sin(angle) * 1.5);
            
            group.add(line);
            tentacles.push(line);
        }

        const render = () => {
            requestAnimationFrame(render);
            const v = volume.value;
            const time = Date.now() * 0.001;

            // Rhythmic Pulsing
            const pulse = 1 + Math.sin(time * 3 + v * 5) * 0.15;
            bell.scale.set(pulse, pulse, pulse);
            
            // Tentacle Wave Animation
            tentacles.forEach((line, idx) => {
                const pos = line.geometry.attributes.position;
                for (let j = 0; j < pos.count; j++) {
                    const wave = Math.sin(time * 4 + j * 0.5 + idx) * (0.1 + v * 0.5);
                    const x = (idx % 2 === 0 ? wave : 0);
                    const z = (idx % 2 !== 0 ? wave : 0);
                    pos.setXYZ(j, x, -j * 0.4 * pulse, z);
                }
                pos.needsUpdate = true;
            });

            group.rotation.y += 0.005;
            renderer.render(scene, camera);
            gl.endFrameEXP();
        };
        render();
    };

    return (
        <View style={{ width: sz, height: sz }}>
            <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
        </View>
    );
};

const INTERFACES = [
    { name: 'GUARDIAN', bg: '#080600', accent: '#FFD700', Component: Guardian },
    { name: 'THE VOID', bg: '#000000', accent: '#666', Component: TheVoid },
    { name: 'KINETIC', bg: '#000508', accent: '#00EEFF', Component: KineticGrid },
    { name: 'PRISM', bg: '#050505', accent: '#FFFFFF', Component: PrismBars },
    { name: 'CHRONOS', bg: '#0A0800', accent: '#FFDD00', Component: Chronos },
    { name: 'JELLYFISH', bg: '#000805', accent: '#00FFAA', Component: Jellyfish },
];

export function SpeechMode({ visible, listening, speaking, volume, onClose, onMicPress }: Props) {
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const transition = useSharedValue(0);
    const mode: Mode = speaking ? 'speaking' : listening ? 'listening' : 'idle';

    const selectInterface = (idx: number) => {
        setSelectedIdx(idx);
        transition.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) });
    };

    const backToGrid = () => {
        transition.value = withTiming(0, { duration: 300 }, (fin) => { if (fin) { 'worklet'; runOnJS(setSelectedIdx)(null); } });
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
            <View style={[styles.root, { backgroundColor: selected?.bg ?? '#000000' }]}>
                <Animated.View style={[styles.abs, gridStyle]}>
                    <View style={styles.gridContainer}>
                        <View style={styles.header}>
                            <Text style={styles.gridTitle}>ETHÉREAL</Text>
                            <Text style={styles.gridSubtitle}>CYBER-ZEN INTERfACES</Text>
                        </View>
                        <View style={styles.gridWrap}>
                            {INTERFACES.map((iface, idx) => (
                                <TouchableOpacity key={idx} style={[styles.cell, { backgroundColor: iface.bg }]} onPress={() => selectInterface(idx)} activeOpacity={0.8}>
                                    <View style={styles.cellVisual}><iface.Component mode={mode} sz={CELL_W * 0.8} volume={volume} /></View>
                                    <View style={styles.cellBar}>
                                        <Text style={[styles.cellName, { color: iface.accent }]}>{iface.name}</Text>
                                        <View style={[styles.ind, { backgroundColor: iface.accent }]} />
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </Animated.View>

                {selectedIdx !== null && (
                    <Animated.View style={[styles.fullScreen, fStyles.container, fullStyle]}>
                        <View style={fStyles.vContainer}>{selected && <selected.Component mode={mode} sz={FS_SZ} volume={volume} />}</View>
                        <View style={fStyles.bControls}>
                            <Text style={[fStyles.status, { color: selected?.accent }]}>{mode.toUpperCase()}</Text>
                            <TouchableOpacity style={[styles.micBtn, { borderColor: (selected?.accent ?? '#FFF') + '44' }]} onPress={onMicPress}>
                                <View style={[styles.micInner, { backgroundColor: (selected?.accent ?? '#FFF') + '22' }]}>
                                    <Text style={{ fontSize: 28 }}>{listening ? '◯' : '●'}</Text>
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={backToGrid} style={fStyles.backBtn}>
                                <Text style={[styles.backText, { color: selected?.accent }]}>DISCONNECT</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                )}
                
                <TouchableOpacity style={styles.closeX} onPress={onClose}><Text style={{ color: '#444', fontSize: 18, fontFamily: MONO }}>×</Text></TouchableOpacity>
            </View>
        </Modal>
    );
}

const fStyles = StyleSheet.create({
    container: { paddingTop: 100, paddingBottom: 60, justifyContent: 'space-between' },
    vContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    bControls: { width: '100%', alignItems: 'center' },
    status: { fontFamily: MONO, fontSize: 12, letterSpacing: 8, marginBottom: 40, opacity: 0.8 },
    backBtn: { marginTop: 40, padding: 10 }
});

const styles = StyleSheet.create({
    root: { flex: 1 },
    abs: { ...StyleSheet.absoluteFillObject },
    header: { marginBottom: 30, alignItems: 'center' },
    gridTitle: { color: '#FFF', fontSize: 24, letterSpacing: 12, fontWeight: '200', opacity: 0.9 },
    gridSubtitle: { color: '#444', fontSize: 9, letterSpacing: 4, marginTop: 10, fontFamily: MONO },
    gridContainer: { flex: 1, paddingVertical: 80, paddingHorizontal: PAD },
    gridWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    cell: { width: CELL_W, height: CELL_H, borderRadius: 24, marginBottom: GAP, borderWidth: 1, borderColor: '#111', overflow: 'hidden' },
    cellVisual: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
    cellBar: { width: '100%', paddingVertical: 15, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    cellName: { fontSize: 10, fontFamily: MONO, letterSpacing: 3, fontWeight: '600' },
    ind: { width: 10, height: 1, marginTop: 6, opacity: 0.5 },
    fullScreen: { flex: 1, alignItems: 'center' },
    micBtn: { width: 100, height: 100, borderRadius: 50, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    micInner: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
    backText: { fontFamily: MONO, fontSize: 10, letterSpacing: 4, fontWeight: '700' },
    closeX: { position: 'absolute', top: 55, right: 30, zIndex: 10, padding: 5 }
});