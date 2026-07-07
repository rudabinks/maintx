function Modal({title,children,onClose}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(27,29,33,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50}} onClick={onClose}>
      <div style={{background:"#fff",padding:24,width:420,maxWidth:"92vw",borderTop:"5px solid var(--accent)"}} onClick={e=>e.stopPropagation()}>
        <h3 style={{margin:"0 0 16px",fontFamily:"var(--display)",textTransform:"uppercase",letterSpacing:".04em"}}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function MachineModal({onClose,onSave}) {
  const [f,setF] = useState({name:"",code:"",family:"CN fraisage",crit:2,year:""});
  return (
    <Modal title="Ajouter une machine" onClose={onClose}>
      <input placeholder="Nom (ex: Mori Seiki M300L)" value={f.name} onChange={e=>setF({...f,name:e.target.value})} style={{marginBottom:10}}/>
      <input placeholder="Code parc (ex: FR-08)" value={f.code} onChange={e=>setF({...f,code:e.target.value})} style={{marginBottom:10}}/>
      <input placeholder="Famille (ex: Tour CN)" value={f.family} onChange={e=>setF({...f,family:e.target.value})} style={{marginBottom:10}}/>
      <input placeholder="Année (optionnel)" value={f.year} onChange={e=>setF({...f,year:e.target.value})} style={{marginBottom:10}}/>
      <label style={{font:"600 12px system-ui"}}>Criticité : <span style={{color:CRIT[f.crit].color}}>{CRIT[f.crit].label}</span></label>
      <input type="range" min="1" max="3" value={f.crit} onChange={e=>setF({...f,crit:+e.target.value})} style={{border:0,padding:0}}/>
      <div style={{font:"500 11px system-ui",color:"var(--muted)",marginBottom:4}}>{CRIT[f.crit].desc}</div>
      <button className="btn" disabled={!f.name} onClick={()=>onSave(f)} style={{width:"100%",marginTop:12}}>Enregistrer</button>
    </Modal>
  );
}

function InterventionModal({machines,onClose,onSave}) {
  const [f,setF] = useState({machine:machines[0]?.id,type:"curative",prio:2,title:""});
  return (
    <Modal title="Déclarer une intervention" onClose={onClose}>
      <label style={{font:"500 12px system-ui",color:"var(--muted)"}}>Machine</label>
      <Dropdown style={{marginBottom:10}} value={f.machine}
                options={machines.map(m=>({value:m.id,label:(m.code?m.code+" — ":"")+m.name,sub:m.family}))}
                onChange={v=>setF({...f,machine:v})}/>
      <label style={{font:"500 12px system-ui",color:"var(--muted)"}}>Type d'intervention</label>
      <Dropdown style={{marginBottom:10}} value={f.type}
                options={Object.entries(ITYPE).map(([k,v])=>({value:k,label:v}))}
                onChange={v=>setF({...f,type:v})}/>
      <input placeholder="Description du problème" value={f.title} onChange={e=>setF({...f,title:e.target.value})} style={{marginBottom:10}}/>
      <label style={{font:"500 12px system-ui",color:"var(--muted)"}}>Priorité : {f.prio}/3</label>
      <input type="range" min="1" max="3" value={f.prio} onChange={e=>setF({...f,prio:+e.target.value})} style={{border:0,padding:0}}/>
      <button className="btn" disabled={!f.title||!f.machine} onClick={()=>onSave(f)} style={{width:"100%",marginTop:12}}>Déclarer</button>
    </Modal>
  );
}

