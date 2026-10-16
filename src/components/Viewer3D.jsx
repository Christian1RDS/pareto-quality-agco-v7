import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Center, ContactShadows, Html, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import { Box, Copy, Eye, MousePointer2, RotateCcw, Save, Undo2 } from "lucide-react";
import * as THREE from "three";

const MODEL_URL = `${import.meta.env.BASE_URL}models/cabine-interativa-V1.1-G7.glb`;

// Correcoes confirmadas entram aqui depois dos testes.
const MESH_CORRECTIONS = {};
const PERMANENTLY_HIDDEN_PARTS = [];

function LoadingModel() {
  const { progress } = useProgress();
  return <Html center><div className="min-w-52 rounded-2xl border border-slate-600 bg-[#171a1f]/95 p-5 text-center text-white shadow-2xl"><p className="font-black">Carregando cabine 3D</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700"><div className="h-full bg-[#d10f43]" style={{ width: `${Math.round(progress)}%` }}/></div><p className="mt-2 text-xs">{Math.round(progress)}%</p></div></Html>;
}

function CabinModel({ selectedName, isolatedName, transforms, onMeshesReady, onSelect }) {
  const { scene } = useGLTF(MODEL_URL);
  const model = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    const items = [];
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.userData.originalTransform ??= {
        position: object.position.toArray(),
        rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
        scale: object.scale.toArray(),
      };
      items.push({ name: object.name || "SEM_NOME", uuid: object.uuid, transform: object.userData.originalTransform });
      const correction = MESH_CORRECTIONS[object.name];
      const temporary = transforms[object.name];
      const applied = temporary || correction || object.userData.originalTransform;
      if (applied) {
        object.position.fromArray(applied.position);
        object.rotation.set(...applied.rotation);
        object.scale.fromArray(applied.scale || [1, 1, 1]);
      }
      object.visible = !PERMANENTLY_HIDDEN_PARTS.includes(object.name) && (!isolatedName || object.name === isolatedName);
      object.frustumCulled = false;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      object.material = Array.isArray(object.material) ? materials.map((m) => m?.clone()) : materials[0]?.clone();
      const activeMaterials = Array.isArray(object.material) ? object.material : [object.material];
      activeMaterials.filter(Boolean).forEach((material) => {
        material.side = THREE.DoubleSide;
        material.transparent = false;
        material.opacity = 1;
        if (object.name === selectedName) {
          material.color = new THREE.Color("#ff2d55");
          material.emissive = new THREE.Color("#7f1028");
          material.emissiveIntensity = 0.8;
        }
        material.needsUpdate = true;
      });
    });
    items.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    onMeshesReady(items);
  }, [isolatedName, model, onMeshesReady, selectedName, transforms]);

  return <Center><primitive object={model} onPointerDown={(event) => { event.stopPropagation(); if (event.object?.isMesh) onSelect(event.object.name); }}/></Center>;
}

const round = (value) => Number(value.toFixed(4));
const deg = (value) => round(THREE.MathUtils.radToDeg(value));
const rad = (value) => THREE.MathUtils.degToRad(value);

