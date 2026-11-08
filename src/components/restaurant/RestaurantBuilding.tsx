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

/** Larger open floor plan so props/hotspots breathe */
const ROOM = { cx: 0, cz: 0.2, halfX: 5.6, halfZ: 5.0 };

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
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.02} />
    </RoundedBox>
  );
}

/** Hide wall when camera is outside that face — snap opaque ↔ gone (no hazy mid fade). */
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
  const mesh = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const out = useMemo(() => new THREE.Vector3(...outward).normalize(), [outward]);

  useFrame(() => {
    if (!mesh.current) return;
    const fromCenter = new THREE.Vector3(
      camera.position.x - ROOM.cx,
      0,
      camera.position.z - ROOM.cz
    ).normalize();
    const outside = fromCenter.dot(out);
    mesh.current.visible = outside < 0.05;
  });

  return (
    <RoundedBox
      ref={mesh}
      position={position}
      args={args}
      radius={0.05}
      smoothness={3}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={accent ? "#ea580c" : color}
        roughness={0.55}
        metalness={0.02}
        emissive={accent ? "#c2410c" : "#000000"}
        emissiveIntensity={accent ? 0.28 : 0}
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
    const pulse = hasWork ? 0.22 + Math.sin(clock.getElapsedTime() * 2.2) * 0.12 : 0;
    mat.emissiveIntensity = selected ? 0.5 : hovered ? 0.32 : pulse;
  });

  return (
    <RoundedBox
      ref={ref}
      position={[0, 1.15, ROOM.cz + ROOM.halfZ - 0.08]}
      args={[2.4, 2.0, 0.14]}
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
        roughness={0.5}
        emissive={hasWork || selected || hovered ? "#c2410c" : "#000000"}
        emissiveIntensity={hasWork ? 0.25 : 0}
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
      {/* Pedestal */}
      <ClayFloor position={[0, -0.34, 1.0]} args={[16, 0.5, 18]} color="#292524" />
      <ClayFloor position={[0, -0.05, 1.0]} args={[15, 0.12, 17]} color="#44403c" />
      {/* Interior floor */}
      <ClayFloor position={[0, 0.05, ROOM.cz]} args={[11.2, 0.1, 10.0]} color="#f5e6d0" />
      {/* Exterior deck */}
      <ClayFloor position={[0.6, 0.06, 7.0]} args={[6.5, 0.1, 3.4]} color="#57534e" />

      <SmartWall
        position={[0, 1.25, ROOM.cz + ROOM.halfZ]}
        args={[11.2, 2.45, 0.14]}
        outward={[0, 0, 1]}
        color="#f3e7d6"
        accent={wallWork || focusedZone === "pared_entrada"}
      />
      <SmartWall
        position={[0, 1.25, ROOM.cz - ROOM.halfZ]}
        args={[11.2, 2.45, 0.14]}
        outward={[0, 0, -1]}
        color="#efe2cf"
      />
      <SmartWall
        position={[-ROOM.halfX, 1.25, ROOM.cz]}
        args={[0.14, 2.45, 10.0]}
        outward={[-1, 0, 0]}
        color="#f0e4d2"
      />
      <SmartWall
        position={[ROOM.halfX, 1.25, ROOM.cz]}
        args={[0.14, 2.45, 10.0]}
        outward={[1, 0, 0]}
        color="#f0e4d2"
      />

      <SelectableWallPanel
        selected={focusedZone === "pared_entrada"}
        hasWork={wallWork}
        onSelect={() => onSelectZone("pared_entrada")}
      />

      {/* Awning lip only — not a roof */}
      <RoundedBox position={[0, 2.35, 4.55]} args={[5.2, 0.14, 1.35]} radius={0.07} castShadow>
        <meshStandardMaterial color="#f97316" roughness={0.45} />
      </RoundedBox>

      {/* ——— SALÓN (spaced tables) ——— */}
      <KenneyProp name="tableCloth" zone="salon" position={[-1.9, 0.1, 1.4]} scale={1.15} selected={focusedZone === "salon"} hasWork={salonWork} onSelect={onSelectZone} />
      <KenneyProp name="chairRounded" zone="salon" position={[-2.7, 0.1, 1.4]} rotation={[0, Math.PI / 2, 0]} scale={1.05} selected={focusedZone === "salon"} hasWork={salonWork} onSelect={onSelectZone} />
      <KenneyProp name="chairRounded" zone="salon" position={[-1.1, 0.1, 1.4]} rotation={[0, -Math.PI / 2, 0]} scale={1.05} selected={focusedZone === "salon"} hasWork={salonWork} onSelect={onSelectZone} />

      <KenneyProp name="tableRound" zone="salon" position={[1.9, 0.1, 0.3]} scale={1.2} selected={focusedZone === "salon"} hasWork={salonWork} onSelect={onSelectZone} />
      <KenneyProp name="chair" zone="salon" position={[1.9, 0.1, 1.15]} scale={1.05} selected={focusedZone === "salon"} hasWork={salonWork} onSelect={onSelectZone} />
      <KenneyProp name="chair" zone="salon" position={[1.9, 0.1, -0.55]} rotation={[0, Math.PI, 0]} scale={1.05} selected={focusedZone === "salon"} hasWork={salonWork} onSelect={onSelectZone} />

      <KenneyProp name="tableCross" zone="salon" position={[0.15, 0.1, 2.85]} scale={1.1} selected={focusedZone === "salon"} hasWork={salonWork} onSelect={onSelectZone} />
      <KenneyProp name="chairCushion" zone="salon" position={[0.95, 0.1, 2.85]} rotation={[0, -Math.PI / 2, 0]} scale={1.05} selected={focusedZone === "salon"} hasWork={salonWork} onSelect={onSelectZone} />
      <KenneyProp name="chairCushion" zone="salon" position={[-0.65, 0.1, 2.85]} rotation={[0, Math.PI / 2, 0]} scale={1.05} selected={focusedZone === "salon"} hasWork={salonWork} onSelect={onSelectZone} />
      <KenneyProp name="plantSmall2" zone="salon" position={[3.3, 0.1, 1.6]} scale={1.1} selected={focusedZone === "salon"} hasWork={salonWork} onSelect={onSelectZone} />

      {/* ——— BARRA (left wing) ——— */}
      <KenneyProp name="kitchenBar" zone="barra" position={[-4.0, 0.1, -0.3]} rotation={[0, Math.PI / 2, 0]} scale={1.25} selected={focusedZone === "barra"} hasWork={barraWork} onSelect={onSelectZone} workColor="#c2410c" />
      <KenneyProp name="kitchenBarEnd" zone="barra" position={[-4.0, 0.1, 1.3]} rotation={[0, Math.PI / 2, 0]} scale={1.2} selected={focusedZone === "barra"} hasWork={barraWork} onSelect={onSelectZone} workColor="#c2410c" />
      <KenneyProp name="stoolBar" zone="barra" position={[-2.95, 0.1, -0.5]} scale={1.1} selected={focusedZone === "barra"} hasWork={barraWork} onSelect={onSelectZone} />
      <KenneyProp name="stoolBarSquare" zone="barra" position={[-2.95, 0.1, 0.55]} scale={1.1} selected={focusedZone === "barra"} hasWork={barraWork} onSelect={onSelectZone} />
      <KenneyProp name="stoolBar" zone="barra" position={[-2.95, 0.1, 1.5]} scale={1.1} selected={focusedZone === "barra"} hasWork={barraWork} onSelect={onSelectZone} />
      <KenneyProp name="kitchenCoffeeMachine" zone="barra" position={[-4.0, 0.95, -1.3]} scale={1.15} selected={focusedZone === "barra"} hasWork={barraWork} onSelect={onSelectZone} />

      {/* ——— COCINA (back wall run) ——— */}
      <KenneyProp name="kitchenFridge" zone="cocina" position={[-3.6, 0.1, -4.0]} rotation={[0, Math.PI / 2, 0]} scale={1.25} selected={focusedZone === "cocina"} hasWork={cocinaWork} onSelect={onSelectZone} workColor="#ea580c" />
      <KenneyProp name="kitchenCabinet" zone="cocina" position={[-1.8, 0.1, -4.15]} scale={1.2} selected={focusedZone === "cocina"} hasWork={cocinaWork} onSelect={onSelectZone} workColor="#ea580c" />
      <KenneyProp name="kitchenCabinetDrawer" zone="cocina" position={[-0.2, 0.1, -4.15]} scale={1.2} selected={focusedZone === "cocina"} hasWork={cocinaWork} onSelect={onSelectZone} workColor="#ea580c" />
      <KenneyProp name="kitchenSink" zone="cocina" position={[1.5, 0.1, -4.15]} scale={1.15} selected={focusedZone === "cocina"} hasWork={cocinaWork} onSelect={onSelectZone} workColor="#ea580c" />
      <KenneyProp name="kitchenStove" zone="cocina" position={[3.3, 0.1, -4.1]} scale={1.15} selected={focusedZone === "cocina"} hasWork={cocinaWork} onSelect={onSelectZone} workColor="#ea580c" />
      <KenneyProp name="kitchenMicrowave" zone="cocina" position={[-0.2, 1.05, -4.15]} scale={1.1} selected={focusedZone === "cocina"} hasWork={cocinaWork} onSelect={onSelectZone} />
      <KenneyProp name="kitchenBlender" zone="cocina" position={[2.0, 1.0, -3.95]} scale={1.2} selected={focusedZone === "cocina"} hasWork={cocinaWork} onSelect={onSelectZone} />
      {cocinaWork && (
        <>
          <KenneyProp name="cardboardBoxOpen" zone="cocina" position={[0.6, 0.1, -2.7]} scale={1.1} selected={focusedZone === "cocina"} hasWork onSelect={onSelectZone} workColor="#ea580c" />
          <KenneyProp name="cardboardBoxClosed" zone="cocina" position={[1.4, 0.1, -2.5]} rotation={[0, 0.4, 0]} scale={1.0} selected={focusedZone === "cocina"} hasWork onSelect={onSelectZone} workColor="#ea580c" />
        </>
      )}

      {/* ——— BAÑO (right rear corner, opaque stall — no translucent fog box) ——— */}
      <RoundedBox position={[4.4, 1.1, -2.6]} args={[2.0, 2.15, 2.2]} radius={0.08} castShadow receiveShadow>
        <meshStandardMaterial color="#e7f5fe" roughness={0.55} />
      </RoundedBox>
      <KenneyProp name="bathroomSink" zone="bano" position={[4.4, 0.1, -2.2]} scale={1.2} selected={focusedZone === "bano"} hasWork={banoWork} onSelect={onSelectZone} workColor="#0ea5e9" />

      {/* ——— OFICINA (right front) ——— */}
      <KenneyProp name="desk" zone="oficina" position={[4.3, 0.1, 2.3]} rotation={[0, -Math.PI / 2, 0]} scale={1.15} selected={focusedZone === "oficina"} hasWork={oficinaWork} onSelect={onSelectZone} workColor="#78716c" />
      <KenneyProp name="chairDesk" zone="oficina" position={[4.3, 0.1, 3.15]} scale={1.05} selected={focusedZone === "oficina"} hasWork={oficinaWork} onSelect={onSelectZone} workColor="#78716c" />

      {/* ——— EXTERIOR terrace ——— */}
      <KenneyProp name="tableRound" zone="exterior" position={[0.6, 0.12, 6.9]} scale={1.15} selected={focusedZone === "exterior"} hasWork={exteriorWork} onSelect={onSelectZone} workColor="#65a30d" />
      <KenneyProp name="chair" zone="exterior" position={[1.45, 0.12, 6.9]} rotation={[0, -Math.PI / 2, 0]} scale={1.05} selected={focusedZone === "exterior"} hasWork={exteriorWork} onSelect={onSelectZone} workColor="#65a30d" />
      <KenneyProp name="chair" zone="exterior" position={[-0.25, 0.12, 6.9]} rotation={[0, Math.PI / 2, 0]} scale={1.05} selected={focusedZone === "exterior"} hasWork={exteriorWork} onSelect={onSelectZone} workColor="#65a30d" />
      <KenneyProp name="pottedPlant" zone="exterior" position={[2.8, 0.12, 7.3]} scale={1.2} selected={focusedZone === "exterior"} hasWork={exteriorWork} onSelect={onSelectZone} workColor="#65a30d" />
      <KenneyProp name="plantSmall1" zone="exterior" position={[-2.2, 0.12, 6.2]} scale={1.15} selected={focusedZone === "exterior"} hasWork={exteriorWork} onSelect={onSelectZone} workColor="#65a30d" />

      {/* Crisp hanging bulbs (no fog-like volume lights) */}
      {[
        [-1.9, 1.4],
        [1.9, 0.3],
        [0.15, 2.85],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 2.2, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.45, 8]} />
            <meshStandardMaterial color="#a8a29e" />
          </mesh>
          <mesh position={[0, 1.9, 0]} castShadow>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial color="#fff7ed" emissive="#fdba74" emissiveIntensity={0.55} />
          </mesh>
          <pointLight position={[0, 1.75, 0]} intensity={0.28} distance={3.5} color="#ffe4c4" />
        </group>
      ))}
    </group>
  );
}
