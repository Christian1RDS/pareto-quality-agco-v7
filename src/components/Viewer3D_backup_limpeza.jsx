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
import { Box, Eye, EyeOff, MousePointer2, RotateCcw, Undo2 } from "lucide-react";
import * as THREE from "three";

const MODEL_URL = `${import.meta.env.BASE_URL}models/cabine-interativa-V1.1-G7.glb`;
const PERMANENTLY_HIDDEN_PARTS = [];

function LoadingModel() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="min-w-52 rounded-2xl border border-slate-600 bg-[#171a1f]/95 p-5 text-center shadow-2xl backdrop-blur">
        <p className="text-sm font-black text-white">Carregando cabine 3D</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700">
          <div className="h-full rounded-full bg-[#d10f43] transition-[width] duration-300" style={{ width: `${Math.round(progress)}%` }} />
        </div>
        <p className="mt-2 text-xs font-bold text-slate-300">{Math.round(progress)}%</p>
      </div>
    </Html>
  );
}

function CabinModel({ selectionMode, selectedId, hiddenIds, onSelect }) {
  const { scene } = useGLTF(MODEL_URL);
  const model = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    model.traverse((object) => {
      object.visible = !PERMANENTLY_HIDDEN_PARTS.includes(object.name) && !hiddenIds.has(object.uuid);
      if (!object.isMesh) return;
      object.frustumCulled = false;
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      object.userData.originalMaterials ??= materials.map((material) => material?.clone());
      const originals = object.userData.originalMaterials;
      object.material = Array.isArray(object.material)
        ? originals.map((material) => material?.clone())
        : originals[0]?.clone();
      const currentMaterials = Array.isArray(object.material) ? object.material : [object.material];
      currentMaterials.filter(Boolean).forEach((material) => {
        material.visible = true;
        material.side = THREE.DoubleSide;
        material.transparent = false;
        material.opacity = 1;
        material.depthWrite = true;
        material.depthTest = true;
        if (object.uuid === selectedId) {
          material.color = new THREE.Color("#ff2d55");
          material.emissive = new THREE.Color("#7f1028");
          material.emissiveIntensity = 0.8;
        }
        material.needsUpdate = true;
      });
    });
  }, [model, hiddenIds, selectedId]);

  const handlePointerDown = (event) => {
    if (!selectionMode) return;
    event.stopPropagation();
    const object = event.object;
    onSelect({
      id: object.uuid,
      name: object.name || "SEM_NOME",
      type: object.type,
    });
  };

  return (
    <Center>
      <primitive object={model} onPointerDown={handlePointerDown} />
    </Center>
  );
}

