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

