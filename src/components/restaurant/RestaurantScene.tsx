"use client";

import { Canvas, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  OrbitControls,
  SoftShadows,
} from "@react-three/drei";
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
  const target = useRef(new THREE.Vector3(0, 0.55, 0.2));
  const desiredCam = useRef(new THREE.Vector3(5.8, 4.6, 6.4));

  useEffect(() => {
    if (focusedZone) {
      const z = ZONES[focusedZone];
      desiredCam.current.set(...z.camera);
      target.current.set(...z.lookAt);
    } else {
      desiredCam.current.set(5.8, 4.6, 6.4);
      target.current.set(0, 0.55, 0.2);
    }
  }, [focusedZone]);

  useEffect(() => {
    let frame = 0;
    const animate = () => {
      frame += 1;
      camera.position.lerp(desiredCam.current, 0.085);
      if (controlsRef.current) {
        controlsRef.current.target.lerp(target.current, 0.1);
        controlsRef.current.update();
      }
      if (frame < 70) requestAnimationFrame(animate);
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
      <color attach="background" args={["#f4efe6"]} />
      <fog attach="fog" args={["#f4efe6", 16, 32]} />
      <SoftShadows size={18} samples={10} focus={0.85} />

      <ambientLight intensity={0.55} />
      <directionalLight
        castShadow
        position={[7, 11, 5]}
        intensity={1.35}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0002}
        color="#fff4e5"
      />
      <directionalLight position={[-5, 4, -3]} intensity={0.35} color="#dbeafe" />
      <hemisphereLight args={["#fff7ed", "#a8a29e", 0.45]} />

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

      <ContactShadows
        position={[0, -0.48, 0.4]}
        opacity={0.45}
        scale={14}
        blur={2.4}
        far={8}
      />
      <Environment preset="apartment" environmentIntensity={0.55} />

      <CameraRig focusedZone={focusedZone} controlsRef={controlsRef} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        autoRotate={!focusedZone}
        autoRotateSpeed={0.45}
        minDistance={4}
        maxDistance={14}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2.15}
        target={[0, 0.55, 0.2]}
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
        camera={{ position: [5.8, 4.6, 6.4], fov: 38, near: 0.1, far: 70 }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        onPointerMissed={() => props.onFocusZone(null)}
      >
        <Suspense fallback={null}>
          <SceneInner {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
}
