/* ------------------------- DEMANDES D'ACCÈS (validation superadmin) ------------------------- */
function PendingRequests({pending,orgs,db}) {
  if (!pending.length) return null;
  return <>
    <H2>Demandes d'accès en attente ({pending.length})</H2>
    <div style={{font:"500 13px system-ui",color:"var(--muted)",marginBottom:12}}>
      Personnes inscrites qui attendent votre validation. Affectez chacune à une entreprise et un rôle, ou refusez.
    </div>
    {pending.map(p=><PendingRow key={p.id} p={p} orgs={orgs} db={db}/>)}
  </>;
}

function PendingRow({p,orgs,db}) {
  const [org,setOrg] = useState(orgs[0]?.id);
  const [role,setRole] = useState("operator");
  return (
    <Row style={{borderLeft:"4px solid var(--accent)"}}>
      <div style={{flex:"1 1 200px"}}>
        <b>{p.full_name}</b>
        <div style={{font:"500 12px system-ui",color:"var(--muted)",marginTop:2}}>
          {p.requested_org ? `Entreprise déclarée : ${p.requested_org}` : "Entreprise non précisée"} · inscrit le {p.created_at?.slice(0,10)}
        </div>
      </div>
      <Dropdown width={180} value={org} placeholder="Entreprise…"
                options={orgs.map(o=>({value:o.id,label:o.name}))} onChange={setOrg}/>
      <Dropdown width={150} value={role}
                options={Object.entries(ROLES).map(([k,v])=>({value:k,label:v.label,sub:v.desc}))} onChange={setRole}/>
      <button className="btn sm" disabled={!org} onClick={()=>db.approveProfile(p.id,org,role)}>✅ Autoriser</button>
      <button className="btn ghost sm" onClick={()=>db.rejectProfile(p.id)}>✕ Refuser</button>
    </Row>
  );
}

