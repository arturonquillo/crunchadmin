"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { RestaurantZone } from "@/lib/zones";
import { KenneyProp } from "./KenneyProp";

type Props = {
  focusedZone: RestaurantZone | null;
  zonesWithWork: Set<RestaurantZone>;
  onSelectZone: (zone: RestaurantZone) => void;
};

const ROOM = { cx: 0, cz: -0.2, halfX: 3.5, halfZ: 3.0 };

function ClayFloor({
  position,
  args,
  color,
}: {
  position: [number, number, number];
  args: [number, number, number];
  color: string;
}) {
  return (
    <RoundedBox
      position={position}
      args={args}
      radius={0.06}
      smoothness={3}
      receiveShadow
      castShadow
    >
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.06} />
    </RoundedBox>
  );
}

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
    const outside = fromCenter.dot(out);
    const target = outside > 0.1 ? 0 : outside > -0.08 ? 0.28 : 0.92;
    mat.current.opacity = THREE.MathUtils.lerp(mat.current.opacity, target, 0.16);
    mat.current.transparent = true;
    mat.current.depthWrite = mat.current.opacity > 0.55;
  });

  return (
    <RoundedBox position={position} args={args} radius={0.05} smoothness={3} castShadow>
      <meshStandardMaterial
        ref={mat}
        color={accent ? "#ea580c" : color}
        roughness={0.48}
        metalness={0.04}
        transparent
        opacity={0.92}
        emissive={accent ? "#c2410c" : "#000000"}
        emissiveIntensity={accent ? 0.35 : 0}
      />
    </RoundedBox>
  );
}

function SelectableWallPanel({
  selected,
  hasWork,
  onSelect,
}: {
  selected: boolean;
  hasWork: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    const pulse = hasWork ? 0.25 + Math.sin(clock.getElapsedTime() * 2.2) * 0.15 : 0;
    mat.emissiveIntensity = selected ? 0.55 : hovered ? 0.35 : pulse;
  });

  return (
    <RoundedBox
      ref={ref}
      position={[0, 1.05, 2.72]}
      args={[1.9, 1.85, 0.12]}
      radius={0.08}
      smoothness={3}
      castShadow
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
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
      <meshStandardMaterial
        color={hasWork || selected ? "#ea580c" : "#ffedd5"}
        roughness={0.45}
        emissive={hasWork || selected || hovered ? "#c2410c" : "#000000"}
        emissiveIntensity={hasWork ? 0.3 : 0}
      />
    </RoundedBox>
  );
}

