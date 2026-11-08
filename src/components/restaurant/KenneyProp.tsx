"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { RestaurantZone } from "@/lib/zones";

/** Kenney Furniture Pack OBJs are ~5× room units; normalize to meters-ish. */
export const KENNEY_UNIT = 0.22;

type Props = {
  name: string;
  zone: RestaurantZone;
  position: [number, number, number];
  rotation?: [number, number, number];
  /** Extra multiplier on top of KENNEY_UNIT */
  scale?: number | [number, number, number];
  selected?: boolean;
  hasWork?: boolean;
  onSelect: (zone: RestaurantZone) => void;
  workColor?: string;
};

export function KenneyProp({
  name,
  zone,
  position,
  rotation = [0, 0, 0],
  scale = 1,
  selected = false,
  hasWork = false,
  onSelect,
  workColor = "#f97316",
}: Props) {
  const { scene } = useGLTF(`/models/kenney/${name}.glb`);
  const root = useMemo(() => scene.clone(true), [scene]);
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const baseY = position[1];

  useEffect(() => {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const std = m as THREE.MeshStandardMaterial;
        if (std?.isMeshStandardMaterial) {
          std.roughness = 0.55;
          std.metalness = 0.05;
          std.envMapIntensity = 0.65;
        }
      });
    });
  }, [root]);

  useEffect(() => {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const std = m as THREE.MeshStandardMaterial;
        if (!std?.isMeshStandardMaterial) return;
        if (selected || hovered) {
          std.emissive = new THREE.Color(selected ? "#fdba74" : "#ffedd5");
          std.emissiveIntensity = selected ? 0.5 : 0.25;
        } else if (hasWork) {
          std.emissive = new THREE.Color(workColor);
          std.emissiveIntensity = 0.3;
        } else {
          std.emissive = new THREE.Color("#000000");
          std.emissiveIntensity = 0;
        }
        std.needsUpdate = true;
      });
    });
  }, [root, selected, hovered, hasWork, workColor]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    const bob =
      (hovered || selected ? 0.045 : 0) +
      (hasWork && !selected ? Math.sin(t * 2.6) * 0.03 : 0) +
      (hovered ? Math.sin(t * 7) * 0.012 : 0);
    group.current.position.y = baseY + bob;
    const targetScale = hovered || selected ? 1.06 : 1;
    const s = group.current.scale;
    // preserve authored scale ratio via userData
    const base = (group.current.userData.baseScale as number) || 1;
    const next = THREE.MathUtils.lerp(s.x / base, targetScale, 0.18) * base;
    s.setScalar(next);
  });

  const scaleNum =
    (typeof scale === "number" ? scale : scale[0]) * KENNEY_UNIT;
  const finalScale: number | [number, number, number] =
    typeof scale === "number"
      ? scaleNum
      : [scale[0] * KENNEY_UNIT, scale[1] * KENNEY_UNIT, scale[2] * KENNEY_UNIT];

  return (
    <group
      ref={group}
      position={position}
      rotation={rotation}
      scale={finalScale}
      userData={{ baseScale: scaleNum }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(zone);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <primitive object={root} />
      {(hovered || selected || hasWork) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.35, hovered || selected ? 0.52 : 0.45, 32]} />
          <meshBasicMaterial
            color={selected ? "#ea580c" : hasWork ? workColor : "#fb923c"}
            transparent
            opacity={selected ? 0.85 : hovered ? 0.65 : 0.35}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

[
  "chair",
  "chairRounded",
  "chairCushion",
  "chairDesk",
  "stoolBar",
  "stoolBarSquare",
  "tableRound",
  "table",
  "tableCloth",
  "tableCross",
  "kitchenBar",
  "kitchenBarEnd",
  "kitchenCabinet",
  "kitchenCabinetDrawer",
  "kitchenFridge",
  "kitchenFridgeSmall",
  "kitchenStove",
  "kitchenSink",
  "kitchenMicrowave",
  "kitchenCoffeeMachine",
  "kitchenBlender",
  "bathroomSink",
  "desk",
  "cardboardBoxOpen",
  "cardboardBoxClosed",
  "pottedPlant",
  "plantSmall1",
  "plantSmall2",
].forEach((name) => {
  useGLTF.preload(`/models/kenney/${name}.glb`);
});
