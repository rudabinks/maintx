/* ------------------------- PIÈCES DÉTACHÉES ------------------------- */
function Pieces({parts,setModal,db}) {
  return <>
    <Toolbar><H2>Pièces détachées ({parts.length})</H2><button className="btn" onClick={()=>setModal("part")}>+ Ajouter</button></Toolbar>
    {parts.map(p=>(
      <Row key={p.id} style={{borderLeft:`4px solid ${partLow(p)?"var(--alarm)":"var(--run)"}`}}>
        <div style={{flex:1}}>
          <b>{p.name}</b>{p.ref && <span style={{font:"700 12px ui-monospace,monospace",color:"var(--muted)"}}> · {p.ref}</span>}
          <div style={{font:"500 12px system-ui",color:"var(--muted)",marginTop:2}}>
            {p.location || "Emplacement non renseigné"}{p.unit_cost ? ` · ${p.unit_cost} € HT` : ""}
          </div>
        </div>
        {partLow(p) && <span style={{color:"#fff",font:"700 10px system-ui",textTransform:"uppercase",padding:"5px 10px",background:"var(--alarm)"}}>Stock bas</span>}
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button className="btn ghost sm" disabled={+p.qty<=0} onClick={()=>db.adjustPart(p,-1)}>−</button>
          <b style={{minWidth:56,textAlign:"center"}}>{+p.qty}{+p.min_qty>0 && <span style={{font:"500 11px system-ui",color:"var(--muted)"}}> / min {+p.min_qty}</span>}</b>
          <button className="btn ghost sm" onClick={()=>db.adjustPart(p,1)}>+</button>
        </div>
        <button className="btn ghost sm" onClick={()=>db.deletePart(p)}>✕</button>
      </Row>
    ))}
    {parts.length===0 && <Empty>Aucune pièce en stock. Ajoutez vos consommables courants (roulements, courroies, filtres, fusibles…) avec le bouton ci-dessus.</Empty>}
  </>;
}

