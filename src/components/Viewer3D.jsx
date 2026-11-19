import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Bounds,
  Center,
  ContactShadows,
  Html,
  Line,
  OrbitControls,
  useGLTF,
  useProgress,
} from "@react-three/drei";
import {
  Download,
  Eye,
  EyeOff,
  MapPin,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import * as THREE from "three";

const MODEL_URL = `${import.meta.env.BASE_URL}models/cabine-interativa-G7-V5.glb`;
const STORAGE_KEY = "pareto-quality-g7-solidworks-welds-v1";
const NOMINAL_COLOR = "#ffd400";
const LOW_COLOR = "#22c55e";
const MEDIUM_COLOR = "#f59e0b";
const CRITICAL_COLOR = "#ef174f";

function loadSavedWelds() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function LoadingModel() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="min-w-56 rounded-2xl border border-slate-600 bg-[#171a1f]/95 p-5 text-center text-white shadow-2xl backdrop-blur">
        <p className="text-sm font-black">Carregando cabine 3D</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700">
          <div className="h-full rounded-full bg-[#d10f43]" style={{ width: `${Math.round(progress)}%` }} />
        </div>
        <p className="mt-2 text-xs font-bold text-slate-300">{Math.round(progress)}%</p>
      </div>
    </Html>
  );
}

function CabinModel({ drawing, onSurfacePoint }) {
  const { scene } = useGLTF(MODEL_URL);
  const model = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.frustumCulled = false;
      object.castShadow = true;
      object.receiveShadow = true;
      const original = Array.isArray(object.material) ? object.material : [object.material];
      object.material = Array.isArray(object.material)
        ? original.map((material) => material?.clone())
        : original[0]?.clone();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.filter(Boolean).forEach((material) => {
        material.side = THREE.DoubleSide;
        material.needsUpdate = true;
      });
    });
  }, [model]);

  const capture = (event) => {
    if (!drawing || !event.object?.isMesh) return;
    event.stopPropagation();
    const normal = event.face?.normal?.clone() || new THREE.Vector3(0, 1, 0);
    normal.transformDirection(event.object.matrixWorld);
    const point = event.point.clone().add(normal.multiplyScalar(0.012));
    onSurfacePoint({
      position: point.toArray().map((value) => Number(value.toFixed(5))),
      normal: normal.toArray().map((value) => Number(value.toFixed(5))),
      meshName: event.object.name || "SEM_NOME",
    });
  };

  return <Center><primitive object={model} onPointerDown={capture} /></Center>;
}

function statsFor(weld, defectData) {
  const data = defectData?.[String(weld.code)] || {};
  return {
    anomalies: Number(data.anomalies || 0),
    workOrders: Number(data.workOrders || 0),
    mainFailure: data.mainFailure || "Sem ocorrências",
    failureCounts: Array.isArray(data.failureCounts) ? data.failureCounts : [],
  };
}

function colorFor(stats, selectedFailure) {
  if (selectedFailure && stats.failureCounts.some((item) => item.name === selectedFailure && item.qty > 0)) return CRITICAL_COLOR;
  if (!stats.anomalies) return NOMINAL_COLOR;
  if (stats.anomalies <= 2) return LOW_COLOR;
  if (stats.anomalies <= 5) return MEDIUM_COLOR;
  return CRITICAL_COLOR;
}

function buildCurve(points) {
  return new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point.position)), false, "centripetal");
}

function BeadPiece({ start, end, size, color, selected, rippleIndex, onSelect }) {
  const direction = useMemo(() => end.clone().sub(start), [end, start]);
  const length = direction.length();
  const midpoint = useMemo(() => start.clone().add(end).multiplyScalar(0.5), [end, start]);
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()),
    [direction],
  );
  const shade = rippleIndex % 2 === 0 ? color : new THREE.Color(color).multiplyScalar(0.62).getStyle();

  return (
    <mesh
      position={midpoint}
      quaternion={quaternion}
      onClick={(event) => { event.stopPropagation(); onSelect(); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "auto"; }}
      castShadow
    >
      <cylinderGeometry args={[size, size * 1.03, Math.max(length * 1.05, 0.003), 3, 1, false]} />
      <meshStandardMaterial color={shade} emissive={color} emissiveIntensity={selected ? 1.55 : 0.42} roughness={0.62} metalness={0.08} />
    </mesh>
  );
}

