"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { RestaurantBuilding } from "./RestaurantBuilding";
import { ZoneHotspot } from "./ZoneHotspot";
import { ZONE_IDS, ZONES, type RestaurantZone } from "@/lib/zones";

export type ScenePendiente = {
  id: string;
  title: string;
  zone: string;
  estado: string;
  prioridad: string;
};

type Props = {
  pendientes: ScenePendiente[];
  focusedZone: RestaurantZone | null;
  onFocusZone: (zone: RestaurantZone | null) => void;
};

function CameraRig({
  focusedZone,
  controlsRef,
}: {
  focusedZone: RestaurantZone | null;
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 0.8, 0));
  const desiredCam = useRef(new THREE.Vector3(6.5, 4.2, 7.5));

  useEffect(() => {
    if (focusedZone) {
      const z = ZONES[focusedZone];
      desiredCam.current.set(...z.camera);
      target.current.set(...z.lookAt);
    } else {
      desiredCam.current.set(6.5, 4.2, 7.5);
      target.current.set(0, 0.8, 0);
    }
  }, [focusedZone]);

  useEffect(() => {
    let frame = 0;
    const animate = () => {
      frame += 1;
      camera.position.lerp(desiredCam.current, 0.08);
      if (controlsRef.current) {
        controlsRef.current.target.lerp(target.current, 0.1);
        controlsRef.current.update();
      }
      if (frame < 60) requestAnimationFrame(animate);
    };
    animate();
  }, [focusedZone, camera, controlsRef]);

  return null;
}

function SceneInner({ pendientes, focusedZone, onFocusZone }: Props) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRotate = useRef(true);

  const counts = useMemo(() => {
    const map = new Map<RestaurantZone, number>();
    for (const id of ZONE_IDS) map.set(id, 0);
    for (const p of pendientes) {
      if (p.estado === "HECHO") continue;
      const zone = (ZONE_IDS.includes(p.zone as RestaurantZone)
        ? p.zone
        : "oficina") as RestaurantZone;
      map.set(zone, (map.get(zone) || 0) + 1);
    }
    return map;
  }, [pendientes]);

  const zonesWithWork = useMemo(() => {
    const set = new Set<RestaurantZone>();
    counts.forEach((n, id) => {
      if (n > 0) set.add(id);
    });
    return set;
  }, [counts]);

  const bumpIdle = () => {
    autoRotate.current = false;
    if (controlsRef.current) controlsRef.current.autoRotate = false;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      autoRotate.current = true;
      if (controlsRef.current && !focusedZone) {
        controlsRef.current.autoRotate = true;
      }
    }, 3500);
  };

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = !focusedZone && autoRotate.current;
    }
  }, [focusedZone]);

  return (
    <>
      <color attach="background" args={["#d9e8c8"]} />
      <fog attach="fog" args={["#d9e8c8", 14, 28]} />
      <ambientLight intensity={0.65} />
      <directionalLight
        castShadow
        position={[8, 12, 6]}
        intensity={1.15}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <hemisphereLight args={["#fef3c7", "#86a87a", 0.35]} />

      <RestaurantBuilding focusedZone={focusedZone} zonesWithWork={zonesWithWork} />

      {ZONE_IDS.map((zone) => (
        <ZoneHotspot
          key={zone}
          zone={zone}
          count={counts.get(zone) || 0}
          active={focusedZone === zone}
          onSelect={(z) => {
            bumpIdle();
            onFocusZone(focusedZone === z ? null : z);
          }}
        />
      ))}

      <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={16} blur={2.2} />
      <Environment preset="park" />

      <CameraRig focusedZone={focusedZone} controlsRef={controlsRef} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        autoRotate={!focusedZone}
        autoRotateSpeed={0.55}
        minDistance={3.5}
        maxDistance={16}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 0.8, 0]}
        onStart={bumpIdle}
        onChange={bumpIdle}
      />
    </>
  );
}

export function RestaurantScene(props: Props) {
  return (
    <div className="restaurant-canvas">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [6.5, 4.2, 7.5], fov: 42, near: 0.1, far: 60 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onPointerMissed={() => props.onFocusZone(null)}
      >
        <Suspense fallback={null}>
          <SceneInner {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
}