function ImportModal({onClose,onImport}) {
  const [text,setText] = useState("");
  const [busy,setBusy] = useState(false);
  const fileRef = useRef();
  const {rows} = useMemo(()=>parseMachinesCSV(text), [text]);
  const loadFile = f => { const r=new FileReader(); r.onload=e=>setText(e.target.result); r.readAsText(f); };
  const doImport = async () => {
    setBusy(true);
    const ok = await onImport(rows);
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Modal title="Importer le parc (CSV / Excel)" onClose={onClose}>
      <div style={{font:"500 12px system-ui",color:"var(--muted)",marginBottom:10}}>
        Colle les cellules depuis Excel, ou choisis un fichier .csv. Colonnes reconnues :
        <b> Nom, Code, Famille, Criticité, Année</b> (une ligne d'en-tête conseillée).
        La criticité accepte 1/2/3 ou Secondaire/Importante/Critique.
      </div>
      <label className="btn ghost sm" style={{display:"inline-block",cursor:"pointer",marginBottom:8}}>
        📄 Choisir un fichier CSV
        <input type="file" accept=".csv,.txt,text/csv" ref={fileRef} style={{display:"none"}}
               onChange={e=>{const f=e.target.files[0]; if(f) loadFile(f); e.target.value="";}}/>
      </label>
      <textarea rows={5} placeholder={"Nom;Code;Famille;Criticité;Année\nMori Seiki M300L;FR-08;Tour CN;Critique;2015\nHaas VF2;FR-09;Fraiseuse;2;2019"}
                value={text} onChange={e=>setText(e.target.value)} style={{marginBottom:10,fontFamily:"ui-monospace,monospace",fontSize:12}}/>
      {rows.length>0 ? (
        <div style={{marginBottom:12}}>
          <div style={{font:"700 12px system-ui",marginBottom:6}}>{rows.length} machine{rows.length>1?"s":""} détectée{rows.length>1?"s":""} :</div>
          <div style={{maxHeight:180,overflow:"auto",border:"1px solid #E3E5E8"}}>
            {rows.slice(0,50).map((r,k)=>(
              <div key={k} style={{display:"flex",gap:8,padding:"5px 8px",borderBottom:"1px solid #EEE",font:"500 12px system-ui"}}>
                <b style={{flex:1}}>{r.name}</b>
                <span style={{color:"var(--muted)"}}>{r.code||"—"}</span>
                <span style={{color:"var(--muted)"}}>{r.family||"—"}</span>
                <span style={{color:CRIT[r.crit]?.color,fontWeight:700}}>{CRIT[r.crit]?.label}</span>
              </div>
            ))}
          </div>
          {rows.length>50 && <div style={{font:"500 11px system-ui",color:"var(--muted)",marginTop:4}}>… et {rows.length-50} autres</div>}
        </div>
      ) : text.trim() && <div style={{font:"600 12px system-ui",color:"var(--warn)",marginBottom:12}}>Aucune ligne exploitable — vérifie qu'il y a au moins une colonne Nom.</div>}
      <button className="btn" disabled={!rows.length||busy} onClick={doImport} style={{width:"100%"}}>
        {busy?"Import…":`Importer ${rows.length||""} machine${rows.length>1?"s":""}`}
      </button>
    </Modal>
  );
}

function PartModal({onClose,onSave}) {
  const [f,setF] = useState({name:"",ref:"",location:"",qty:1,min_qty:0,unit_cost:""});
  return (
    <Modal title="Ajouter une pièce" onClose={onClose}>
      <input placeholder="Nom (ex: Roulement broche)" value={f.name} onChange={e=>setF({...f,name:e.target.value})} style={{marginBottom:10}}/>
      <input placeholder="Référence (ex: 6205-2RS, optionnel)" value={f.ref} onChange={e=>setF({...f,ref:e.target.value})} style={{marginBottom:10}}/>
      <input placeholder="Emplacement (ex: Armoire A3, optionnel)" value={f.location} onChange={e=>setF({...f,location:e.target.value})} style={{marginBottom:10}}/>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <div style={{flex:1}}>
          <label style={{font:"500 12px system-ui",color:"var(--muted)"}}>Quantité en stock</label>
          <input type="number" min="0" value={f.qty} onChange={e=>setF({...f,qty:e.target.value})}/>
        </div>
        <div style={{flex:1}}>
          <label style={{font:"500 12px system-ui",color:"var(--muted)"}}>Stock mini (alerte)</label>
          <input type="number" min="0" value={f.min_qty} onChange={e=>setF({...f,min_qty:e.target.value})}/>
        </div>
        <div style={{flex:1}}>
          <label style={{font:"500 12px system-ui",color:"var(--muted)"}}>Coût unit. € HT</label>
          <input type="number" min="0" step="0.01" value={f.unit_cost} onChange={e=>setF({...f,unit_cost:e.target.value})}/>
        </div>
      </div>
      <button className="btn" disabled={!f.name} onClick={()=>onSave(f)} style={{width:"100%"}}>Enregistrer</button>
    </Modal>
  );
}

/* ------------------------- ANALYSE ------------------------- */
function Analyse({machines,interventions,org,db,role}) {
  const doneWithTime = interventions.filter(i=>i.started_at&&i.finished_at);
  const [rate,setRate] = useState(org?.settings?.hourly_rate ?? 45);
  // Coût par machine = pièces consommées + heures d'intervention × taux horaire MO
  const costByMachine = machines.map(m=>{
    const its = interventions.filter(i=>i.machine_id===m.id);
    const partsCost = its.reduce((a,i)=>a+(i.parts_used||[]).reduce((s,u)=>s+(+u.cost||0),0),0);
    const hours = its.filter(i=>i.started_at&&i.finished_at).reduce((a,i)=>a+(new Date(i.finished_at)-new Date(i.started_at))/3600000,0);
    return {label:m.code||m.name.slice(0,10), value:Math.round(partsCost + hours*(+rate||0))};
  }).filter(x=>x.value>0).sort((a,b)=>b.value-a.value).slice(0,8);
  // Temps d'arrêt par machine (min)
  const downtimeByMachine = machines.map(m=>({
    label: m.code||m.name.slice(0,10),
    value: Math.round(doneWithTime.filter(i=>i.machine_id===m.id).reduce((a,i)=>a+(new Date(i.finished_at)-new Date(i.started_at))/60000,0))
  })).filter(x=>x.value>0).sort((a,b)=>b.value-a.value).slice(0,8);
  // Interventions par mois (6 derniers)
  const months = [...Array(6)].map((_,k)=>{
    const d = new Date(); d.setMonth(d.getMonth()-(5-k));
    const key = d.toISOString().slice(0,7);
    return {label:key.slice(5)+"/"+key.slice(2,4), value:interventions.filter(i=>i.reported_at?.slice(0,7)===key).length};
  });
  // Répartition par type
  const byType = Object.entries(ITYPE).map(([k,v])=>({label:v, value:interventions.filter(i=>i.type===k).length})).filter(x=>x.value>0);
  const total = interventions.length;

  // Pareto des causes de panne (curatifs avec cause renseignée)
  const curatives = interventions.filter(i=>i.type==="curative");
  const pareto = Object.entries(FAILCAUSE)
    .map(([k,v])=>({label:v.label, value:curatives.filter(i=>i.failure_cause===k).length}))
    .filter(x=>x.value>0).sort((a,b)=>b.value-a.value);
  const sansCause = curatives.filter(i=>!i.failure_cause).length;

  const [retro,setRetro] = useState(false);
  // Totaux pour le résumé
  const mttrMin = doneWithTime.length ? Math.round(doneWithTime.reduce((a,i)=>a+(new Date(i.finished_at)-new Date(i.started_at))/60000,0)/doneWithTime.length) : null;
  const totalDownMin = Math.round(doneWithTime.reduce((a,i)=>a+(new Date(i.finished_at)-new Date(i.started_at))/60000,0));
  const totalPartsCost = interventions.reduce((a,i)=>a+(i.parts_used||[]).reduce((s,u)=>s+(+u.cost||0),0),0);
  const totalCost = Math.round(totalPartsCost + (totalDownMin/60)*(+rate||0));
  const prevN = interventions.filter(i=>i.type==="preventive").length;
  const prevPct = total ? Math.round(100*prevN/total) : 0;
  return <>
    <Toolbar>
      <H2>Analyse</H2>
      {["manager","superadmin"].includes(role) && <button className="btn" onClick={()=>setRetro(true)}>🎉 Rétro {new Date().getFullYear()}</button>}
    </Toolbar>
    {retro && <Retro org={org} machines={machines} interventions={interventions} rate={+rate||0} onClose={()=>setRetro(false)}/>}

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(148px,1fr))",gap:10,marginBottom:8}}>
      <Kpi label="Interventions" value={total}/>
      <Kpi label="Part préventif" value={prevPct+"%"} color="var(--run)" alert={prevPct>=50}/>
      <Kpi label="MTTR moyen" value={mttrMin?mttrMin+" min":"—"}/>
      <Kpi label="Arrêt total" value={totalDownMin?Math.round(totalDownMin/60)+" h":"—"}/>
      <Kpi label="Coût maintenance" value={totalCost.toLocaleString("fr-FR")+" €"}/>
    </div>

    <H2>Causes de panne (les plus fréquentes)</H2>
    <HBarChart data={pareto} color="var(--warn)" empty="Renseignez la cause des pannes (menu « Cause ? » sur les interventions curatives)."/>
    {sansCause>0 && pareto.length>0 && (
      <div style={{font:"500 12px system-ui",color:"var(--muted)",marginTop:6}}>
        {sansCause} panne{sansCause>1?"s":""} sans cause renseignée — non comptée{sansCause>1?"s":""}.
      </div>
    )}

    <H2>Coût de maintenance par machine</H2>
    <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:10}}>
      <span style={{font:"600 12px system-ui",color:"var(--muted)"}}>Taux horaire main d'œuvre</span>
      <input type="number" min="0" value={rate} onChange={e=>setRate(e.target.value)} style={{width:90}}/>
      <span style={{font:"600 13px system-ui"}}>€/h</span>
      <button className="btn sm" disabled={+rate===+(org?.settings?.hourly_rate??45)} onClick={()=>db.saveHourlyRate(rate)}>Enregistrer</button>
    </div>
    <HBarChart data={costByMachine} color="var(--ink)" unit="€" empty="Saisissez les pièces utilisées et clôturez les interventions pour mesurer les coûts."/>

    <H2>Temps d'arrêt par machine</H2>
    <HBarChart data={downtimeByMachine} color="var(--alarm)" unit="min" empty="Passez des interventions En cours → Clôturée pour mesurer les arrêts."/>

    <H2>Interventions par mois</H2>
    <BarChart data={months} color="var(--ink)"/>

    <H2>Curatif vs préventif</H2>
    {total>0 ? (
      <div className="card">
        {byType.map(t=>(
          <div key={t.label} style={{margin:"8px 0"}}>
            <div style={{display:"flex",justifyContent:"space-between",font:"600 12px system-ui",marginBottom:3}}>
              <span>{t.label}</span><span>{t.value} ({Math.round(100*t.value/total)}%)</span>
            </div>
            <div style={{background:"var(--bg)",height:14}}>
              <div style={{width:(100*t.value/total)+"%",height:"100%",background:t.label==="Curatif"?"var(--alarm)":t.label==="Préventif"?"var(--run)":"var(--warn)"}}/>
            </div>
          </div>
        ))}
        <div style={{font:"500 11px system-ui",color:"var(--muted)",marginTop:10}}>
          Objectif d'une bonne maintenance : faire monter la part de préventif au-dessus du curatif.
        </div>
      </div>
    ) : <Empty>Pas encore de données.</Empty>}
  </>;
}