function SolidWorksWeld({ weld, color, selected, onSelect }) {
  const groupRef = useRef();
  const curve = useMemo(() => buildCurve(weld.points), [weld.points]);
  const modelScale = Number(weld.modelScale || 0.001);
  const size = Math.max(0.004, Number(weld.sizeMm || 3) * modelScale);
  const beadLength = Math.max(size * 1.15, Number(weld.beadLengthMm || 8) * modelScale);
  const pitch = Math.max(beadLength, Number(weld.pitchMm || 16) * modelScale);
  const totalLength = curve.getLength();
  const pieces = useMemo(() => {
    const output = [];
    const continuousStep = Math.max(size * 0.75, beadLength * 0.6);
    const step = weld.type === "intermittent" ? pitch : continuousStep;
    const activeLength = weld.type === "intermittent" ? Math.min(beadLength, step * 0.78) : Math.min(beadLength, step * 1.08);
    let distance = 0;
    let index = 0;
    while (distance < totalLength) {
      const startDistance = distance;
      const endDistance = Math.min(totalLength, distance + activeLength);
      const start = curve.getPointAt(totalLength ? startDistance / totalLength : 0);
      const end = curve.getPointAt(totalLength ? endDistance / totalLength : 1);
      if (start.distanceTo(end) > 0.0001) output.push({ start, end, index });
      distance += step;
      index += 1;
      if (index > 1500) break;
    }
    return output;
  }, [beadLength, curve, pitch, size, totalLength, weld.type]);

  useFrame(({ clock }) => {
    if (!groupRef.current || !selected) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 3.2) * 0.025;
    groupRef.current.scale.setScalar(pulse);
  });

  return (
    <group ref={groupRef}>
      {pieces.map((piece) => (
        <BeadPiece
          key={piece.index}
          start={piece.start}
          end={piece.end}
          size={size}
          color={color}
          selected={selected}
          rippleIndex={piece.index}
          onSelect={() => onSelect(weld.id)}
        />
      ))}
    </group>
  );
}

function WeldLabel({ weld, selected, onSelect }) {
  const anchor = weld.points[Math.floor(weld.points.length / 2)].position;
  const label = [anchor[0] + 0.24, anchor[1] + 0.16, anchor[2] + 0.08];
  return (
    <group>
      <Line points={[anchor, label]} color={selected ? CRITICAL_COLOR : NOMINAL_COLOR} lineWidth={2} />
      <Html position={label} distanceFactor={7} zIndexRange={[90, 0]}>
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onSelect(weld.id); }}
          className={`rounded-lg border px-2.5 py-1.5 text-xs font-black shadow-xl backdrop-blur ${selected ? "border-rose-400 bg-rose-500 text-white" : "border-amber-300 bg-[#171a1f]/90 text-amber-200"}`}
        >
          P{weld.code}
        </button>
      </Html>
    </group>
  );
}

