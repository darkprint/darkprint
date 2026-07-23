"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, Sparkles, Float } from "@react-three/drei";
import * as THREE from "three";
import type { MotionValue } from "framer-motion";

const VOID = "#05060d";
const CYAN = "#38bdf8";
const AMBER = "#ffb020";
const EMERALD = "#34d399";
const METAL = "#0b0e18";
const STEEL = "#161a29";

/* Camera dolly + gentle orbit driven by scroll progress (0..1). */
function Rig({ scroll }: { scroll: MotionValue<number> }) {
  useFrame((state) => {
    const p = THREE.MathUtils.clamp(scroll.get(), 0, 1);
    const t = state.clock.elapsedTime;
    // dolly in and settle lower as the factory "reveals"
    const targetZ = THREE.MathUtils.lerp(17, 8.2, p);
    const targetY = THREE.MathUtils.lerp(5.2, 2.6, p);
    const orbit = Math.sin(t * 0.12) * (1.4 + p * 1.2);
    state.camera.position.x += (orbit - state.camera.position.x) * 0.04;
    state.camera.position.z += (targetZ - state.camera.position.z) * 0.05;
    state.camera.position.y += (targetY - state.camera.position.y) * 0.05;
    state.camera.lookAt(0, 1.5, 0);
  });
  return null;
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.14} color={CYAN} />
      {/* amber key from a machine */}
      <spotLight
        position={[6, 7, 6]}
        angle={0.5}
        penumbra={0.9}
        intensity={70}
        color={AMBER}
        distance={40}
      />
      {/* cyan rim from behind */}
      <pointLight position={[-8, 4, -6]} intensity={60} color={CYAN} distance={40} />
      <pointLight position={[0, 2, 8]} intensity={16} color={"#7dd3fc"} distance={24} />
    </>
  );
}

/* A window strip that reads as a lit machine in the dark. */
function LitStrip({
  position,
  args,
  color = CYAN,
  intensity = 2.2,
}: {
  position: [number, number, number];
  args: [number, number, number];
  color?: string;
  intensity?: number;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={intensity}
        toneMapped={false}
      />
    </mesh>
  );
}

function Building() {
  // sawtooth roof units
  const teeth = useMemo(() => [-3, -1, 1, 3], []);
  return (
    <group position={[0, 0, 0]}>
      {/* main hall */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[8.4, 3, 4.4]} />
        <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.55} />
      </mesh>
      {/* base plinth */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[8.9, 0.4, 4.9]} />
        <meshStandardMaterial color={"#070a12"} metalness={0.4} roughness={0.7} />
      </mesh>

      {/* sawtooth roof: a slanted panel + a vertical north-light window per tooth */}
      {teeth.map((x) => (
        <group key={x} position={[x, 3, 0]}>
          <mesh rotation={[0, 0, -0.5]} position={[0, 0.5, 0]}>
            <boxGeometry args={[1.9, 0.12, 4.4]} />
            <meshStandardMaterial color={STEEL} metalness={0.5} roughness={0.5} />
          </mesh>
          <LitStrip
            position={[-0.72, 0.55, 0]}
            args={[0.08, 0.9, 4.2]}
            color={CYAN}
            intensity={1.6}
          />
        </group>
      ))}

      {/* window rows on the front face — a few lit, most dark */}
      {[-3, -2, -1, 0, 1, 2, 3].map((x, i) => (
        <LitStrip
          key={x}
          position={[x, 1.4, 2.23]}
          args={[0.5, 0.5, 0.06]}
          color={i % 3 === 0 ? AMBER : "#0e1a2e"}
          intensity={i % 3 === 0 ? 2.4 : 0.2}
        />
      ))}

      {/* smokestacks */}
      {[-2.6, 2.6].map((x) => (
        <group key={x} position={[x, 4.4, -1.4]}>
          <mesh position={[0, 0.9, 0]}>
            <cylinderGeometry args={[0.28, 0.34, 2, 16]} />
            <meshStandardMaterial color={"#0a0d15"} metalness={0.5} roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.95, 0]}>
            <torusGeometry args={[0.3, 0.05, 8, 20]} />
            <meshStandardMaterial
              color={AMBER}
              emissive={AMBER}
              emissiveIntensity={2}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function RobotArm({
  position,
  phase,
}: {
  position: [number, number, number];
  phase: number;
}) {
  const upper = useRef<THREE.Group>(null);
  const fore = useRef<THREE.Group>(null);
  const base = useRef<THREE.Group>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime + phase;
    if (base.current) base.current.rotation.y = Math.sin(t * 0.5) * 0.5;
    if (upper.current) upper.current.rotation.z = -0.5 + Math.sin(t * 0.8) * 0.35;
    if (fore.current) fore.current.rotation.z = 0.9 + Math.cos(t * 0.8) * 0.4;
  });
  return (
    <group position={position}>
      <group ref={base}>
        {/* base */}
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.28, 0.34, 0.3, 16]} />
          <meshStandardMaterial color={STEEL} metalness={0.7} roughness={0.4} />
        </mesh>
        {/* upper arm */}
        <group ref={upper} position={[0, 0.3, 0]}>
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[0.16, 0.95, 0.16]} />
            <meshStandardMaterial color={"#20263a"} metalness={0.7} roughness={0.4} />
          </mesh>
          {/* forearm */}
          <group ref={fore} position={[0, 0.9, 0]}>
            <mesh position={[0.35, 0, 0]}>
              <boxGeometry args={[0.75, 0.13, 0.13]} />
              <meshStandardMaterial color={"#2a3150"} metalness={0.7} roughness={0.4} />
            </mesh>
            {/* glowing tool tip */}
            <mesh position={[0.72, 0, 0]}>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshStandardMaterial
                color={EMERALD}
                emissive={EMERALD}
                emissiveIntensity={3}
                toneMapped={false}
              />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

