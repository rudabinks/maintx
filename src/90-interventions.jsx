function Interventions({interventions,machineName,db,parts,setModal,setView}) {
  const [mode,setModeRaw] = useState(()=>localStorage.getItem("mx_int_view")||"list"); // list | table | kanban
  const setMode = v => { localStorage.setItem("mx_int_view",v); setModeRaw(v); };
  const pending = interventions.filter(i=>i.triage==="pending");
  const open = interventions.filter(i=>i.status!=="done" && i.triage!=="pending");
  const done = interventions.filter(i=>i.status==="done");
  const seg = (v,txt) => (
    <button onClick={()=>setMode(v)} style={{border:0,padding:"8px 12px",cursor:"pointer",font:"700 12px system-ui",
      background:mode===v?"var(--ink)":"#fff",color:mode===v?"var(--accent)":"var(--ink)"}}>{txt}</button>
  );
  return <>
    {pending.length>0 && (
      <div style={{marginBottom:18}}>
        <div style={{font:"800 11px system-ui",textTransform:"uppercase",letterSpacing:".05em",color:"var(--ink)",background:"var(--accent)",padding:"6px 12px",display:"inline-block",marginBottom:8}}>
          {pending.length} nouvelle{pending.length>1?"s":""} demande{pending.length>1?"s":""} à valider
        </div>
        {pending.map(i=>(
          <TriageCard key={i.id} i={i} machineName={machineName} db={db}
                      others={interventions.filter(x=>x.id!==i.id && x.machine_id===i.machine_id && x.status!=="done" && x.triage!=="pending")}/>
        ))}
      </div>
    )}
    <Toolbar>
      <H2>Interventions · {open.length} en cours</H2>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <div className="desktoponly" style={{border:"1.5px solid var(--ink)"}}>{seg("list","Liste")}{seg("table","Tableau")}{seg("kanban","Kanban")}</div>
        <button className="btn" onClick={()=>setModal("intervention")}>+ Déclarer</button>
      </div>
    </Toolbar>
    {mode==="kanban" ? <IntKanban list={open.concat(done)} machineName={machineName} db={db}/>
     : mode==="table" ? <>
         <IntTable rows={open} machineName={machineName} db={db} parts={parts}/>
         {open.length===0 && <Empty>Rien en cours — tout roule ✓</Empty>}
         {done.length>0 && <Foldable title={`Terminées (${done.length})`}><IntTable rows={done} machineName={machineName} db={db} parts={parts}/></Foldable>}
       </>
     : <>
         {open.map(i=><IRow key={i.id} i={i} machineName={machineName} db={db} full parts={parts}/>)}
         {open.length===0 && <Empty>Rien en cours — tout roule ✓</Empty>}
         {done.length>0 && <Foldable title={`Terminées (${done.length})`}>{done.map(i=><IRow key={i.id} i={i} machineName={machineName} db={db} full parts={parts}/>)}</Foldable>}
       </>}
  </>;
}

function IntTable({rows,machineName,db,parts}) {
  if (!rows.length) return null;
  return (
    <div style={{overflowX:"auto",marginBottom:10}}>
      <table className="dtable">
        <thead><tr><th>Machine</th><th>Intervention</th><th>Priorité</th><th>Cause</th><th>Statut</th><th>Date</th></tr></thead>
        <tbody>{rows.map(i=><IntTableRow key={i.id} i={i} machineName={machineName} db={db} parts={parts}/>)}</tbody>
      </table>
    </div>
  );
}

function IntTableRow({i,machineName,db,parts}) {
  const [open,setOpen] = useState(false);
  return <>
    <tr className="clk" onClick={()=>setOpen(!open)}>
      <td><span style={{display:"inline-block",width:7,height:7,borderRadius:2,background:prioColor(i.priority),marginRight:6}}/>{machineName(i.machine_id)||"—"}</td>
      <td>{i.title}</td>
      <td style={{color:prioColor(i.priority),fontWeight:700}}>{prioLabel(i.priority)}</td>
      <td style={{color:"var(--muted)"}}>{i.failure_cause?FAILCAUSE[i.failure_cause]?.label:"—"}</td>
      <td><StatusPill st={i.status}/></td>
      <td style={{color:"var(--muted)",whiteSpace:"nowrap"}}>{i.reported_at?.slice(0,10)}</td>
    </tr>
    {open && <tr><td colSpan={6} style={{padding:0}}><InterventionDetail i={i} db={db} parts={parts}/></td></tr>}
  </>;
}