/* ------------------------- GESTION D'UNE USINE (client) ------------------------- */
function OrgRow({o,db,onOpen}) {
  const [open,setOpen] = useState(false);
  const [members,setMembers] = useState(null);
  const [zones,setZones] = useState(null);
  const [logo,setLogo] = useState(o.logo_url||"");
  const [zn,setZn] = useState("");
  const reload = async () => { setMembers(await db.fetchOrgMembers(o.id)); setZones(await db.fetchZones(o.id)); };
  useEffect(() => { if(open && members===null) reload(); }, [open]);
  const addZone = async () => { if(!zn.trim()) return; await db.addZone(o.id, zn.trim()); setZn(""); setZones(await db.fetchZones(o.id)); };
  const lbl = {font:"500 12px system-ui",color:"var(--muted)",display:"block",marginBottom:4};
  const sec = {font:"700 11px system-ui",textTransform:"uppercase",letterSpacing:".06em",color:"var(--muted)",marginBottom:8};
  const mut = {font:"500 12px system-ui",color:"var(--muted)"};
  return (
    <div style={{border:"1px solid #E3E5E8",marginBottom:8}}>
      <Row style={{marginBottom:0}}>
        <div style={{flex:1,cursor:"pointer"}} onClick={()=>setOpen(!open)}>
          <b>{open?"▾":"▸"} {o.name}</b>
          <div style={{...mut,marginTop:2}}>plan {o.plan} · {o.slug}{o.logo_url?" · logo ✓":""}</div>
        </div>
        <button className="btn ghost sm" onClick={()=>setOpen(!open)}>{open?"Fermer":"Gérer"}</button>
        <button className="btn ghost sm" onClick={onOpen}>Ouvrir →</button>
      </Row>
      {open && (
        <div style={{padding:"12px 16px 16px",display:"flex",flexDirection:"column",gap:18,background:"var(--bg)"}}>

          <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
            <div style={{flex:"1 1 260px"}}>
              <label style={lbl}>Logo (URL — affiché sur les rapports PDF)</label>
              <div style={{display:"flex",gap:8}}>
                <input placeholder="https://…/logo.png" value={logo} onChange={e=>setLogo(e.target.value)}/>
                <button className="btn sm" onClick={()=>db.setOrgLogo(o.id,logo.trim())}>OK</button>
              </div>
            </div>
            <div>
              <label style={lbl}>Formule</label>
              <Dropdown width={220} value={o.plan||"standard"}
                        options={[{value:"standard",label:"Standard"},{value:"connect",label:"Connect (machines connectées)"}]}
                        onChange={v=>db.setOrgPlan(o.id,v)}/>
            </div>
          </div>

          <div>
            <div style={sec}>Utilisateurs affectés {members?`(${members.length})`:""}</div>
            {members===null && <div style={mut}>Chargement…</div>}
            {members?.map(m=>(
              <Row key={m.id} style={{marginBottom:6}}>
                <div style={{flex:1}}><b>{m.full_name}</b><div style={{...mut,marginTop:2}}>{ROLES[m.role]?.label||m.role}</div></div>
                <Dropdown width={150} value={m.role}
                          options={Object.entries(ROLES).map(([k,v])=>({value:k,label:v.label,sub:v.desc}))}
                          onChange={async v=>{await db.setProfileRole(m.id,v); reload();}}/>
                <button className="btn ghost sm" onClick={async()=>{ if(await db.removeFromOrg(m.id)) reload(); }}>Retirer</button>
              </Row>
            ))}
            {members?.length===0 && <div style={mut}>Personne n'est affecté à cette usine. Les inscriptions apparaissent dans « Demandes d'accès » en haut.</div>}
          </div>

          <div>
            <div style={sec}>Ateliers / zones {zones?`(${zones.length})`:""}</div>
            {zones?.map(z=>(
              <Row key={z.id} style={{marginBottom:6}}>
                <div style={{flex:1}}><b>{z.name}</b></div>
                <button className="btn ghost sm" onClick={async()=>{ if(await db.deleteZone(z.id)) setZones(await db.fetchZones(o.id)); }}>✕</button>
              </Row>
            ))}
            {zones?.length===0 && members!==null && <div style={{...mut,marginBottom:6}}>Aucun atelier — ajoutez les zones de l'usine (ex : Usinage, Montage, Presses).</div>}
            <div style={{display:"flex",gap:8,marginTop:6}}>
              <input placeholder="Nom d'un atelier / zone" value={zn} onChange={e=>setZn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addZone()}/>
              <button className="btn sm" disabled={!zn.trim()} onClick={addZone}>+ Ajouter</button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

/* ------------------------- TRIAGE (inbox des signalements QR) ------------------------- */
function Triage({interventions,machineName,db}) {
  const pending = interventions.filter(i=>i.triage==="pending");
  return <>
    <H2>À trier ({pending.length})</H2>
    <div style={{font:"500 13px system-ui",color:"var(--muted)",marginBottom:14}}>
      Signalements arrivés par QR code. Qualifiez-les avant qu'ils entrent dans le flux — objectif : file vide chaque matin.
    </div>
    {pending.map(i=>{
      const others = interventions.filter(x=>x.id!==i.id && x.machine_id===i.machine_id && x.status!=="done" && x.triage!=="pending");
      return <TriageCard key={i.id} i={i} others={others} machineName={machineName} db={db}/>;
    })}
    {pending.length===0 && <Empty>File vide — tout est trié ✓</Empty>}
  </>;
}

function TriageCard({i,others,machineName,db}) {
  return (
    <Row style={{borderLeft:"4px solid var(--accent)",flexWrap:"wrap",gap:10}}>
      <div style={{flex:"1 1 260px"}}>
        <b>{i.title}</b>
        <div style={{font:"500 12px system-ui",color:"var(--muted)",marginTop:2}}>
          {machineName(i.machine_id)} · {i.reported_at?.slice(0,16).replace("T"," ")} · priorité {i.priority}/3
        </div>
        {i.description && <div style={{font:"500 12px system-ui",marginTop:4}}>{i.description}</div>}
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
        <button className="btn sm" onClick={()=>db.triage(i,"accepted")}>✅ Prendre en charge</button>
        {others.length>0 && (
          <Dropdown width={190} placeholder="🔗 Doublon de…" value={null}
                    options={others.map(o=>({value:o.id,label:o.title.length>26?o.title.slice(0,26)+"…":o.title,sub:o.reported_at?.slice(0,10)}))}
                    onChange={id=>db.triageDuplicate(i,id)}/>
        )}
        <button className="btn ghost sm" title="Pas urgent : accepté en priorité basse" onClick={()=>db.triage(i,"deferred")}>⏸ Reporter</button>
        <button className="btn ghost sm" title="Fausse alerte" onClick={()=>db.triageReject(i)}>✕ Rejeter</button>
      </div>
    </Row>
  );
}

