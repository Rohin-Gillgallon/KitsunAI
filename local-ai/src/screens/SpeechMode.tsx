import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    Dimensions, Modal, ScrollView, Platform,
    TextInput
} from 'react-native';
import { GLView } from 'expo-gl';
import * as THREE from 'three';
import { Renderer } from 'expo-three';
import {
    Canvas, Circle, Group, Line, vec, BlurMask,
    RoundedRect, Path, Skia
} from '@shopify/react-native-skia';
import Animated, {
    useSharedValue, withRepeat, withTiming, withSpring,
    useDerivedValue, Easing, useAnimatedStyle, runOnJS, SharedValue
} from 'react-native-reanimated';

import { Settings, useTheme } from '../store/settings';

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
    visible?: boolean;
    listening?: boolean;
    volume?: SharedValue<number>;
    onClose?: () => void;
    onMicPress?: () => void;
    onOpenTranscript?: () => void;
    onOpenSettings?: () => void;
    onSend?: (text: string) => void;
    isHome?: boolean;
    speaking?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & THEMES
// ─────────────────────────────────────────────────────────────────────────────

export type Variant = 'classic' | 'spectral' | 'elite' | 'stealth';
export type Species = 'fox' | 'spaniel';

interface VisualizerProps {
    mode: Mode;
    sz: number;
    volume: SharedValue<number>;
    variant?: Variant;
}

// ─────────────────────────────────────────────────────────────────────────────
// VISUALIZERS
// ─────────────────────────────────────────────────────────────────────────────

/** 1. THE VOID: Black Hole Visualizer (Skia) */
export const TheVoid = ({ mode, sz, volume, variant = 'classic', isList }: VisualizerProps & { isList?: boolean }) => {
    const cx = sz / 2;
    const breathe = useSharedValue(0);
    const time = useSharedValue(0);
    useEffect(() => {
        if (!isList) {
            breathe.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }), -1, true);
            time.value = withRepeat(withTiming(100, { duration: 50000, easing: Easing.linear }), -1, false);
        }
    }, [isList]);

    const ringR = useDerivedValue(() => isList ? sz * 0.2 : sz * 0.22 + volume.value * sz * 0.08 + breathe.value * 5);
    const glow = useDerivedValue(() => isList ? 10 : 15 + volume.value * 35);
    const pulse = useDerivedValue(() => isList ? 0.3 : 0.3 + volume.value * 0.5);

    if (variant === 'spectral') {
        const dots = [0, 1, 2, 3, 4, 5, 6, 7];
        return (
            <Canvas style={{ width: sz, height: sz }}>
                <Circle cx={cx} cy={cx} r={useDerivedValue(() => isList ? sz * 0.2 : sz * 0.15 + volume.value * sz * 0.12)} color="#EE00FF" opacity={0.2}><BlurMask blur={25} style="normal" /></Circle>
                {dots.map(i => {
                    const a = useDerivedValue(() => (isList ? 0 : time.value * 0.8) + (i / 8) * Math.PI * 2);
                    const r = sz * (0.06 + (i % 4) * 0.05);
                    return (<Circle key={i} cx={useDerivedValue(() => cx + Math.cos(a.value) * r)} cy={useDerivedValue(() => cx + Math.sin(a.value) * r)} r={useDerivedValue(() => isList ? 2 : 2 + volume.value * 3)} color="#FF44FF" opacity={useDerivedValue(() => isList ? 0.6 : 0.3 + volume.value * 0.6)} />);
                })}
                <Circle cx={cx} cy={cx} r={useDerivedValue(() => isList ? 4 : 5 + volume.value * 5)} color="#FF00FF" opacity={0.9}><BlurMask blur={8} style="normal" /></Circle>
            </Canvas>
        );
    }
    if (variant === 'stealth') {
        const layers = [0, 1, 2, 3, 4];
        return (
            <Canvas style={{ width: sz, height: sz }}>
                {layers.map(i => {
                    const off = (i - 2) * (isList ? 8 : 12);
                    return (<Circle key={i} cx={cx + off} cy={cx} r={useDerivedValue(() => isList ? sz * 0.15 : sz * 0.12 + volume.value * sz * 0.08 + Math.abs(off) * 0.5)} color="#00FFCC" opacity={useDerivedValue(() => isList ? 0.12 : 0.08 + volume.value * 0.1)}><BlurMask blur={useDerivedValue(() => isList ? 15 : 20 + volume.value * 10)} style="normal" /></Circle>);
                })}
                <Circle cx={cx} cy={cx} r={useDerivedValue(() => isList ? 5 : 6 - volume.value * 2)} color="#000" />
            </Canvas>
        );
    }
    if (variant === 'elite') {
        const rings = [0, 1, 2, 3];
        return (
            <Canvas style={{ width: sz, height: sz }}>
                {rings.map(i => (
                    <Circle key={i} cx={cx} cy={cx} r={useDerivedValue(() => { const b = sz * (0.08 + i * 0.06); return isList ? b : b + volume.value * sz * 0.05 * (i + 1) + breathe.value * 3 * (i + 1); })} color="#FFCC00" opacity={useDerivedValue(() => isList ? 0.2 - i * 0.04 : (0.4 - i * 0.08) + volume.value * 0.3)} style="stroke" strokeWidth={useDerivedValue(() => isList ? 1.5 : 2 + volume.value * 2)}><BlurMask blur={useDerivedValue(() => isList ? 5 : 8 + volume.value * 8)} style="normal" /></Circle>
                ))}
                <Circle cx={cx} cy={cx} r={useDerivedValue(() => isList ? 5 : 8 + volume.value * 5)} color="#FFEE00" opacity={0.9}><BlurMask blur={useDerivedValue(() => isList ? 3 : 5 + volume.value * 10)} style="normal" /></Circle>
            </Canvas>
        );
    }
    // EVENT HORIZON (classic): White accretion ring around pure black center
    return (
        <Canvas style={{ width: sz, height: sz }}>
            <Circle cx={cx} cy={cx} r={useDerivedValue(() => ringR.value * 1.3)} color="#FFF" opacity={0.05}><BlurMask blur={30} style="normal" /></Circle>
            <Circle cx={cx} cy={cx} r={ringR} color="#FFF" opacity={pulse} style="stroke" strokeWidth={useDerivedValue(() => isList ? 2 : 3 + volume.value * 4)}><BlurMask blur={glow} style="normal" /></Circle>
            {!isList && <Circle cx={cx} cy={cx} r={useDerivedValue(() => ringR.value * 0.6)} color="#FFF" opacity={0.08} style="stroke" strokeWidth={1}><BlurMask blur={5} style="normal" /></Circle>}
            <Circle cx={cx} cy={cx} r={useDerivedValue(() => isList ? sz * 0.08 : sz * 0.1 - volume.value * sz * 0.02)} color="#000" />
        </Canvas>
    );
};

