"use client";

import { useMemo } from "react";
import type { RestaurantZone } from "@/lib/zones";

type Props = {
  focusedZone: RestaurantZone | null;
  zonesWithWork: Set<RestaurantZone>;
};

function Box({
  position,
  args,
  color,
  opacity = 1,
  emissive,
  emissiveIntensity = 0,
  onClick,
}: {
  position: [number, number, number];
  args: [number, number, number];
  color: string;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
  onClick?: (e: { stopPropagation: () => void }) => void;
}) {
  return (
    <mesh position={position} castShadow receiveShadow onClick={onClick}>
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
        emissive={emissive ?? "#000000"}
        emissiveIntensity={emissiveIntensity}
        roughness={0.72}
        metalness={0.05}
      />
    </mesh>
  );
}

export function RestaurantBuilding({ focusedZone, zonesWithWork }: Props) {
  const wallGlow = useMemo(() => {
    const active = focusedZone === "pared_entrada" || zonesWithWork.has("pared_entrada");
    return active;
  }, [focusedZone, zonesWithWork]);

  return (
    <group>
      {/* Ground / patio */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 1]} receiveShadow>
        <circleGeometry args={[9, 48]} />
        <meshStandardMaterial color="#c5d6a8" roughness={1} />
      </mesh>

      {/* Building floor */}
      <Box position={[0, 0.05, 0]} args={[7.2, 0.1, 6.4]} color="#e8dcc8" />

      {/* Outer walls */}
      {/* Front entrance wall (with opening) */}
      <Box position={[-2.1, 1.35, 3.1]} args={[2.6, 2.7, 0.18]} color="#f2e6d4" />
      <Box position={[2.1, 1.35, 3.1]} args={[2.6, 2.7, 0.18]} color="#f2e6d4" />
      <Box position={[0, 2.35, 3.1]} args={[1.6, 0.7, 0.18]} color="#f2e6d4" />
      {/* Paint-target wall face — red outline when pending work */}
      <mesh position={[0, 1.15, 3.2]} onClick={(e) => e.stopPropagation()}>
        <boxGeometry args={[1.55, 2.1, 0.06]} />
        <meshStandardMaterial
          color={wallGlow ? "#d94a2a" : "#f7efe3"}
          emissive={wallGlow ? "#c2410c" : "#000000"}
          emissiveIntensity={wallGlow ? (focusedZone === "pared_entrada" ? 0.55 : 0.28) : 0}
          roughness={0.65}
        />
      </mesh>
      {wallGlow && (
        <mesh position={[0, 1.15, 3.28]}>
          <boxGeometry args={[1.7, 2.25, 0.03]} />
          <meshStandardMaterial
            color="#ff6b3d"
            transparent
            opacity={focusedZone === "pared_entrada" ? 0.55 : 0.3}
            emissive="#ff4d1a"
            emissiveIntensity={0.4}
          />
        </mesh>
      )}

      {/* Side / back walls */}
      <Box position={[-3.55, 1.35, 0]} args={[0.18, 2.7, 6.4]} color="#efe4d2" />
      <Box position={[3.55, 1.35, 0]} args={[0.18, 2.7, 6.4]} color="#efe4d2" />
      <Box position={[0, 1.35, -3.15]} args={[7.2, 2.7, 0.18]} color="#ebe0ce" />

      {/* Roof slab (cartoon flat) */}
      <Box position={[0, 2.85, 0]} args={[7.6, 0.18, 6.8]} color="#5c4030" />
      <Box position={[0, 3.05, 0]} args={[4.2, 0.35, 3.4]} color="#6b4a34" />

      {/* Sign */}
      <Box position={[0, 3.55, 3.2]} args={[2.4, 0.55, 0.12]} color="#1a2218" />

      {/* Bar counter */}
      <Box
        position={[-2.3, 0.55, -0.2]}
        args={[1.4, 1.0, 3.2]}
        color={focusedZone === "barra" || zonesWithWork.has("barra") ? "#a16207" : "#8b5a2b"}
        emissive={focusedZone === "barra" ? "#92400e" : "#000000"}
        emissiveIntensity={focusedZone === "barra" ? 0.25 : 0}
      />
      <Box position={[-2.3, 1.1, -0.2]} args={[1.55, 0.12, 3.35]} color="#d6b28c" />

      {/* Kitchen block */}
      <Box
        position={[0, 0.55, -2.45]}
        args={[3.6, 1.0, 1.2]}
        color={focusedZone === "cocina" || zonesWithWork.has("cocina") ? "#ea580c" : "#9a3412"}
        emissive={focusedZone === "cocina" ? "#c2410c" : "#000000"}
        emissiveIntensity={focusedZone === "cocina" ? 0.3 : 0}
      />
      <Box position={[-1.1, 1.35, -2.45]} args={[0.9, 0.7, 0.7]} color="#64748b" />
      <Box position={[0.9, 1.25, -2.45]} args={[1.1, 0.5, 0.8]} color="#94a3b8" />

      {/* Salon tables */}
      {[
        [-0.6, 0.8],
        [1.1, 0.6],
        [0.2, 1.7],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Box position={[0, 0.42, 0]} args={[0.9, 0.08, 0.9]} color="#d4a574" />
          <Box position={[0, 0.2, 0]} args={[0.12, 0.4, 0.12]} color="#8b5a2b" />
          <Box position={[-0.45, 0.28, 0.35]} args={[0.28, 0.45, 0.28]} color="#4a7c59" />
        </group>
      ))}

      {/* Bathroom cubicle */}
      <Box
        position={[2.55, 1.1, -1.7]}
        args={[1.5, 2.1, 1.6]}
        color={focusedZone === "bano" || zonesWithWork.has("bano") ? "#67e8f9" : "#bae6fd"}
        opacity={0.92}
        emissive={focusedZone === "bano" ? "#0891b2" : "#000000"}
        emissiveIntensity={focusedZone === "bano" ? 0.25 : 0}
      />

      {/* Office loft / mezzanine */}
      <Box position={[2.7, 1.85, 1.3]} args={[1.5, 0.1, 1.8]} color="#cbd5e1" />
      <Box
        position={[2.7, 2.35, 1.3]}
        args={[1.4, 0.9, 1.5]}
        color={focusedZone === "oficina" || zonesWithWork.has("oficina") ? "#94a3b8" : "#e2e8f0"}
        emissive={focusedZone === "oficina" ? "#334155" : "#000000"}
        emissiveIntensity={focusedZone === "oficina" ? 0.2 : 0}
      />

      {/* Exterior planter */}
      <Box
        position={[-2.2, 0.25, 4.8]}
        args={[1.2, 0.45, 0.8]}
        color={focusedZone === "exterior" ? "#4d7c0f" : "#3f6212"}
        emissive={focusedZone === "exterior" ? "#65a30d" : "#000000"}
        emissiveIntensity={focusedZone === "exterior" ? 0.25 : 0}
      />
      <Box position={[2.0, 0.2, 5.0]} args={[0.9, 0.35, 0.9]} color="#365314" />
      <mesh position={[2.0, 0.7, 5.0]}>
        <sphereGeometry args={[0.45, 12, 12]} />
        <meshStandardMaterial color="#84cc16" roughness={0.85} />
      </mesh>

      {/* Salon floor glow when focused */}
      {(focusedZone === "salon" || zonesWithWork.has("salon")) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.2, 0.12, 0.8]}>
          <circleGeometry args={[1.6, 24]} />
          <meshStandardMaterial
            color="#86efac"
            transparent
            opacity={focusedZone === "salon" ? 0.45 : 0.22}
            emissive="#22c55e"
            emissiveIntensity={0.3}
          />
        </mesh>
      )}
    </group>
  );
}
