"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";
import { useTranslations } from "next-intl";
import { ZONES, type RestaurantZone } from "@/lib/zones";

type Props = {
  zone: RestaurantZone;
  count: number;
  active: boolean;
  /** When a zone sheet is open, hide HTML pills so they never cover Cerrar/content */
  sheetOpen?: boolean;
  onSelect: (zone: RestaurantZone) => void;
};

export function ZoneHotspot({
  zone,
  count,
  active,
  sheetOpen = false,
  onSelect,
}: Props) {
  const def = ZONES[zone];
  const tl = useTranslations("Labels");
  const meshRef = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    meshRef.current.position.y = def.position[1] + Math.sin(t * 2 + def.position[0]) * 0.08;
    meshRef.current.rotation.y = t * 0.6;
  });

  return (
    <group position={def.position}>
      {/* Keep only the active 3D marker while sheet is open; hide others */}
      <mesh
        ref={meshRef}
        visible={!sheetOpen || active}
        onClick={(e) => {
          e.stopPropagation();
          if (!sheetOpen || active) onSelect(zone);
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
      {/* Keep Html mounted — conditional unmount races React roots via drei portals */}
      <Html
        distanceFactor={8}
        position={[0, 0.45, 0]}
        center
        zIndexRange={[15, 5]}
        style={{
          pointerEvents: sheetOpen ? "none" : "auto",
          opacity: sheetOpen ? 0 : 1,
          visibility: sheetOpen ? "hidden" : "visible",
        }}
      >
        <button
          type="button"
          className={`zone-pin ${active ? "active" : ""} ${count > 0 ? "has-work" : ""}`}
          tabIndex={sheetOpen ? -1 : 0}
          onClick={(e) => {
            e.stopPropagation();
            if (!sheetOpen) onSelect(zone);
          }}
        >
          <span className="zone-pin-label">{tl(`zone.${zone}`)}</span>
          {count > 0 && <span className="zone-pin-count">{count}</span>}
        </button>
      </Html>
    </group>
  );
}
