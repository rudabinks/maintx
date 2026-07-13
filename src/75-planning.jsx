/* ------------------------- PLANNING (responsable maintenance) ------------------------- */
function Planning({interventions,machines,machineName,db,setModal}) {
  const [techs,setTechs] = useState([]);
  useEffect(() => { db.fetchTechnicians().then(setTechs); }, []);
  const techName = id => techs.find(t=>t.id===id)?.full_name || "non assigné";
  const planned = interventions.filter(i=>i.scheduled_for && i.status!=="done")
    .sort((a,b)=>(a.scheduled_for||"").localeCompare(b.scheduled_for||""));
  const groups = {};
  planned.forEach(i=>{ (groups[i.scheduled_for] = groups[i.scheduled_for]||[]).push(i); });
  const days = Object.keys(groups).sort();
  const dayLabel = d => {
    if (d===today()) return "Aujourd'hui";
    if (d===addDays(today(),1)) return "Demain";
    return new Date(d+"T00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  };
  return <>
    <Toolbar>
      <H2>Planning{planned.length?` · ${planned.length} à venir`:""}</H2>
      <button className="btn" onClick={()=>setModal("plan")}>+ Planifier une intervention</button>
    </Toolbar>
    {days.map(d=>(
      <div key={d} style={{marginBottom:16}}>
        <div style={{font:"800 12px system-ui",textTransform:"uppercase",letterSpacing:".05em",marginBottom:8,color:d<today()?"var(--alarm)":"var(--ink)"}}>
          {dayLabel(d)}{d<today()?" · en retard":""}
        </div>
        {groups[d].map(i=><PlanItem key={i.id} i={i} machineName={machineName} techName={techName} db={db}/>)}
      </div>
    ))}
    {planned.length===0 && <Empty>Aucune intervention planifiée — cliquez sur « Planifier une intervention » pour en programmer une.</Empty>}
  </>;
}

function PlanItem({i,machineName,techName,db}) {
  const [open,setOpen] = useState(false);
  return (
    <div style={{marginBottom:8}}>
      <Row style={{marginBottom:0,borderLeft:`4px solid ${i.type==="curative"?"var(--alarm)":"var(--run)"}`}}>
        <div style={{flex:1,cursor:i.directive?"pointer":"default"}} onClick={()=>i.directive&&setOpen(!open)}>
          <b>{i.title}</b>
          <div style={{font:"500 12px system-ui",color:"var(--muted)",marginTop:2}}>
            {machineName(i.machine_id)} · {ITYPE[i.type]} · {techName(i.assigned_to)}
          </div>
        </div>
        {i.directive && <button className="btn ghost sm" onClick={()=>setOpen(!open)}>{open?"Masquer":"Directives"}</button>}
        <button className="btn ghost sm" title="Supprimer du planning" onClick={()=>db.deleteIntervention(i)}>Supprimer</button>
      </Row>
      {open && i.directive && (
        <div style={{background:"var(--bg)",borderLeft:"4px solid var(--accent)",padding:"11px 14px",font:"500 13px system-ui",whiteSpace:"pre-wrap"}}>{i.directive}</div>
      )}
    </div>
  );
}

function PlanningModal({machines,db,onClose}) {
  const [f,setF] = useState({machine:machines[0]?.id,assigned_to:"",scheduled_for:today(),type:"preventive",title:"",notes:"",directive:""});
  const [techs,setTechs] = useState([]);
  const [gen,setGen] = useState(false);
  const [saving,setSaving] = useState(false);
  const busy = useRef(false); // verrou anti double-envoi
  useEffect(() => { db.fetchTechnicians().then(setTechs); }, []);
  const submit = () => {
    if (busy.current || !f.title || !f.machine) return;
    busy.current = true; setSaving(true);
    db.planIntervention(f);
  };
  const lbl = {font:"500 12px system-ui",color:"var(--muted)",display:"block",marginBottom:4,marginTop:2};
  const generate = async () => {
    setGen(true);
    try {
      const m = machines.find(x=>x.id===f.machine);
      const txt = await db.generateDirective({machine:m?((m.code?m.code+" ":"")+m.name):"", title:f.title, type:ITYPE[f.type], notes:f.notes});
      setF(x=>({...x,directive:txt}));
    } catch(e) { alert("Génération indisponible : "+(e.message||e)); }
    setGen(false);
  };
  return (
    <Modal title="Planifier une intervention" onClose={onClose}>
      <label style={lbl}>Machine</label>
      <Dropdown value={f.machine} options={machines.map(m=>({value:m.id,label:(m.code?m.code+" — ":"")+m.name,sub:m.family}))}
                onChange={v=>setF({...f,machine:v})}/>
      <label style={lbl}>Type</label>
      <Dropdown value={f.type} options={Object.entries(ITYPE).map(([k,v])=>({value:k,label:v}))} onChange={v=>setF({...f,type:v})}/>
      <input placeholder="Titre (ex: Révision hebdomadaire presse)" value={f.title} onChange={e=>setF({...f,title:e.target.value})} style={{margin:"8px 0"}}/>
      <label style={lbl}>Technicien assigné</label>
      <Dropdown value={f.assigned_to||null} placeholder="Assigner à…"
                options={techs.map(t=>({value:t.id,label:t.full_name,sub:ROLES[t.role]?.label||t.role}))}
                onChange={v=>setF({...f,assigned_to:v})}/>
      <label style={lbl}>Date</label>
      <input type="date" value={f.scheduled_for} onChange={e=>setF({...f,scheduled_for:e.target.value})}/>
      <label style={lbl}>Consignes du responsable (pour l'IA)</label>
      <textarea rows={2} placeholder="Ce que le technicien doit faire, précisions, pièces à prévoir…" value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/>
      <button className="btn ghost" style={{width:"100%",margin:"8px 0"}} disabled={gen||!f.title} onClick={generate}>
        {gen?"Génération…":"Générer les directives (IA)"}
      </button>
      {f.directive && <>
        <label style={lbl}>Directives pour le technicien (modifiables)</label>
        <textarea rows={4} value={f.directive} onChange={e=>setF({...f,directive:e.target.value})}/>
      </>}
      <button className="btn" disabled={saving||!f.title||!f.machine} onClick={submit} style={{width:"100%",marginTop:10}}>
        {saving?"Planification…":"Planifier"}
      </button>
    </Modal>
  );
}
