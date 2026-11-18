import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarRange, MapPin, TrendingUp } from "lucide-react";

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const ALL_POINTS = "Todos os pontos";
const NO_POINT = "Sem ponto informado";

const pad = (value) => String(value).padStart(2, "0");
const formatShortDate = (date) => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
const mondayOf = (date) => {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  result.setHours(0, 0, 0, 0);
  return result;
};
const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const isoWeekNumber = (date) => {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
};

function TooltipCard({ active, payload, label, anomaly, point, view }) {
  if (!active || !payload?.length) return null;
  const value = payload.find((item) => item.dataKey === "qty")?.value ?? 0;
  return (
    <div className="max-w-xs rounded-xl border border-slate-600 bg-[#20242a]/95 p-4 text-white shadow-2xl backdrop-blur">
      <p className="text-xs font-black uppercase tracking-wider text-[#ef1855]">{view === "Semanal" ? payload[0]?.payload?.label : label}</p>
      {view === "Semanal" && payload[0]?.payload?.period && <p className="mt-1 text-[11px] text-slate-400">{payload[0].payload.period}</p>}
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs text-slate-300">{anomaly}</p>
      <p className="mt-1 text-xs font-bold text-amber-300">{point}</p>
    </div>
  );
}

export default function MonthlyAnomalyTrend({ rows, model = "Todos", region = "Todas", pointColumn = "" }) {
  const years = useMemo(() => [...new Set(rows.map((row) => row.date?.getFullYear()).filter(Boolean))].sort((a,b) => b-a), [rows]);
  const [selectedYear, setSelectedYear] = useState(years[0] || new Date().getFullYear());
  const [selectedAnomaly, setSelectedAnomaly] = useState("");
  const [selectedPoint, setSelectedPoint] = useState(ALL_POINTS);
  const [view, setView] = useState("Mensal");

  const filteredBase = useMemo(() => rows.filter((row) => row.date && (model === "Todos" || row.model === model) && (region === "Todas" || row.region === region)), [rows, model, region]);
  const anomalies = useMemo(() => [...new Set(filteredBase.map((row) => row.failure).filter(Boolean))].sort((a,b) => a.localeCompare(b,"pt-BR")), [filteredBase]);
  const effectiveAnomaly = anomalies.includes(selectedAnomaly) ? selectedAnomaly : (anomalies[0] || "");
  const effectiveYear = years.includes(Number(selectedYear)) ? Number(selectedYear) : (years[0] || new Date().getFullYear());
  const anomalyRows = useMemo(() => filteredBase.filter((row) => row.failure === effectiveAnomaly), [filteredBase, effectiveAnomaly]);
  const pointOptions = useMemo(() => {
    const values = [...new Set(anomalyRows.map((row) => row.point || NO_POINT))].sort((a,b) => a.localeCompare(b,"pt-BR",{numeric:true}));
    return [ALL_POINTS, ...values];
  }, [anomalyRows]);
  const effectivePoint = pointOptions.includes(selectedPoint) ? selectedPoint : ALL_POINTS;
  const selectedRows = useMemo(() => anomalyRows.filter((row) => row.date.getFullYear() === effectiveYear && (effectivePoint === ALL_POINTS || (row.point || NO_POINT) === effectivePoint)), [anomalyRows, effectivePoint, effectiveYear]);

  const monthlyData = useMemo(() => {
    const counts = Array(12).fill(0);
    selectedRows.forEach((row) => { counts[row.date.getMonth()] += 1; });
    return MONTHS.map((month,index) => ({ label: month, axisLabel: month.slice(0,3), qty: counts[index] }));
  }, [selectedRows]);

  const weeklyData = useMemo(() => {
    const firstMonday = mondayOf(new Date(effectiveYear, 0, 1));
    const lastDay = new Date(effectiveYear, 11, 31);
    const weeks = [];
    for (let date = new Date(firstMonday); date <= lastDay; date.setDate(date.getDate() + 7)) {
      const start = new Date(date);
      const weekNumber = isoWeekNumber(start);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      weeks.push({
        key: isoDate(start),
        weekNumber,
        label: `Semana ${weekNumber}`,
        axisLabel: `S${weekNumber}`,
        period: `${formatShortDate(start)} a ${formatShortDate(end)}`,
        qty: 0,
      });
    }
    const index = new Map(weeks.map((week, position) => [week.key, position]));
    selectedRows.forEach((row) => {
      const key = isoDate(mondayOf(row.date));
      const position = index.get(key);
      if (position !== undefined) weeks[position].qty += 1;
    });
    return weeks;
  }, [effectiveYear, selectedRows]);

  const data = view === "Semanal" ? weeklyData : monthlyData;
  const total = data.reduce((sum,item) => sum + item.qty,0);
  const average = data.length ? total / data.length : 0;
  const peak = data.reduce((best,item) => item.qty > best.qty ? item : best, data[0] || {label:"-",qty:0});
  const firstOccurrence = data.find((item) => item.qty > 0);

  return (
    <section className="mt-6 rounded-2xl border border-slate-700 bg-[#171a1f] p-5 shadow-xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-[#ef1855]"><CalendarRange size={15}/> Evolução por período</p>
          <h2 className="mt-1 text-xl font-black text-white">Anomalias mensal e semanal</h2>
          <p className="mt-1 text-sm text-slate-400">Alterne a visão, escolha a anomalia, o ponto específico e o ano.</p>
        </div>
        <div className="grid w-full gap-3 md:grid-cols-[160px_minmax(260px,1fr)_220px_120px] xl:w-auto">
          <label><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Visualização</span><select value={view} onChange={(e) => setView(e.target.value)} className="h-11 w-full rounded-xl border border-slate-700 bg-[#20242a] px-3 text-sm font-bold text-white outline-none focus:border-[#d10f43]"><option>Mensal</option><option>Semanal</option></select></label>
          <label><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Anomalia</span><select value={effectiveAnomaly} onChange={(e) => { setSelectedAnomaly(e.target.value); setSelectedPoint(ALL_POINTS); }} className="h-11 w-full rounded-xl border border-slate-700 bg-[#20242a] px-3 text-sm font-bold text-white outline-none focus:border-[#d10f43]">{anomalies.map((anomaly) => <option key={anomaly} value={anomaly}>{anomaly}</option>)}</select></label>
          <label><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Ponto</span><select value={effectivePoint} onChange={(e) => setSelectedPoint(e.target.value)} className="h-11 w-full rounded-xl border border-slate-700 bg-[#20242a] px-3 text-sm font-bold text-white outline-none focus:border-[#d10f43]">{pointOptions.map((point) => <option key={point} value={point}>{point}</option>)}</select></label>
          <label><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Ano</span><select value={effectiveYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="h-11 w-full rounded-xl border border-slate-700 bg-[#20242a] px-3 text-sm font-bold text-white outline-none focus:border-[#d10f43]">{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/5 bg-[#20242a] px-3 py-2 text-xs text-slate-400"><MapPin size={14} className="text-amber-300"/>{pointColumn ? `Coluna de ponto reconhecida: ${pointColumn}` : "Nenhuma coluna de ponto reconhecida; os registros aparecem como Sem ponto informado."}</div>
      <div className="mt-5 grid gap-3 sm:grid-cols-4"><Metric label="Total no ano" value={total}/><Metric label={view === "Semanal" ? "Média semanal" : "Média mensal"} value={average.toFixed(1).replace(".",",")}/><Metric label={view === "Semanal" ? "Maior semana" : "Maior mês"} value={`${peak.label}: ${peak.qty}`}/><Metric label="Primeira ocorrência" value={firstOccurrence?.label || "Sem ocorrência"}/></div>

      {effectiveAnomaly ? <div className="mt-6 h-[480px] w-full rounded-xl bg-[#14171c] p-3"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={{top:30,right:24,bottom:view === "Semanal"?65:30,left:0}}><CartesianGrid stroke="#343943" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="axisLabel" interval={view === "Semanal" ? 3 : 0} angle={view === "Semanal" ? -45 : 0} textAnchor={view === "Semanal" ? "end" : "middle"} height={view === "Semanal"?75:35} tick={{fill:"#dbe4f0",fontSize:11}} axisLine={{stroke:"#475569"}}/><YAxis allowDecimals={false} tick={{fill:"#dbe4f0"}} axisLine={{stroke:"#475569"}}/><Tooltip content={<TooltipCard anomaly={effectiveAnomaly} point={effectivePoint} view={view}/>} cursor={{fill:"rgba(255,255,255,0.04)"}}/><Bar dataKey="qty" fill="#d30b43" radius={[5,5,0,0]} isAnimationActive={true} animationDuration={900} animationEasing="ease-out"><LabelList dataKey="qty" position="top" fill="#f8fafc" fontSize={view === "Semanal"?9:12} fontWeight={900}/></Bar><Line type="monotone" dataKey="qty" stroke="#f8fafc" strokeWidth={3} dot={view === "Semanal"?false:{r:4,fill:"#f8fafc",strokeWidth:0}} activeDot={{r:7,fill:"#f59e0b",stroke:"#fff"}} isAnimationActive={true} animationDuration={1100}/></ComposedChart></ResponsiveContainer></div> : <div className="mt-6 flex h-72 items-center justify-center rounded-xl bg-[#20242a] text-slate-400">Nenhuma anomalia disponível.</div>}

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/5 bg-[#20242a] p-3 text-xs text-slate-400"><TrendingUp size={16} className="mt-0.5 shrink-0 text-[#ef1855]"/>{view === "Semanal" ? "A visão semanal usa a numeração ISO do ano: Semana 1, Semana 2 e assim por diante, com segunda-feira como início. Semanas sem registro aparecem com zero." : "A visão mensal considera janeiro a dezembro. Meses sem registro aparecem com zero."} O ponto filtra somente a anomalia selecionada.</div>
    </section>
  );
}

function Metric({label,value}) { return <div className="rounded-xl border border-white/5 bg-[#20242a] p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xl font-black text-white">{value}</p></div>; }
