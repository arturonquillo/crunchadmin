"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { RestaurantZone } from "@/lib/zones";

/** Kenney Furniture Pack OBJs are ~5× room units; normalize to meters-ish. */
export const KENNEY_UNIT = 0.22;

/**
 * Interior clay floor top is ~0.10 (RoundedBox y=0.05, h=0.1).
 * Sit a hair under the top so feet read planted (clay/game), not hovering.
 */
export const INTERIOR_FLOOR_Y = 0.085;
/** Exterior deck top ~0.11 — same slight plant. */
export const DECK_Y = 0.095;

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
  /**
   * When true (default), mesh feet are snapped to local Y=0 so the group
   * position sits on the floor/counter surface. Countertop appliances keep
   * this on — place the group at counter height.
   */
  grounded?: boolean;
};

function cloneMaterials(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m) => m.clone());
    } else if (mesh.material) {
      mesh.material = mesh.material.clone();
    }
  });
}

/** Preserve Kenney baseColorFactor; tune roughness/metalness for clay-readable realism. */
function tuneKenneyMaterial(std: THREE.MeshStandardMaterial) {
  const name = (std.name || "").toLowerCase();
  std.envMapIntensity = 0;
  // Never wash the Kenney palette with scene emissive
  std.emissive = new THREE.Color(0x000000);
  std.emissiveIntensity = 0;

  if (
    name.includes("metal") ||
    name.includes("chrome") ||
    name.includes("steel") ||
    name.includes("iron")
  ) {
    std.metalness = 0.55;
    std.roughness = 0.32;
  } else if (name.includes("glass") || name.includes("water")) {
    std.metalness = 0.08;
    std.roughness = 0.12;
    std.transparent = true;
    if (std.opacity > 0.9) std.opacity = 0.72;
  } else if (
    name.includes("wood") ||
    name.includes("table") ||
    name.includes("chair") ||
    name.includes("desk") ||
    name.includes("cabinet")
  ) {
    std.metalness = 0;
    std.roughness = 0.78;
    // Slight warm grade toward Cute Furniture Free woods without replacing hue
    const c = std.color;
    c.r = Math.min(1, c.r * 1.04);
    c.g = Math.min(1, c.g * 1.01);
    c.b = Math.min(1, c.b * 0.96);
  } else if (
    name.includes("fabric") ||
    name.includes("carpet") ||
    name.includes("cloth") ||
    name.includes("cushion") ||
    name.includes("textile")
  ) {
    std.metalness = 0;
    std.roughness = 0.92;
  } else if (name.includes("plant") || name.includes("leaf") || name.includes("foliage")) {
    std.metalness = 0;
    std.roughness = 0.7;
  } else if (name.includes("plastic") || name.includes("rubber")) {
    std.metalness = 0.02;
    std.roughness = 0.55;
  } else {
    // Matte clay default — keep Kenney vertex colors readable
    std.metalness = Math.min(std.metalness || 0, 0.06);
    std.roughness = Math.max(std.roughness || 0.7, 0.68);
  }
}

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
  grounded = true,
}: Props) {
  const { scene } = useGLTF(`/models/kenney/${name}.glb`);
  const { root, footOffset } = useMemo(() => {
    const cloned = scene.clone(true);
    cloneMaterials(cloned);
    cloned.position.set(0, 0, 0);
    cloned.rotation.set(0, 0, 0);
    cloned.scale.set(1, 1, 1);
    cloned.updateMatrixWorld(true);
    // Prefer geometry AABBs so empty scene roots / helpers cannot skew the foot.
    const box = new THREE.Box3();
    let hasMesh = false;
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      hasMesh = true;
      mesh.geometry.computeBoundingBox();
      if (!mesh.geometry.boundingBox) return;
      const local = mesh.geometry.boundingBox.clone();
      local.applyMatrix4(mesh.matrixWorld);
      box.union(local);
    });
    if (!hasMesh) box.setFromObject(cloned);
    // Snap feet to local Y=0 (handles outlier pivots like tableRound / bathroomSink)
    const offset =
      grounded && Number.isFinite(box.min.y) && box.min.y !== Infinity
        ? -box.min.y
        : 0;
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const std = m as THREE.MeshStandardMaterial;
        if (std?.isMeshStandardMaterial) tuneKenneyMaterial(std);
      });
    });
    return { root: cloned, footOffset: offset };
  }, [scene, grounded]);

  const group = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    // Selection UX lives on the floor ring only — do not emissive-tint meshes
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const std = m as THREE.MeshStandardMaterial;
        if (!std?.isMeshStandardMaterial) return;
        std.emissive.setHex(0x000000);
        std.emissiveIntensity = 0;
        std.needsUpdate = true;
      });
    });
  }, [root, selected, hovered, hasWork]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    // Furniture stays planted — no Y bob/lift
    group.current.position.y = position[1];
    const targetScale = hovered || selected ? 1.045 : 1;
    const s = group.current.scale;
    const base = (group.current.userData.baseScale as number) || 1;
    const next = THREE.MathUtils.lerp(s.x / base, targetScale, 0.18) * base;
    s.setScalar(next);

    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      if (hasWork && !selected && !hovered) {
        mat.opacity = 0.28 + Math.sin(clock.getElapsedTime() * 2.4) * 0.1;
      }
    }
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
      <primitive object={root} position={[0, footOffset, 0]} />
      {(hovered || selected || hasWork) && (
        <mesh
          ref={ringRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.012, 0]}
        >
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
