import { useState, useMemo } from "react";

// ─── DATA ────────────────────────────────────────────────────────────────────
const EQUIPMENT_TYPES = {
  compressor: {
    label: "Compresor", icon: "⚙️", color: "#FF6B35",
    faultTypes: ["Alta temperatura de descarga","Baja presión de succión","Alta presión de descarga",
      "Vibración excesiva","Fuga de aceite","Fuga de gas","Falla en válvulas","Falla en cojinetes",
      "Sobrecalentamiento de motor","Falla en sistema de enfriamiento","Ruido anormal",
      "Alta corriente eléctrica","Paro por seguridad","Falla en instrumentación","Otro"],
  },
  cryogenic_pump: {
    label: "Bomba Criogénica", icon: "❄️", color: "#00B4D8",
    faultTypes: ["Cavitación","Fuga criogénica","Pérdida de vacío (aislamiento)","Alta temperatura de carcasa",
      "Baja eficiencia de bombeo","Vibración excesiva","Falla en sello mecánico","Falla en rodamientos",
      "Paro por alta temperatura","Falla en sistema eléctrico","Contaminación del fluido",
      "Flujo insuficiente","Presión anormal","Falla en instrumentación","Otro"],
  },
};

const SEVERITY = [
  { id: "critical", label: "Crítica",  color: "#FF1744", dot: "🔴" },
  { id: "high",     label: "Alta",     color: "#FF6B35", dot: "🟠" },
  { id: "medium",   label: "Media",    color: "#FFB300", dot: "🟡" },
  { id: "low",      label: "Baja",     color: "#00C853", dot: "🟢" },
];

const STATUS = [
  { id: "open",          label: "Abierta",               color: "#FF1744" },
  { id: "in_progress",   label: "En proceso",             color: "#FFB300" },
  { id: "resolved",      label: "Resuelta",               color: "#00C853" },
  { id: "pending_parts", label: "Esperando refacciones",  color: "#7C4DFF" },
];

const CAUSA_RAIZ_CATS = ["Máquina","Método","Mano de obra","Material","Medición","Medio ambiente"];

const INITIAL = [
  {
    id: 1, equipmentType:"compressor", equipmentId:"COMP-001", location:"Planta A - Área 3",
    faultType:"Alta temperatura de descarga", severity:"critical", status:"resolved",
    description:"Temperatura de descarga llegó a 185°C, límite es 170°C. Filtro de aceite obstruido.",
    reportedBy:"Carlos Méndez", date:"2026-04-10", time:"08:30",
    resolution:"Cambio de filtro de aceite y limpieza del sistema.", downtime:3.5,
    fiveWhys:["El compresor alcanzó alta temperatura","El aceite no circulaba correctamente",
      "El filtro de aceite estaba obstruido","No se realizó el cambio de filtro en el intervalo programado",
      "No existe alarma de diferencial de presión en filtro"],
    causaRaizCategoria:"Método", causaRaizDescripcion:"Falta de programa de mantenimiento preventivo con alertas de diferencial de presión.",
    accionCorrectiva:"Instalar sensor de ΔP en filtro y programar alarma en PLC.", resuelto: true,
  },
  {
    id: 2, equipmentType:"cryogenic_pump", equipmentId:"BCP-003", location:"Planta B - Llenadora",
    faultType:"Pérdida de vacío (aislamiento)", severity:"high", status:"in_progress",
    description:"Escarcha en carcasa exterior. Posible daño en aislamiento de vacío.",
    reportedBy:"Ana Reyes", date:"2026-04-15", time:"14:15",
    resolution:"", downtime:8,
    fiveWhys:["Se detectó escarcha en carcasa","El aislamiento de vacío falló","","",""],
    causaRaizCategoria:"Máquina", causaRaizDescripcion:"",
    accionCorrectiva:"", resuelto: false,
  },
  {
    id: 3, equipmentType:"compressor", equipmentId:"COMP-001", location:"Planta A - Área 3",
    faultType:"Vibración excesiva", severity:"medium", status:"resolved",
    description:"Vibración medida en 12 mm/s, límite operativo es 7 mm/s.",
    reportedBy:"Luis Torres", date:"2026-03-22", time:"06:45",
    resolution:"Balanceo de impulsor y ajuste de anclaje.", downtime:5,
    fiveWhys:["Vibración fuera de límite","Desbalance en impulsor","Acumulación de hielo en impulsor",
      "Temperatura de succión alta generó evaporación prematura","Setpoint de temperatura incorrecto tras mantenimiento previo"],
    causaRaizCategoria:"Mano de obra", causaRaizDescripcion:"Setpoint mal configurado post-mantenimiento.",
    accionCorrectiva:"Crear checklist de puesta en marcha post-mantenimiento.", resuelto: true,
  },
  {
    id: 4, equipmentType:"cryogenic_pump", equipmentId:"BCP-001", location:"Planta A - Llenadora",
    faultType:"Cavitación", severity:"high", status:"resolved",
    description:"Ruido de cavitación y caída de flujo en BCP-001.",
    reportedBy:"Carlos Méndez", date:"2026-03-10", time:"10:00",
    resolution:"Ajuste de presión de succión y purga del sistema.", downtime:2,
    fiveWhys:["Cavitación en bomba","Presión de succión insuficiente","Nivel bajo en tanque de almacenamiento",
      "Válvula de llenado cerrada por error de operación","Falta de enclavamiento físico en válvula"],
    causaRaizCategoria:"Método", causaRaizDescripcion:"Sin enclavamiento en válvula crítica.",
    accionCorrectiva:"Instalar enclavamiento y alarma de nivel bajo.", resuelto: true,
  },
];

