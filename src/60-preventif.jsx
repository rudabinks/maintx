/* ------------------------- PRÉVENTIF ------------------------- */
const planIsDue = (p,machines) => p.next_due<=today() || planHoursDue(p,machines);

const planDetail = p => `${+p.freq_days>0?`tous les ${p.freq_days} j`:"une seule fois"}${p.freq_hours?` ou ${+p.freq_hours} h`:""}${p.checklist?.length?` · ☑ ${p.checklist.length}`:""}`;

function Preventif({preventifs,interventions,machines,machineName,db,setModal}) {
  const [checkFor,setCheckFor] = useState(null);
  const [groupBy,setGroupBy] = useState("task"); // task | machine
  const [onlyDue,setOnlyDue] = useState(true);    // à faire seulement (défaut) | toutes
  const active = preventifs.filter(p=>p.active!==false);
  const dueCount = active.filter(p=>planIsDue(p,machines)).length;
  const source = onlyDue ? active.filter(p=>planIsDue(p,machines)) : active;
  const history = (interventions||[]).filter(i=>i.type==="preventive" && i.status==="done")
    .sort((a,b)=>new Date(b.finished_at||b.reported_at)-new Date(a.finished_at||a.reported_at)).slice(0,40);
  const groups = {};
  source.forEach(p=>{
    const key = groupBy==="task" ? (p.title||"").trim().toLowerCase() : p.machine_id;
    const label = groupBy==="task" ? p.title : machineName(p.machine_id);
    (groups[key] = groups[key] || {label, plans:[]}).plans.push(p);
  });
  const groupList = Object.values(groups)
    .map(g=>({...g, due:g.plans.filter(p=>planIsDue(p,machines)).length}))
    .sort((a,b)=> b.due-a.due || (a.label||"").localeCompare(b.label||""));
  const segBtn = (val,txt) => (
    <button onClick={()=>setGroupBy(val)} style={{border:0,padding:"8px 12px",cursor:"pointer",font:"700 12px system-ui",
      background:groupBy===val?"var(--ink)":"#fff",color:groupBy===val?"var(--accent)":"var(--ink)"}}>{txt}</button>
  );
  const dueBtn = (val,txt) => (
    <button onClick={()=>setOnlyDue(val)} style={{border:0,padding:"8px 12px",cursor:"pointer",font:"700 12px system-ui",
      background:onlyDue===val?"var(--ink)":"#fff",color:onlyDue===val?"var(--accent)":"var(--ink)"}}>{txt}</button>
  );
  return <>
    <Toolbar>
      <H2>Préventif{onlyDue?` · ${dueCount} à faire`:""}</H2>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <div style={{display:"flex",border:"1.5px solid var(--ink)"}}>{dueBtn(true,"À faire")}{dueBtn(false,"Toutes")}</div>
        <div style={{display:"flex",border:"1.5px solid var(--ink)"}}>{segBtn("task","Par tâche")}{segBtn("machine","Par machine")}</div>
        <button className="btn" onClick={()=>setModal("preventif")}>+ Nouvelle gamme</button>
      </div>
    </Toolbar>
    {groupList.map(g=>(
      <PreventifGroup key={g.label} g={g} groupBy={groupBy} machines={machines} machineName={machineName} db={db} onCheck={setCheckFor}/>
    ))}
    {active.length===0 && <Empty>Aucune gamme préventive — créez la première avec le bouton ci-dessus.</Empty>}
    {active.length>0 && source.length===0 && onlyDue && <Empty>Rien à faire — tout le préventif est à jour ✓</Empty>}
    {history.length>0 && (
      <Foldable title={`Historique des préventifs faits (${history.length})`}>
        {history.map(i=>(
          <Row key={i.id} style={{borderLeft:"4px solid var(--run)"}}>
            <div style={{flex:1}}>
              <b>{i.title}</b>
              <div style={{font:"500 12px system-ui",color:"var(--muted)",marginTop:2}}>{machineName(i.machine_id)}</div>
            </div>
            <div style={{font:"600 12px system-ui",color:"var(--muted)",whiteSpace:"nowrap"}}>{(i.finished_at||i.reported_at)?.slice(0,10)}</div>
          </Row>
        ))}
      </Foldable>
    )}
    {checkFor && <ChecklistModal plan={checkFor} onClose={()=>setCheckFor(null)}
                                 onValidate={steps=>{db.donePreventif(checkFor,steps);setCheckFor(null);}}/>}
  </>;
}

