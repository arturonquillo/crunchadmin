"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { RestaurantZone } from "@/lib/zones";

type Props = {
  focusedZone: RestaurantZone | null;
  zonesWithWork: Set<RestaurantZone>;
};

const ROOM = { cx: 0, cz: -0.15, halfX: 3.35, halfZ: 2.85 };

function Clay({
  position,
  args,
  color,
  radius = 0.08,
  roughness = 0.45,
  metalness = 0.02,
  emissive,
  emissiveIntensity = 0,
  opacity = 1,
  castShadow = true,
  receiveShadow = true,
  onClick,
}: {
  position: [number, number, number];
  args: [number, number, number];
  color: string;
  radius?: number;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  onClick?: (e: { stopPropagation: () => void }) => void;
}) {
  const r = Math.min(radius, Math.min(args[0], args[1], args[2]) * 0.45);
  return (
    <RoundedBox
      position={position}
      args={args}
      radius={r}
      smoothness={4}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      onClick={onClick}
    >
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        emissive={emissive ?? "#000000"}
        emissiveIntensity={emissiveIntensity}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </RoundedBox>
  );
}

/** Perimeter wall that fades when the camera is on its outside (dollhouse cutaway). */
function SmartWall({
  position,
  args,
  outward,
  color,
  accent,
}: {
  position: [number, number, number];
  args: [number, number, number];
  outward: [number, number, number];
  color: string;
  accent?: boolean;
}) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const { camera } = useThree();
  const out = useMemo(() => new THREE.Vector3(...outward).normalize(), [outward]);

  useFrame(() => {
    if (!mat.current) return;
    const fromCenter = new THREE.Vector3(
      camera.position.x - ROOM.cx,
      0,
      camera.position.z - ROOM.cz
    ).normalize();
    // Camera outside this wall → hide so we always look into the room
    const outside = fromCenter.dot(out);
    const target = outside > 0.12 ? 0 : outside > -0.05 ? 0.35 : 1;
    mat.current.opacity = THREE.MathUtils.lerp(mat.current.opacity, target, 0.18);
    mat.current.transparent = mat.current.opacity < 0.98;
    mat.current.depthWrite = mat.current.opacity > 0.6;
  });

  return (
    <RoundedBox position={position} args={args} radius={0.06} smoothness={3} castShadow>
      <meshStandardMaterial
        ref={mat}
        color={accent ? "#ea580c" : color}
        roughness={0.42}
        metalness={0.03}
        transparent
        opacity={1}
        emissive={accent ? "#c2410c" : "#000000"}
        emissiveIntensity={accent ? 0.22 : 0}
      />
    </RoundedBox>
  );
}

function Chair({ position, rotY = 0 }: { position: [number, number, number]; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <Clay position={[0, 0.28, 0]} args={[0.38, 0.08, 0.38]} color="#fb923c" radius={0.06} />
      <Clay position={[0, 0.48, -0.14]} args={[0.38, 0.34, 0.08]} color="#fb923c" radius={0.05} />
      <Clay position={[-0.12, 0.14, -0.12]} args={[0.05, 0.28, 0.05]} color="#44403c" radius={0.02} />
      <Clay position={[0.12, 0.14, -0.12]} args={[0.05, 0.28, 0.05]} color="#44403c" radius={0.02} />
      <Clay position={[-0.12, 0.14, 0.12]} args={[0.05, 0.28, 0.05]} color="#44403c" radius={0.02} />
      <Clay position={[0.12, 0.14, 0.12]} args={[0.05, 0.28, 0.05]} color="#44403c" radius={0.02} />
    </group>
  );
}

function TableSet({
  position,
  glow,
}: {
  position: [number, number, number];
  glow?: boolean;
}) {
  return (
    <group position={position}>
      <Clay
        position={[0, 0.42, 0]}
        args={[0.95, 0.08, 0.95]}
        color="#fff7ed"
        radius={0.08}
        emissive={glow ? "#fdba74" : "#000000"}
        emissiveIntensity={glow ? 0.2 : 0}
      />
      <Clay position={[0, 0.2, 0]} args={[0.14, 0.4, 0.14]} color="#a8a29e" radius={0.04} />
      <Chair position={[0.55, 0, 0]} rotY={-Math.PI / 2} />
      <Chair position={[-0.55, 0, 0]} rotY={Math.PI / 2} />
    </group>
  );
}

function Plant({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <Clay position={[0, 0.18, 0]} args={[0.28, 0.28, 0.28]} color="#78716c" radius={0.06} />
      <mesh position={[0, 0.48, 0]} castShadow>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color="#65a30d" roughness={0.7} />
      </mesh>
      <mesh position={[0.12, 0.62, 0.05]} castShadow>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#84cc16" roughness={0.7} />
      </mesh>
    </group>
  );
}