// ─── UTILS ───────────────────────────────────────────────────────────────────
const getSev  = (id) => SEVERITY.find(s => s.id === id) || SEVERITY[2];
const getStat = (id) => STATUS.find(s => s.id === id)   || STATUS[0];
const getEq   = (id) => EQUIPMENT_TYPES[id];

function calcMTBF(recs) {
  const resolved = recs.filter(r => r.status === "resolved" && r.downtime > 0);
  if (resolved.length < 2) return null;
  const sorted = [...resolved].sort((a,b) => new Date(a.date)-new Date(b.date));
  let gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i].date) - new Date(sorted[i-1].date)) / 36e5;
    gaps.push(diff);
  }
  return (gaps.reduce((a,b)=>a+b,0)/gaps.length).toFixed(1);
}

function calcMTTR(recs) {
  const resolved = recs.filter(r => r.status === "resolved" && r.downtime > 0);
  if (!resolved.length) return null;
  return (resolved.reduce((a,r)=>a+r.downtime,0)/resolved.length).toFixed(1);
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const C = {
  bg:      "#080C14",
  surface: "#0E1520",
  card:    "#121B28",
  border:  "#1A2840",
  text:    "#D8E4F0",
  muted:   "#4A6480",
  accent:  "#FF6B35",
};

const S = {
  app: {
    fontFamily: "'Rajdhani', 'IBM Plex Sans', sans-serif",
    background: C.bg, minHeight:"100vh", maxWidth:430,
    margin:"0 auto", color:C.text, position:"relative", overflowX:"hidden",
  },
  header: {
    background:`linear-gradient(135deg, ${C.surface}, #0A1525)`,
    borderBottom:`1px solid ${C.border}`, padding:"14px 18px 10px",
    position:"sticky", top:0, zIndex:100,
  },
  screen: { padding:"14px 14px 100px", overflowY:"auto", maxHeight:"calc(100vh - 120px)" },
  card: (border) => ({
    background: C.card, border:`1px solid ${border||C.border}`,
    borderRadius:14, padding:14, marginBottom:10,
  }),
  label: { fontSize:10, fontWeight:700, color:C.muted, letterSpacing:"0.8px",
    textTransform:"uppercase", marginBottom:5, display:"block" },
  input: {
    width:"100%", background:"#090E18", border:`1px solid ${C.border}`,
    borderRadius:10, padding:"11px 13px", color:C.text, fontSize:13,
    outline:"none", boxSizing:"border-box", fontFamily:"inherit",
  },
  select: {
    width:"100%", background:"#090E18", border:`1px solid ${C.border}`,
    borderRadius:10, padding:"11px 13px", color:C.text, fontSize:13,
    outline:"none", boxSizing:"border-box", appearance:"none", fontFamily:"inherit",
  },
  badge: (color) => ({
    display:"inline-flex", alignItems:"center", gap:4,
    background:`${color}20`, color:color, fontSize:10, fontWeight:700,
    padding:"3px 9px", borderRadius:20, letterSpacing:"0.3px", border:`1px solid ${color}35`,
  }),
  btn: (color, outline) => ({
    background: outline ? "transparent" : color,
    border: `1.5px solid ${color}`,
    color: outline ? color : "#fff",
    borderRadius:11, padding:"12px 16px", fontSize:13, fontWeight:700,
    cursor:"pointer", width:"100%", letterSpacing:"0.3px", fontFamily:"inherit",
  }),
  fab: {
    position:"fixed", bottom:82, right:18, width:56, height:56, borderRadius:"50%",
    background:`linear-gradient(135deg, #FF6B35, #FF1744)`,
    color:"#fff", fontSize:26, border:"none", cursor:"pointer",
    display:"flex", alignItems:"center", justifyContent:"center",
    boxShadow:"0 4px 24px #FF6B3555", zIndex:200,
  },
  nav: {
    position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
    width:"100%", maxWidth:430, background:"#08101A",
    borderTop:`1px solid ${C.border}`, display:"flex", padding:"8px 0 14px", zIndex:150,
  },
  navItem: (a) => ({
    flex:1, display:"flex", flexDirection:"column", alignItems:"center",
    gap:3, cursor:"pointer", padding:"5px 0",
    opacity: a ? 1 : 0.35, transition:"opacity 0.2s",
  }),
  navLbl: (a) => ({ fontSize:9, fontWeight:a?700:400, color:a?"#FF6B35":C.muted, letterSpacing:"0.5px" }),
  sectionTitle: { fontSize:10, fontWeight:700, color:C.muted, letterSpacing:"1.2px",
    textTransform:"uppercase", marginBottom:10, marginTop:2 },
  whyBox: (i) => ({
    background:"#090E18", border:`1px solid ${C.border}`,
    borderLeft:`3px solid ${["#FF1744","#FF6B35","#FFB300","#00B4D8","#00C853"][i]}`,
    borderRadius:"0 10px 10px 0", padding:"10px 12px", marginBottom:8,
  }),
  catBtn: (active, color) => ({
    padding:"7px 10px", borderRadius:10, fontSize:11, fontWeight:700, cursor:"pointer",
    border:`1.5px solid ${active ? color : C.border}`,
    background: active ? `${color}20` : "#090E18",
    color: active ? color : C.muted, letterSpacing:"0.3px", fontFamily:"inherit",
    whiteSpace:"nowrap",
  }),
  metricBox: (color) => ({
    background:`${color}12`, border:`1px solid ${color}30`,
    borderRadius:12, padding:"12px 14px", flex:1, textAlign:"center",
  }),
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view,       setView]       = useState("dashboard");
  const [records,    setRecords]    = useState(INITIAL);
  const [selected,   setSelected]   = useState(null);
  const [editRec,    setEditRec]    = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [filterStat, setFilterStat] = useState("all");
  const [histEqId,   setHistEqId]   = useState(null);
  const [notif,      setNotif]      = useState(null);

  const blankForm = () => ({
    equipmentType:"compressor", equipmentId:"", location:"", faultType:"",
    severity:"medium", status:"open", description:"", reportedBy:"",
    date: new Date().toISOString().split("T")[0],
    time: new Date().toTimeString().slice(0,5),
    resolution:"", downtime:0,
    fiveWhys:["","","","",""],
    causaRaizCategoria:"Máquina", causaRaizDescripcion:"",
    accionCorrectiva:"", resuelto:false,
  });

  const [form, setForm] = useState(blankForm());

  const toast = (msg, type="ok") => {
    setNotif({msg,type});
    setTimeout(()=>setNotif(null), 2600);
  };

  // Equipment IDs for history
  const equipIds = useMemo(()=>[...new Set(records.map(r=>r.equipmentId))].sort(),[records]);

  // Stats
  const stats = useMemo(()=>({
    total:       records.length,
    critical:    records.filter(r=>r.severity==="critical").length,
    open:        records.filter(r=>r.status==="open").length,
    resolved:    records.filter(r=>r.status==="resolved").length,
    withRCA:     records.filter(r=>r.fiveWhys?.[4]?.trim()).length,
    compressors: records.filter(r=>r.equipmentType==="compressor").length,
    cryogenic:   records.filter(r=>r.equipmentType==="cryogenic_pump").length,
  }),[records]);

  const filtered = useMemo(()=> records.filter(r=>{
    if (filterType!=="all" && r.equipmentType!==filterType) return false;
    if (filterStat!=="all" && r.status!==filterStat) return false;
    return true;
  }),[records, filterType, filterStat]);

  // Recurring faults detection
  const recurring = useMemo(()=>{
    const map = {};
    records.forEach(r=>{ const k=`${r.equipmentId}::${r.faultType}`; map[k]=(map[k]||0)+1; });
    return Object.entries(map).filter(([,v])=>v>=2).map(([k,v])=>({key:k,count:v}));
  },[records]);

  // Handlers
  const openNew = () => { setEditRec(null); setForm(blankForm()); setView("form"); };
  const openEdit = (r) => { setEditRec(r); setForm({...r}); setView("form"); };

  const handleSubmit = () => {
    if (!form.equipmentId||!form.faultType||!form.description||!form.reportedBy){
      toast("Completa los campos requeridos","err"); return;
    }
    if (editRec) {
      setRecords(records.map(r=>r.id===editRec.id?{...form,id:editRec.id}:r));
      toast("Registro actualizado ✓");
    } else {
      setRecords([{...form, id:Date.now()}, ...records]);
      toast("Falla registrada ✓");
    }
    setView("list");
  };

  const deleteRec = (id) => {
    setRecords(records.filter(r=>r.id!==id));
    setSelected(null); setView("list"); toast("Eliminado");
  };

  const setWhy = (i,v) => setForm(f=>{ const w=[...f.fiveWhys]; w[i]=v; return {...f,fiveWhys:w}; });

  // ── DASHBOARD ──────────────────────────────────────────────────────────────
  const Dashboard = () => (
    <div style={S.screen}>
      <div style={{marginBottom:18}}>
        <div style={{fontSize:24,fontWeight:800,letterSpacing:"-0.5px"}}>Panel de Control</div>
        <div style={{fontSize:11,color:C.muted}}>
          {new Date().toLocaleDateString("es-MX",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
        </div>
      </div>

      {stats.critical>0 && (
        <div style={{...S.card("#FF1744"), display:"flex", alignItems:"center", gap:12, marginBottom:14}}>
          <span style={{fontSize:26}}>🚨</span>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#FF1744"}}>
              {stats.critical} falla{stats.critical>1?"s":""} crítica{stats.critical>1?"s":""}
            </div>
            <div style={{fontSize:11,color:C.muted}}>Requiere atención inmediata</div>
          </div>
        </div>
      )}

      {recurring.length>0 && (
        <div style={{...S.card("#FFB300"), marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#FFB300",marginBottom:8}}>
            ⚠️ FALLAS RECURRENTES DETECTADAS
          </div>
          {recurring.map(r=>(
            <div key={r.key} style={{fontSize:11,color:C.text,marginBottom:4}}>
              • {r.key.split("::")[0]} — <span style={{color:"#FFB300"}}>{r.key.split("::")[1]}</span>
              <span style={{color:C.muted}}> ({r.count}x)</span>
            </div>
          ))}
          <div style={{fontSize:10,color:C.muted,marginTop:6}}>💡 Prioriza RCA en estos equipos</div>
        </div>
      )}

      {/* KPI grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:16}}>
        {[
          {label:"Total fallas",   val:stats.total,    color:"#FF6B35"},
          {label:"Abiertas",       val:stats.open,     color:"#FF1744"},
          {label:"Con RCA completo",val:stats.withRCA,  color:"#00C853"},
          {label:"Resueltas",      val:stats.resolved, color:"#00B4D8"},
        ].map(k=>(
          <div key={k.label} style={S.metricBox(k.color)}>
            <div style={{fontSize:34,fontWeight:900,color:k.color,lineHeight:1}}>{k.val}</div>
            <div style={{fontSize:10,color:C.muted,marginTop:4,textTransform:"uppercase",letterSpacing:"0.4px"}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* By type */}
      <div style={S.sectionTitle}>Por tipo de equipo</div>
      <div style={{display:"flex",gap:9,marginBottom:18}}>
        {Object.entries(EQUIPMENT_TYPES).map(([key,eq])=>(
          <div key={key} style={{...S.metricBox(eq.color), display:"flex", alignItems:"center", gap:10}}>
            <span style={{fontSize:22}}>{eq.icon}</span>
            <div>
              <div style={{fontSize:22,fontWeight:800,color:eq.color}}>
                {records.filter(r=>r.equipmentType===key).length}
              </div>
              <div style={{fontSize:9,color:C.muted}}>{eq.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* RCA coverage */}
      <div style={S.sectionTitle}>Cobertura de análisis RCA</div>
      <div style={{...S.card(), marginBottom:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:12,color:C.text}}>5 Porqués completados</span>
          <span style={{fontSize:13,fontWeight:700,color:"#00C853"}}>
            {stats.withRCA}/{stats.total}
          </span>
        </div>
        <div style={{background:"#090E18",borderRadius:6,height:8,overflow:"hidden"}}>
          <div style={{
            height:"100%", borderRadius:6,
            width:`${stats.total?((stats.withRCA/stats.total)*100):0}%`,
            background:"linear-gradient(90deg,#00C853,#00B4D8)",
            transition:"width 0.6s ease",
          }}/>
        </div>
        <div style={{fontSize:10,color:C.muted,marginTop:6}}>
          {stats.total - stats.withRCA} falla{stats.total-stats.withRCA!==1?"s":""} pendiente{stats.total-stats.withRCA!==1?"s":""} de RCA
        </div>
      </div>

      {/* Recent */}
      <div style={S.sectionTitle}>Últimas fallas</div>
      {records.slice(0,3).map(r=>{
        const sv=getSev(r.severity); const eq=getEq(r.equipmentType);
        return (
          <div key={r.id} style={{...S.card(), borderLeft:`4px solid ${sv.color}`, cursor:"pointer"}}
            onClick={()=>{setSelected(r);setView("detail");}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <div style={{fontWeight:700,fontSize:13}}>{eq.icon} {r.equipmentId}</div>
              <span style={S.badge(sv.color)}>{sv.dot} {sv.label}</span>
            </div>
            <div style={{fontSize:11,color:"#8899BB",marginBottom:5}}>{r.faultType}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:10,color:r.fiveWhys?.[4]?.trim()?"#00C853":C.muted}}>
                {r.fiveWhys?.[4]?.trim() ? "✅ RCA completo" : "⏳ RCA pendiente"}
              </span>
              <span style={{fontSize:10,color:C.muted}}>{r.date}</span>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  const ListView = () => (
    <div style={S.screen}>
      <div style={{fontSize:18,fontWeight:800,marginBottom:14}}>Registro de Fallas</div>

      {/* Filters */}
      <div style={{display:"flex",gap:6,marginBottom:9,overflowX:"auto",paddingBottom:2}}>
        {[{id:"all",label:"Todos"},{id:"compressor",label:"⚙️ Comp."},{id:"cryogenic_pump",label:"❄️ Criog."}].map(f=>(
          <button key={f.id} style={S.catBtn(filterType===f.id,"#FF6B35")}
            onClick={()=>setFilterType(f.id)}>{f.label}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
        {[{id:"all",label:"Todos",color:"#FF6B35"},...STATUS].map(s=>(
          <button key={s.id} style={S.catBtn(filterStat===s.id,s.color)}
            onClick={()=>setFilterStat(s.id)}>{s.label}</button>
        ))}
      </div>

      {filtered.length===0
        ? <div style={{textAlign:"center",padding:"40px 0",color:C.muted}}>
            <div style={{fontSize:36,marginBottom:10}}>📋</div>
            <div style={{fontSize:13}}>Sin registros con ese filtro</div>
          </div>
        : filtered.map(r=>{
          const sv=getSev(r.severity); const st=getStat(r.status); const eq=getEq(r.equipmentType);
          return (
            <div key={r.id} style={{...S.card(), borderLeft:`4px solid ${sv.color}`, cursor:"pointer"}}
              onClick={()=>{setSelected(r);setView("detail");}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                <div>
                  <div style={{fontWeight:700,fontSize:13}}>{eq.icon} {r.equipmentId}</div>
                  <div style={{fontSize:10,color:C.muted,marginTop:1}}>{r.location}</div>
                </div>
                <span style={S.badge(sv.color)}>{sv.dot} {sv.label}</span>
              </div>
              <div style={{fontSize:11,color:"#8899BB",marginBottom:8}}>{r.faultType}</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",gap:6}}>
                  <span style={S.badge(st.color)}>{st.label}</span>
                  {r.fiveWhys?.[4]?.trim() &&
                    <span style={S.badge("#00C853")}>RCA ✓</span>}
                </div>
                <span style={{fontSize:10,color:C.muted}}>{r.date}</span>
              </div>
            </div>
          );
        })
      }
    </div>
  );

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────
  const DetailView = () => {
    if (!selected) return null;
    const r=selected; const sv=getSev(r.severity); const st=getStat(r.status); const eq=getEq(r.equipmentType);
    const whysComplete = r.fiveWhys?.filter(w=>w?.trim()).length||0;
    return (
      <div style={S.screen}>
        <button onClick={()=>setView("list")} style={{background:"none",border:"none",color:C.muted,fontSize:12,cursor:"pointer",marginBottom:12,padding:0}}>
          ← Volver
        </button>

        {/* Hero */}
        <div style={{...S.card(`${sv.color}40`), background:`linear-gradient(135deg,${sv.color}18,${sv.color}08)`, marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div>
              <div style={{fontSize:22,fontWeight:900}}>{eq.icon} {r.equipmentId}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:2}}>{r.location}</div>
            </div>
            <span style={S.badge(sv.color)}>{sv.dot} {sv.label}</span>
          </div>
          <div style={{fontSize:13,fontWeight:700,color:eq.color,marginBottom:8}}>{r.faultType}</div>
          <div style={{display:"flex",gap:7}}>
            <span style={S.badge(st.color)}>{st.label}</span>
            {r.downtime>0 && <span style={S.badge("#7C4DFF")}>⏱ {r.downtime}h fuera</span>}
          </div>
        </div>

        {/* Info */}
        {[
          {lbl:"Descripción", val:r.description},
          {lbl:"Reportado por", val:r.reportedBy},
          {lbl:"Fecha / Hora", val:`${r.date} · ${r.time}`},
          r.resolution ? {lbl:"Resolución", val:r.resolution} : null,
        ].filter(Boolean).map((x,i)=>(
          <div key={i} style={{...S.card(), marginBottom:9}}>
            <div style={S.label}>{x.lbl}</div>
            <div style={{fontSize:13,color:C.text,lineHeight:1.5}}>{x.val}</div>
          </div>
        ))}

        {/* 5 Whys */}
        <div style={{...S.card(`${whysComplete>=5?"#00C853":"#FFB300"}40`), marginBottom:9}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={S.label}>Análisis 5 Porqués</div>
            <span style={S.badge(whysComplete>=5?"#00C853":"#FFB300")}>
              {whysComplete}/5
            </span>
          </div>
          {(r.fiveWhys||[]).map((w,i)=>(
            <div key={i} style={S.whyBox(i)}>
              <div style={{fontSize:9,color:C.muted,marginBottom:3,letterSpacing:"0.5px"}}>
                PORQUÉ #{i+1}
              </div>
              <div style={{fontSize:12,color:w?.trim()?C.text:C.muted}}>
                {w?.trim()||"Sin respuesta"}
              </div>
            </div>
          ))}

          {r.causaRaizCategoria && (
            <div style={{marginTop:12,padding:"10px 12px",background:"#090E18",borderRadius:10,border:`1px solid ${C.border}`}}>
              <div style={S.label}>Categoría causa raíz</div>
              <span style={S.badge("#7C4DFF")}>{r.causaRaizCategoria}</span>
              {r.causaRaizDescripcion && (
                <div style={{fontSize:12,color:C.text,marginTop:8,lineHeight:1.5}}>{r.causaRaizDescripcion}</div>
              )}
            </div>
          )}

          {r.accionCorrectiva && (
            <div style={{marginTop:9,padding:"10px 12px",background:"#00C85310",borderRadius:10,border:"1px solid #00C85330"}}>
              <div style={S.label}>Acción correctiva</div>
              <div style={{fontSize:12,color:"#00C853",lineHeight:1.5}}>{r.accionCorrectiva}</div>
            </div>
          )}
        </div>

        <div style={{display:"flex",gap:9}}>
          <button style={{...S.btn("#5B8FBB",true),flex:1}} onClick={()=>openEdit(r)}>✏️ Editar</button>
          <button style={{...S.btn("#FF1744",true),flex:1}} onClick={()=>deleteRec(r.id)}>🗑️</button>
        </div>
      </div>
    );
  };

  // ── HISTORY VIEW ───────────────────────────────────────────────────────────
  const HistoryView = () => {
    const eqRecs = histEqId ? records.filter(r=>r.equipmentId===histEqId) : [];
    const mtbf = calcMTBF(eqRecs);
    const mttr = calcMTTR(eqRecs);
    const faultFreq = {};
    eqRecs.forEach(r=>{ faultFreq[r.faultType]=(faultFreq[r.faultType]||0)+1; });
    const topFaults = Object.entries(faultFreq).sort((a,b)=>b[1]-a[1]);

    return (
      <div style={S.screen}>
        <div style={{fontSize:18,fontWeight:800,marginBottom:14}}>Historial por Equipo</div>

        {/* Equipment picker */}
        <div style={S.sectionTitle}>Seleccionar equipo</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:16}}>
          {equipIds.map(id=>{
            const eq = getEq(records.find(r=>r.equipmentId===id)?.equipmentType);
            const active = histEqId===id;
            return (
              <button key={id} style={S.catBtn(active, eq?.color||"#FF6B35")}
                onClick={()=>setHistEqId(active?null:id)}>
                {eq?.icon} {id}
              </button>
            );
          })}
        </div>

        {histEqId && eqRecs.length>0 ? (
          <>
            {/* MTBF / MTTR */}
            <div style={S.sectionTitle}>Métricas de confiabilidad</div>
            <div style={{display:"flex",gap:9,marginBottom:14}}>
              <div style={S.metricBox("#00B4D8")}>
                <div style={{fontSize:11,color:C.muted,marginBottom:4}}>MTBF</div>
                <div style={{fontSize:26,fontWeight:900,color:"#00B4D8"}}>
                  {mtbf||"—"}
                </div>
                <div style={{fontSize:9,color:C.muted}}>horas promedio entre fallas</div>
              </div>
              <div style={S.metricBox("#FFB300")}>
                <div style={{fontSize:11,color:C.muted,marginBottom:4}}>MTTR</div>
                <div style={{fontSize:26,fontWeight:900,color:"#FFB300"}}>
                  {mttr||"—"}
                </div>
                <div style={{fontSize:9,color:C.muted}}>horas promedio de reparación</div>
              </div>
              <div style={S.metricBox("#FF6B35")}>
                <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Total</div>
                <div style={{fontSize:26,fontWeight:900,color:"#FF6B35"}}>{eqRecs.length}</div>
                <div style={{fontSize:9,color:C.muted}}>fallas registradas</div>
              </div>
            </div>

            {/* Top faults */}
            {topFaults.length>0 && (
              <>
                <div style={S.sectionTitle}>Fallas más frecuentes</div>
                <div style={{...S.card(), marginBottom:14}}>
                  {topFaults.map(([ft,cnt],i)=>{
                    const pct = (cnt/eqRecs.length)*100;
                    return (
                      <div key={ft} style={{marginBottom:i<topFaults.length-1?10:0}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontSize:11,color:C.text,flex:1,marginRight:8}}>{ft}</span>
                          <span style={{fontSize:11,fontWeight:700,color:"#FF6B35"}}>{cnt}x</span>
                        </div>
                        <div style={{background:"#090E18",borderRadius:4,height:5,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#FF6B35,#FF1744)",borderRadius:4}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Timeline */}
            <div style={S.sectionTitle}>Historial cronológico</div>
            {[...eqRecs].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(r=>{
              const sv=getSev(r.severity); const st=getStat(r.status);
              return (
                <div key={r.id}
                  style={{...S.card(), borderLeft:`4px solid ${sv.color}`, cursor:"pointer"}}
                  onClick={()=>{setSelected(r);setView("detail");}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:13,fontWeight:700}}>{r.faultType}</span>
                    <span style={S.badge(sv.color)}>{sv.dot}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={S.badge(st.color)}>{st.label}</span>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:10,color:C.muted}}>{r.date}</div>
                      {r.downtime>0 && <div style={{fontSize:10,color:"#7C4DFF"}}>⏱ {r.downtime}h</div>}
                    </div>
                  </div>
                  {r.fiveWhys?.[4]?.trim() && (
                    <div style={{fontSize:10,color:"#00C853",marginTop:6}}>✅ RCA: {r.causaRaizCategoria}</div>
                  )}
                </div>
              );
            })}
          </>
        ) : histEqId ? (
          <div style={{textAlign:"center",padding:"30px 0",color:C.muted}}>Sin registros para este equipo</div>
        ) : (
          <div style={{textAlign:"center",padding:"40px 0",color:C.muted}}>
            <div style={{fontSize:36,marginBottom:10}}>🏭</div>
            <div style={{fontSize:13}}>Selecciona un equipo para ver su historial y métricas</div>
          </div>
        )}
      </div>
    );
  };

  // ── FORM VIEW ──────────────────────────────────────────────────────────────
  const FormView = () => {
    const [tab, setTab] = useState("basic");
    const eq = getEq(form.equipmentType);

    return (
      <div style={S.screen}>
        <button onClick={()=>setView(editRec?"detail":"list")}
          style={{background:"none",border:"none",color:C.muted,fontSize:12,cursor:"pointer",marginBottom:12,padding:0}}>
          ← Cancelar
        </button>
        <div style={{fontSize:18,fontWeight:800,marginBottom:14}}>
          {editRec?"✏️ Editar Falla":"🆕 Registrar Falla"}
        </div>

        {/* Tab selector */}
        <div style={{display:"flex",gap:7,marginBottom:18}}>
          {[{id:"basic",lbl:"📋 General"},{id:"rca",lbl:"🔍 5 Porqués"},{id:"action",lbl:"✅ Acción"}].map(t=>(
            <button key={t.id} style={{
              flex:1, padding:"9px 6px", borderRadius:10, fontSize:11, fontWeight:700,
              cursor:"pointer", fontFamily:"inherit",
              border:`1.5px solid ${tab===t.id?"#FF6B35":C.border}`,
              background: tab===t.id?"#FF6B3520":"#090E18",
              color: tab===t.id?"#FF6B35":C.muted,
            }} onClick={()=>setTab(t.id)}>{t.lbl}</button>
          ))}
        </div>

        {/* ── TAB: BASIC ── */}
        {tab==="basic" && <>
          <div style={{marginBottom:12}}>
            <div style={S.label}>Tipo de equipo</div>
            <div style={{display:"flex",gap:9}}>
              {Object.entries(EQUIPMENT_TYPES).map(([k,e])=>(
                <button key={k} style={S.catBtn(form.equipmentType===k,e.color)}
                  onClick={()=>setForm({...form,equipmentType:k,faultType:""})}>
                  {e.icon} {e.label}
                </button>
              ))}
            </div>
          </div>

          {[
            {lbl:"ID / Tag del equipo *", key:"equipmentId", ph:"Ej: COMP-001, BCP-003"},
            {lbl:"Ubicación",            key:"location",    ph:"Ej: Planta A - Área 3"},
          ].map(f=>(
            <div key={f.key} style={{marginBottom:12}}>
              <div style={S.label}>{f.lbl}</div>
              <input style={S.input} placeholder={f.ph}
                value={form[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})}/>
            </div>
          ))}

          <div style={{marginBottom:12}}>
            <div style={S.label}>Tipo de falla *</div>
            <select style={S.select} value={form.faultType}
              onChange={e=>setForm({...form,faultType:e.target.value})}>
              <option value="">Seleccionar...</option>
              {EQUIPMENT_TYPES[form.equipmentType].faultTypes.map(ft=>(
                <option key={ft} value={ft}>{ft}</option>
              ))}
            </select>
          </div>

          <div style={{display:"flex",gap:9,marginBottom:12}}>
            <div style={{flex:1}}>
              <div style={S.label}>Severidad</div>
              <select style={S.select} value={form.severity}
                onChange={e=>setForm({...form,severity:e.target.value})}>
                {SEVERITY.map(s=><option key={s.id} value={s.id}>{s.dot} {s.label}</option>)}
              </select>
            </div>
            <div style={{flex:1}}>
              <div style={S.label}>Estado</div>
              <select style={S.select} value={form.status}
                onChange={e=>setForm({...form,status:e.target.value})}>
                {STATUS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{display:"flex",gap:9,marginBottom:12}}>
            <div style={{flex:1}}>
              <div style={S.label}>Fecha</div>
              <input type="date" style={S.input} value={form.date}
                onChange={e=>setForm({...form,date:e.target.value})}/>
            </div>
            <div style={{flex:1}}>
              <div style={S.label}>Hora</div>
              <input type="time" style={S.input} value={form.time}
                onChange={e=>setForm({...form,time:e.target.value})}/>
            </div>
          </div>

          <div style={{marginBottom:12}}>
            <div style={S.label}>Descripción de la falla *</div>
            <textarea style={{...S.input,minHeight:85,resize:"vertical",lineHeight:1.5}}
              placeholder="Describe síntomas, lecturas de instrumentos, condiciones observadas..."
              value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
          </div>

          <div style={{marginBottom:12}}>
            <div style={S.label}>Reportado por *</div>
            <input style={S.input} placeholder="Nombre del técnico / operador"
              value={form.reportedBy} onChange={e=>setForm({...form,reportedBy:e.target.value})}/>
          </div>

          <div style={{marginBottom:16}}>
            <div style={S.label}>Tiempo fuera de servicio (horas)</div>
            <input type="number" style={S.input} placeholder="0" min="0" step="0.5"
              value={form.downtime} onChange={e=>setForm({...form,downtime:parseFloat(e.target.value)||0})}/>
          </div>

          <button style={{...S.btn("#FF6B35"), background:"linear-gradient(135deg,#FF6B35,#FF4422)", padding:"13px"}}
            onClick={()=>setTab("rca")}>
            Siguiente: Análisis 5 Porqués →
          </button>
        </>}

        {/* ── TAB: 5 WHYS ── */}
        {tab==="rca" && <>
          <div style={{...S.card("#00B4D820"), marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:700,color:"#00B4D8",marginBottom:4}}>¿Cómo usar los 5 Porqués?</div>
            <div style={{fontSize:11,color:C.muted,lineHeight:1.6}}>
              Empieza con el síntoma visible y pregunta "¿por qué?" hasta llegar a la causa raíz real. Cada respuesta se convierte en el siguiente "¿por qué?"
            </div>
          </div>

          {form.fiveWhys.map((w,i)=>(
            <div key={i} style={{marginBottom:12}}>
              <div style={S.label}>
                {["1er","2do","3er","4to","5to"][i]} Porqué
                {i===0 && " (síntoma principal)"}
                {i===4 && " (causa raíz)"}
              </div>
              <div style={S.whyBox(i)}>
                <textarea style={{
                  ...S.input, minHeight:60, resize:"vertical", lineHeight:1.5,
                  background:"transparent", border:"none", padding:0,
                }}
                  placeholder={[
                    `¿Por qué falló ${form.equipmentId||"el equipo"}?`,
                    "¿Por qué ocurrió eso?",
                    "¿Por qué ocurrió eso?",
                    "¿Por qué ocurrió eso?",
                    "¿Por qué ocurrió eso? (causa raíz)",
                  ][i]}
                  value={w} onChange={e=>setWhy(i,e.target.value)}/>
              </div>
            </div>
          ))}

          <div style={{marginBottom:14}}>
            <div style={S.label}>Categoría de causa raíz (6M)</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
              {CAUSA_RAIZ_CATS.map(c=>(
                <button key={c} style={S.catBtn(form.causaRaizCategoria===c,"#7C4DFF")}
                  onClick={()=>setForm({...form,causaRaizCategoria:c})}>{c}</button>
              ))}
            </div>
          </div>

          <div style={{marginBottom:16}}>
            <div style={S.label}>Descripción de causa raíz</div>
            <textarea style={{...S.input,minHeight:70,resize:"vertical",lineHeight:1.5}}
              placeholder="Resume en una oración la causa raíz identificada..."
              value={form.causaRaizDescripcion}
              onChange={e=>setForm({...form,causaRaizDescripcion:e.target.value})}/>
          </div>

          <button style={{...S.btn("#7C4DFF"), background:"linear-gradient(135deg,#7C4DFF,#651FFF)", padding:"13px"}}
            onClick={()=>setTab("action")}>
            Siguiente: Acción Correctiva →
          </button>
        </>}

        {/* ── TAB: ACTION ── */}
        {tab==="action" && <>
          <div style={{...S.card("#00C85320"), marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:700,color:"#00C853",marginBottom:4}}>Cierre del RCA</div>
            <div style={{fontSize:11,color:C.muted,lineHeight:1.6}}>
              Define la acción correctiva que elimina la causa raíz, no solo el síntoma.
            </div>
          </div>

          <div style={{marginBottom:14}}>
            <div style={S.label}>Resolución / Acción aplicada</div>
            <textarea style={{...S.input,minHeight:80,resize:"vertical",lineHeight:1.5}}
              placeholder="¿Qué se hizo para resolver esta falla específica?"
              value={form.resolution} onChange={e=>setForm({...form,resolution:e.target.value})}/>
          </div>

          <div style={{marginBottom:14}}>
            <div style={S.label}>Acción correctiva (evita recurrencia)</div>
            <textarea style={{...S.input,minHeight:80,resize:"vertical",lineHeight:1.5}}
              placeholder="¿Qué cambio permanente se hará para que no vuelva a ocurrir? (ej: instalar sensor, modificar PM, actualizar procedimiento)"
              value={form.accionCorrectiva} onChange={e=>setForm({...form,accionCorrectiva:e.target.value})}/>
          </div>

          {/* Summary before save */}
          <div style={{...S.card(), marginBottom:14}}>
            <div style={S.label}>Resumen del registro</div>
            {[
              {lbl:"Equipo",    val:`${getEq(form.equipmentType)?.icon} ${form.equipmentId||"—"}`},
              {lbl:"Falla",     val:form.faultType||"—"},
              {lbl:"Severidad", val:getSev(form.severity)?.label},
              {lbl:"5 Porqués",val:`${form.fiveWhys.filter(w=>w?.trim()).length}/5 completados`},
              {lbl:"Causa raíz",val:form.causaRaizCategoria||"—"},
            ].map((x,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",
                padding:"6px 0", borderBottom:i<4?`1px solid ${C.border}`:"none"}}>
                <span style={{fontSize:11,color:C.muted}}>{x.lbl}</span>
                <span style={{fontSize:11,fontWeight:600,color:C.text}}>{x.val}</span>
              </div>
            ))}
          </div>

          <button style={{
            ...S.btn("#00C853"), background:"linear-gradient(135deg,#00C853,#00B070)",
            padding:"14px", fontSize:14,
          }} onClick={handleSubmit}>
            {editRec?"💾 Guardar cambios":"✅ Registrar con RCA"}
          </button>
        </>}
      </div>
    );
  };

  // ── NAV ────────────────────────────────────────────────────────────────────
  const navItems = [
    { id:"dashboard", icon:"📊", label:"Panel" },
    { id:"list",      icon:"📋", label:"Fallas" },
    { id:"history",   icon:"🏭", label:"Historial" },
  ];
  const activeNav = ["dashboard","list","history"].includes(view) ? view : null;

  return (
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=IBM+Plex+Sans:wght@400;600;700;800&display=swap" rel="stylesheet"/>

      {/* HEADER */}
      <div style={S.header}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:19,fontWeight:800,letterSpacing:"-0.3px"}}>⚙️❄️ EquipLog</div>
            <div style={{fontSize:9,color:C.muted,letterSpacing:"1px",textTransform:"uppercase"}}>
              Sistema de gestión de fallas v2
            </div>
          </div>
          <div style={{display:"flex",gap:7}}>
            {stats.open>0 && (
              <div style={S.badge("#FF1744")}>{stats.open} abierta{stats.open>1?"s":""}</div>
            )}
            {recurring.length>0 && (
              <div style={S.badge("#FFB300")}>⚠️ {recurring.length} recurrente{recurring.length>1?"s":""}</div>
            )}
          </div>
        </div>
      </div>

      {/* TOAST */}
      {notif && (
        <div style={{
          position:"fixed", top:76, left:"50%", transform:"translateX(-50%)",
          background:notif.type==="err"?"#FF1744":"#00C853",
          color:"#fff", padding:"11px 22px", borderRadius:11, fontSize:12,
          fontWeight:700, zIndex:500, boxShadow:"0 4px 20px rgba(0,0,0,0.5)",
          whiteSpace:"nowrap",
        }}>{notif.msg}</div>
      )}

      {/* SCREENS */}
      {view==="dashboard" && <Dashboard/>}
      {view==="list"      && <ListView/>}
      {view==="detail"    && <DetailView/>}
      {view==="history"   && <HistoryView/>}
      {view==="form"      && <FormView/>}

      {/* FAB */}
      {view!=="form" && (
        <button style={S.fab} onClick={openNew}>＋</button>
      )}

      {/* BOTTOM NAV */}
      <div style={S.nav}>
        {navItems.map(n=>{
          const a = activeNav===n.id;
          return (
            <div key={n.id} style={S.navItem(a)} onClick={()=>setView(n.id)}>
              <span style={{fontSize:19}}>{n.icon}</span>
              <span style={S.navLbl(a)}>{n.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