function Conveyor() {
  const products = useRef<THREE.Mesh[]>([]);
  const N = 6;
  useFrame((_, delta) => {
    for (const m of products.current) {
      if (!m) continue;
      m.position.x += delta * 1.1;
      if (m.position.x > 4.4) m.position.x = -4.4;
    }
  });
  return (
    <group position={[0, 0.55, 2.9]}>
      {/* belt */}
      <mesh>
        <boxGeometry args={[9, 0.12, 0.7]} />
        <meshStandardMaterial color={"#0a0d16"} metalness={0.4} roughness={0.8} />
      </mesh>
      {Array.from({ length: N }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) products.current[i] = el;
          }}
          position={[-4.4 + (i * 8.8) / N, 0.18, 0]}
        >
          <boxGeometry args={[0.34, 0.34, 0.34]} />
          <meshStandardMaterial
            color={"#12203a"}
            emissive={CYAN}
            emissiveIntensity={0.25}
            metalness={0.3}
            roughness={0.6}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function FactoryScene({ scroll }: { scroll: MotionValue<number> }) {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ position: [0, 5.2, 17], fov: 42 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
      }}
    >
      <color attach="background" args={[VOID]} />
      <fog attach="fog" args={[VOID, 13, 38]} />
      <Rig scroll={scroll} />
      <Lights />

      <Float speed={1.1} rotationIntensity={0} floatIntensity={0.25} floatingRange={[0, 0.12]}>
        <Building />
      </Float>

      <RobotArm position={[-2, 0.4, 2.9]} phase={0} />
      <RobotArm position={[0.4, 0.4, 2.9]} phase={1.7} />
      <RobotArm position={[2.6, 0.4, 2.9]} phase={3.2} />
      <Conveyor />

      {/* techy floor grid + reflective dark plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color={"#04050a"} metalness={0.5} roughness={0.9} />
      </mesh>
      <Grid
        position={[0, 0.01, 0]}
        args={[60, 60]}
        cellSize={1}
        cellThickness={0.6}
        cellColor={"#0e1626"}
        sectionSize={5}
        sectionThickness={1}
        sectionColor={CYAN}
        fadeDistance={34}
        fadeStrength={2}
        infiniteGrid
      />

      <Sparkles count={70} scale={[18, 6, 12]} size={2} speed={0.3} color={CYAN} opacity={0.5} />
    </Canvas>
  );
}