/** 2. KINETIC GRID */
export const KineticGrid = ({ mode, sz, volume, variant = 'classic', isList }: VisualizerProps & { isList?: boolean }) => {
    const cx = sz / 2;
    const scroll = useSharedValue(0);
    const time = useSharedValue(0);
    useEffect(() => {
        if (!isList) {
            scroll.value = withRepeat(withTiming(sz, { duration: 5000, easing: Easing.linear }), -1, false);
            time.value = withRepeat(withTiming(100, { duration: 50000, easing: Easing.linear }), -1, false);
        }
    }, [isList]);
    const strokeW = useDerivedValue(() => isList ? 0.8 : 0.5 + volume.value * 2);
    const opacity = useDerivedValue(() => isList ? 0.2 : 0.1 + volume.value * 0.5);

    if (variant === 'spectral') {
        // MATRIX: Green falling dot columns
        const cols = isList ? 4 : 6;
        const rows = isList ? 3 : 5;
        return (
            <Canvas style={{ width: sz, height: sz }}>
                {[...Array(cols)].map((_, c) =>
                    [...Array(rows)].map((_, r) => {
                        const x = (c + 0.5) * (sz / cols);
                        const baseY = (r / rows) * sz;
                        const y = useDerivedValue(() => isList ? baseY : (baseY + scroll.value * (0.5 + c * 0.15)) % sz);
                        return <RoundedRect key={`${c}-${r}`} x={x - 2} y={y} width={4} height={useDerivedValue(() => isList ? 6 : 8 + volume.value * 10)} r={2} color="#00FF44" opacity={useDerivedValue(() => isList ? 0.3 - r * 0.05 : 0.1 + volume.value * 0.4 - (r / rows) * 0.3)} />;
                    })
                )}
            </Canvas>
        );
    }
    if (variant === 'stealth') {
        // SYNTH: Magenta synthwave horizon with sun
        const lineCount = isList ? 5 : 8;
        return (
            <Canvas style={{ width: sz, height: sz }}>
                <Circle cx={cx} cy={cx * 0.8} r={useDerivedValue(() => isList ? sz * 0.15 : sz * 0.15 + volume.value * sz * 0.05)} color="#FF6600" opacity={useDerivedValue(() => isList ? 0.4 : 0.3 + volume.value * 0.4)}>
                    <BlurMask blur={useDerivedValue(() => isList ? 10 : 15 + volume.value * 15)} style="normal" />
                </Circle>
                {[...Array(lineCount)].map((_, i) => {
                    const y = cx + (i + 1) * (sz * 0.4 / lineCount);
                    return <Line key={i} p1={vec(0, y)} p2={vec(sz, y)} color="#FF00FF" strokeWidth={useDerivedValue(() => isList ? 0.5 : 0.5 + volume.value * 1.5)} opacity={useDerivedValue(() => isList ? 0.2 : 0.15 + volume.value * 0.3)} />;
                })}
                {[...Array(5)].map((_, i) => {
                    const x = (i + 1) * (sz / 6);
                    return <Line key={`v${i}`} p1={vec(x, cx)} p2={vec(cx + (x - cx) * 3, sz)} color="#FF00FF" strokeWidth={strokeW} opacity={useDerivedValue(() => isList ? 0.15 : 0.1 + volume.value * 0.2)} />;
                })}
            </Canvas>
        );
    }
    if (variant === 'elite') {
        // MONO: White concentric rotating squares
        const sqCount = isList ? 3 : 5;
        return (
            <Canvas style={{ width: sz, height: sz }}>
                <Group transform={useDerivedValue(() => [{ rotate: isList ? 0.1 : time.value * 0.02 + volume.value * 0.5 }])} origin={vec(cx, cx)}>
                    {[...Array(sqCount)].map((_, i) => {
                        const s = (i + 1) * (sz / (sqCount + 1) * 0.4);
                        return <RoundedRect key={i} x={cx - s} y={cx - s} width={s * 2} height={s * 2} r={2} color="#888" opacity={useDerivedValue(() => isList ? 0.2 : 0.15 + volume.value * 0.25)} style="stroke" strokeWidth={useDerivedValue(() => isList ? 0.8 : 0.8 + volume.value * 1.5)} />;
                    })}
                </Group>
                {!isList && <Group transform={useDerivedValue(() => [{ rotate: -time.value * 0.015 }])} origin={vec(cx, cx)}>
                    {[...Array(sqCount)].map((_, i) => {
                        const s = (i + 0.5) * (sz / (sqCount + 1) * 0.4);
                        return <RoundedRect key={i} x={cx - s} y={cx - s} width={s * 2} height={s * 2} r={2} color="#AAA" opacity={useDerivedValue(() => 0.05 + volume.value * 0.1)} style="stroke" strokeWidth={0.5} />;
                    })}
                </Group>}
            </Canvas>
        );
    }
    // CYBER (classic): Neon cyan scrolling grid
    const count = isList ? 6 : 8;
    const step = sz / count;
    return (
        <Canvas style={{ width: sz, height: sz }}>
            <Group transform={useDerivedValue(() => [{ translateY: isList ? 0 : scroll.value - sz }])}>
                {[...Array(count * 2)].map((_, i) => (
                    <Line key={`v-${i}`} p1={vec(i * step, 0)} p2={vec(i * step, sz * 2)} color="#00EEFF" strokeWidth={strokeW} opacity={opacity} />
                ))}
                {[...Array(count * 2)].map((_, i) => (
                    <Line key={`h-${i}`} p1={vec(0, i * step)} p2={vec(sz, i * step)} color="#00EEFF" strokeWidth={strokeW} opacity={opacity} />
                ))}
            </Group>
            {!isList && <BlurMask blur={5} style="outer" />}
        </Canvas>
    );
};