export default function Viewer3D() {
  const [cameraKey, setCameraKey] = useState(0);
  const [meshes, setMeshes] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [isolatedName, setIsolatedName] = useState("");
  const [transforms, setTransforms] = useState({});

  const onMeshesReady = useCallback((items) => setMeshes((current) => current.length ? current : items), []);
  const filtered = useMemo(() => meshes.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())), [meshes, search]);
  const selected = transforms[selectedName] || MESH_CORRECTIONS[selectedName] || { position: [0,0,0], rotation: [0,0,0], scale: [1,1,1] };

  const ensureTransform = () => {
    if (!selectedName || transforms[selectedName]) return;
    const target = sceneCache.get(selectedName);
    if (target) setTransforms((current) => ({ ...current, [selectedName]: target }));
  };

  const changePosition = (axis, delta) => {
    if (!selectedName) return;
    setTransforms((current) => {
      const base = current[selectedName] || sceneCache.get(selectedName) || selected;
      const position = [...base.position]; position[axis] = round(position[axis] + delta);
      return { ...current, [selectedName]: { ...base, position } };
    });
  };
  const changeRotation = (axis, degrees) => {
    if (!selectedName) return;
    setTransforms((current) => {
      const base = current[selectedName] || sceneCache.get(selectedName) || selected;
      const rotation = [...base.rotation]; rotation[axis] = round(rotation[axis] + rad(degrees));
      return { ...current, [selectedName]: { ...base, rotation } };
    });
  };
  const resetSelected = () => setTransforms((current) => { const next = { ...current }; delete next[selectedName]; return next; });
  const copyCorrection = async () => {
    if (!selectedName) return;
    const value = transforms[selectedName] || sceneCache.get(selectedName) || selected;
    const text = `"${selectedName}": { position: [${value.position.map(round).join(", ")}], rotation: [${value.rotation.map(round).join(", ")}], scale: [${(value.scale || [1,1,1]).map(round).join(", ")}] },`;
    await navigator.clipboard.writeText(text);
  };

  return <section className="mt-6 overflow-hidden rounded-2xl border border-slate-700 bg-[#171a1f] shadow-xl">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 p-5"><div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-[#ef1855]"><Box size={15}/> Editor técnico</p><h2 className="mt-1 text-xl font-black">Cabine 3D G7</h2><p className="text-sm text-slate-400">Selecione uma malha e ajuste posição ou rotação temporariamente.</p></div><button onClick={() => setCameraKey((k) => k + 1)} className="flex h-11 items-center gap-2 rounded-xl border border-slate-600 bg-[#20242a] px-4 font-black"><RotateCcw size={16}/>Restaurar visão</button></div>
    <div className="grid xl:grid-cols-[1fr_350px]">
      <div className="relative h-[70vh] min-h-[540px] bg-[#111419]">
        <Canvas key={cameraKey} camera={{ position:[7,5,9], fov:42, near:0.01, far:2000 }} dpr={[1,1.75]} shadows>
          <color attach="background" args={["#111419"]}/><ambientLight intensity={1.8}/><hemisphereLight args={["#dbeafe","#1e293b",1.4]}/><directionalLight position={[8,12,8]} intensity={3.2}/><directionalLight position={[-8,5,-6]} intensity={1.5}/>
          <Suspense fallback={<LoadingModel/>}><Bounds fit clip observe margin={1.15}><CabinModel selectedName={selectedName} isolatedName={isolatedName} transforms={transforms} onMeshesReady={(items) => { items.forEach((item) => { if (!sceneCache.has(item.name)) sceneCache.set(item.name, item.transform); }); onMeshesReady(items); }} onSelect={setSelectedName}/></Bounds><ContactShadows position={[0,-2.6,0]} opacity={0.35} scale={24} blur={2.5}/></Suspense>
          <gridHelper args={[30,30,"#46505e","#242a33"]} position={[0,-2.65,0]}/><axesHelper args={[3]}/><OrbitControls makeDefault enableDamping minDistance={2} maxDistance={40}/>
        </Canvas>
      </div>
      <aside className="max-h-[70vh] overflow-auto border-l border-slate-700 bg-[#14171c] p-5 text-sm">
        <h3 className="font-black">Inspetor e editor XYZ</h3>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar mesh-..." className="mt-3 h-10 w-full rounded-lg border border-slate-600 bg-[#20242a] px-3"/>
        <select value={selectedName} onChange={(e) => { setSelectedName(e.target.value); ensureTransform(); }} className="mt-2 h-11 w-full rounded-lg border border-slate-600 bg-[#20242a] px-3 font-bold"><option value="">Selecione uma malha</option>{filtered.map((m) => <option key={m.uuid} value={m.name}>{m.name}</option>)}</select>
        <div className="mt-2 grid grid-cols-2 gap-2"><button disabled={!selectedName} onClick={() => setIsolatedName(selectedName)} className="h-10 rounded-lg border border-slate-600 bg-[#20242a] font-black disabled:opacity-40"><Eye size={14} className="inline mr-1"/>Isolar</button><button onClick={() => setIsolatedName("")} className="h-10 rounded-lg border border-slate-600 bg-[#20242a] font-black">Mostrar todas</button></div>
        <TransformSection title="Posição X/Y/Z" values={selected.position} action={changePosition} steps={[-1,-0.1,0.1,1]} format={round}/>
        <TransformSection title="Rotação X/Y/Z (graus)" values={selected.rotation} action={changeRotation} steps={[-90,-5,5,90]} format={deg}/>
        <div className="mt-4 grid gap-2"><button disabled={!selectedName} onClick={copyCorrection} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#d10f43] font-black disabled:opacity-40"><Copy size={15}/>Copiar transformação</button><button disabled={!selectedName} onClick={resetSelected} className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-600 bg-[#20242a] font-black disabled:opacity-40"><Undo2 size={15}/>Restaurar peça</button></div>
        <p className="mt-4 text-xs leading-5 text-slate-400">Os movimentos são temporários. Após acertar uma peça, use “Copiar transformação” e envie o texto copiado para gravarmos a posição automaticamente no site.</p>
      </aside>
    </div>
  </section>;
}

const sceneCache = new Map();
function TransformSection({ title, values, action, steps, format }) {
  return <div className="mt-4 rounded-xl border border-slate-700 bg-[#20242a] p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{title}</p>{["X","Y","Z"].map((axis,index) => <div key={axis} className="mt-3"><div className="flex justify-between"><span className="font-black">{axis}</span><span className="font-mono text-slate-300">{format(values[index])}</span></div><div className="mt-1 grid grid-cols-4 gap-1">{steps.map((step) => <button key={step} onClick={() => action(index,step)} className="rounded bg-[#303640] py-1 text-xs font-bold hover:bg-[#d10f43]">{step > 0 ? `+${step}` : step}</button>)}</div></div>)}</div>;
}
useGLTF.preload(MODEL_URL);