function WeldDetails({ weld, stats, onClose, onDelete }) {
  return (
    <div className="absolute bottom-5 left-5 z-30 w-[min(390px,calc(100%-40px))] rounded-2xl border border-amber-400/60 bg-[#171a1f]/95 p-5 text-white shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-amber-300">Indicação técnica de solda</p><h3 className="mt-1 text-xl font-black">Ponto {weld.code}</h3><p className="text-sm text-slate-400">{weld.description || "Sem descrição"}</p></div>
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-600 p-2"><X size={15} /></button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/5 p-3"><p className="text-[10px] uppercase text-slate-400">Anomalias</p><p className="text-2xl font-black text-rose-400">{stats.anomalies}</p></div>
        <div className="rounded-xl bg-white/5 p-3"><p className="text-[10px] uppercase text-slate-400">WOs afetadas</p><p className="text-2xl font-black text-amber-300">{stats.workOrders}</p></div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><p><span className="text-slate-400">Tipo:</span> {weld.type === "intermittent" ? "Intermitente" : "Contínuo"}</p><p><span className="text-slate-400">Tamanho:</span> {weld.sizeMm} mm</p><p><span className="text-slate-400">Comprimento:</span> {weld.beadLengthMm} mm</p><p><span className="text-slate-400">Passo:</span> {weld.pitchMm} mm</p><p><span className="text-slate-400">Programa:</span> {weld.program || "-"}</p><p><span className="text-slate-400">Zona:</span> {weld.zone || "-"}</p></div>
      <p className="mt-3 text-xs"><span className="text-slate-400">Principal modo:</span> <strong>{stats.mainFailure}</strong></p>
      {stats.failureCounts.length > 0 && <div className="mt-3 space-y-1.5">{stats.failureCounts.map((failure) => <div key={failure.name} className="flex justify-between text-xs"><span className="text-slate-400">{failure.name}</span><strong>{failure.qty}</strong></div>)}</div>}
      <button type="button" onClick={onDelete} className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-700 text-xs font-black text-rose-300"><Trash2 size={14} />Excluir cadastro</button>
    </div>
  );
}

