"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
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

const DEFAULT_CAM: [number, number, number] = [12.5, 9.2, 13.5];
const DEFAULT_TARGET: [number, number, number] = [0, 0.55, 0.6];

function CameraRig({
  focusedZone,
  controlsRef,
}: {
  focusedZone: RestaurantZone | null;
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(...DEFAULT_TARGET));
  const desiredCam = useRef(new THREE.Vector3(...DEFAULT_CAM));

  useEffect(() => {
    if (focusedZone) {
      const z = ZONES[focusedZone];
      desiredCam.current.set(...z.camera);
      target.current.set(...z.lookAt);
    } else {
      desiredCam.current.set(...DEFAULT_CAM);
      target.current.set(...DEFAULT_TARGET);
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
    }, 4500);
  };

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = !focusedZone && autoRotate.current;
    }
  }, [focusedZone]);

  const selectZone = (zone: RestaurantZone) => {
    bumpIdle();
    onFocusZone(focusedZone === zone ? null : zone);
  };

  return (
    <>
      <color attach="background" args={["#f3ebe0"]} />
      {/* No scene fog / SoftShadows / Environment — keep clay props crisp */}

      <ambientLight intensity={0.75} />
      <directionalLight
        castShadow
        position={[10, 16, 8]}
        intensity={1.55}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00015}
        shadow-camera-far={40}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        color="#ffffff"
      />
      <directionalLight position={[-8, 6, -5]} intensity={0.35} color="#e8eef7" />
      <hemisphereLight args={["#fffaf3", "#c4b8a8", 0.35]} />

      <RestaurantBuilding
        focusedZone={focusedZone}
        zonesWithWork={zonesWithWork}
        onSelectZone={selectZone}
      />

      {ZONE_IDS.map((zone) => (
        <ZoneHotspot
          key={zone}
          zone={zone}
          count={counts.get(zone) || 0}
          active={focusedZone === zone}
          onSelect={selectZone}
        />
      ))}

      <ContactShadows
        position={[0, -0.48, 0.8]}
        opacity={0.28}
        scale={24}
        blur={1.4}
        far={12}
      />

      <CameraRig focusedZone={focusedZone} controlsRef={controlsRef} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        autoRotate={!focusedZone}
        autoRotateSpeed={0.35}
        minDistance={4}
        maxDistance={36}
        minPolarAngle={0.25}
        maxPolarAngle={Math.PI / 2.05}
        zoomSpeed={1.2}
        target={DEFAULT_TARGET}
        onStart={bumpIdle}
        onEnd={bumpIdle}
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
        camera={{ position: DEFAULT_CAM, fov: 38, near: 0.1, far: 100 }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
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
