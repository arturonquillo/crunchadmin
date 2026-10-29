"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";
import { ZONES, type RestaurantZone } from "@/lib/zones";

type Props = {
  zone: RestaurantZone;
  count: number;
  active: boolean;
  onSelect: (zone: RestaurantZone) => void;
};

export function ZoneHotspot({ zone, count, active, onSelect }: Props) {
  const def = ZONES[zone];
  const meshRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    meshRef.current.position.y = def.position[1] + Math.sin(t * 2 + def.position[0]) * 0.08;
    meshRef.current.rotation.y = t * 0.6;
  });

  if (count <= 0 && !active) {
    // Still show subtle zone pins so empty areas are discoverable
  }

  return (
    <group position={def.position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(zone);
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <octahedronGeometry args={[active ? 0.28 : 0.2, 0]} />
        <meshStandardMaterial
          color={def.color}
          emissive={def.color}
          emissiveIntensity={active ? 0.7 : count > 0 ? 0.45 : 0.15}
          roughness={0.35}
          metalness={0.15}
        />
      </mesh>
      <Html distanceFactor={8} position={[0, 0.45, 0]} center>
        <button
          type="button"
          className={`zone-pin ${active ? "active" : ""} ${count > 0 ? "has-work" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(zone);
          }}
        >
          <span className="zone-pin-label">{def.label}</span>
          {count > 0 && <span className="zone-pin-count">{count}</span>}
        </button>
      </Html>
    </group>
  );
}