export function RestaurantBuilding({
  focusedZone,
  zonesWithWork,
  onSelectZone,
}: Props) {
  const wallWork = zonesWithWork.has("pared_entrada");
  const cocinaWork = zonesWithWork.has("cocina");
  const barraWork = zonesWithWork.has("barra");
  const salonWork = zonesWithWork.has("salon");
  const banoWork = zonesWithWork.has("bano");
  const oficinaWork = zonesWithWork.has("oficina");
  const exteriorWork = zonesWithWork.has("exterior");

  return (
    <group>
      <ClayFloor position={[0, -0.32, 0.35]} args={[10.5, 0.5, 11.5]} color="#292524" />
      <ClayFloor position={[0, -0.04, 0.35]} args={[9.8, 0.12, 10.8]} color="#44403c" />
      <ClayFloor position={[0, 0.05, -0.2]} args={[7.0, 0.1, 6.0]} color="#f5e6d0" />
      <ClayFloor position={[0.6, 0.06, 4.15]} args={[4.2, 0.1, 2.3]} color="#57534e" />

      <SmartWall
        position={[0, 1.2, ROOM.cz + ROOM.halfZ]}
        args={[7.0, 2.35, 0.14]}
        outward={[0, 0, 1]}
        color="#f3e7d6"
        accent={wallWork || focusedZone === "pared_entrada"}
      />
      <SmartWall
        position={[0, 1.2, ROOM.cz - ROOM.halfZ]}
        args={[7.0, 2.35, 0.14]}
        outward={[0, 0, -1]}
        color="#efe2cf"
      />
      <SmartWall
        position={[-ROOM.halfX, 1.2, ROOM.cz]}
        args={[0.14, 2.35, 6.0]}
        outward={[-1, 0, 0]}
        color="#f0e4d2"
      />
      <SmartWall
        position={[ROOM.halfX, 1.2, ROOM.cz]}
        args={[0.14, 2.35, 6.0]}
        outward={[1, 0, 0]}
        color="#f0e4d2"
      />

      <SelectableWallPanel
        selected={focusedZone === "pared_entrada"}
        hasWork={wallWork}
        onSelect={() => onSelectZone("pared_entrada")}
      />

      <RoundedBox position={[0, 2.25, 2.45]} args={[4.4, 0.14, 1.15]} radius={0.07} castShadow>
        <meshStandardMaterial color="#f97316" roughness={0.4} />
      </RoundedBox>

      {/* Salón */}
      <KenneyProp name="tableCloth" zone="salon" position={[-0.7, 0.1, 0.9]} scale={1.15} selected={focusedZone === "salon"} hasWork={salonWork} onSelect={onSelectZone} />
      <KenneyProp name="chairRounded" zone="salon" position={[-1.35, 0.1, 0.9]} rotation={[0, Math.PI / 2, 0]} scale={1.05} selected={focusedZone === "salon"} hasWork={salonWork} onSelect={onSelectZone} />
      <KenneyProp name="chairRounded" zone="salon" position={[-0.05, 0.1, 0.9]} rotation={[0, -Math.PI / 2, 0]} scale={1.05} selected={focusedZone === "salon"} hasWork={salonWork} onSelect={onSelectZone} />
      <KenneyProp name="tableRound" zone="salon" position={[1.25, 0.1, 0.55]} scale={1.2} selected={focusedZone === "salon"} hasWork={salonWork} onSelect={onSelectZone} />
      <KenneyProp name="chair" zone="salon" position={[1.25, 0.1, 1.15]} scale={1.05} selected={focusedZone === "salon"} hasWork={salonWork} onSelect={onSelectZone} />
      <KenneyProp name="tableCross" zone="salon" position={[0.35, 0.1, 1.75]} scale={1.1} selected={focusedZone === "salon"} hasWork={salonWork} onSelect={onSelectZone} />
      <KenneyProp name="chairCushion" zone="salon" position={[0.95, 0.1, 1.75]} rotation={[0, -Math.PI / 2, 0]} scale={1.05} selected={focusedZone === "salon"} hasWork={salonWork} onSelect={onSelectZone} />

      {/* Barra */}
      <KenneyProp name="kitchenBar" zone="barra" position={[-2.25, 0.1, 0.2]} rotation={[0, Math.PI / 2, 0]} scale={1.25} selected={focusedZone === "barra"} hasWork={barraWork} onSelect={onSelectZone} workColor="#c2410c" />
      <KenneyProp name="kitchenBarEnd" zone="barra" position={[-2.25, 0.1, 1.35]} rotation={[0, Math.PI / 2, 0]} scale={1.2} selected={focusedZone === "barra"} hasWork={barraWork} onSelect={onSelectZone} workColor="#c2410c" />
      <KenneyProp name="stoolBar" zone="barra" position={[-1.45, 0.1, 0.0]} scale={1.1} selected={focusedZone === "barra"} hasWork={barraWork} onSelect={onSelectZone} />
      <KenneyProp name="stoolBarSquare" zone="barra" position={[-1.45, 0.1, 0.75]} scale={1.1} selected={focusedZone === "barra"} hasWork={barraWork} onSelect={onSelectZone} />
      <KenneyProp name="kitchenCoffeeMachine" zone="barra" position={[-2.25, 0.95, -0.55]} scale={1.15} selected={focusedZone === "barra"} hasWork={barraWork} onSelect={onSelectZone} />

      {/* Cocina */}
      <KenneyProp name="kitchenCabinet" zone="cocina" position={[-1.1, 0.1, -2.35]} scale={1.2} selected={focusedZone === "cocina"} hasWork={cocinaWork} onSelect={onSelectZone} workColor="#ea580c" />
      <KenneyProp name="kitchenCabinetDrawer" zone="cocina" position={[0.1, 0.1, -2.35]} scale={1.2} selected={focusedZone === "cocina"} hasWork={cocinaWork} onSelect={onSelectZone} workColor="#ea580c" />
      <KenneyProp name="kitchenSink" zone="cocina" position={[1.2, 0.1, -2.35]} scale={1.15} selected={focusedZone === "cocina"} hasWork={cocinaWork} onSelect={onSelectZone} workColor="#ea580c" />
      <KenneyProp name="kitchenFridge" zone="cocina" position={[-2.35, 0.1, -2.2]} rotation={[0, Math.PI / 2, 0]} scale={1.25} selected={focusedZone === "cocina"} hasWork={cocinaWork} onSelect={onSelectZone} workColor="#ea580c" />
      <KenneyProp name="kitchenStove" zone="cocina" position={[2.2, 0.1, -2.3]} scale={1.15} selected={focusedZone === "cocina"} hasWork={cocinaWork} onSelect={onSelectZone} workColor="#ea580c" />
      <KenneyProp name="kitchenMicrowave" zone="cocina" position={[0.1, 1.05, -2.35]} scale={1.1} selected={focusedZone === "cocina"} hasWork={cocinaWork} onSelect={onSelectZone} />
      <KenneyProp name="kitchenBlender" zone="cocina" position={[1.55, 1.0, -2.2]} scale={1.2} selected={focusedZone === "cocina"} hasWork={cocinaWork} onSelect={onSelectZone} />
      {cocinaWork && (
        <>
          <KenneyProp name="cardboardBoxOpen" zone="cocina" position={[0.7, 0.1, -1.55]} scale={1.1} selected={focusedZone === "cocina"} hasWork onSelect={onSelectZone} workColor="#ea580c" />
          <KenneyProp name="cardboardBoxClosed" zone="cocina" position={[1.25, 0.1, -1.45]} rotation={[0, 0.4, 0]} scale={1.0} selected={focusedZone === "cocina"} hasWork onSelect={onSelectZone} workColor="#ea580c" />
        </>
      )}

      {/* Baño */}
      <KenneyProp name="bathroomSink" zone="bano" position={[2.55, 0.1, -1.55]} scale={1.2} selected={focusedZone === "bano"} hasWork={banoWork} onSelect={onSelectZone} workColor="#0ea5e9" />
      <RoundedBox
        position={[2.55, 0.95, -1.55]}
        args={[1.5, 1.7, 1.5]}
        radius={0.1}
        onClick={(e) => {
          e.stopPropagation();
          onSelectZone("bano");
        }}
      >
        <meshStandardMaterial
          color={banoWork || focusedZone === "bano" ? "#7dd3fc" : "#e0f2fe"}
          transparent
          opacity={0.35}
          roughness={0.35}
        />
      </RoundedBox>

      {/* Oficina */}
      <KenneyProp name="desk" zone="oficina" position={[2.5, 0.1, 1.35]} rotation={[0, -Math.PI / 2, 0]} scale={1.15} selected={focusedZone === "oficina"} hasWork={oficinaWork} onSelect={onSelectZone} workColor="#78716c" />
      <KenneyProp name="chairDesk" zone="oficina" position={[2.5, 0.1, 2.0]} scale={1.05} selected={focusedZone === "oficina"} hasWork={oficinaWork} onSelect={onSelectZone} workColor="#78716c" />

      {/* Exterior */}
      <KenneyProp name="tableRound" zone="exterior" position={[0.7, 0.12, 4.15]} scale={1.15} selected={focusedZone === "exterior"} hasWork={exteriorWork} onSelect={onSelectZone} workColor="#65a30d" />
      <KenneyProp name="chair" zone="exterior" position={[1.35, 0.12, 4.15]} rotation={[0, -Math.PI / 2, 0]} scale={1.05} selected={focusedZone === "exterior"} hasWork={exteriorWork} onSelect={onSelectZone} workColor="#65a30d" />
      <KenneyProp name="chair" zone="exterior" position={[0.05, 0.12, 4.15]} rotation={[0, Math.PI / 2, 0]} scale={1.05} selected={focusedZone === "exterior"} hasWork={exteriorWork} onSelect={onSelectZone} workColor="#65a30d" />
      <KenneyProp name="pottedPlant" zone="exterior" position={[2.25, 0.12, 4.4]} scale={1.2} selected={focusedZone === "exterior"} hasWork={exteriorWork} onSelect={onSelectZone} workColor="#65a30d" />
      <KenneyProp name="plantSmall1" zone="exterior" position={[-1.5, 0.12, 3.7]} scale={1.15} selected={focusedZone === "exterior"} hasWork={exteriorWork} onSelect={onSelectZone} workColor="#65a30d" />
      <KenneyProp name="plantSmall2" zone="salon" position={[2.7, 0.1, 0.2]} scale={1.1} selected={focusedZone === "salon"} hasWork={salonWork} onSelect={onSelectZone} />

      {[
        [-0.7, 0.9],
        [1.25, 0.55],
        [0.35, 1.75],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 2.15, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.5, 8]} />
            <meshStandardMaterial color="#a8a29e" />
          </mesh>
          <mesh position={[0, 1.82, 0]} castShadow>
            <sphereGeometry args={[0.14, 16, 16]} />
            <meshStandardMaterial color="#ffedd5" emissive="#fdba74" emissiveIntensity={0.7} />
          </mesh>
          <pointLight position={[0, 1.7, 0]} intensity={0.4} distance={4} color="#ffd7a8" />
        </group>
      ))}
    </group>
  );
}