function PreventifModal({machines,onClose,onSave}) {
  const [f,setF] = useState({machines:machines[0]?[machines[0].id]:[],title:"",freq:30,freqH:"",next:today(),checklist:[],once:false});
  const [step,setStep] = useState("");
  const addStep = () => { if(!step.trim()) return; setF({...f,checklist:[...f.checklist,step.trim()]}); setStep(""); };
  const toggle = id => setF({...f, machines: f.machines.includes(id) ? f.machines.filter(x=>x!==id) : [...f.machines, id]});
  return (
    <Modal title="Nouvelle gamme préventive" onClose={onClose}>
      <label style={{font:"500 12px system-ui",color:"var(--muted)"}}>Machines concernées ({f.machines.length})</label>
      <div style={{display:"flex",gap:8,margin:"4px 0 6px"}}>
        <button className="btn ghost sm" onClick={()=>setF({...f,machines:machines.map(m=>m.id)})}>Toutes</button>
        <button className="btn ghost sm" onClick={()=>setF({...f,machines:[]})}>Aucune</button>
      </div>
      <div style={{maxHeight:150,overflow:"auto",border:"1px solid #E3E5E8",marginBottom:10}}>
        {machines.map(m=>(
          <label key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderBottom:"1px solid #EEE",cursor:"pointer",font:"600 13px system-ui",background:f.machines.includes(m.id)?"rgba(255,196,0,.10)":"#fff"}}>
            <input type="checkbox" checked={f.machines.includes(m.id)} onChange={()=>toggle(m.id)} style={{width:16,height:16,margin:0}}/>
            {(m.code?m.code+" — ":"")+m.name}
          </label>
        ))}
      </div>
      <input placeholder="Titre (ex: Contrôle niveaux + graissage)" value={f.title} onChange={e=>setF({...f,title:e.target.value})} style={{marginBottom:10}}/>
      <label style={{display:"flex",alignItems:"center",gap:8,font:"600 13px system-ui",margin:"2px 0 10px",cursor:"pointer"}}>
        <input type="checkbox" checked={f.once} style={{width:17,height:17,margin:0}} onChange={e=>setF({...f,once:e.target.checked})}/>
        Une seule fois (pas de périodicité) — la tâche disparaît une fois faite
      </label>
      {!f.once && <>
        <label style={{font:"500 12px system-ui",color:"var(--muted)"}}>Périodicité (jours)</label>
        <input type="number" min="1" value={f.freq} onChange={e=>setF({...f,freq:+e.target.value})} style={{marginBottom:10}}/>
        <label style={{font:"500 12px system-ui",color:"var(--muted)"}}>Ou au compteur (heures machine, optionnel — ex: 500)</label>
        <input type="number" min="1" placeholder="—" value={f.freqH} onChange={e=>setF({...f,freqH:e.target.value})} style={{marginBottom:10}}/>
      </>}
      <label style={{font:"500 12px system-ui",color:"var(--muted)"}}>Première échéance</label>
      <input type="date" value={f.next} onChange={e=>setF({...f,next:e.target.value})} style={{marginBottom:10}}/>
      <label style={{font:"500 12px system-ui",color:"var(--muted)"}}>Checklist (optionnel) — points que le technicien cochera</label>
      {f.checklist.map((s,k)=>(
        <div key={k} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",font:"600 13px system-ui"}}>
          <span style={{color:"var(--accent)"}}>▮</span><span style={{flex:1}}>{s}</span>
          <button className="btn ghost sm" onClick={()=>setF({...f,checklist:f.checklist.filter((_,j)=>j!==k)})}>✕</button>
        </div>
      ))}
      <div style={{display:"flex",gap:8,margin:"6px 0 10px"}}>
        <input placeholder="Point de contrôle (ex: Vérifier niveau d'huile)" value={step}
               onChange={e=>setStep(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addStep();}}}/>
        <button className="btn sm" disabled={!step.trim()} onClick={addStep}>+</button>
      </div>
      <button className="btn" disabled={!f.title||!f.machines.length} onClick={()=>onSave({...f, freq:f.once?0:f.freq, freqH:f.once?"":f.freqH})} style={{width:"100%",marginTop:6}}>
        Créer{f.machines.length>1?` sur ${f.machines.length} machines`:""}
      </button>
    </Modal>
  );
}

function OrgModal({onClose,onSave}) {
  const [name,setName] = useState("");
  return (
    <Modal title="Nouveau client" onClose={onClose}>
      <input placeholder="Nom de l'entreprise" value={name} onChange={e=>setName(e.target.value)} style={{marginBottom:12}}/>
      <button className="btn" disabled={!name} onClick={()=>onSave(name)} style={{width:"100%"}}>Créer</button>
    </Modal>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root/>);