export default function Viewer3D({ defectData = {}, selectedFailure = "", selectedWeldCode = "" }) {
  const [cameraKey, setCameraKey] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [draftPoints, setDraftPoints] = useState([]);
  const [welds, setWelds] = useState(loadSavedWelds);
  const [selectedId, setSelectedId] = useState("");
  const [showWelds, setShowWelds] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    code: "330",
    region: "TRASEIRA",
    program: "P02",
    zone: "Z4",
    description: "",
    type: "continuous",
    sizeMm: 3,
    beadLengthMm: 8,
    pitchMm: 16,
    modelScale: 0.001,
  });

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(welds)), [welds]);
  useEffect(() => {
    if (!selectedWeldCode) return;
    const match = welds.find((weld) => String(weld.code) === String(selectedWeldCode));
    if (match) { setSelectedId(match.id); setShowWelds(true); }
  }, [selectedWeldCode, welds]);

  const selectedWeld = welds.find((weld) => weld.id === selectedId);
  const selectedStats = selectedWeld ? statsFor(selectedWeld, defectData) : null;

  const startDrawing = () => { setSelectedId(""); setDraftPoints([]); setDrawing(true); };
  const cancelDrawing = () => { setDraftPoints([]); setDrawing(false); setFormOpen(false); };
  const finishDrawing = () => { if (draftPoints.length >= 2) { setDrawing(false); setFormOpen(true); } };
  const saveWeld = () => {
    if (!form.code || draftPoints.length < 2) return;
    const weld = { id: `G7-P${form.code}-${Date.now()}`, ...form, points: draftPoints };
    setWelds((current) => [...current, weld]);
    setSelectedId(weld.id);
    setDraftPoints([]);
    setFormOpen(false);
    setShowWelds(true);
  };
  const deleteWeld = (id) => { setWelds((current) => current.filter((weld) => weld.id !== id)); setSelectedId(""); };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(welds, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "weld-map-G7.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-700 bg-[#171a1f] shadow-xl">
      <div className="flex flex-col gap-4 border-b border-slate-700 p-5 xl:flex-row xl:items-center xl:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#ef1855]">Editor de cordões estilo CAD</p><h2 className="mt-1 text-xl font-black text-white">Cabine 3D G7</h2><p className="mt-1 text-sm text-slate-400">{drawing ? "Clique seguindo a junta. Depois escolha tamanho, comprimento e passo." : "Cordões com perfil triangular, contínuos ou intermitentes."}</p></div>
        <div className="flex flex-wrap gap-2">
          {!drawing ? <button type="button" onClick={startDrawing} className="flex h-11 items-center gap-2 rounded-xl bg-[#d10f43] px-4 text-sm font-black text-white"><MapPin size={16} />Novo cordão</button> : <><button type="button" onClick={() => setDraftPoints((current) => current.slice(0, -1))} disabled={!draftPoints.length} className="flex h-11 items-center gap-2 rounded-xl border border-slate-600 bg-[#20242a] px-4 text-sm font-black text-white disabled:opacity-40"><Undo2 size={16} />Desfazer</button><button type="button" onClick={finishDrawing} disabled={draftPoints.length < 2} className="flex h-11 items-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-black text-black disabled:opacity-40"><Save size={16} />Dimensionar</button><button type="button" onClick={cancelDrawing} className="flex h-11 items-center gap-2 rounded-xl border border-slate-600 bg-[#20242a] px-4 text-sm font-black text-white"><X size={16} />Cancelar</button></>}
          <button type="button" onClick={() => setShowWelds((value) => !value)} className="flex h-11 items-center gap-2 rounded-xl border border-slate-600 bg-[#20242a] px-4 text-sm font-black text-white">{showWelds ? <EyeOff size={16} /> : <Eye size={16} />}{showWelds ? "Ocultar" : "Mostrar"}</button>
          <button type="button" onClick={exportJson} disabled={!welds.length} className="flex h-11 items-center gap-2 rounded-xl border border-slate-600 bg-[#20242a] px-4 text-sm font-black text-white disabled:opacity-40"><Download size={16} />Exportar</button>
          <button type="button" onClick={() => setCameraKey((value) => value + 1)} className="flex h-11 items-center gap-2 rounded-xl border border-slate-600 bg-[#20242a] px-4 text-sm font-black text-white"><RotateCcw size={16} />Restaurar visão</button>
        </div>
      </div>

      <div className="relative h-[72vh] min-h-[560px] w-full bg-[#111419]">
        {drawing && <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-xl border border-amber-400/70 bg-[#171a1f]/95 px-4 py-2 text-sm font-black text-amber-200 shadow-xl">Clique em sequência sobre a junta de solda</div>}
        <Canvas key={cameraKey} camera={{ position: [7, 5, 9], fov: 42, near: 0.01, far: 2000 }} dpr={[1, 1.75]} shadows>
          <color attach="background" args={["#111419"]} /><ambientLight intensity={1.8} /><hemisphereLight args={["#dbeafe", "#1e293b", 1.4]} /><directionalLight position={[8, 12, 8]} intensity={3.2} castShadow /><directionalLight position={[-8, 5, -6]} intensity={1.5} />
          <Suspense fallback={<LoadingModel />}>
            <Bounds fit clip observe margin={1.15}><CabinModel drawing={drawing} onSurfacePoint={(point) => setDraftPoints((current) => [...current, point])} /></Bounds>
            {showWelds && welds.map((weld) => {
              const stats = statsFor(weld, defectData);
              const selected = weld.id === selectedId;
              const color = colorFor(stats, selectedFailure);
              return <group key={weld.id}><SolidWorksWeld weld={weld} color={color} selected={selected} onSelect={setSelectedId} /><WeldLabel weld={weld} selected={selected} onSelect={setSelectedId} /></group>;
            })}
            {draftPoints.length > 0 && <group>{draftPoints.length > 1 && <Line points={draftPoints.map((point) => point.position)} color={NOMINAL_COLOR} lineWidth={4} dashed dashSize={0.06} gapSize={0.03} />}{draftPoints.map((point, index) => <mesh key={index} position={point.position}><sphereGeometry args={[0.035, 16, 16]} /><meshBasicMaterial color={NOMINAL_COLOR} /></mesh>)}</group>}
            <ContactShadows position={[0, -2.6, 0]} opacity={0.35} scale={24} blur={2.5} />
          </Suspense>
          <gridHelper args={[30, 30, "#46505e", "#242a33"]} position={[0, -2.65, 0]} /><OrbitControls makeDefault enabled={!drawing && !formOpen} enableDamping minDistance={2} maxDistance={40} />
        </Canvas>
        {selectedWeld && selectedStats && <WeldDetails weld={selectedWeld} stats={selectedStats} onClose={() => setSelectedId("")} onDelete={() => deleteWeld(selectedWeld.id)} />}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-600 bg-[#171a1f] p-5 text-white shadow-2xl">
            <div className="flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-amber-300">Propriedades de solda</p><h3 className="text-xl font-black">Cordão estilo CAD</h3></div><button type="button" onClick={() => { setFormOpen(false); setDrawing(true); }} className="rounded-lg border border-slate-600 p-2"><X size={16} /></button></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-bold">Ponto<input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} className="mt-1 h-10 w-full rounded-lg bg-[#252a31] px-3" /></label>
              <label className="text-xs font-bold">Tipo<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="mt-1 h-10 w-full rounded-lg bg-[#252a31] px-3"><option value="continuous">Contínuo</option><option value="intermittent">Intermitente</option></select></label>
              <label className="text-xs font-bold">Tamanho do filete (mm)<input type="number" step="0.5" min="1" max="20" value={form.sizeMm} onChange={(event) => setForm({ ...form, sizeMm: Number(event.target.value) })} className="mt-1 h-10 w-full rounded-lg bg-[#252a31] px-3" /></label>
              <label className="text-xs font-bold">Comprimento de cada trecho (mm)<input type="number" step="1" min="2" max="200" value={form.beadLengthMm} onChange={(event) => setForm({ ...form, beadLengthMm: Number(event.target.value) })} className="mt-1 h-10 w-full rounded-lg bg-[#252a31] px-3" /></label>
              <label className="text-xs font-bold">Passo entre trechos (mm)<input type="number" step="1" min="2" max="500" value={form.pitchMm} onChange={(event) => setForm({ ...form, pitchMm: Number(event.target.value) })} disabled={form.type !== "intermittent"} className="mt-1 h-10 w-full rounded-lg bg-[#252a31] px-3 disabled:opacity-40" /></label>
              <label className="text-xs font-bold">Escala mm → modelo<input type="number" step="0.0001" min="0.0001" max="1" value={form.modelScale} onChange={(event) => setForm({ ...form, modelScale: Number(event.target.value) })} className="mt-1 h-10 w-full rounded-lg bg-[#252a31] px-3" /></label>
              <label className="text-xs font-bold">Região<select value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} className="mt-1 h-10 w-full rounded-lg bg-[#252a31] px-3"><option>TRASEIRA</option><option>FRONTAL</option><option>LATERAL ESQUERDA</option><option>LATERAL DIREITA</option><option>ASSOALHO / PISO</option><option>TETO / SUPERIOR</option></select></label>
              <label className="text-xs font-bold">Programa<input value={form.program} onChange={(event) => setForm({ ...form, program: event.target.value })} className="mt-1 h-10 w-full rounded-lg bg-[#252a31] px-3" /></label>
              <label className="text-xs font-bold">Zona<input value={form.zone} onChange={(event) => setForm({ ...form, zone: event.target.value })} className="mt-1 h-10 w-full rounded-lg bg-[#252a31] px-3" /></label>
              <label className="text-xs font-bold lg:col-span-3">Descrição<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Ex.: Travessa traseira superior" className="mt-1 h-10 w-full rounded-lg bg-[#252a31] px-3" /></label>
            </div>
            <div className="mt-4 rounded-xl border border-slate-700 bg-[#20242a] p-3 text-xs text-slate-300"><strong>Pré-ajuste:</strong> para cabine em metros, comece com escala 0,001. Se o cordão ficar muito fino ou grosso, ajuste somente “Escala mm → modelo”.</div>
            <button type="button" onClick={saveWeld} className="mt-4 h-11 w-full rounded-xl bg-[#d10f43] font-black">Salvar cordão P{form.code}</button>
          </div>
        </div>
      )}
    </section>
  );
}

useGLTF.preload(MODEL_URL);