function IntKanban({list,machineName,db}) {
  const cols = [["open","Nouvelles"],["in_progress","En cours"],["waiting_parts","Attente pièces"],["done","Terminé"]];
  const move = (i,v) => v==="__triage" ? db.triage(i,"pending") : db.setInterventionStatus(i,v);
  const opts = [
    {value:"open",label:"Ouverte",color:"var(--alarm)"},
    {value:"in_progress",label:"En cours",color:"var(--warn)"},
    {value:"waiting_parts",label:"Attente pièces",color:"var(--muted)"},
    {value:"done",label:"Clôturer",color:"var(--run)"},
    {value:"__triage",label:"Renvoyer à trier",color:"var(--accent)"},
  ];
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10}}>
      {cols.map(([st,label])=>{
        let items = list.filter(i=>i.status===st);
        if (st==="done") items = items.slice(0,20);
        return (
          <div key={st}>
            <div style={{display:"flex",alignItems:"center",gap:6,font:"600 12px system-ui",color:"var(--muted)",marginBottom:8}}>{label}<span style={{marginLeft:"auto"}}>{items.length}</span></div>
            {items.map(i=>(
              <div key={i.id} style={{background:"#fff",borderRadius:8,border:"0.5px solid #E3E5E8",borderLeft:`3px solid ${prioColor(i.priority)}`,padding:"10px 11px",marginBottom:8,opacity:st==="done"?.75:1}}>
                <div style={{font:"700 10px ui-monospace,monospace",color:"var(--muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{machineName(i.machine_id)||"—"}</div>
                <div style={{font:"600 12px system-ui",margin:"3px 0 6px"}}>{i.title}</div>
                {i.failure_cause && <span style={{font:"600 10px system-ui",padding:"1px 7px",borderRadius:8,background:PILL[i.status]?.bg||"var(--bg)",color:FAILCAUSE[i.failure_cause]?.color,marginRight:6}}>{FAILCAUSE[i.failure_cause]?.label}</span>}
                <div style={{marginTop:8}}>
                  <Dropdown width={"100%"} align="left" value={null} placeholder="Déplacer…" options={opts} onChange={v=>move(i,v)}/>
                </div>
              </div>
            ))}
            {items.length===0 && <div style={{font:"500 11px system-ui",color:"var(--muted)",padding:"4px 2px"}}>—</div>}
          </div>
        );
      })}
    </div>
  );
}

function IRow({i,machineName,db,full,parts}) {
  const [open,setOpen] = useState(false);
  const prioC = i.priority===3?"var(--alarm)":i.priority===2?"var(--warn)":"var(--muted)";
  const photos = i.photos || [];
  return (
    <div style={{marginBottom:8}}>
      <Row style={{borderLeft:`4px solid ${prioC}`,marginBottom:0}}>
        <div style={{flex:1}}>
          <b>{i.title}</b>
          <div style={{font:"500 12px system-ui",color:"var(--muted)",marginTop:2}}>
            {machineName(i.machine_id)} {machineName(i.machine_id)?"· ":""}{ITYPE[i.type]} · {i.reported_at?.slice(0,10)}
            {i.scheduled_for && <span style={{color:i.scheduled_for<today()?"var(--alarm)":"var(--accent)",fontWeight:700}}> · planifié le {i.scheduled_for}</span>}
            {photos.length>0 && ` · ${photos.length} photo${photos.length>1?"s":""}`}
            {i.failure_cause && <span style={{color:FAILCAUSE[i.failure_cause]?.color,fontWeight:700}}> · {FAILCAUSE[i.failure_cause]?.label}</span>}
          </div>
        </div>
        {full && !i.acked_at && i.status==="open" && (
          <button className="btn sm" title="L'opérateur verra « Prise en compte » sur son suivi" onClick={()=>db.ackIntervention(i)}>Pris en compte</button>
        )}
        {full && i.type==="curative" && (
          <Dropdown width={165} align="right" value={i.failure_cause} placeholder="Cause ?"
                    options={Object.entries(FAILCAUSE).map(([k,v])=>({value:k,label:v.label,color:v.color}))}
                    onChange={c=>db.setInterventionCause(i.id,c)}/>
        )}
        {full ? (
          <Dropdown width={170} align="right" value={i.status}
                    options={Object.entries(ISTATUS).map(([k,v])=>({value:k,label:v.label,color:v.color}))}
                    onChange={st=>db.setInterventionStatus(i,st)}/>
        ) : (
          <span style={{color:"#fff",font:"700 10px system-ui",textTransform:"uppercase",padding:"5px 10px",background:i.status==="done"?"var(--run)":"var(--ink)"}}>{ISTATUS[i.status].label}</span>
        )}
        {full && <button className="btn ghost sm" title="Photos et commentaires" onClick={()=>setOpen(!open)}>{open?"▲":"▼ Détails"}</button>}
        {full && <button className="btn ghost sm" title="Supprimer l'intervention" onClick={()=>db.deleteIntervention(i)}>✕</button>}
      </Row>
      {open && full && <InterventionDetail i={i} db={db} parts={parts}/>}
    </div>
  );
}