/** 3. ORIGAMI COMPANION (Three.js) — Fox + Spaniel */
export const OrigamiCompanion = ({ mode, sz, volume, variant = 'classic', species = 'fox', isList }: VisualizerProps & { species?: Species; isList?: boolean }) => {
    if (isList) {
        // Fox variants: classic=orange, spectral=ice blue, stealth=purple, elite=origami orange
        // Spaniel variants: classic=cyan, spectral=indigo, stealth=pink, elite=green
        const foxColors: Record<string, string> = { classic: '#FF6600', spectral: '#88DDFF', stealth: '#8800FF', elite: '#FF7711' };
        const spanielColors: Record<string, string> = { classic: '#00CCFF', spectral: '#4444FF', stealth: '#FF66AA', elite: '#22AA22' };
        const color = species === 'fox' ? (foxColors[variant] || '#FF6600') : (spanielColors[variant] || '#00CCFF');
        const k = sz / 100;
        return (
            <Canvas style={{ width: sz, height: sz }}>
                <Circle cx={sz / 2} cy={sz / 2} r={sz * 0.35} color={color} opacity={0.05}><BlurMask blur={15} style="normal" /></Circle>
                <Group transform={[{ scale: k }]}>
                    {species === 'fox' ? (
                        <Group>
                            <Path path="M30 60 L50 25 L70 60 L50 80 Z" color={color} opacity={0.8} />
                            <Path path="M50 25 L30 60 L50 45 Z" color={color} opacity={0.4} />
                            <Path path="M50 25 L70 60 L50 45 Z" color={color} opacity={0.4} />
                            <Path path="M35 50 L20 15 L45 35 Z" color={color} />
                            <Path path="M65 50 L80 15 L55 35 Z" color={color} />
                            {variant === 'stealth' && <Path path="M30 60 L50 25 L70 60 L50 80 Z" color="#FFF" opacity={0.15} style="stroke" strokeWidth={1.5} />}
                            {variant === 'spectral' && <Circle cx={50} cy={50} r={18} color="#88DDFF" opacity={0.1}><BlurMask blur={10} style="normal" /></Circle>}
                            <Circle cx={50} cy={78} r={2} color="#000" />
                        </Group>
                    ) : (
                        <Group>
                            <Path path="M20 30 L80 30 L50 90 Z" color={color} opacity={0.8} />
                            <Path path="M25 30 L5 65 L40 55 Z" color={color} />
                            <Path path="M75 30 L95 65 L60 55 Z" color={color} />
                            <Path path="M38 75 L50 63 L62 75 L50 90 Z" color="#FFF" opacity={0.3} />
                            <Path path="M44 75 L56 75 L50 83 Z" color="#000" />
                            <Circle cx={40} cy={55} r={2} color="#000" />
                            <Circle cx={60} cy={55} r={2} color="#000" />
                        </Group>
                    )}
                </Group>
            </Canvas>
        );
    }

    const onContextCreate = async (gl: any) => {
        const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
        const renderer = new Renderer({ gl });
        const origPS = gl.pixelStorei;
        gl.pixelStorei = (p: number, v: any) => { if (p === 0x9240 || p === 0x9241) return; origPS.call(gl, p, v); };
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000, 0);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(0, 0, 10);

        const group = new THREE.Group();
        scene.add(group);
        scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const pLight = new THREE.PointLight(0xffffff, 1.2);
        pLight.position.set(5, 5, 10);
        scene.add(pLight);

        // Variant-based color + material
        let mainColor: number;
        let matProps: any = { flatShading: true, metalness: 0, roughness: 0.8 };
        if (species === 'fox') {
            if (variant === 'spectral') { mainColor = 0x88DDFF; matProps = { ...matProps, transparent: true, opacity: 0.6 }; }
            else if (variant === 'stealth') { mainColor = 0x6600CC; matProps = { transparent: true, opacity: 0.35, wireframe: true }; }
            else if (variant === 'elite') { mainColor = 0xFF6600; } // Phoenix origami
            else { mainColor = 0xFF6600; } // Classic N64
        } else {
            if (variant === 'spectral') { mainColor = 0x4444FF; }
            else if (variant === 'stealth') { mainColor = 0xFF66AA; }
            else if (variant === 'elite') { mainColor = 0x22AA22; }
            else { mainColor = 0x00CCFF; }
        }

        const headMat = new THREE.MeshStandardMaterial({ ...matProps, color: mainColor });
        const headGroup = new THREE.Group();
        group.add(headGroup);

        // Shadow fox: add solid dark under-mesh + wireframe overlay
        if (species === 'fox' && variant === 'stealth') {
            const solidMat = new THREE.MeshStandardMaterial({ color: 0x220044, flatShading: true, metalness: 0, roughness: 0.9 });
            const solidVerts = new Float32Array([0,-2.5,2.5, 0,0,1.5, -2,0.5,0.5, 2,0.5,0.5, -1.2,2.2,0, 1.2,2.2,0, 0,0,-1.5]);
            const sGeo = new THREE.BufferGeometry();
            sGeo.setAttribute('position', new THREE.BufferAttribute(solidVerts, 3));
            sGeo.setIndex([1,2,0, 1,0,3, 2,4,1, 1,4,5, 1,5,3, 4,6,5, 2,6,4, 3,5,6, 2,0,6, 0,3,6]);
            sGeo.computeVertexNormals();
            headGroup.add(new THREE.Mesh(sGeo, solidMat));
        }

        // Arctic fox: add icosahedron core glow
        if (species === 'fox' && variant === 'spectral') {
            const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), new THREE.MeshBasicMaterial({ color: 0x88DDFF, transparent: true, opacity: 0.15 }));
            group.add(core);
        }

        const headGeo = new THREE.BufferGeometry();
        if (species === 'fox' && variant === 'elite') {
            // PHOENIX: Origami paper fox — flat kite shape, split ears, pointed snout
            const v = new Float32Array([
                // Left face half (folded slightly)
                0, 1.5, 0.2,  -2.2, 0, 0,  0, -3, 0.6,
                // Right face half
                0, 1.5, 0.2,  2.2, 0, 0,   0, -3, 0.6,
                // Left ear
                -0.3, 1.5, 0.1, -1.5, 3.8, 0, -2.2, 0, 0,
                // Right ear
                0.3, 1.5, 0.1,  1.5, 3.8, 0,  2.2, 0, 0,
                // Nose tip (black)
                -0.4, -2.6, 0.7,  0.4, -2.6, 0.7,  0, -3, 0.6,
            ]);
            headGeo.setAttribute('position', new THREE.BufferAttribute(v, 3));
            headGeo.setIndex([0,1,2, 3,5,4, 6,7,8, 9,11,10, 12,13,14]);
        } else if (species === 'fox') {
            // N64-style chunky fox head
            const vertices = new Float32Array([
                0, -2.5, 2.5,  0, 0, 1.5,  -2, 0.5, 0.5,  2, 0.5, 0.5,  -1.2, 2.2, 0,  1.2, 2.2, 0,  0, 0, -1.5
            ]);
            headGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            headGeo.setIndex([1,2,0, 1,0,3, 2,4,1, 1,4,5, 1,5,3, 4,6,5, 2,6,4, 3,5,6, 2,0,6, 0,3,6]);
        } else {
            // Spaniel head (all variants share geometry, differ by material/extras)
            if (variant !== 'spectral') {
                const muzMat = new THREE.MeshStandardMaterial({ ...matProps, color: 0xFFFFFF, opacity: 0.7, transparent: true });
                const muzGeo = new THREE.BufferGeometry();
                muzGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1.2,-1,1.3, 1.2,-1,1.3, 0,-2.8,1.6]), 3));
                muzGeo.setIndex([0,1,2]);
                headGroup.add(new THREE.Mesh(muzGeo, muzMat));
            }
            const vertices = new Float32Array([
                -2,2.5,0.5, 2,2.5,0.5, 3.5,0,0.5, 0,-3.8,1.2, -3.5,0,0.5,
                -1.5,2.5,-1, 1.5,2.5,-1, 2.5,0,-1, 0,-2.5,-1, -2.5,0,-1
            ]);
            headGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            headGeo.setIndex([0,1,2, 0,2,3, 0,3,4, 5,7,6, 5,8,7, 5,9,8, 0,5,6, 0,6,1, 1,6,7, 1,7,2, 2,7,8, 2,8,3, 3,8,9, 3,9,4, 4,9,5, 4,5,0]);
        }
        headGeo.computeVertexNormals();
        headGroup.add(new THREE.Mesh(headGeo, variant === 'elite' && species === 'fox' ? new THREE.MeshStandardMaterial({ color: 0xFF6600, flatShading: true, metalness: 0, roughness: 0.9, side: THREE.DoubleSide }) : headMat));

        // Phoenix nose tip
        if (species === 'fox' && variant === 'elite') {
            const noseGeo = new THREE.BufferGeometry();
            noseGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.4,-2.6,0.7, 0.4,-2.6,0.7, 0,-3,0.6]), 3));
            noseGeo.setIndex([0,1,2]);
            headGroup.add(new THREE.Mesh(noseGeo, new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide })));
        }

        // Eyes
        const eyeColor = variant === 'stealth' ? 0xAA00FF : variant === 'spectral' ? 0x88DDFF : 0x000000;
        if (variant === 'elite' && species === 'fox') {
            // Origami sleepy line eyes (thin flat rectangles)
            [-0.6, 0.6].forEach(x => {
                const eyeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.1), new THREE.MeshBasicMaterial({ color: 0x222222 }));
                eyeMesh.position.set(x, 0.3, 0.5);
                eyeMesh.rotation.z = x > 0 ? -0.15 : 0.15;
                headGroup.add(eyeMesh);
            });
        } else {
            [-0.7, 0.7].forEach(x => {
                const eye = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.1), new THREE.MeshBasicMaterial({ color: eyeColor }));
                eye.position.set(x, species === 'fox' ? 0.7 : 0.6, 0.6);
                headGroup.add(eye);
            });
        }

        // Nose (non-phoenix)
        if (!(species === 'fox' && variant === 'elite')) {
            const nose = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 1), new THREE.MeshBasicMaterial({ color: 0x000000 }));
            nose.position.set(0, species === 'fox' ? -2.3 : -1.3, 2.5);
            headGroup.add(nose);
        }

        // Ears
        const makeEar = (x: number, rotZ: number) => {
            let eGeo;
            if (species === 'fox') {
                eGeo = new THREE.ConeGeometry(0.8, 3, 3);
            } else {
                const eVerts = new Float32Array([0,0,0, -1.8,-4,0.5, 1.0,-3,0.5]);
                eGeo = new THREE.BufferGeometry();
                eGeo.setAttribute('position', new THREE.BufferAttribute(eVerts, 3));
                eGeo.setIndex([0,1,2, 0,2,1]);
            }
            const eMesh = new THREE.Mesh(eGeo, headMat);
            if (species === 'fox') {
                eMesh.position.set(x, 2.5, 0);
                eMesh.rotation.z = rotZ;
            } else {
                eMesh.position.set(x, 2.5, 0);
                eMesh.rotation.y = x > 0 ? 0.2 : -0.2;
                eMesh.scale.x = x > 0 ? -1 : 1;
            }
            headGroup.add(eMesh);
            return eMesh;
        };
        // Phoenix doesn't use cone ears — ears are built into geometry
        const lEar = variant === 'elite' && species === 'fox' ? null : makeEar(-1.2, species === 'fox' ? 0.2 : 0.5);
        const rEar = variant === 'elite' && species === 'fox' ? null : makeEar(1.2, species === 'fox' ? -0.2 : -0.5);

        // Midnight spaniel: add constellation point lights
        if (species === 'spaniel' && variant === 'spectral') {
            [[-1,1,0.6],[1,1,0.6],[0,-2,1.3],[-2,0,0.5],[2,0,0.5],[0,2.5,0.5]].forEach(p => {
                const dot = new THREE.Mesh(new THREE.SphereGeometry(0.08), new THREE.MeshBasicMaterial({ color: 0xFFFFFF }));
                dot.position.set(p[0], p[1], p[2]);
                headGroup.add(dot);
            });
        }

        const render = () => {
            requestAnimationFrame(render);
            const v = volume.value;
            const t = Date.now() * 0.001;
            const s = 1.2 + v * 0.2;
            group.scale.set(s, s, s);
            group.position.y = Math.sin(t * 2) * 0.3;
            group.rotation.y = Math.sin(t * 0.5) * 0.2;

            if (species === 'fox' && variant === 'elite') {
                // Phoenix: subtle paper flutter
                headGroup.rotation.z = Math.sin(t * 3) * v * 0.08;
                headGroup.rotation.x = Math.sin(t * 2) * v * 0.05;
            } else if (species === 'fox' && variant === 'stealth') {
                // Shadow: phase in/out
                headMat.opacity = 0.2 + v * 0.3 + Math.sin(t * 4) * 0.1;
                if (lEar) lEar.rotation.z = 0.2 + Math.sin(t * 8) * v * 0.3;
                if (rEar) rEar.rotation.z = -0.2 - Math.sin(t * 8) * v * 0.3;
            } else if (species === 'spaniel') {
                if (lEar) lEar.rotation.x = (Math.PI / 6) + Math.sin(t * 6) * v * 0.6;
                if (rEar) rEar.rotation.x = (Math.PI / 6) + Math.sin(t * 6) * v * 0.6;
            } else {
                if (lEar) lEar.rotation.z = 0.2 + Math.sin(t * 10) * v * 0.2;
                if (rEar) rEar.rotation.z = -0.2 - Math.sin(t * 10) * v * 0.2;
            }
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

/** 4. PRISM BARS */
export const PrismBars = ({ mode, sz, volume, variant = 'classic', isList }: VisualizerProps & { isList?: boolean }) => {
    const cx = sz / 2;
    const count = isList ? 3 : 5;
    const spacing = isList ? 30 : 24;
    const barColor = variant === 'spectral' ? '#AAAAAA' : variant === 'stealth' ? '#00FF88' : variant === 'elite' ? '#FF2222' : '#FFFFFF';
    const glowColor = variant === 'spectral' ? '#666666' : variant === 'stealth' ? '#00CC66' : variant === 'elite' ? '#FF8800' : '#88CCFF';

    const Pillar = ({ i }: { i: number }) => {
        const dist = Math.abs(i - (count - 1) / 2);
        const sensitivity = 1 - (dist * 0.25);
        const h = useDerivedValue(() => isList ? (40 + sensitivity * 20) : 30 + volume.value * 100 * sensitivity);
        const x = cx - ((count - 1) * spacing) / 2 + i * spacing;
        const barW = variant === 'elite' ? 14 : variant === 'stealth' ? 10 : 12;

        return (
            <Group>
                {!isList && <RoundedRect x={x - barW / 2 + 2} y={useDerivedValue(() => cx - h.value / 2 + 4)} width={barW} height={h} r={4} color="#000" opacity={0.3} />}
                <RoundedRect x={x - barW / 2} y={useDerivedValue(() => cx - h.value / 2)} width={barW} height={h} r={4} color={barColor} opacity={useDerivedValue(() => isList ? 0.6 : 0.4 + volume.value * 0.6)}>
                    <BlurMask blur={2} style="inner" />
                </RoundedRect>
                {!isList && (
                    <RoundedRect x={x - 2} y={useDerivedValue(() => cx - h.value / 3)} width={4} height={useDerivedValue(() => h.value / 2)} r={2} color={glowColor} opacity={useDerivedValue(() => volume.value * 0.8)}>
                        <BlurMask blur={variant === 'elite' ? 8 : 5} style="normal" />
                    </RoundedRect>
                )}
                {!isList && variant === 'elite' && (
                    <Circle cx={x} cy={useDerivedValue(() => cx - h.value / 2)} r={useDerivedValue(() => 3 + volume.value * 5)} color="#FF4400" opacity={useDerivedValue(() => volume.value * 0.6)}>
                        <BlurMask blur={10} style="normal" />
                    </Circle>
                )}
            </Group>
        );
    };

    return <Canvas style={{ width: sz, height: sz }}>{[...Array(count)].map((_, i) => <Pillar key={i} i={i} />)}</Canvas>;
};

/** 5. CHRONOS — Bioluminescent Lifeforms */
export const Chronos = ({ mode, sz, volume, variant = 'classic', isList }: VisualizerProps & { isList?: boolean }) => {
    const cx = sz / 2;
    const time = useSharedValue(0);
    useEffect(() => { 
        if (!isList) {
            time.value = withRepeat(withTiming(100, { duration: 50000, easing: Easing.linear }), -1, false); 
        }
    }, [isList]);

    // Variant-specific entity configs: different counts, orbit shapes, speeds
    const configs = {
        classic:  { color: '#FFD700', glow: '#FFAA00', count: 8,  rBase: 0.04, orbits: [0.3,0.25,0.35,0.2,0.4,0.15,0.28,0.33], speeds: [1.2,0.7,0.9,1.5,0.6,1.1,0.8,1.3] },
        spectral: { color: '#00BBFF', glow: '#0066CC', count: 12, rBase: 0.025, orbits: [0.2,0.15,0.25,0.3,0.18,0.22,0.28,0.12,0.35,0.2,0.15,0.25], speeds: [0.4,0.6,0.3,0.5,0.7,0.35,0.45,0.55,0.3,0.65,0.5,0.4] },
        stealth:  { color: '#FF8800', glow: '#CC5500', count: 5,  rBase: 0.07, orbits: [0.25,0.3,0.2,0.35,0.28], speeds: [0.5,0.4,0.6,0.35,0.45] },
        elite:    { color: '#AA44FF', glow: '#6600CC', count: 6,  rBase: 0.05, orbits: [0.3,0.25,0.35,0.2,0.4,0.15], speeds: [1.8,1.5,2.0,1.2,1.6,1.4] },
    };
    const cfg = configs[variant] || configs.classic;
    const entities = [...Array(cfg.count)].map((_, i) => ({
        rx: cfg.orbits[i % cfg.orbits.length],
        ry: cfg.orbits[(i + 2) % cfg.orbits.length] * 0.8,
        fx: cfg.speeds[i % cfg.speeds.length],
        fy: cfg.speeds[(i + 1) % cfg.speeds.length] * 0.9,
        off: (i / cfg.count) * Math.PI * 2,
    }));

    return (
        <Canvas style={{ width: sz, height: sz }}>
            {entities.map((e, i) => {
                const posX = useDerivedValue(() => cx + (isList ? e.rx * sz * Math.cos(e.off) : Math.cos(time.value * e.fx + e.off) * sz * e.rx));
                const posY = useDerivedValue(() => cx + (isList ? e.ry * sz * Math.sin(e.off) : Math.sin(time.value * e.fy + e.off) * sz * e.ry));
                const glowSize = useDerivedValue(() => isList ? sz * cfg.rBase : (sz * cfg.rBase * 2 + volume.value * 25) * (1 + Math.sin(time.value * 2 + e.off) * 0.2));
                return (
                    <Group key={i} blendMode="plus">
                        <Circle cx={posX} cy={posY} r={useDerivedValue(() => glowSize.value * (variant === 'stealth' ? 2.5 : 1.5))} color={cfg.glow} opacity={0.1}><BlurMask blur={15} style="normal" /></Circle>
                        <Circle cx={posX} cy={posY} r={useDerivedValue(() => glowSize.value * 0.6)} color={cfg.color} opacity={useDerivedValue(() => isList ? 0.8 : 0.4 + volume.value * 0.6)} />
                        {!isList && <Circle cx={posX} cy={posY} r={useDerivedValue(() => glowSize.value * 0.2)} color="#FFF" />}
                        {!isList && variant === 'stealth' && (
                            <Line p1={vec(useDerivedValue(() => posX.value).value, useDerivedValue(() => posY.value).value)} p2={vec(useDerivedValue(() => posX.value).value, useDerivedValue(() => posY.value + glowSize.value * 3).value)} color={cfg.color} strokeWidth={1} opacity={0.2} />
                        )}
                    </Group>
                );
            })}
        </Canvas>
    );
};

/** 6. JELLYFISH (Three.js Dot-Based) */
export const Jellyfish = ({ mode, sz, volume, variant = 'classic', isList }: VisualizerProps & { isList?: boolean }) => {
    if (isList) {
        const color = variant === 'spectral' ? '#4488FF' : variant === 'elite' ? '#FFFFFF' : variant === 'stealth' ? '#FF22AA' : '#00FFAA';
        return (
            <Canvas style={{ width: sz, height: sz }}>
                <Circle cx={sz / 2} cy={sz / 2} r={sz * 0.25} color={color} opacity={variant === 'elite' ? 0.3 : 0.1}><BlurMask blur={15} style="normal" /></Circle>
                <Group transform={[{ scale: sz / 100 }]}>
                    <Path path="M20 50 Q50 10 80 50 Z" color={color} opacity={0.8} />
                    <Path path="M30 50 Q25 70 30 90" color={color} strokeWidth={2} style="stroke" />
                    <Path path="M45 55 Q50 75 45 95" color={color} strokeWidth={2} style="stroke" />
                    <Path path="M55 55 Q60 75 55 95" color={color} strokeWidth={2} style="stroke" />
                    <Path path="M70 50 Q75 70 70 90" color={color} strokeWidth={2} style="stroke" />
                </Group>
            </Canvas>
        );
    }
    const onContextCreate = async (gl: any) => {
        const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
        const renderer = new Renderer({ gl });
        const origPS = gl.pixelStorei;
        gl.pixelStorei = (p: number, v: any) => { if (p === 0x9240 || p === 0x9241) return; origPS.call(gl, p, v); };
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000, 0);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.z = 8;
        const group = new THREE.Group();
        scene.add(group);

        const configs = {
            classic:  { c: 0x00FFAA, bellDots: 32, tents: 10, tentDots: 25, tentLen: 0.4, size: 0.08, op: 0.8 }, // BIOLUME
            spectral: { c: 0x4488FF, bellDots: 24, tents: 8,  tentDots: 15, tentLen: 0.3, size: 0.12, op: 0.9 }, // ELECTRIC
            stealth:  { c: 0xFF22AA, bellDots: 16, tents: 6,  tentDots: 40, tentLen: 0.6, size: 0.06, op: 0.7 }, // DEEPSEA
            elite:    { c: 0xFFFFFF, bellDots: 64, tents: 12, tentDots: 30, tentLen: 0.5, size: 0.05, op: 0.3 }, // GHOST
        };
        const cfg = configs[variant] || configs.classic;

        const bellGeo = new THREE.SphereGeometry(2, cfg.bellDots, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const bellMat = new THREE.PointsMaterial({ color: cfg.c, size: cfg.size, transparent: true, opacity: cfg.op, blending: THREE.AdditiveBlending });
        const bell = new THREE.Points(bellGeo, bellMat);
        group.add(bell);

        const tentacles: { points: THREE.Points, geometry: THREE.BufferGeometry }[] = [];
        for (let i = 0; i < cfg.tents; i++) {
            const angle = (i / cfg.tents) * Math.PI * 2;
            const radius = 1.6;
            const positions = new Float32Array(cfg.tentDots * 3);
            for (let j = 0; j < cfg.tentDots; j++) {
                positions[j * 3] = Math.cos(angle) * radius;
                positions[j * 3 + 1] = -j * cfg.tentLen;
                positions[j * 3 + 2] = Math.sin(angle) * radius;
            }
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const pMat = new THREE.PointsMaterial({ color: cfg.c, size: cfg.size * 0.7, transparent: true, opacity: cfg.op * 0.8, blending: THREE.AdditiveBlending });
            const points = new THREE.Points(geometry, pMat);
            group.add(points);
            tentacles.push({ points, geometry });
        }

        const render = () => {
            requestAnimationFrame(render);
            const v = volume.value;
            const t = Date.now() * 0.001;
            
            // Base breathing + volume pulse
            let pulse = 1 + Math.sin(t * 3 + v * 5) * 0.15;
            
            if (variant === 'stealth') {
                pulse = 1 + Math.sin(t * 1.5) * 0.1 + v * 0.4; // Deep breathing, bigger snaps
            } else if (variant === 'spectral') {
                pulse = 1 + v * 0.3; // Jerky electric movements
                if (Math.random() > 0.8) bellMat.opacity = cfg.op + v * 0.5;
                else bellMat.opacity = cfg.op * 0.5;
            } else if (variant === 'elite') {
                // Ghostly fade in with volume
                bellMat.opacity = 0.1 + v * 0.8;
                tentacles.forEach(t => (t.points.material as THREE.PointsMaterial).opacity = 0.05 + v * 0.5);
                pulse = 1.2 + Math.sin(t * 2) * 0.2;
            }

            bell.scale.set(pulse, pulse, pulse);
            
            tentacles.forEach(({ geometry }, i) => {
                const positions = geometry.attributes.position.array as Float32Array;
                const angle = (i / cfg.tents) * Math.PI * 2 + (variant === 'spectral' ? Math.sin(t * 10) * v * 0.2 : 0);
                const radius = 1.6 * pulse;
                for (let j = 0; j < cfg.tentDots; j++) {
                    let wave = Math.sin(t * 5 + j * 0.4 + v * 8) * (0.1 + v * 0.5) * (j / cfg.tentDots);
                    if (variant === 'stealth') {
                        // Snapping motion
                        wave = Math.sin(t * 2 + j * 0.2) * 0.5 * (j / cfg.tentDots) + (v > 0.5 ? Math.cos(j) * v : 0);
                    } else if (variant === 'spectral') {
                        // Electric zig-zag
                        wave += (Math.random() - 0.5) * v * 0.5;
                    }
                    positions[j * 3] = Math.cos(angle) * radius + wave;
                    positions[j * 3 + 1] = -j * cfg.tentLen * pulse + (variant === 'elite' ? Math.sin(t + j) * 0.2 : 0);
                    positions[j * 3 + 2] = Math.sin(angle) * radius + wave;
                }
                geometry.attributes.position.needsUpdate = true;
            });

            group.rotation.y += variant === 'spectral' ? 0.01 + v * 0.05 : 0.005;
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

/** 7. NEBULA (Space Nebula) */
export const Nebula = ({ mode, sz, volume, variant = 'classic', isList }: VisualizerProps & { isList?: boolean }) => {
    const cx = sz / 2;
    const time = useSharedValue(0);
    useEffect(() => { 
        if (!isList) {
            time.value = withRepeat(withTiming(100, { duration: 50000, easing: Easing.linear }), -1, false); 
        }
    }, [isList]);

    if (variant === 'spectral') {
        // HORSEHEAD: Red/orange dark nebula with silhouette pillar
        return (
            <Canvas style={{ width: sz, height: sz }}>
                <Circle cx={cx} cy={cx} r={useDerivedValue(() => isList ? sz * 0.35 : sz * 0.35 + volume.value * sz * 0.1)} color="#FF2200" opacity={useDerivedValue(() => isList ? 0.25 : 0.2 + volume.value * 0.15)}><BlurMask blur={30} style="normal" /></Circle>
                <Circle cx={cx * 0.8} cy={cx * 1.1} r={useDerivedValue(() => isList ? sz * 0.2 : sz * 0.2 + volume.value * sz * 0.08)} color="#FF6600" opacity={0.15}><BlurMask blur={25} style="normal" /></Circle>
                <RoundedRect x={cx - 8} y={cx * 0.5} width={16} height={sz * 0.5} r={8} color="#000" opacity={useDerivedValue(() => isList ? 0.6 : 0.5 + volume.value * 0.2)} />
                {!isList && [0,1,2,3].map(i => <Circle key={i} cx={cx * (0.5 + i * 0.35)} cy={cx * (0.3 + i * 0.2)} r={useDerivedValue(() => 1 + volume.value * 2)} color="#FFAA44" opacity={useDerivedValue(() => 0.3 + Math.sin(time.value + i) * 0.3)} />)}
            </Canvas>
        );
    }
    if (variant === 'stealth') {
        // HELIX: Teal ring nebula — concentric glowing rings
        const rings = [0, 1, 2, 3, 4];
        return (
            <Canvas style={{ width: sz, height: sz }}>
                {rings.map(i => (
                    <Circle key={i} cx={cx} cy={cx} r={useDerivedValue(() => { const b = sz * (0.08 + i * 0.06); return isList ? b : b + volume.value * sz * 0.03 * (i + 1) + Math.sin(time.value * 0.5 + i) * 3; })} color="#22FF88" opacity={useDerivedValue(() => isList ? 0.15 - i * 0.02 : 0.2 - i * 0.03 + volume.value * 0.15)} style="stroke" strokeWidth={useDerivedValue(() => isList ? 2 : 2.5 + volume.value * 3)}>
                        <BlurMask blur={useDerivedValue(() => isList ? 8 : 10 + volume.value * 10)} style="normal" />
                    </Circle>
                ))}
                <Circle cx={cx} cy={cx} r={useDerivedValue(() => isList ? 4 : 5 + volume.value * 4)} color="#AAFFCC" opacity={0.9}><BlurMask blur={5} style="normal" /></Circle>
            </Canvas>
        );
    }
    if (variant === 'elite') {
        // CRAB: Golden radiating filaments from center
        const filaments = [0, 1, 2, 3, 4, 5, 6, 7];
        return (
            <Canvas style={{ width: sz, height: sz }}>
                <Circle cx={cx} cy={cx} r={useDerivedValue(() => isList ? sz * 0.15 : sz * 0.12 + volume.value * sz * 0.1)} color="#FFCC00" opacity={0.15}><BlurMask blur={20} style="normal" /></Circle>
                {filaments.map(i => {
                    const a = (i / 8) * Math.PI * 2;
                    const len = useDerivedValue(() => isList ? sz * 0.25 : sz * 0.2 + volume.value * sz * 0.15 + Math.sin(time.value * 0.3 + i) * sz * 0.03);
                    return <Line key={i} p1={vec(cx, cx)} p2={vec(useDerivedValue(() => cx + Math.cos(a) * len.value).value, useDerivedValue(() => cx + Math.sin(a) * len.value).value)} color="#FFCC00" strokeWidth={useDerivedValue(() => isList ? 1 : 1.5 + volume.value * 2)} opacity={useDerivedValue(() => isList ? 0.3 : 0.2 + volume.value * 0.4)} />;
                })}
                <Circle cx={cx} cy={cx} r={useDerivedValue(() => isList ? 4 : 6 + volume.value * 4)} color="#FFEE88" opacity={0.9}><BlurMask blur={5} style="normal" /></Circle>
            </Canvas>
        );
    }
    // ORION (classic): Purple/blue layered gas clouds with star dots
    const clouds = [
        { dx: 0, dy: 0, r: 0.3, c: '#3300AA' },
        { dx: -0.1, dy: 0.08, r: 0.22, c: '#4400CC' },
        { dx: 0.12, dy: -0.06, r: 0.18, c: '#2200FF' },
        { dx: -0.05, dy: -0.1, r: 0.15, c: '#6600FF' },
    ];
    return (
        <Canvas style={{ width: sz, height: sz }}>
            {clouds.map((cl, i) => (
                <Circle key={i} cx={cx + cl.dx * sz} cy={cx + cl.dy * sz} r={useDerivedValue(() => isList ? sz * cl.r : sz * cl.r + volume.value * sz * 0.08 + Math.sin(time.value * 0.2 + i) * 5)} color={cl.c} opacity={useDerivedValue(() => isList ? 0.3 : 0.2 + volume.value * 0.15)} blendMode="screen">
                    <BlurMask blur={25} style="normal" />
                </Circle>
            ))}
            {!isList && [0,1,2,3,4,5].map(i => {
                const sx = cx + Math.cos(i * 1.1) * sz * 0.25;
                const sy = cx + Math.sin(i * 1.7) * sz * 0.2;
                return <Circle key={`s${i}`} cx={sx} cy={sy} r={useDerivedValue(() => 1 + volume.value * 1.5)} color="#FFF" opacity={useDerivedValue(() => 0.3 + Math.sin(time.value * 2 + i * 1.5) * 0.4)} />;
            })}
        </Canvas>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES (24 OPTIONS)
// ─────────────────────────────────────────────────────────────────────────────

const types = [
    { 
        name: 'FOX', Comp: OrigamiCompanion, spec: 'fox',
        variants: [
            { vName: 'CLASSIC', v: 'classic', acc: '#FF6600', bg: '#080600' },
            { vName: 'ARCTIC', v: 'spectral', acc: '#00FFFF', bg: '#000810' },
            { vName: 'SHADOW', v: 'stealth', acc: '#8800FF', bg: '#05000A' },
            { vName: 'PHOENIX', v: 'elite', acc: '#FF0033', bg: '#0A0000' },
        ]
    },
    { 
        name: 'SPANIEL', Comp: OrigamiCompanion, spec: 'spaniel',
        variants: [
            { vName: 'ORIGAMI', v: 'classic', acc: '#00CCFF', bg: '#080810' },
            { vName: 'MIDNIGHT', v: 'spectral', acc: '#4444FF', bg: '#00000A' },
            { vName: 'SAKURA', v: 'stealth', acc: '#FF66AA', bg: '#0A0005' },
            { vName: 'FOREST', v: 'elite', acc: '#22AA22', bg: '#000A00' },
        ]
    },
    { 
        name: 'VOID', Comp: TheVoid,
        variants: [
            { vName: 'EVENT HORIZON', v: 'classic', acc: '#FFFFFF', bg: '#000000' },
            { vName: 'SINGULARITY', v: 'spectral', acc: '#EE00FF', bg: '#05000A' },
            { vName: 'NEBULA CORE', v: 'stealth', acc: '#00FFCC', bg: '#000808' },
            { vName: 'SUPERNOVA', v: 'elite', acc: '#FFCC00', bg: '#0A0500' },
        ]
    },
    { 
        name: 'KINETIC', Comp: KineticGrid,
        variants: [
            { vName: 'CYBER', v: 'classic', acc: '#00EEFF', bg: '#000508' },
            { vName: 'MATRIX', v: 'spectral', acc: '#00FF00', bg: '#000800' },
            { vName: 'SYNTH', v: 'stealth', acc: '#FF00FF', bg: '#080008' },
            { vName: 'MONO', v: 'elite', acc: '#888888', bg: '#050505' },
        ]
    },
    { 
        name: 'PRISM', Comp: PrismBars,
        variants: [
            { vName: 'CRYSTAL', v: 'classic', acc: '#FFFFFF', bg: '#050505' },
            { vName: 'OBSIDIAN', v: 'spectral', acc: '#AAAAAA', bg: '#000000' },
            { vName: 'EMERALD', v: 'stealth', acc: '#00FF88', bg: '#000803' },
            { vName: 'RUBY', v: 'elite', acc: '#FF2222', bg: '#080000' },
        ]
    },
    { 
        name: 'CHRONOS', Comp: Chronos,
        variants: [
            { vName: 'HOURGLASS', v: 'classic', acc: '#FFD700', bg: '#080600' },
            { vName: 'MIDNIGHT', v: 'spectral', acc: '#5555FF', bg: '#00000A' },
            { vName: 'DAWN', v: 'stealth', acc: '#FF8800', bg: '#0A0500' },
            { vName: 'TWILIGHT', v: 'elite', acc: '#AA00FF', bg: '#05000A' },
        ]
    },
    { 
        name: 'JELLYFISH', Comp: Jellyfish,
        variants: [
            { vName: 'BIOLUME', v: 'classic', acc: '#00FFAA', bg: '#000805' },
            { vName: 'ELECTRIC', v: 'spectral', acc: '#0088FF', bg: '#000308' },
            { vName: 'DEEPSEA', v: 'stealth', acc: '#FF00AA', bg: '#080005' },
            { vName: 'GHOST', v: 'elite', acc: '#FFFFFF', bg: '#080808' },
        ]
    },
    { 
        name: 'NEBULA', Comp: Nebula,
        variants: [
            { vName: 'ORION', v: 'classic', acc: '#6600FF', bg: '#05000A' },
            { vName: 'HORSEHEAD', v: 'spectral', acc: '#FF2200', bg: '#0A0200' },
            { vName: 'HELIX', v: 'stealth', acc: '#22FF88', bg: '#000805' },
            { vName: 'CRAB', v: 'elite', acc: '#FFCC00', bg: '#0A0800' },
        ]
    },
];

export const INTERFACES = types.flatMap(t => t.variants.map(v => ({
    name: `${v.vName} ${t.name}`,
    variantName: v.vName,
    type: t.name,
    variant: v.v as Variant,
    species: (t as any).spec,
    bg: v.bg,
    accent: v.acc,
    Component: t.Comp
})));

export function SpeechMode({ 
    visible, listening: propsListening, speaking: propsSpeaking, 
    volume: propsVolume, onClose, onMicPress: propsOnMicPress, 
    onOpenTranscript, onOpenSettings, onSend, isHome 
}: Props) {
    const defaultVolume = useSharedValue(0);
    const volume = propsVolume || defaultVolume;
    
    const [internalSpeaking, setInternalSpeaking] = useState(false);
    
    const listening = isHome ? (propsListening ?? false) : (propsListening ?? false);
    const speaking = isHome ? (propsSpeaking ?? internalSpeaking) : (propsSpeaking ?? false);

    const themeIdx = useTheme();
    const [selectedIdx, setSelectedIdx] = useState<number | null>(themeIdx);
    const mode: Mode = speaking ? 'speaking' : listening ? 'listening' : 'idle';

    const selected = (selectedIdx !== null && selectedIdx < INTERFACES.length) ? INTERFACES[selectedIdx] : null;

    useEffect(() => {
        setSelectedIdx(themeIdx);
    }, [themeIdx]);

    const [textInput, setTextInput] = useState('');

    const handleSubmit = () => {
        if (!textInput.trim()) return;
        onSend?.(textInput.trim());
        setTextInput('');
    };

    const accent = selected?.accent || '#FFF';
    const bg = selected?.bg || '#000';

    return (
        <View style={[styles.root, { backgroundColor: bg }]}>
            {selectedIdx !== null && (
                <View style={[styles.fullScreen, fStyles.container]}>
                    <View style={fStyles.vContainer}>
                        {isHome && (
                            <TouchableOpacity onPress={onOpenSettings} style={fStyles.settingsBtn}>
                                <Text style={[styles.backText, { color: accent }]}>SETTINGS</Text>
                            </TouchableOpacity>
                        )}
                        {selected && (
                            <selected.Component 
                                key={selectedIdx}
                                mode={mode} 
                                sz={FS_SZ} 
                                volume={volume} 
                                variant={selected.variant as Variant}
                                species={selected.species as Species}
                            />
                        )}
                    </View>
                    
                    <View style={fStyles.bControls}>
                        {isHome && (
                            <View style={styles.inputRow}>
                                <TextInput
                                    style={[styles.input, { borderColor: accent + '44', flex: 1 }]}
                                    value={textInput}
                                    onChangeText={setTextInput}
                                    placeholder={selected ? `Type to ${selected.name.charAt(0).toUpperCase() + selected.name.slice(1).toLowerCase()}...` : "Type to Fox..."}
                                    placeholderTextColor={accent + '66'}
                                    onSubmitEditing={handleSubmit}
                                />
                                <TouchableOpacity
                                    style={[
                                        styles.sendButton, 
                                        { backgroundColor: accent },
                                        !textInput.trim() && styles.sendDisabled
                                    ]}
                                    onPress={handleSubmit}
                                    disabled={!textInput.trim()}
                                >
                                    <Text style={[styles.sendText, { color: '#000' }]}>↑</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        
                        <View style={styles.controlRow}>
                            <Text style={[styles.micLabel, { color: accent + '88' }]}>
                                {listening ? 'LISTENING...' : 'PUSH TO TALK'}
                            </Text>
                            <TouchableOpacity 
                                style={[styles.micBtn, { borderColor: accent + '44' }]} 
                                onPress={propsOnMicPress}
                            >
                                <View style={[styles.micInner, { backgroundColor: accent + '22' }]}>
                                    {listening ? (
                                        <View style={[styles.micRing, { borderColor: accent }]} />
                                    ) : (
                                        <View style={[styles.micDot, { backgroundColor: accent }]} />
                                    )}
                                </View>
                            </TouchableOpacity>
                            
                            <TouchableOpacity onPress={isHome ? onOpenTranscript : onClose} style={fStyles.backBtn}>
                                <Text style={[styles.backText, { color: accent }]}>{isHome ? 'OPEN TRANSCRIPT' : 'DISCONNECT'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
            
            {!isHome && <TouchableOpacity style={styles.closeX} onPress={onClose}><Text style={{ color: '#444', fontSize: 18, fontFamily: MONO }}>×</Text></TouchableOpacity>}
        </View>
    );
}

const fStyles = StyleSheet.create({
    container: { paddingTop: 60, paddingBottom: 120, justifyContent: 'space-between' },
    vContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    transcriptBtn: { position: 'absolute', top: 0, left: 30, padding: 10, zIndex: 10 },
    settingsBtn: { position: 'absolute', top: 0, right: 30, padding: 10, zIndex: 10 },
    bControls: { width: '100%', alignItems: 'center', paddingHorizontal: 30 },
    status: { fontFamily: MONO, fontSize: 12, letterSpacing: 8, marginBottom: 40, opacity: 0.8 },
    backBtn: { marginTop: 20, padding: 10 }
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
    controlRow: { alignItems: 'center', width: '100%' },
    micLabel: { fontFamily: MONO, fontSize: 8, letterSpacing: 3, marginBottom: 15, fontWeight: '700', opacity: 0.6 },
    inputRow: { width: '100%', flexDirection: 'row', alignItems: 'center', marginBottom: 25, paddingHorizontal: 10 },
    input: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderRadius: 30,
        paddingHorizontal: 20,
        paddingVertical: 12,
        color: '#FFF',
        fontFamily: MONO,
        fontSize: 14,
    },
    sendButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    sendDisabled: {
        backgroundColor: '#222',
        opacity: 0.5,
    },
    sendText: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    micBtn: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    micInner: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
    micDot: { width: 14, height: 14, borderRadius: 7 },
    micRing: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5 },
    backText: { fontFamily: MONO, fontSize: 10, letterSpacing: 4, fontWeight: '700' },
    closeX: { position: 'absolute', top: 55, right: 30, zIndex: 10, padding: 5 }
});