function Retro({org,machines,interventions,rate,onClose}) {
  const year = new Date().getFullYear();
  const its = interventions.filter(i=>i.reported_at?.slice(0,4)===String(year));
  const cur = its.filter(i=>i.type==="curative");
  const prev = its.filter(i=>i.type==="preventive");
  const byM = machines.map(m=>({m, n:cur.filter(i=>i.machine_id===m.id).length})).sort((a,b)=>b.n-a.n);
  const done = its.filter(i=>i.started_at&&i.finished_at);
  const downtime = Math.round(done.reduce((a,i)=>a+(new Date(i.finished_at)-new Date(i.started_at))/60000,0));
  const mttr = done.length ? Math.round(downtime/done.length) : 0;
  const partsCost = its.reduce((a,i)=>a+(i.parts_used||[]).reduce((s,u)=>s+(+u.cost||0),0),0);
  const cost = Math.round(partsCost + downtime/60*rate);
  const causes = {}; cur.forEach(i=>{if(i.failure_cause) causes[i.failure_cause]=(causes[i.failure_cause]||0)+1;});
  const topCause = Object.entries(causes).sort((a,b)=>b[1]-a[1])[0];
  const slides = [
    {big:"▮▮", t:`MAINTX RÉTRO ${year}`, s:org?.name || ""},
    {big:its.length, t:"interventions cette année", s:`${cur.length} pannes · ${prev.length} préventifs`},
    byM[0]?.n>0 ? {big:byM[0].m.name, t:"la plus capricieuse", s:`${byM[0].n} pannes — on la surveille de près`} : null,
    topCause ? {big:FAILCAUSE[topCause[0]]?.label, t:"cause n°1 des pannes", s:`${topCause[1]} pannes — la piste d'amélioration ${year+1}`} : null,
    downtime>0 ? {big:Math.round(downtime/60)+" h", t:"d'arrêt machine", s:`MTTR moyen : ${mttr} min`} : null,
    cost>0 ? {big:cost.toLocaleString("fr-FR")+" €", t:"de maintenance", s:"pièces + main d'œuvre"} : null,
    {big:"MERCI", t:"à toute l'équipe", s:`Rendez-vous en ${year+1} 🔧`},
  ].filter(Boolean);
  const [k,setK] = useState(0);
  useEffect(() => {
    const key = e => {
      if (e.key==="Escape") onClose();
      if (e.key==="ArrowRight") setK(x=>Math.min(slides.length-1,x+1));
      if (e.key==="ArrowLeft") setK(x=>Math.max(0,x-1));
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  const s = slides[k];
  return (
    <div style={{position:"fixed",inset:0,background:"var(--ink)",zIndex:100,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",padding:24}}
         onClick={()=>k<slides.length-1 ? setK(k+1) : onClose()}>
      <div style={{position:"absolute",top:20,left:24,fontFamily:"var(--display)",fontSize:16,color:"#fff"}}>
        <span style={{color:"var(--accent)"}}>▮▮</span> MAINT<span style={{color:"var(--accent)"}}>X</span>
      </div>
      <button className="btn ghost sm" style={{position:"absolute",top:20,right:24,color:"#C9CCD1",borderColor:"#444"}}
              onClick={e=>{e.stopPropagation();onClose();}}>✕ Fermer</button>
      <div style={{textAlign:"center",maxWidth:760}}>
        <div style={{fontFamily:"var(--display)",fontSize:s.big && String(s.big).length>12 ? 42 : 88,lineHeight:1.05,color:"var(--accent)",textTransform:"uppercase",wordBreak:"break-word"}}>{s.big}</div>
        <div style={{fontFamily:"var(--display)",fontSize:24,color:"#fff",textTransform:"uppercase",marginTop:18}}>{s.t}</div>
        <div style={{font:"500 15px system-ui",color:"#C9CCD1",marginTop:10}}>{s.s}</div>
      </div>
      <div style={{position:"absolute",bottom:26,display:"flex",gap:6}}>
        {slides.map((_,j)=><span key={j} style={{width:22,height:5,background:j===k?"var(--accent)":"#3B4048"}}/>)}
      </div>
      <div style={{position:"absolute",bottom:44,font:"500 11px system-ui",color:"#5E646E"}}>Cliquez pour avancer</div>
    </div>
  );
}

function HBarChart({data,color,unit,empty}) {
  if (!data.length || data.every(d=>!d.value)) return <Empty>{empty||"Pas encore de données."}</Empty>;
  const max = Math.max(...data.map(d=>d.value),1);
  return (
    <div className="card">
      {data.map((d,k)=>(
        <div key={k} style={{display:"flex",alignItems:"center",gap:10,margin:"6px 0"}}>
          <div style={{width:120,flexShrink:0,font:"600 12px system-ui",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={d.label}>{d.label}</div>
          <div style={{flex:1,background:"var(--bg)",height:20}}>
            <div style={{width:Math.max(2,Math.round(100*d.value/max))+"%",height:"100%",background:color}}/>
          </div>
          <div style={{width:76,flexShrink:0,textAlign:"right",font:"700 12px system-ui"}}>{d.value.toLocaleString("fr-FR")}{unit?" "+unit:""}</div>
        </div>
      ))}
    </div>
  );
}

function BarChart({data,color,empty}) {
  if (!data.length || data.every(d=>!d.value)) return <Empty>{empty||"Pas encore de données."}</Empty>;
  const max = Math.max(...data.map(d=>d.value),1);
  const W=560, H=180, pad=26, bw=Math.min(56,(W-pad)/data.length-10);
  return (
    <div className="card" style={{maxWidth:W+32}}>
      <svg viewBox={`0 0 ${W} ${H+30}`} style={{width:"100%"}}>
        {data.map((d,k)=>{
          const h = Math.round((d.value/max)*(H-pad));
          const x = pad + k*((W-pad)/data.length);
          return (
            <g key={k}>
              <rect x={x} y={H-h} width={bw} height={h} fill={color}/>
              <text x={x+bw/2} y={H-h-6} textAnchor="middle" style={{font:"700 12px system-ui"}}>{d.value}</text>
              <text x={x+bw/2} y={H+16} textAnchor="middle" style={{font:"600 10px system-ui",fill:"#8A8F98"}}>{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