function VoiceReport({i,onApplied,db}) {
  const [state,setState] = useState("idle"); // idle | rec | busy | review
  const [text,setText] = useState("");
  const [prop,setProp] = useState(null);
  const [err,setErr] = useState(null);
  const recRef = useRef(null);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  useEffect(() => () => { recRef.current?.stop(); recRef.current = null; }, []); // coupe le micro au démontage
  const start = () => {
    setErr(null);
    const r = new SR();
    r.lang = "fr-FR"; r.continuous = true; r.interimResults = true;
    let final = text ? text+" " : "";
    r.onresult = e => {
      let interim = "";
      for (let k=e.resultIndex; k<e.results.length; k++) {
        if (e.results[k].isFinal) final += e.results[k][0].transcript + " ";
        else interim += e.results[k][0].transcript;
      }
      setText((final+interim).trim());
    };
    r.onerror = ev => { setErr("Micro : "+ev.error); setState("idle"); };
    r.onend = () => setState(s=>s==="rec"?"idle":s);
    recRef.current = r; r.start(); setState("rec");
  };
  const stop = () => { const r=recRef.current; recRef.current=null; setState("idle"); r?.stop(); };
  const analyze = async () => {
    setState("busy"); setErr(null);
    try {
      const res = await fetch(FN.voice, {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_KEY,"apikey":SUPABASE_KEY},
        body:JSON.stringify({transcript:text, title:i.title}),
      });
      const p = await res.json();
      if (!res.ok || p.error) throw new Error(p.error||res.status);
      setProp(p); setState("review");
    } catch(e) {
      setErr("Analyse momentanément indisponible, réessayez dans un instant.");
      setState("idle");
    }
  };
  const apply = async () => {
    setState("busy");
    let body = prop.resume;
    if (prop.pieces?.length) body += "\nPièces : "+prop.pieces.join(", ");
    if (prop.actions_restantes) body += "\nReste à faire : "+prop.actions_restantes;
    await db.addComment(i.id, body);
    if (prop.cause && i.type==="curative") await db.setInterventionCause(i.id, prop.cause);
    await db.setInterventionStatus(i, prop.repare ? "done" : (i.status==="open" ? "in_progress" : i.status));
    setProp(null); setText(""); setState("idle");
    onApplied && onApplied();
  };
  return (
    <div style={{border:"1.5px dashed #C9CCD1",padding:"10px 12px",marginBottom:12,background:"#fff"}}>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <b style={{font:"700 11px system-ui",textTransform:"uppercase",letterSpacing:".06em"}}>Mode mains sales</b>
        {SR ? (
          state==="rec"
            ? <button className="btn sm" style={{background:"var(--alarm)",color:"#fff"}} onClick={stop}>Stop</button>
            : <button className="btn sm" onClick={start} disabled={state==="busy"}>Dicter</button>
        ) : <span style={{font:"500 11px system-ui",color:"var(--muted)"}}>Dictée non supportée sur ce navigateur (Chrome/Edge ou téléphone) — tapez le texte :</span>}
        {state==="rec" && <span style={{color:"var(--alarm)",font:"700 12px system-ui"}}>● Enregistrement… parlez</span>}
        <button className="btn sm" disabled={!text.trim()||state==="busy"||state==="rec"} onClick={analyze}>
          {state==="busy" ? "Analyse…" : "Analyser"}
        </button>
      </div>
      {(text || state==="rec" || !SR) && (
        <textarea rows={2} value={text} onChange={e=>setText(e.target.value)} style={{marginTop:8}}
                  placeholder="Ex : j'ai remplacé le roulement côté moteur, c'était encrassé, la machine est repartie, prévoir de recommander la référence 6205"/>
      )}
      {err && <div style={{color:"var(--alarm)",font:"600 12px system-ui",marginTop:6}}>{err}</div>}
      {state==="review" && prop && (
        <div style={{background:"var(--bg)",padding:"10px 12px",marginTop:8}}>
          <div style={{font:"700 11px system-ui",textTransform:"uppercase",color:"var(--muted)",marginBottom:4}}>Proposition de l'IA</div>
          <div style={{font:"500 13px system-ui",whiteSpace:"pre-wrap"}}>{prop.resume}</div>
          <div style={{font:"600 12px system-ui",marginTop:8,display:"flex",gap:12,flexWrap:"wrap"}}>
            {prop.cause && <span>Cause : <b style={{color:FAILCAUSE[prop.cause]?.color}}>{FAILCAUSE[prop.cause]?.label||prop.cause}</b></span>}
            <span style={{color:prop.repare?"var(--run)":"var(--warn)",fontWeight:700}}>{prop.repare ? "Machine réparée → clôturée" : "Non réparée → passera « En cours »"}</span>
          </div>
          {prop.pieces?.length>0 && <div style={{font:"500 12px system-ui",marginTop:4}}>Pièces : {prop.pieces.join(", ")}</div>}
          {prop.actions_restantes && <div style={{font:"500 12px system-ui",marginTop:4}}>Reste à faire : {prop.actions_restantes}</div>}
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button className="btn sm" onClick={apply}>✓ Valider</button>
            <button className="btn ghost sm" onClick={()=>{setProp(null);setState("idle");}}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}

function InterventionDetail({i,db,parts}) {
  const [comments,setComments] = useState(null);
  const [txt,setTxt] = useState("");
  const [busy,setBusy] = useState(false);
  const [partId,setPartId] = useState(null);
  const [partQty,setPartQty] = useState(1);
  const [deja,setDeja] = useState([]);
  const load = () => db.fetchComments(i.id).then(setComments);
  useEffect(() => {
    load();
    if (i.type==="curative" && i.status!=="done") db.fetchDejaVu(i).then(setDeja);
  }, [i.id]);
  const send = async () => {
    if (!txt.trim()) return;
    setBusy(true); await db.addComment(i.id, txt.trim()); setTxt(""); await load(); setBusy(false);
  };
  const photos = i.photos || [];
  return (
    <div style={{background:"#F6F7F8",borderLeft:"4px solid #D5D8DC",padding:"12px 16px"}}>
      {i.directive && (
        <div style={{background:"#FFF7DB",borderLeft:"4px solid var(--accent)",padding:"10px 12px",marginBottom:10}}>
          <div style={{font:"700 11px system-ui",textTransform:"uppercase",letterSpacing:".05em",marginBottom:4}}>Directives du responsable</div>
          <div style={{font:"500 13px system-ui",whiteSpace:"pre-wrap"}}>{i.directive}</div>
        </div>
      )}
      {i.description && <div style={{font:"500 13px system-ui",whiteSpace:"pre-wrap",marginBottom:10}}>{i.description}</div>}
      {deja.length>0 && i.status!=="done" && (
        <div style={{background:"#FFF7DB",borderLeft:"4px solid var(--accent)",padding:"10px 12px",marginBottom:12}}>
          <div style={{font:"700 11px system-ui",textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>Déjà arrivé sur cette machine</div>
          {deja.map(d=>(
            <div key={d.id} style={{font:"500 12px system-ui",padding:"3px 0"}}>
              {d.reported_at?.slice(0,10)} — <b>{d.title}</b>
              {d.failure_cause && <span style={{color:FAILCAUSE[d.failure_cause]?.color,fontWeight:700}}> · {FAILCAUSE[d.failure_cause]?.label}</span>}
              {(d.parts_used||[]).length>0 && <span style={{color:"var(--muted)"}}> · pièces : {d.parts_used.map(u=>u.name).join(", ")}</span>}
            </div>
          ))}
        </div>
      )}
      <VoiceReport i={i} db={db} onApplied={load}/>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:12}}>
        {photos.map((ph,k)=>(
          <button key={k} className="btn ghost sm" onClick={()=>db.openPhoto(ph.path)}>{ph.name?.length>20?ph.name.slice(0,20)+"…":ph.name||("photo "+(k+1))}</button>
        ))}
        <label className="btn sm" style={{cursor:"pointer"}}>
          + Photo
          <input type="file" accept="image/*" style={{display:"none"}}
                 onChange={e=>{const f=e.target.files[0]; if(f){db.uploadPhoto(i,f); e.target.value="";}}}/>
        </label>
      </div>
      <div style={{font:"700 11px system-ui",textTransform:"uppercase",letterSpacing:".06em",color:"var(--muted)",marginBottom:6}}>Pièces utilisées</div>
      {(i.parts_used||[]).map((u,k)=>(
        <div key={k} style={{font:"600 13px system-ui",padding:"3px 0"}}>
          <span style={{color:"var(--accent)"}}>▮</span> {u.qty}× {u.name}{u.ref?` (${u.ref})`:""}{u.cost?` · ${u.cost} €`:""}
        </div>
      ))}
      {(parts||[]).length>0 ? (
        <div style={{display:"flex",gap:8,alignItems:"center",margin:"6px 0 14px",flexWrap:"wrap"}}>
          <Dropdown width={230} value={partId} placeholder="Choisir une pièce…"
                    options={parts.map(p=>({value:p.id,label:p.name+(p.ref?` (${p.ref})`:""),sub:`stock : ${+p.qty}`}))}
                    onChange={setPartId}/>
          <input type="number" min="1" value={partQty} onChange={e=>setPartQty(Math.max(1,+e.target.value||1))} style={{width:70}}/>
          <button className="btn sm" disabled={!partId}
                  onClick={()=>{const p=parts.find(x=>x.id===partId); if(p){db.usePart(i,p,partQty); setPartId(null); setPartQty(1);}}}>
            Utiliser
          </button>
        </div>
      ) : (
        <div style={{font:"500 12px system-ui",color:"var(--muted)",marginBottom:14}}>
          {(i.parts_used||[]).length===0 && "Aucune pièce — créez votre stock dans « Pièces détachées »."}
        </div>
      )}
      <div style={{font:"700 11px system-ui",textTransform:"uppercase",letterSpacing:".06em",color:"var(--muted)",marginBottom:6}}>Commentaires</div>
      {comments === null && <div style={{font:"500 12px system-ui",color:"var(--muted)"}}>Chargement…</div>}
      {comments?.map(c=>(
        <div key={c.id} style={{marginBottom:8}}>
          <span style={{font:"700 12px system-ui"}}>{c.author?.full_name || "?"}</span>
          <span style={{font:"500 11px system-ui",color:"var(--muted)"}}> · {c.created_at?.slice(0,16).replace("T"," ")}</span>
          <div style={{font:"500 13px system-ui"}}>{c.body}</div>
        </div>
      ))}
      {comments?.length === 0 && <div style={{font:"500 12px system-ui",color:"var(--muted)",marginBottom:8}}>Aucun commentaire.</div>}
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <input placeholder="Ajouter un commentaire (pièce changée, réglage effectué…)" value={txt}
               onChange={e=>setTxt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}/>
        <button className="btn sm" disabled={busy||!txt.trim()} onClick={send}>Envoyer</button>
      </div>
    </div>
  );
}

