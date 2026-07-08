function Parc({machines,interventions,preventifs,setModal,setView,isSuper}) {
  return <>
    <Toolbar>
      <H2>Parc machines ({machines.length})</H2>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {machines.length>0 && <button className="btn ghost" onClick={()=>printAllQR(machines)}>🖨 Étiquettes QR (A4)</button>}
        {isSuper && <button className="btn ghost" onClick={()=>setModal("import")}>⤒ Importer CSV</button>}
        <button className="btn" onClick={()=>setModal("machine")}>+ Ajouter</button>
      </div>
    </Toolbar>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
      {machines.map(m=>{
        const h = computeHealth(m, interventions.filter(i=>i.machine_id===m.id), preventifs.filter(p=>p.machine_id===m.id));
        const days = m.degraded_deadline ? Math.ceil((new Date(m.degraded_deadline)-Date.now())/864e5) : null;
        const hint = m.status==="alarm" ? "En panne maintenant"
          : m.status==="degraded" ? (days!=null ? (days<0?`Dégradé · dépassé ${-days} j`:`Dégradé · J−${days}`) : "Dégradé autorisé")
          : m.status==="maintenance" ? "En maintenance"
          : m.status==="stopped" ? "Arrêtée"
          : h.score>=80 ? "RAS" : (h.reasons[0]||"RAS").replace(/\s*\(−?\d+\)/,"");
        return (
        <div key={m.id} style={{background:"var(--panel)",borderTop:`3px solid ${STATUS[m.status].color}`,padding:"12px 14px",cursor:"pointer",display:"flex",flexDirection:"column"}}
             title="Ouvrir la fiche" onClick={()=>setView({name:"machine",id:m.id})}>
          <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{font:"700 10px ui-monospace,monospace",color:"var(--muted)",textTransform:"uppercase",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.code||"—"}{m.family?" · "+m.family:""}</div>
              <div style={{fontWeight:800,fontSize:14,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.name}</div>
            </div>
            <span className={"lamp lg"+(m.status==="alarm"?" blink":"")} style={{background:STATUS[m.status].color,flex:"none"}}/>
          </div>
          <div style={{display:"flex",alignItems:"baseline",gap:6,marginTop:10}}>
            <span style={{font:"800 22px system-ui",color:h.color}}>{h.score}</span>
            <span style={{font:"500 11px system-ui",color:"var(--muted)"}}>forme /100</span>
            <span style={{marginLeft:"auto",font:"600 11px system-ui",color:CRIT[m.criticality]?.color}} title={CRIT[m.criticality]?.label}>{"▮".repeat(m.criticality)}{"▯".repeat(3-m.criticality)}</span>
          </div>
          <div style={{font:"500 11px system-ui",color:m.status==="alarm"||(m.status==="degraded"&&days<0)?"var(--alarm)":"var(--muted)",marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{hint}</div>
        </div>
      );})}
    </div>
    {machines.length===0 && <Empty>Ajoutez votre première machine avec le bouton ci-dessus.</Empty>}
  </>;
}

/* ------------------------- FICHE MACHINE ------------------------- */
function MachineDetail({machine,docs,interventions,parts,plans,db,back}) {
  const [tab,setTab] = useState("infos");
  const [degModal,setDegModal] = useState(false);
  if (!machine) return null;
  return <>
    <button className="btn ghost sm" onClick={back}>← Retour au parc</button>
    <div style={{display:"flex",alignItems:"center",gap:16,margin:"16px 0 4px"}}>
      <span className={"lamp lg"+(machine.status==="alarm"?" blink":"")} style={{background:STATUS[machine.status].color}}/>
      <div>
        <div style={{font:"700 11px ui-monospace,monospace",color:"var(--muted)",textTransform:"uppercase"}}>{machine.code} · {machine.family}</div>
        <h2 style={{fontFamily:"var(--display)",fontSize:22,margin:0,textTransform:"uppercase"}}>{machine.name}</h2>
      </div>
      <Dropdown width={195} align="right" style={{marginLeft:"auto"}} value={machine.status}
                options={Object.entries(STATUS).map(([k,v])=>({value:k,label:v.label,color:v.color}))}
                onChange={st=>st==="degraded" ? setDegModal(true) : db.setMachineStatus(machine.id,st)}/>
    </div>
    {machine.status==="degraded" && <DegradedBanner machine={machine} onEdit={()=>setDegModal(true)}/>}
    {degModal && <DegradedModal machine={machine} onClose={()=>setDegModal(false)}
                                onSave={(cond,dl)=>{db.setDegraded(machine.id,cond,dl);setDegModal(false);}}/>}
    <div style={{borderBottom:"1.5px solid #D5D8DC",marginBottom:16}}>
      {[["infos","Infos & specs"],["activite","Activité"],["docs",`Documents (${docs.length})`],["histo",`Historique (${interventions.length})`],["qr","QR code"]].map(([k,l])=>(
        <button key={k} className={"tab"+(tab===k?" active":"")} onClick={()=>setTab(k)}>{l}</button>
      ))}
    </div>
    {tab==="infos" && <><MeterBox machine={machine} db={db}/><Specs machine={machine} db={db}/></>}
    {tab==="activite" && <ActivityTab machine={machine} interventions={interventions} docs={docs} plans={plans||[]} db={db}/>}
    {tab==="docs" && <Docs machine={machine} docs={docs} db={db}/>}
    {tab==="histo" && <>
      {interventions.map(i=><IRow key={i.id} i={i} machineName={()=>""} db={db} full parts={parts}/>)}
      {interventions.length===0 && <Empty>Aucune intervention sur cette machine.</Empty>}
    </>}
    {tab==="qr" && <QRTab machine={machine}/>}
  </>;
}

function DegradedBanner({machine,onEdit}) {
  const days = machine.degraded_deadline ? Math.ceil((new Date(machine.degraded_deadline)-Date.now())/864e5) : null;
  const over = days !== null && days < 0;
  return (
    <div style={{background:over?"#FDECEA":"#FFF7DB",border:`1.5px solid ${over?"var(--alarm)":"var(--accent)"}`,padding:"12px 16px",margin:"12px 0",display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{flex:1,minWidth:220}}>
        <div style={{font:"800 12px system-ui",textTransform:"uppercase",letterSpacing:".05em",color:over?"var(--alarm)":"var(--ink)"}}>
          ⚠ Mode dégradé autorisé {over ? "— DATE LIMITE DÉPASSÉE" : ""}
        </div>
        <div style={{font:"500 13px system-ui",marginTop:4}}>{machine.degraded_conditions}</div>
      </div>
      <div style={{textAlign:"center"}}>
        <div style={{fontFamily:"var(--display)",fontSize:24,lineHeight:1,color:over?"var(--alarm)":"var(--ink)"}}>
          {days===null ? "—" : over ? `+${-days} j` : `J−${days}`}
        </div>
        <div style={{font:"600 10px system-ui",textTransform:"uppercase",color:"var(--muted)"}}>
          {over ? "de retard" : "avant réparation"}
        </div>
        <div style={{font:"600 11px system-ui",color:"var(--muted)"}}>{machine.degraded_deadline}</div>
      </div>
      <button className="btn ghost sm" onClick={onEdit}>Modifier</button>
      <div style={{width:"100%",font:"500 11px system-ui",color:"var(--muted)"}}>
        Pour sortir du mode dégradé : changez le statut de la machine (menu en haut à droite).
      </div>
    </div>
  );
}

function DegradedModal({machine,onClose,onSave}) {
  const [cond,setCond] = useState(machine.degraded_conditions || "");
  const [dl,setDl] = useState(machine.degraded_deadline || addDays(today(),7));
  return (
    <Modal title="Mode dégradé autorisé" onClose={onClose}>
      <div style={{font:"500 12px system-ui",color:"var(--muted)",marginBottom:12}}>
        La machine continue de tourner sous conditions, avec une date limite de réparation.
        L'écart est assumé et tracé (principe repris de l'aéronautique).
      </div>
      <label style={{font:"500 12px system-ui",color:"var(--muted)"}}>Conditions d'exploitation (obligatoire)</label>
      <textarea rows={3} placeholder="Ex : vitesse réduite 50 %, pas d'usinage inox, contrôle visuel toutes les 2 h"
                value={cond} onChange={e=>setCond(e.target.value)} style={{marginBottom:10}}/>
      <label style={{font:"500 12px system-ui",color:"var(--muted)"}}>Réparer avant le</label>
      <input type="date" value={dl} onChange={e=>setDl(e.target.value)} style={{marginBottom:12}}/>
      <div style={{display:"flex",gap:8}}>
        <button className="btn ghost" onClick={onClose} style={{flex:1}}>Annuler</button>
        <button className="btn" disabled={!cond.trim()||!dl} onClick={()=>onSave(cond.trim(),dl)} style={{flex:2}}>
          Activer le mode dégradé
        </button>
      </div>
    </Modal>
  );
}

function MeterBox({machine,db}) {
  const [h,setH] = useState(machine.meter_hours ?? 0);
  useEffect(() => { setH(machine.meter_hours ?? 0); }, [machine.id, machine.meter_hours]);
  return (
    <div className="card" style={{maxWidth:560,marginBottom:12,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <b style={{font:"700 12px system-ui",textTransform:"uppercase"}}>Compteur horaire :</b>
      <input type="number" min="0" value={h} onChange={e=>setH(e.target.value)} style={{width:110}}/>
      <span style={{font:"600 13px system-ui"}}>h</span>
      <button className="btn sm" disabled={+h===+(machine.meter_hours??0)} onClick={()=>db.setMeterHours(machine.id,+h||0)}>Enregistrer</button>
      <span style={{font:"500 11px system-ui",color:"var(--muted)"}}>Relevé manuel — déclenchera les gammes « au compteur ». Automatique avec le futur plan Connect.</span>
    </div>
  );
}

function Specs({machine,db}) {
  const specs = machine.meta?.specs || {};
  const [k,setK] = useState(""); const [v,setV] = useState("");
  const save = obj => db.updateMachineMeta(machine.id, {...machine.meta, specs:obj});
  return (
    <div className="card" style={{maxWidth:560}}>
      <div style={{font:"600 12px system-ui",color:"var(--muted)",marginBottom:12}}>
        Caractéristiques techniques de la machine — adaptez librement selon sa technologie
        (tension, pression pneumatique, type de CN, puissance, n° série…).
      </div>
      {Object.entries(specs).map(([key,val])=>(
        <div key={key} style={{display:"flex",gap:8,alignItems:"center",padding:"6px 0",borderBottom:"1px solid #EEE"}}>
          <b style={{width:180,font:"600 13px system-ui"}}>{key}</b>
          <span style={{flex:1,font:"500 13px system-ui"}}>{val}</span>
          <button className="btn ghost sm" onClick={()=>{const s={...specs};delete s[key];save(s);}}>✕</button>
        </div>
      ))}
      {Object.keys(specs).length===0 && <Empty>Aucune caractéristique renseignée.</Empty>}
      <div style={{display:"flex",gap:8,marginTop:12}}>
        <input placeholder="Caractéristique (ex: Tension)" value={k} onChange={e=>setK(e.target.value)}/>
        <input placeholder="Valeur (ex: 3×400V)" value={v} onChange={e=>setV(e.target.value)}/>
        <button className="btn sm" disabled={!k||!v} onClick={()=>{save({...specs,[k]:v});setK("");setV("");}}>+</button>
      </div>
    </div>
  );
}

function Docs({machine,docs,db}) {
  const [cat,setCat] = useState("maintenance");
  const [linkUrl,setLinkUrl] = useState("");
  const [linkName,setLinkName] = useState("");
  const fileRef = useRef();
  const addLink = () => {
    if (!linkUrl.trim().startsWith("http")) { alert("Collez un lien complet (https://…)"); return; }
    db.addDocLink(machine.id, linkUrl.trim(), linkName.trim()||"Document en ligne", cat);
    setLinkUrl(""); setLinkName("");
  };
  return <>
    <div className="card" style={{display:"flex",gap:10,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
      <b style={{font:"700 12px system-ui",textTransform:"uppercase"}}>Ajouter un document :</b>
      <Dropdown width={175} value={cat}
                options={Object.entries(DOCCAT).map(([k,v])=>({value:k,label:v.label,color:v.color}))}
                onChange={setCat}/>
      <input type="file" multiple ref={fileRef} style={{width:"auto",border:0,padding:0}}
             onChange={async e=>{
               const fs = [...e.target.files]; e.target.value = "";
               for (const f of fs) await db.uploadDoc(machine.id, f, cat);
             }}/>
      <span style={{font:"500 11px system-ui",color:"var(--muted)"}}>Fichier stocké dans MaintX (max 50 Mo, compressez les gros PDF)</span>
    </div>
    <div className="card" style={{display:"flex",gap:10,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
      <b style={{font:"700 12px system-ui",textTransform:"uppercase"}}>🔗 Ou par lien :</b>
      <input placeholder="https://drive.google.com/… (Drive, Dropbox, site constructeur)" value={linkUrl}
             onChange={e=>setLinkUrl(e.target.value)} style={{flex:"1 1 240px",width:"auto"}}/>
      <input placeholder="Nom (ex: Catalogue pièces 2024)" value={linkName}
             onChange={e=>setLinkName(e.target.value)} style={{flex:"1 1 160px",width:"auto"}}/>
      <button className="btn sm" disabled={!linkUrl.trim()} onClick={addLink}>Ajouter</button>
      <span style={{font:"500 11px system-ui",color:"var(--muted)"}}>Ne compte pas dans le stockage MaintX.</span>
    </div>
    {Object.entries(DOCCAT).map(([k,v])=>{
      const list = docs.filter(d=>d.category===k);
      if (!list.length) return null;
      return (
        <div key={k} style={{marginBottom:12}}>
          <span className="doccat" style={{background:v.color}}>{v.label}</span>
          {list.map(d=>(
            <Row key={d.id}>
              <div style={{flex:1,cursor:"pointer"}} onClick={()=>db.openDoc(d)}>
                <b style={{font:"600 13px system-ui"}}>📄 {d.name}</b>
                <div style={{font:"500 11px system-ui",color:"var(--muted)"}}>{d.created_at?.slice(0,10)}</div>
              </div>
              <Dropdown width={150} align="right" value={d.category}
                        options={Object.entries(DOCCAT).map(([k,v])=>({value:k,label:v.label,color:v.color}))}
                        onChange={cat=>db.setDocCategory(d,cat)}/>
              {d.storage_path?.startsWith("http") && <span title="Document externe (lien)" style={{font:"600 11px system-ui",color:"var(--muted)"}}>🔗</span>}
              <button className="btn ghost sm" onClick={()=>db.openDoc(d)}>Ouvrir</button>
              <button className="btn ghost sm" onClick={()=>db.deleteDoc(d)}>✕</button>
            </Row>
          ))}
        </div>
      );
    })}
    {docs.length===0 && <Empty>Aucun document. Ajoutez schémas électriques, pneumatiques, hydrauliques, notices de maintenance…</Empty>}
  </>;
}

function Mecano({machine,docs,db}) {
  const [q,setQ] = useState("");
  const [hist,setHist] = useState([]);
  const [busy,setBusy] = useState(false);
  const nbIndexed = docs.filter(d=>d.indexed_at).length;
  const ask = async () => {
    const question = q.trim();
    if (!question || busy) return;
    setBusy(true); setQ("");
    try {
      const r = await db.askMecano(machine, question);
      setHist(h=>[{q:question, a:r.answer, sources:r.sources||[]}, ...h]);
    } catch(e) {
      setHist(h=>[{q:question, a:"Service momentanément indisponible, réessayez. ("+(e.message||e)+")", sources:[]}, ...h]);
    }
    setBusy(false);
  };
  return <>
    <div className="card" style={{maxWidth:640,marginBottom:14}}>
      <div style={{font:"700 12px system-ui",textTransform:"uppercase",letterSpacing:".05em",marginBottom:6}}>🔧 Mécano — l'assistant qui a lu les manuels</div>
      <div style={{font:"500 12px system-ui",color:"var(--muted)",marginBottom:12}}>
        Répond uniquement à partir des documents indexés de cette machine ({nbIndexed} document{nbIndexed>1?"s":""} lisible{nbIndexed>1?"s":""} 🧠),
        avec la page en source. S'il ne trouve pas, il le dit — il n'invente jamais.
      </div>
      <div style={{display:"flex",gap:8}}>
        <input placeholder="Ex : couple de serrage de la broche ? pression pneumatique ?" value={q}
               onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ask()}/>
        <button className="btn" disabled={busy||!q.trim()} onClick={ask}>{busy?"…":"Demander"}</button>
      </div>
      {nbIndexed===0 && <div style={{font:"600 12px system-ui",color:"var(--warn)",marginTop:8}}>
        Aucun document indexé — uploadez un PDF dans l'onglet Documents (indexation automatique) ou cliquez 🧠 Indexer sur les PDF existants.
      </div>}
    </div>
    {hist.map((h,k)=>(
      <div key={k} className="card" style={{maxWidth:640,marginBottom:10}}>
        <div style={{font:"700 13px system-ui",marginBottom:6}}>❓ {h.q}</div>
        <div style={{font:"500 13px system-ui",whiteSpace:"pre-wrap"}}>{h.a}</div>
        {h.sources.length>0 && (
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
            {h.sources.map((s,j)=>(
              <span key={j} style={{font:"600 11px system-ui",background:"var(--bg)",padding:"3px 8px"}}>📄 {s.doc} · p. {s.page}</span>
            ))}
          </div>
        )}
      </div>
    ))}
  </>;
}

function Heatmap({interventions}) {
  const counts = {};
  interventions.filter(i=>i.type==="curative").forEach(i=>{
    const d = i.reported_at?.slice(0,10);
    if (d) counts[d] = (counts[d]||0)+1;
  });
  const start = new Date(); start.setDate(start.getDate()-364);
  const days = [...Array(365)].map((_,k)=>{const d=new Date(start); d.setDate(d.getDate()+k); return d.toISOString().slice(0,10);});
  const color = n => !n ? "#E3E5E8" : n===1 ? "#F0B4AD" : n===2 ? "#E07A6E" : "var(--alarm)";
  return (
    <div className="card" style={{maxWidth:800,overflowX:"auto"}}>
      <div style={{display:"grid",gridTemplateRows:"repeat(7,10px)",gridAutoFlow:"column",gap:2,width:"max-content"}}>
        {days.map(d=><div key={d} title={d+(counts[d]?` — ${counts[d]} panne${counts[d]>1?"s":""}`:"")} style={{width:10,height:10,background:color(counts[d])}}/>)}
      </div>
      <div style={{font:"500 11px system-ui",color:"var(--muted)",marginTop:8,display:"flex",gap:10,alignItems:"center"}}>
        <span>Il y a 12 mois</span>
        <span style={{marginLeft:"auto"}}>Pannes/jour :</span>
        {[0,1,2,3].map(n=><span key={n} style={{display:"inline-flex",alignItems:"center",gap:3}}><span style={{width:10,height:10,background:color(n),display:"inline-block"}}/>{n===3?"3+":n}</span>)}
      </div>
    </div>
  );
}

function ActivityTab({machine,interventions,docs,plans,db}) {
  const {score,reasons,color} = computeHealth(machine,interventions,plans);
  const [comments,setComments] = useState([]);
  useEffect(() => { db.fetchMachineComments(interventions.map(i=>i.id)).then(setComments); }, [machine.id]);
  const events = [];
  interventions.forEach(i=>{
    events.push({at:i.reported_at, icon:i.type==="curative"?"🔴":"🛠️", label:`${ITYPE[i.type]} : ${i.title}`});
    if (i.finished_at) events.push({at:i.finished_at, icon:"✅", label:`Clôturée : ${i.title}`});
  });
  docs.forEach(d=>events.push({at:d.created_at, icon:"📄", label:`Document : ${d.name}`}));
  comments.forEach(c=>events.push({at:c.created_at, icon:"💬", label:`${c.author?.full_name||"?"} : ${c.body}`}));
  events.sort((a,b)=>new Date(b.at)-new Date(a.at));
  return <>
    <div className="card" style={{maxWidth:560,marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:16}}>
        <div style={{fontFamily:"var(--display)",fontSize:40,lineHeight:1,color}}>{score}</div>
        <div style={{flex:1}}>
          <div style={{font:"700 11px system-ui",textTransform:"uppercase",letterSpacing:".07em",color:"var(--muted)"}}>Forme machine / 100</div>
          <div style={{background:"var(--bg)",height:10,marginTop:6}}><div style={{width:score+"%",height:"100%",background:color}}/></div>
        </div>
      </div>
      {reasons.length>0
        ? reasons.map((r,k)=><div key={k} style={{font:"500 12px system-ui",color:"var(--muted)",marginTop:6}}>• {r}</div>)
        : <div style={{font:"600 12px system-ui",color:"var(--run)",marginTop:10}}>Aucun signal négatif — machine en pleine forme.</div>}
      <div style={{font:"500 11px system-ui",color:"var(--muted)",marginTop:10}}>
        Calculé sans capteurs : pannes récentes, préventifs en retard, causes récurrentes, état actuel.
      </div>
    </div>
    <H2>Pannes sur 12 mois</H2>
    <Heatmap interventions={interventions}/>
    <H2>Fil d'activité</H2>
    {events.map((e,k)=>(
      <div key={k} style={{display:"flex",gap:10,padding:"8px 2px",borderBottom:"1px solid #E3E5E8",font:"500 13px system-ui",alignItems:"baseline"}}>
        <span>{e.icon}</span>
        <span style={{flex:1}}>{e.label}</span>
        <span style={{color:"var(--muted)",font:"500 12px system-ui",whiteSpace:"nowrap"}}>{e.at?.slice(0,16).replace("T"," ")}</span>
      </div>
    ))}
    {events.length===0 && <Empty>Aucune activité sur cette machine pour l'instant.</Empty>}
  </>;
}

function QRTab({machine}) {
  const ref = useRef();
  const url = window.location.origin + window.location.pathname + "#/qr/" + machine.qr_token;
  useEffect(() => {
    ref.current.innerHTML = "";
    new QRCode(ref.current, {text:url, width:180, height:180, correctLevel:QRCode.CorrectLevel.M});
  }, [machine.id]);
  const print = () => {
    const img = ref.current.querySelector("img")?.src || ref.current.querySelector("canvas")?.toDataURL();
    const w = window.open("","_blank","width=400,height=520");
    w.document.write(`<div style="text-align:center;font-family:sans-serif;padding:20px">
      <div style="font-weight:900;font-size:20px">⚠ PANNE MACHINE ?</div>
      <div style="font-size:13px;margin:4px 0 14px">Scannez pour prévenir la maintenance</div>
      <img src="${img}" style="width:220px"/>
      <div style="font-weight:800;font-size:16px;margin-top:12px">${machine.code||""} — ${machine.name}</div>
      <div style="font-size:11px;color:#888;margin-top:16px">MaintX</div>
    </div>`);
    w.document.close(); w.focus(); setTimeout(()=>w.print(), 300);
  };
  return (
    <div className="card" style={{maxWidth:420,textAlign:"center"}}>
      <div ref={ref} style={{display:"inline-block",padding:12,background:"#fff"}}/>
      <div style={{font:"700 14px system-ui",marginTop:8}}>{machine.code} — {machine.name}</div>
      <div style={{font:"500 11px system-ui",color:"var(--muted)",margin:"6px 0 14px",wordBreak:"break-all"}}>{url}</div>
      <button className="btn" onClick={print}>🖨 Imprimer l'étiquette</button>
      <div style={{font:"500 11px system-ui",color:"var(--muted)",marginTop:12}}>
        À coller sur la machine. Toute personne qui scanne peut déclarer une panne, sans compte.
      </div>
    </div>
  );
}

// Génère une planche imprimable avec l'étiquette QR de TOUTES les machines
function printAllQR(machines) {
  if (!machines.length) { alert("Aucune machine à imprimer."); return; }
  const esc = s => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const base = window.location.origin + window.location.pathname;
  const holder = document.createElement("div");
  holder.style.display = "none";
  document.body.appendChild(holder);
  const cards = machines.map(m => {
    const el = document.createElement("div");
    holder.appendChild(el);
    new QRCode(el, {text: base + "#/qr/" + m.qr_token, width:420, height:420, correctLevel:QRCode.CorrectLevel.M});
    const img = el.querySelector("canvas")?.toDataURL() || el.querySelector("img")?.src || "";
    return {img, code:esc(m.code), name:esc(m.name)};
  });
  document.body.removeChild(holder);
  const w = window.open("","_blank");
  w.document.write(`<html><head><meta charset="utf-8"><title>Étiquettes QR — MaintX</title><style>
    @page{size:A4;margin:0}
    body{font-family:system-ui,sans-serif;margin:0}
    .page{width:210mm;height:297mm;display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;padding:20mm;page-break-after:always;text-align:center}
    .page img{width:120mm;height:120mm}
    .name{font-weight:900;font-size:34px;margin-top:14mm;word-break:break-word;line-height:1.1}
    .code{font-family:ui-monospace,monospace;font-size:20px;color:#444;margin-top:4mm}
    .hint{font-size:15px;color:#666;margin-top:10mm}
    .brand{position:absolute;bottom:12mm;font-size:11px;letter-spacing:.15em;color:#aaa}
  </style></head><body>
    ${cards.map(c=>`<div class="page">
      <img src="${c.img}"/>
      <div class="name">${c.name}</div>
      ${c.code?`<div class="code">${c.code}</div>`:""}
      <div class="hint">Scannez ce QR code pour signaler une panne</div>
      <div class="brand">MAINTX</div>
    </div>`).join("")}
  </body></html>`);
  w.document.close(); w.focus(); setTimeout(()=>w.print(), 500);
}

