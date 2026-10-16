import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Bounds,
  Center,
  ContactShadows,
  Html,
  OrbitControls,
  useGLTF,
  useProgress,
} from "@react-three/drei";
import { Box, RotateCcw } from "lucide-react";
import * as THREE from "three";

const MODEL_URL = `${import.meta.env.BASE_URL}models/cabine-interativa-V1.1-G7.glb`;

function LoadingModel() {
  const { progress } = useProgress();

  return (
    <Html center>
      <div className="min-w-52 rounded-2xl border border-slate-600 bg-[#171a1f]/95 p-5 text-center shadow-2xl backdrop-blur">
        <p className="text-sm font-black text-white">Carregando cabine 3D</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700">
          <div
            className="h-full rounded-full bg-[#d10f43] transition-[width] duration-300"
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>
        <p className="mt-2 text-xs font-bold text-slate-300">
          {Math.round(progress)}%
        </p>
      </div>
    </Html>
  );
}

function CabinModel() {
  const { scene } = useGLTF(MODEL_URL);
  const model = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    model.traverse((object) => {
      object.visible = true;

      if (!object.isMesh) return;

      object.frustumCulled = false;
      object.castShadow = true;
      object.receiveShadow = true;

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];

      materials.filter(Boolean).forEach((material) => {
        material.visible = true;
        material.side = THREE.DoubleSide;
        material.transparent = false;
        material.opacity = 1;
        material.depthWrite = true;
        material.depthTest = true;
        material.needsUpdate = true;
      });
    });
  }, [model]);

  return (
    <Center>
      <primitive object={model} />
    </Center>
  );
}

export default function Viewer3D() {
  const [cameraKey, setCameraKey] = useState(0);

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-700 bg-[#171a1f] shadow-xl">
      <div className="flex flex-col gap-4 border-b border-slate-700 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-[#ef1855]">
            <Box size={15} /> Visualização técnica
          </p>
          <h2 className="mt-1 text-xl font-black text-white">Cabine 3D G7</h2>
          <p className="mt-1 text-sm text-slate-400">
            Arraste para girar, use a roda para aplicar zoom e o botão direito para mover.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCameraKey((current) => current + 1)}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-600 bg-[#20242a] px-4 text-sm font-black text-white transition hover:border-[#d10f43] hover:bg-[#2a2025]"
        >
          <RotateCcw size={16} />
          Restaurar visão
        </button>
      </div>

      <div className="relative h-[68vh] min-h-[520px] w-full bg-gradient-to-b from-[#20242a] to-[#0f1114]">
        <Canvas
          key={cameraKey}
          camera={{ position: [7, 5, 9], fov: 42, near: 0.01, far: 2000 }}
          dpr={[1, 1.75]}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          shadows
        >
          <color attach="background" args={["#111419"]} />
          <ambientLight intensity={1.8} />
          <hemisphereLight args={["#dbeafe", "#1e293b", 1.4]} />
          <directionalLight
            position={[8, 12, 8]}
            intensity={3.2}
            castShadow
          />
          <directionalLight position={[-8, 5, -6]} intensity={1.5} />

          <Suspense fallback={<LoadingModel />}>
            <Bounds fit clip observe margin={1.15}>
              <CabinModel />
            </Bounds>
            <ContactShadows
              position={[0, -2.6, 0]}
              opacity={0.35}
              scale={24}
              blur={2.5}
              far={10}
            />
          </Suspense>

          <gridHelper args={[30, 30, "#46505e", "#242a33"]} position={[0, -2.65, 0]} />
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            minDistance={2}
            maxDistance={40}
            maxPolarAngle={Math.PI * 0.92}
          />
        </Canvas>

        <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-[11px] font-bold text-slate-300 backdrop-blur">
          Modelo: cabine-interativa-V1.1-G7.glb
        </div>
      </div>
    </section>
  );
}

useGLTF.preload(MODEL_URL);