export function RestaurantBuilding({ focusedZone, zonesWithWork }: Props) {
  const wallAccent =
    focusedZone === "pared_entrada" || zonesWithWork.has("pared_entrada");
  const barraGlow = focusedZone === "barra" || zonesWithWork.has("barra");
  const cocinaGlow = focusedZone === "cocina" || zonesWithWork.has("cocina");
  const salonGlow = focusedZone === "salon" || zonesWithWork.has("salon");
  const banoGlow = focusedZone === "bano" || zonesWithWork.has("bano");
  const oficinaGlow = focusedZone === "oficina" || zonesWithWork.has("oficina");
  const exteriorGlow = focusedZone === "exterior" || zonesWithWork.has("exterior");

  return (
    <group>
      {/* Diorama base — toy pedestal */}
      <Clay
        position={[0, -0.28, 0.4]}
        args={[9.2, 0.45, 10.2]}
        color="#3f3a36"
        radius={0.22}
        roughness={0.55}
      />
      <Clay
        position={[0, -0.02, 0.4]}
        args={[8.6, 0.14, 9.6]}
        color="#292524"
        radius={0.14}
        roughness={0.5}
      />

      {/* Interior floor — warm clay tile feel */}
      <Clay
        position={[0, 0.04, -0.15]}
        args={[6.7, 0.1, 5.7]}
        color="#f5e6d0"
        radius={0.05}
        roughness={0.35}
        metalness={0.08}
      />

      {/* Soft floor glow under salón when work pending */}
      {salonGlow && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.3, 0.1, 0.35]}>
          <circleGeometry args={[1.35, 28]} />
          <meshStandardMaterial
            color="#fdba74"
            transparent
            opacity={focusedZone === "salon" ? 0.4 : 0.22}
            emissive="#f97316"
            emissiveIntensity={0.35}
          />
        </mesh>
      )}

      {/* Dollhouse walls (camera-aware fade) — cream clay + orange accents */}
      <SmartWall
        position={[0, 1.15, ROOM.cz + ROOM.halfZ]}
        args={[6.7, 2.25, 0.16]}
        outward={[0, 0, 1]}
        color="#f3e7d6"
        accent={wallAccent}
      />
      <SmartWall
        position={[0, 1.15, ROOM.cz - ROOM.halfZ]}
        args={[6.7, 2.25, 0.16]}
        outward={[0, 0, -1]}
        color="#efe2cf"
      />
      <SmartWall
        position={[-(ROOM.halfX), 1.15, ROOM.cz]}
        args={[0.16, 2.25, 5.7]}
        outward={[-1, 0, 0]}
        color="#f0e4d2"
      />
      <SmartWall
        position={[ROOM.halfX, 1.15, ROOM.cz]}
        args={[0.16, 2.25, 5.7]}
        outward={[1, 0, 0]}
        color="#f0e4d2"
      />

      {/* Low orange wainscot strips (stay readable even when walls fade) */}
      <Clay position={[-2.4, 0.35, 0.1]} args={[0.12, 0.7, 3.8]} color="#fb923c" radius={0.04} />
      <Clay position={[2.4, 0.35, -0.4]} args={[0.12, 0.7, 3.2]} color="#fb923c" radius={0.04} />

      {/* Entrance accent panel (paint task target) */}
      <Clay
        position={[0, 1.05, 2.62]}
        args={[1.7, 1.7, 0.1]}
        color={wallAccent ? "#ea580c" : "#ffedd5"}
        radius={0.08}
        emissive={wallAccent ? "#c2410c" : "#000000"}
        emissiveIntensity={wallAccent ? (focusedZone === "pared_entrada" ? 0.45 : 0.22) : 0}
      />

      {/* Orange awning lip (no roof — just a front canopy suggestion) */}
      <Clay position={[0, 2.15, 2.35]} args={[4.2, 0.16, 1.1]} color="#f97316" radius={0.08} />
      <Clay position={[0, 2.05, 2.85]} args={[4.0, 0.1, 0.18]} color="#fff7ed" radius={0.04} />

      {/* Bar */}
      <Clay
        position={[-2.15, 0.5, 0.05]}
        args={[1.35, 0.95, 3.0]}
        color={barraGlow ? "#c2410c" : "#9a3412"}
        radius={0.1}
        emissive={focusedZone === "barra" ? "#9a3412" : "#000000"}
        emissiveIntensity={focusedZone === "barra" ? 0.25 : 0}
      />
      <Clay position={[-2.15, 1.02, 0.05]} args={[1.5, 0.12, 3.15]} color="#fed7aa" radius={0.06} />
      <Clay position={[-2.15, 1.25, -0.9]} args={[0.55, 0.55, 0.55]} color="#e7e5e4" radius={0.1} />
      <Clay position={[-2.15, 1.2, 0.7]} args={[0.4, 0.45, 0.4]} color="#a8a29e" radius={0.08} />

      {/* Kitchen island */}
      <Clay
        position={[0.1, 0.48, -2.25]}
        args={[3.4, 0.9, 1.15]}
        color={cocinaGlow ? "#ea580c" : "#d6d3d1"}
        radius={0.1}
        emissive={focusedZone === "cocina" ? "#c2410c" : "#000000"}
        emissiveIntensity={focusedZone === "cocina" ? 0.28 : 0}
      />
      <Clay position={[-0.85, 1.15, -2.25]} args={[0.85, 0.55, 0.7]} color="#78716c" radius={0.08} />
      <Clay position={[0.85, 1.05, -2.25]} args={[1.0, 0.35, 0.75]} color="#a8a29e" radius={0.08} />
      <mesh position={[0.85, 1.28, -2.25]}>
        <cylinderGeometry args={[0.12, 0.12, 0.08, 16]} />
        <meshStandardMaterial color="#292524" roughness={0.4} />
      </mesh>

      {/* Salón tables */}
      <TableSet position={[-0.55, 0, 0.85]} glow={salonGlow} />
      <TableSet position={[1.15, 0, 0.55]} glow={salonGlow} />
      <TableSet position={[0.25, 0, 1.65]} glow={salonGlow} />

      {/* Bathroom cubicle — open top, soft clay */}
      <Clay
        position={[2.45, 0.85, -1.85]}
        args={[1.45, 1.6, 1.45]}
        color={banoGlow ? "#7dd3fc" : "#e0f2fe"}
        radius={0.12}
        opacity={0.92}
        emissive={focusedZone === "bano" ? "#0284c7" : "#000000"}
        emissiveIntensity={focusedZone === "bano" ? 0.2 : 0}
      />
      <Clay position={[2.45, 0.35, -1.85]} args={[0.45, 0.55, 0.45]} color="#fafafa" radius={0.08} />

      {/* Oficina desk */}
      <Clay
        position={[2.45, 0.55, 1.35]}
        args={[1.3, 0.75, 1.15]}
        color={oficinaGlow ? "#a8a29e" : "#e7e5e4"}
        radius={0.1}
        emissive={focusedZone === "oficina" ? "#57534e" : "#000000"}
        emissiveIntensity={focusedZone === "oficina" ? 0.18 : 0}
      />
      <Clay position={[2.45, 0.98, 1.35]} args={[1.35, 0.1, 1.2]} color="#fff7ed" radius={0.05} />
      <Chair position={[2.45, 0, 2.0]} rotY={Math.PI} />

      {/* Exterior patio */}
      <Clay
        position={[0.7, 0.08, 4.05]}
        args={[3.6, 0.12, 2.0]}
        color={exteriorGlow ? "#57534e" : "#44403c"}
        radius={0.08}
      />
      <Clay position={[0.7, 0.42, 4.05]} args={[0.85, 0.08, 0.85]} color="#fff7ed" radius={0.08} />
      <Clay position={[0.7, 0.2, 4.05]} args={[0.12, 0.36, 0.12]} color="#a8a29e" radius={0.03} />
      <Chair position={[1.35, 0.05, 4.05]} rotY={-Math.PI / 2} />
      <Chair position={[0.05, 0.05, 4.05]} rotY={Math.PI / 2} />
      <Plant position={[2.2, 0.08, 4.35]} scale={0.9} />
      <Plant position={[-1.8, 0.05, 3.6]} scale={1.05} />
      <Plant position={[2.7, 0.05, -0.2]} scale={0.85} />

      {/* Soft pendant “lights” hanging in open air (no roof) */}
      {[
        [-0.55, 0.85],
        [1.15, 0.55],
        [0.25, 1.65],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 2.05, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.55, 8]} />
            <meshStandardMaterial color="#a8a29e" />
          </mesh>
          <mesh position={[0, 1.7, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.22, 0.22, 16]} />
            <meshStandardMaterial
              color="#ffedd5"
              emissive="#fdba74"
              emissiveIntensity={0.55}
              roughness={0.35}
            />
          </mesh>
          <pointLight position={[0, 1.55, 0]} intensity={0.35} distance={3.5} color="#ffd7a8" />
        </group>
      ))}
    </group>
  );
}