function PlanRow({p,machines,db,onCheck,bold,sub,indent}) {
  const late = planIsDue(p,machines);
  const nbSteps = p.checklist?.length || 0;
  return (
    <Row style={{borderLeft:`4px solid ${late?"var(--alarm)":"var(--run)"}`,...(indent?{marginLeft:12}:{})}}>
      <div style={{flex:1}}>
        <b>{bold||"—"}</b>
        <div style={{font:"500 12px system-ui",color:"var(--muted)",marginTop:2}}>{sub}</div>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{fontWeight:700,color:late?"var(--alarm)":"var(--ink)"}}>{p.next_due}</div>
        <div style={{font:"500 12px system-ui",color:"var(--muted)"}}>{late?(planHoursDue(p,machines)?"COMPTEUR":"EN RETARD"):"planifié"}</div>
      </div>
      <button className="btn sm" onClick={()=>nbSteps>0 ? onCheck(p) : db.donePreventif(p)}>✓ Fait</button>
    </Row>
  );
}

function PreventifGroup({g,groupBy,machines,machineName,db,onCheck}) {
  const [open,setOpen] = useState(false);
  if (g.plans.length===1) {
    const p = g.plans[0];
    return <PlanRow p={p} machines={machines} db={db} onCheck={onCheck}
                    bold={p.title} sub={`${machineName(p.machine_id)} · ${planDetail(p)}`}/>;
  }
  const unit = groupBy==="task" ? "machines" : "tâches";
  return (
    <div style={{border:`1px solid ${g.due>0?"var(--alarm)":"#E3E5E8"}`,marginBottom:10}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:"var(--panel)",flexWrap:"wrap"}}>
        <div style={{flex:1,cursor:"pointer",minWidth:180}} onClick={()=>setOpen(!open)}>
          <b>{open?"▾":"▸"} {g.label}</b>
          <div style={{font:"500 12px system-ui",color:"var(--muted)",marginTop:2}}>
            {g.plans.length} {unit}{g.due>0?` · ${g.due} à faire`:" · à jour"}
          </div>
        </div>
        <button className="btn sm" onClick={()=>db.donePreventifBatch(g.plans)}>✓ Tout valider ({g.plans.length})</button>
      </div>
      {open && g.plans.map(p=>(
        <PlanRow key={p.id} p={p} machines={machines} db={db} onCheck={onCheck} indent
                 bold={groupBy==="task"?machineName(p.machine_id):p.title} sub={planDetail(p)}/>
      ))}
    </div>
  );
}

function ChecklistModal({plan,onClose,onValidate}) {
  const [steps,setSteps] = useState((plan.checklist||[]).map(s=>({step:s.step||s,done:false})));
  const nb = steps.filter(s=>s.done).length;
  return (
    <Modal title={plan.title} onClose={onClose}>
      <div style={{font:"500 12px system-ui",color:"var(--muted)",marginBottom:12}}>
        Cochez les points réalisés. Vous pouvez valider même si tout n'a pas été fait — les points non faits resteront tracés dans l'historique.
      </div>
      {steps.map((s,k)=>(
        <label key={k} style={{display:"flex",gap:10,alignItems:"center",padding:"9px 10px",background:s.done?"rgba(31,162,84,.08)":"var(--bg)",marginBottom:6,cursor:"pointer",font:"600 13px system-ui"}}>
          <input type="checkbox" checked={s.done} style={{width:18,height:18,margin:0}}
                 onChange={()=>setSteps(steps.map((x,j)=>j===k?{...x,done:!x.done}:x))}/>
          <span style={s.done?{textDecoration:"line-through",color:"var(--muted)"}:null}>{s.step}</span>
        </label>
      ))}
      <button className="btn" style={{width:"100%",marginTop:10}} onClick={()=>onValidate(steps)}>
        ✓ Valider ({nb}/{steps.length} faits)
      </button>
    </Modal>
  );
}