export default function Viewer3D() {
  const [cameraKey, setCameraKey] = useState(0);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState(null);
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const [hiddenItems, setHiddenItems] = useState([]);

  const hideSelected = () => {
    if (!selected) return;
    setHiddenIds((current) => new Set([...current, selected.id]));
    setHiddenItems((current) => [...current, selected]);
    setSelected(null);
  };

  const restoreLast = () => {
    const last = hiddenItems.at(-1);
    if (!last) return;
    setHiddenItems((current) => current.slice(0, -1));
    setHiddenIds((current) => {
      const next = new Set(current);
      next.delete(last.id);
      return next;
    });
  };

  const restoreAll = () => {
    setHiddenIds(new Set());
    setHiddenItems([]);
    setSelected(null);
  };

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-700 bg-[#171a1f] shadow-xl">
      <div className="flex flex-col gap-4 border-b border-slate-700 p-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-[#ef1855]"><Box size={15}/> Visualização técnica</p>
          <h2 className="mt-1 text-xl font-black text-white">Cabine 3D G7</h2>
          <p className="mt-1 text-sm text-slate-400">Ative a seleção, clique somente no resíduo e oculte a peça selecionada.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setSelectionMode((value) => !value); setSelected(null); }} className={`flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-black transition ${selectionMode ? "border-amber-400 bg-amber-400/15 text-amber-200" : "border-slate-600 bg-[#20242a] text-white hover:border-[#d10f43]"}`}>
            <MousePointer2 size={16}/>{selectionMode ? "Seleção ativa" : "Selecionar resíduos"}
          </button>
          <button type="button" onClick={hideSelected} disabled={!selected} className="flex h-11 items-center gap-2 rounded-xl bg-[#d10f43] px-4 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-40"><EyeOff size={16}/>Ocultar selecionada</button>
          <button type="button" onClick={restoreLast} disabled={!hiddenItems.length} className="flex h-11 items-center gap-2 rounded-xl border border-slate-600 bg-[#20242a] px-4 text-sm font-black text-white disabled:opacity-40"><Undo2 size={16}/>Desfazer</button>
          <button type="button" onClick={restoreAll} className="flex h-11 items-center gap-2 rounded-xl border border-slate-600 bg-[#20242a] px-4 text-sm font-black text-white"><Eye size={16}/>Restaurar peças</button>
          <button type="button" onClick={() => setCameraKey((current) => current + 1)} className="flex h-11 items-center gap-2 rounded-xl border border-slate-600 bg-[#20242a] px-4 text-sm font-black text-white"><RotateCcw size={16}/>Restaurar visão</button>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[1fr_310px]">
        <div className="relative h-[68vh] min-h-[520px] bg-gradient-to-b from-[#20242a] to-[#0f1114]">
          <Canvas key={cameraKey} camera={{ position: [7,5,9], fov:42, near:0.01, far:2000 }} dpr={[1,1.75]} gl={{ antialias:true, powerPreference:"high-performance" }} shadows>
            <color attach="background" args={["#111419"]}/>
            <ambientLight intensity={1.8}/><hemisphereLight args={["#dbeafe","#1e293b",1.4]}/>
            <directionalLight position={[8,12,8]} intensity={3.2} castShadow/><directionalLight position={[-8,5,-6]} intensity={1.5}/>
            <Suspense fallback={<LoadingModel/>}>
              <Bounds fit clip observe margin={1.15}>
                <CabinModel selectionMode={selectionMode} selectedId={selected?.id} hiddenIds={hiddenIds} onSelect={setSelected}/>
              </Bounds>
              <ContactShadows position={[0,-2.6,0]} opacity={0.35} scale={24} blur={2.5} far={10}/>
            </Suspense>
            <gridHelper args={[30,30,"#46505e","#242a33"]} position={[0,-2.65,0]}/>
            <OrbitControls makeDefault enabled={!selectionMode} enableDamping dampingFactor={0.08} minDistance={2} maxDistance={40} maxPolarAngle={Math.PI*0.92}/>
          </Canvas>
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-[11px] font-bold text-slate-300 backdrop-blur">Modelo: cabine-interativa-V1.1-G7.glb</div>
        </div>

        <aside className="border-l border-slate-700 bg-[#14171c] p-5 text-sm">
          <h3 className="font-black text-white">Identificação de resíduos</h3>
          <p className="mt-2 text-xs leading-5 text-slate-400">Com a seleção ativa, clique em uma geometria. A peça selecionada ficará vermelha.</p>
          <div className="mt-4 rounded-xl border border-slate-700 bg-[#20242a] p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Selecionada</p>
            <p className="mt-2 break-all font-bold text-white">{selected ? selected.name : "Nenhuma"}</p>
            {selected && <p className="mt-1 break-all text-[10px] text-slate-500">ID: {selected.id}</p>}
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ocultadas nesta sessão</p>
            {hiddenItems.length ? <ul className="mt-2 space-y-2">{hiddenItems.map((item,index) => <li key={item.id} className="rounded-lg bg-[#20242a] p-2"><span className="mr-2 text-[#ef1855]">{index+1}.</span><span className="break-all font-bold text-white">{item.name}</span></li>)}</ul> : <p className="mt-2 text-xs text-slate-500">Nenhuma peça ocultada.</p>}
          </div>
        </aside>
      </div>
    </section>
  );
}

useGLTF.preload(MODEL_URL);
