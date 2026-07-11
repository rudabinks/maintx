/* ------------------------- APP ------------------------- */
function App({session}) {
  const [profile,setProfile] = useState(null);
  const [orgs,setOrgs] = useState([]);
  const [orgId,setOrgId] = useState(null);
  const [machines,setMachines] = useState([]);
  const [interventions,setInterventions] = useState([]);
  const [preventifs,setPreventifs] = useState([]);
  const [docs,setDocs] = useState([]);
  const [parts,setParts] = useState([]);
  const [view,setView] = useState({name:"dashboard"});
  const [modal,setModal] = useState(null);
  const [error,setError] = useState(null);
  const [navOpen,setNavOpen] = useState(false);
  const [pendingProfiles,setPendingProfiles] = useState([]);

  const isSuper = profile?.role === "superadmin";
  const canPlan = profile?.role === "manager" || isSuper; // responsable maintenance / superadmin
  const org = orgs.find(o=>o.id===orgId);

  const loadPending = async () => {
    const {data} = await sb.from("profiles").select("*").eq("pending",true).order("created_at");
    setPendingProfiles(data||[]);
  };
  useEffect(() => { (async () => {
    const {data:p,error:e1} = await sb.from("profiles").select("*").eq("id",session.user.id).single();
    if (e1 || !p) { setError("Profil introuvable. Votre inscription a peut-être été refusée — contactez MaintX."); return; }
    setProfile(p);
    if (p.pending) return; // compte en attente : on ne charge pas l'app
    // Le technicien atterrit direct sur les interventions (le reste reste accessible par le menu)
    if (p.role === "technician") setView({name:"interventions"});
    const {data:o} = await sb.from("organizations").select("*").order("name");
    setOrgs(o||[]);
    setOrgId(p.org_id || (o&&o[0]?.id) || null);
    if (p.role === "superadmin") loadPending();
  })(); }, []);

  const refresh = async () => {
    if (!orgId) return;
    const [m,i,p,d,pa] = await Promise.all([
      sb.from("machines").select("*").eq("org_id",orgId).order("code"),
      sb.from("interventions").select("*").eq("org_id",orgId).is("duplicate_of",null).order("reported_at",{ascending:false}),
      sb.from("preventive_plans").select("*").eq("org_id",orgId).order("next_due"),
      sb.from("machine_documents").select("*").eq("org_id",orgId).order("created_at",{ascending:false}),
      sb.from("parts").select("*").eq("org_id",orgId).order("name"),
    ]);
    setMachines(m.data||[]); setInterventions(i.data||[]); setPreventifs(p.data||[]); setDocs(d.data||[]); setParts(pa.data||[]);
  };
  useEffect(() => { refresh(); }, [orgId]);

  /* --- Actions --- */
  const db = {
    addMachine: async f => { await sb.from("machines").insert({org_id:orgId,name:f.name,code:f.code,family:f.family,criticality:f.crit,meta:{year:f.year,specs:{}}}); refresh(); setModal(null); },
    importMachines: async rows => {
      const payload = rows.map(r=>({org_id:orgId,name:r.name,code:r.code||null,family:r.family||null,criticality:r.crit||2,meta:{year:r.year||"",specs:{}}}));
      const {error} = await sb.from("machines").insert(payload);
      if (error) { alert("Erreur import : "+error.message); return false; }
      refresh(); return true;
    },
    updateMachineMeta: async (id,meta) => { await sb.from("machines").update({meta}).eq("id",id); refresh(); },
    addIntervention: async f => { await sb.from("interventions").insert({org_id:orgId,machine_id:f.machine,type:f.type,priority:f.prio,title:f.title,reported_by:profile.id}); refresh(); setModal(null); },
    fetchTechnicians: async () => {
      const {data} = await sb.from("profiles").select("id,full_name,role").eq("org_id",orgId).in("role",["technician","manager"]).order("full_name");
      return data || [];
    },
    generateDirective: async ({machine,title,type,notes}) => {
      const {data:{session}} = await sb.auth.getSession();
      const res = await fetch(FN.directive, {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token,"apikey":SUPABASE_KEY},
        body:JSON.stringify({machine,title,type,notes}),
      });
      const p = await res.json();
      if (!res.ok || p.error) throw new Error(p.error||res.status);
      return p.text;
    },
    planIntervention: async f => {
      await sb.from("interventions").insert({org_id:orgId,machine_id:f.machine,type:f.type||"preventive",priority:f.prio||2,
        title:f.title,directive:f.directive||null,assigned_to:f.assigned_to||null,scheduled_for:f.scheduled_for||null,
        reported_by:profile.id,triage:"accepted",status:"open"});
      // Prévenir le technicien par email + agenda (best-effort : ne bloque pas si non configuré)
      if (f.assigned_to && f.scheduled_for) {
        try {
          const m = machines.find(x=>x.id===f.machine);
          const {data:{session}} = await sb.auth.getSession();
          const res = await fetch(FN.sendplan, {
            method:"POST",
            headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token,"apikey":SUPABASE_KEY},
            body:JSON.stringify({assigned_to:f.assigned_to, machine:m?((m.code?m.code+" ":"")+m.name):"", title:f.title, date:f.scheduled_for, directive:f.directive, org_name:org?.name}),
          });
          const p = await res.json().catch(()=>({}));
          if (!res.ok || p.error) console.warn("Email planning non envoyé :", p.error||res.status);
        } catch(e) { console.warn("Email planning indisponible", e); }
      }
      refresh(); setModal(null);
    },
    setInterventionStatus: async (i,st) => {
      const patch = {status:st};
      if (st!=="open" && !i.acked_at) patch.acked_at = new Date().toISOString();
      if (st==="in_progress" && !i.started_at) patch.started_at = new Date().toISOString();
      if (st==="done") patch.finished_at = new Date().toISOString();
      else if (i.finished_at) patch.finished_at = null; // réouverture : on efface la date de clôture
      if (st==="open") patch.started_at = null;         // remise en file d'attente
      await sb.from("interventions").update(patch).eq("id",i.id); refresh();
    },
    ackIntervention: async i => { await sb.from("interventions").update({acked_at:new Date().toISOString()}).eq("id",i.id); refresh(); },
    deleteIntervention: async i => {
      if (!confirm(`Supprimer l'intervention "${i.title}" ? (photos et commentaires inclus)`)) return;
      // supprimer d'abord les doublons fusionnés rattachés (sinon ils réapparaissent)
      await sb.from("interventions").delete().eq("duplicate_of",i.id);
      const {error} = await sb.from("interventions").delete().eq("id",i.id);
      if (error) { alert("Suppression impossible : "+error.message); return; }
      refresh();
    },
    triage: async (i,st) => {
      const patch = {triage:st};
      if (st==="deferred") patch.priority = 1;
      await sb.from("interventions").update(patch).eq("id",i.id); refresh();
    },
    triageReject: async i => {
      if (!confirm("Rejeter ce signalement (fausse alerte) ? La machine repassera en marche.")) return;
      await sb.from("interventions").update({triage:"rejected",status:"done",finished_at:new Date().toISOString()}).eq("id",i.id);
      await sb.from("machines").update({status:"running",degraded_conditions:null,degraded_deadline:null}).eq("id",i.machine_id).in("status",["alarm","degraded"]);
      refresh();
    },
    triageDuplicate: async (i,masterId) => {
      await sb.from("interventions").update({duplicate_of:masterId,triage:"merged"}).eq("id",i.id); refresh();
    },
    setOrgLogo: async (id,url) => {
      await sb.from("organizations").update({logo_url:url||null}).eq("id",id);
      const {data:o} = await sb.from("organizations").select("*").order("name");
      setOrgs(o||[]);
    },
    saveWeeklyBrief: async (week,text) => {
      await sb.from("organizations").update({settings:{...(org?.settings||{}),weekly_brief:{week,text}}}).eq("id",orgId);
      const {data:o} = await sb.from("organizations").select("*").order("name");
      setOrgs(o||[]);
    },
    setMachineStatus: async (id,st) => { await sb.from("machines").update({status:st,degraded_conditions:null,degraded_deadline:null}).eq("id",id); refresh(); },
    setDegraded: async (id,conditions,deadline) => { await sb.from("machines").update({status:"degraded",degraded_conditions:conditions,degraded_deadline:deadline}).eq("id",id); refresh(); },
    setInterventionCause: async (id,cause) => { await sb.from("interventions").update({failure_cause:cause}).eq("id",id); refresh(); },
    addPart: async f => { await sb.from("parts").insert({org_id:orgId,name:f.name,ref:f.ref||null,location:f.location||null,qty:+f.qty||0,min_qty:+f.min_qty||0,unit_cost:f.unit_cost?+f.unit_cost:null}); refresh(); setModal(null); },
    adjustPart: async (p,delta) => { await sb.from("parts").update({qty:Math.max(0,+p.qty+delta)}).eq("id",p.id); refresh(); },
    deletePart: async p => {
      if (!confirm(`Supprimer la pièce "${p.name}" ?`)) return;
      await sb.from("parts").delete().eq("id",p.id); refresh();
    },
    usePart: async (i,part,qty) => {
      const cost = part.unit_cost ? Math.round(+part.unit_cost*qty*100)/100 : null;
      // on relit stock et parts_used à jour pour éviter d'écraser une saisie concurrente
      const [{data:freshPart},{data:freshInt}] = await Promise.all([
        sb.from("parts").select("qty").eq("id",part.id).single(),
        sb.from("interventions").select("parts_used").eq("id",i.id).single(),
      ]);
      await sb.from("parts").update({qty:Math.max(0,+(freshPart?.qty??part.qty)-qty)}).eq("id",part.id);
      await sb.from("interventions").update({parts_used:[...(freshInt?.parts_used||i.parts_used||[]),{part_id:part.id,ref:part.ref,name:part.name,qty,cost}]}).eq("id",i.id);
      refresh();
    },
    setMeterHours: async (id,hours) => { await sb.from("machines").update({meter_hours:hours}).eq("id",id); refresh(); },
    saveHourlyRate: async v => {
      await sb.from("organizations").update({settings:{...(org?.settings||{}),hourly_rate:+v||0}}).eq("id",orgId);
      const {data:o} = await sb.from("organizations").select("*").order("name");
      setOrgs(o||[]);
    },
    fetchDejaVu: async i => {
      const {data} = await sb.from("interventions").select("*")
        .eq("machine_id",i.machine_id).eq("type","curative").eq("status","done")
        .neq("id",i.id).is("duplicate_of",null)
        .order("reported_at",{ascending:false}).limit(10);
      const past = data||[];
      // Priorité aux titres qui partagent des mots avec la panne actuelle
      const words = (i.title||"").toLowerCase().split(/[^a-zà-ÿ0-9]+/).filter(w=>w.length>3);
      const score = p => words.filter(w=>(p.title||"").toLowerCase().includes(w)).length;
      return past.map(p=>({p,s:score(p)})).sort((a,b)=>b.s-a.s || new Date(b.p.reported_at)-new Date(a.p.reported_at))
                 .slice(0,3).map(x=>x.p);
    },
    fetchMachineComments: async ids => {
      if (!ids.length) return [];
      const {data} = await sb.from("intervention_comments").select("*, author:profiles(full_name)").in("intervention_id",ids).order("created_at",{ascending:false});
      return data || [];
    },
    fetchComments: async iid => {
      const {data} = await sb.from("intervention_comments").select("*, author:profiles(full_name)").eq("intervention_id",iid).order("created_at");
      return data || [];
    },
    addComment: async (iid,body) => { await sb.from("intervention_comments").insert({org_id:orgId,intervention_id:iid,author_id:profile.id,body}); },
    uploadPhoto: async (i,file) => {
      const path = `${orgId}/${i.machine_id}/interventions/${i.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      const {error:e1} = await sb.storage.from("docs").upload(path, file);
      if (e1) { alert("Erreur upload : "+e1.message); return; }
      await sb.from("interventions").update({photos:[...(i.photos||[]),{path,name:file.name}]}).eq("id",i.id);
      refresh();
    },
    openPhoto: async path => {
      const {data,error} = await sb.storage.from("docs").createSignedUrl(path, 3600);
      if (error) { alert("Erreur d'accès à la photo"); return; }
      window.open(data.signedUrl, "_blank");
    },
    approveProfile: async (pid, org_id, role) => {
      await sb.from("profiles").update({org_id, role, pending:false}).eq("id",pid);
      loadPending();
    },
    rejectProfile: async pid => {
      if (!confirm("Refuser cette demande ? La personne ne pourra pas accéder à MaintX.")) return;
      await sb.from("profiles").delete().eq("id",pid);
      loadPending();
    },
    addOrg: async name => {
      const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
      await sb.from("organizations").insert({name,slug});
      const {data:o} = await sb.from("organizations").select("*").order("name");
      setOrgs(o||[]); setModal(null);
    },
    reloadOrgs: async () => { const {data:o} = await sb.from("organizations").select("*").order("name"); setOrgs(o||[]); },
    setOrgPlan: async (id,plan) => { await sb.from("organizations").update({plan}).eq("id",id); const {data:o}=await sb.from("organizations").select("*").order("name"); setOrgs(o||[]); },
    fetchOrgMembers: async oid => {
      const {data} = await sb.from("profiles").select("*").eq("org_id",oid).order("full_name");
      return data || [];
    },
    setProfileRole: async (pid,role) => { await sb.from("profiles").update({role}).eq("id",pid); },
    removeFromOrg: async pid => {
      if (!confirm("Retirer cette personne de l'usine ? Elle repassera en attente d'affectation.")) return false;
      await sb.from("profiles").update({org_id:null,pending:true}).eq("id",pid);
      loadPending(); return true;
    },
    fetchZones: async oid => {
      const {data} = await sb.from("zones").select("*").eq("org_id",oid).order("name");
      return data || [];
    },
    addZone: async (oid,name) => { await sb.from("zones").insert({org_id:oid,name}); },
    deleteZone: async zid => {
      if (!confirm("Supprimer cet atelier / cette zone ?")) return false;
      await sb.from("zones").delete().eq("id",zid); return true;
    },
    addPreventif: async f => {
      const ids = f.machines?.length ? f.machines : (f.machine ? [f.machine] : []);
      const rows = ids.map(mid=>{
        const m = machines.find(x=>x.id===mid);
        return {org_id:orgId,machine_id:mid,title:f.title,freq_days:f.freq,next_due:f.next,checklist:(f.checklist||[]).map(s=>({step:s})),freq_hours:f.freqH?+f.freqH:null,last_done_hours:m?+m.meter_hours:0};
      });
      if (rows.length) await sb.from("preventive_plans").insert(rows);
      refresh(); setModal(null);
    },
    donePreventif: async (p,steps) => {
      const m = machines.find(x=>x.id===p.machine_id);
      // freq_days = 0 → tâche ponctuelle : on la désactive au lieu de la replanifier
      const patch = +p.freq_days>0
        ? {next_due:addDays(today(),p.freq_days), last_done_hours:m?+m.meter_hours:+p.last_done_hours}
        : {active:false};
      await sb.from("preventive_plans").update(patch).eq("id",p.id);
      const desc = steps?.length ? "Checklist :\n"+steps.map(s=>(s.done?"✓ ":"✗ ")+s.step).join("\n") : null;
      await sb.from("interventions").insert({org_id:orgId,machine_id:p.machine_id,type:"preventive",priority:1,title:p.title,description:desc,status:"done",reported_by:profile.id,started_at:new Date().toISOString(),finished_at:new Date().toISOString()});
      refresh();
    },
    donePreventifBatch: async plans => {
      if (!plans.length) return;
      if (!confirm(`Valider « ${plans[0].title} » sur ${plans.length} machine(s) ?`)) return;
      const now = new Date().toISOString();
      for (const p of plans) {
        const m = machines.find(x=>x.id===p.machine_id);
        const patch = +p.freq_days>0
          ? {next_due:addDays(today(),p.freq_days), last_done_hours:m?+m.meter_hours:+p.last_done_hours}
          : {active:false};
        await sb.from("preventive_plans").update(patch).eq("id",p.id);
        const desc = p.checklist?.length ? "Checklist (validée en lot) :\n"+p.checklist.map(s=>"✓ "+(s.step||s)).join("\n") : null;
        await sb.from("interventions").insert({org_id:orgId,machine_id:p.machine_id,type:"preventive",priority:1,title:p.title,description:desc,status:"done",reported_by:profile.id,started_at:now,finished_at:now});
      }
      refresh();
    },
    uploadDoc: async (machineId, file, category) => {
      const path = `${orgId}/${machineId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      const {error:e1} = await sb.storage.from("docs").upload(path, file);
      if (e1) { alert("Erreur upload : "+e1.message); return; }
      await sb.from("machine_documents").insert({org_id:orgId,machine_id:machineId,category,name:file.name,storage_path:path,uploaded_by:profile.id});
      refresh();
    },
    ingestDoc: async (d, silent) => {
      try {
        if (!window.pdfjsLib) throw new Error("pdf.js non chargé (rechargez la page)");
        const {data:blob,error:e0} = await sb.storage.from("docs").download(d.storage_path);
        if (e0 || !blob) throw new Error("téléchargement du PDF impossible");
        const buf = new Uint8Array(await blob.arrayBuffer());
        const pdf = await window.pdfjsLib.getDocument({data:buf}).promise;
        const chunks = [];
        for (let pg=1; pg<=pdf.numPages; pg++) {
          const page = await pdf.getPage(pg);
          const content = await page.getTextContent();
          const clean = content.items.map(it=>it.str).join(" ").replace(/\s+/g," ").trim();
          if (clean.length < 30) continue; // page vide ou scannée sans texte
          for (let k=0; k<clean.length; k+=1100) chunks.push({page:pg, content:clean.slice(k,k+1250)});
        }
        await sb.from("doc_chunks").delete().eq("document_id",d.id);
        for (let k=0; k<chunks.length; k+=200) {
          const rows = chunks.slice(k,k+200).map(c=>({org_id:d.org_id,machine_id:d.machine_id,document_id:d.id,doc_name:d.name,page:c.page,content:c.content}));
          const {error:e3} = await sb.from("doc_chunks").insert(rows);
          if (e3) throw new Error("insertion : "+e3.message);
        }
        await sb.from("machine_documents").update({indexed_at:new Date().toISOString()}).eq("id",d.id);
        refresh();
        if (!silent) alert(chunks.length ? `${chunks.length} extrait(s) indexé(s) — Mécano peut lire « ${d.name} ».`
                                         : "Aucun texte lisible (PDF scanné ?) — Mécano ne pourra pas s'en servir.");
      } catch(e) {
        if (!silent) alert("Indexation impossible : "+(e.message||e));
      }
    },
    askMecano: async (machine, question) => {
      const {data:{session}} = await sb.auth.getSession();
      const res = await fetch(FN.ask, {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token,"apikey":SUPABASE_KEY},
        body:JSON.stringify({machine_id:machine.id, machine_name:machine.name, question}),
      });
      const p = await res.json();
      if (!res.ok || p.error) throw new Error(p.error||res.status);
      return p;
    },
    setDocCategory: async (d,cat) => { await sb.from("machine_documents").update({category:cat}).eq("id",d.id); refresh(); },
    addDocLink: async (machineId, url, name, category) => {
      await sb.from("machine_documents").insert({org_id:orgId,machine_id:machineId,category,name,storage_path:url,uploaded_by:profile.id});
      refresh();
    },
    openDoc: async d => {
      if (d.storage_path?.startsWith("http")) { window.open(d.storage_path, "_blank"); return; }
      const {data,error} = await sb.storage.from("docs").createSignedUrl(d.storage_path, 3600);
      if (error) { alert("Erreur d'accès au document"); return; }
      window.open(data.signedUrl, "_blank");
    },
    deleteDoc: async d => {
      if (!confirm(`Supprimer "${d.name}" ?`)) return;
      if (!d.storage_path?.startsWith("http")) await sb.storage.from("docs").remove([d.storage_path]);
      await sb.from("machine_documents").delete().eq("id",d.id);
      refresh();
    },
  };

  /* --- KPI --- */
  const kpi = useMemo(() => {
    const pannes = machines.filter(m=>m.status==="alarm").length;
    const pending = interventions.filter(i=>i.triage==="pending").length;
    const ouvertes = interventions.filter(i=>i.status!=="done" && i.triage!=="pending").length;
    const done = interventions.filter(i=>i.started_at && i.finished_at);
    const mttr = done.length ? Math.round(done.reduce((a,i)=>a+(new Date(i.finished_at)-new Date(i.started_at))/60000,0)/done.length) : null;
    const retard = preventifs.filter(p=>p.active && (p.next_due<=today() || planHoursDue(p,machines))).length;
    const lowStock = parts.filter(partLow).length;
    const d90 = new Date(Date.now()-90*864e5).toISOString();
    const counts = {};
    interventions.filter(i=>i.type==="curative" && i.reported_at>d90).forEach(i=>{counts[i.machine_id]=(counts[i.machine_id]||0)+1;});
    const chroniques = Object.entries(counts).filter(([,n])=>n>=3).map(([mid,n])=>({mid,m:machines.find(x=>x.id===mid),n}));
    return {pannes,ouvertes,mttr,retard,chroniques,lowStock,pending};
  }, [machines,interventions,preventifs,parts]);

  const machineName = id => machines.find(m=>m.id===id)?.name || "?";

  if (error) return <Center><div style={{textAlign:"center"}}><div style={{color:"var(--alarm)",font:"600 14px system-ui",marginBottom:16}}>{error}</div><button className="btn" onClick={()=>sb.auth.signOut()}>Se déconnecter</button></div></Center>;
  if (profile && profile.pending) return (
    <Center>
      <div style={{background:"#fff",padding:32,width:400,maxWidth:"94vw",borderTop:"5px solid var(--accent)",textAlign:"center"}}>
        <div style={{fontSize:40}}>⏳</div>
        <div style={{font:"800 17px system-ui",marginTop:4}}>Compte en attente de validation</div>
        <div style={{font:"500 13px system-ui",color:"var(--muted)",margin:"10px 0 18px"}}>
          Bonjour {profile.full_name}. Votre accès n'a pas encore été autorisé par MaintX. Vous recevrez l'accès dès validation.
        </div>
        <button className="btn" onClick={()=>sb.auth.signOut()}>Se déconnecter</button>
      </div>
    </Center>
  );
  if (!profile || !orgId) return <Center>Chargement…</Center>;

  const ITEM = {
    dashboard:{label:"Accueil",ico:"fa-gauge-high",badge:kpi.pannes,color:"var(--alarm)"},
    interventions:{label:"Interventions",ico:"fa-screwdriver-wrench",badge:kpi.ouvertes+kpi.pending,color:kpi.pending>0?"var(--accent)":"#3B4048"},
    parc:{label:"Machines",ico:"fa-gears"},
    preventif:{label:"Préventif",ico:"fa-calendar-check",badge:kpi.retard,color:"var(--alarm)"},
    planning:{label:"Planning",ico:"fa-calendar-days"},
    pieces:{label:"Pièces détachées",ico:"fa-box",badge:kpi.lowStock,color:"var(--warn)"},
    analyse:{label:"Analyse",ico:"fa-chart-line"},
    admin:{label:"Clients & accès",ico:"fa-users",badge:pendingProfiles.length,color:"var(--accent)"},
  };
  const PRIMARY = ["dashboard","interventions","parc","preventif"];       // barre du bas mobile
  const SECONDARY = [...(canPlan?["planning"]:[]),"pieces","analyse",...(isSuper?["admin"]:[])]; // menu "Plus"
  const NavBtn = k => {
    const it = ITEM[k];
    return (
      <button key={k} className={"nav"+(view.name===k?" active":"")} onClick={()=>{setView({name:k});setNavOpen(false);}}>
        <span className="ico">{it.ico}</span>{it.label}
        {it.badge>0 && <span className="navbadge" style={{background:it.color,color:it.color==="var(--accent)"?"var(--ink)":"#fff"}}>{it.badge}</span>}
      </button>
    );
  };

  const TOPNAV = ["dashboard","interventions","preventif",...(canPlan?["planning"]:[]),"parc","pieces","analyse",...(isSuper?["admin"]:[])];
  return (
    <div className="layout" style={{display:"flex",flexDirection:"column",minHeight:"100vh"}}>
      <div className="mobilebar">
        <div style={{fontFamily:"var(--display)",fontSize:17,color:"#fff",flex:1}}>
          <span style={{color:"var(--accent)",marginRight:5}}>▮▮</span>MAINT<span style={{color:"var(--accent)"}}>X</span>
        </div>
        <span style={{color:"#AEB2B9",font:"600 12px system-ui",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:170}}>{org?.name}</span>
      </div>
      <header className="topnav">
        <div style={{fontFamily:"var(--display)",fontSize:18,color:"#fff",marginRight:8}}>
          <span style={{color:"var(--accent)",marginRight:5}}>▮▮</span>MAINT<span style={{color:"var(--accent)"}}>X</span>
        </div>
        <nav style={{display:"flex",gap:2,flex:1,overflowX:"auto"}}>
          {TOPNAV.map(k=>{
            const it = ITEM[k];
            return (
              <button key={k} className={"tnav"+(view.name===k?" active":"")} onClick={()=>setView({name:k})}>
                <i className={"fa-solid "+it.ico} style={{width:16,textAlign:"center"}} aria-hidden="true"></i>{it.label}
                {it.badge>0 && <span className="tbadge" style={{background:it.color,color:it.color==="var(--accent)"?"var(--ink)":"#fff"}}>{it.badge}</span>}
              </button>
            );
          })}
        </nav>
        {isSuper && orgs.length>1 && (
          <Dropdown width={200} align="right" value={orgId}
                    options={orgs.map(o=>({value:o.id,label:o.name,sub:"plan "+(o.plan||"standard")}))}
                    onChange={id=>{setOrgId(id);setView({name:"dashboard"});}}/>
        )}
        <span style={{color:"#AEB2B9",font:"600 12px system-ui",marginLeft:10,whiteSpace:"nowrap"}}>{profile.full_name}</span>
        <button className="btn ghost sm" style={{marginLeft:8,color:"#C9CCD1",borderColor:"#444"}} onClick={()=>sb.auth.signOut()}>Quitter</button>
      </header>

      <main className="main" style={{flex:1,minWidth:0}}>
       <div style={{maxWidth:1180,margin:"0 auto"}}>
        <header style={{marginBottom:20}}>
          <div style={{font:"700 10px system-ui",textTransform:"uppercase",letterSpacing:".12em",color:"var(--muted)",marginBottom:4}}>
            Plan {org?.plan==="connect"?"Connect · machines connectées":"Standard"}
          </div>
          <h1 style={{fontFamily:"var(--display)",fontSize:26,margin:0,textTransform:"uppercase"}}>{org?.name}</h1>
        </header>

        {view.name==="dashboard" && <Dashboard machines={machines} interventions={interventions} preventifs={preventifs} parts={parts} org={org} kpi={kpi} machineName={machineName} db={db} setView={setView}/>}
        {view.name==="parc" && <Parc machines={machines} interventions={interventions} preventifs={preventifs} setModal={setModal} setView={setView} isSuper={isSuper}/>}
        {view.name==="machine" && <MachineDetail machine={machines.find(m=>m.id===view.id)} docs={docs.filter(d=>d.machine_id===view.id)} interventions={interventions.filter(i=>i.machine_id===view.id)} parts={parts} plans={preventifs.filter(p=>p.machine_id===view.id)} db={db} back={()=>setView({name:"parc"})}/>}
        {view.name==="triage" && <Triage interventions={interventions} machineName={machineName} db={db}/>}
        {view.name==="interventions" && <Interventions interventions={interventions} machineName={machineName} db={db} parts={parts} setModal={setModal} setView={setView}/>}
        {view.name==="preventif" && <Preventif preventifs={preventifs} interventions={interventions} machines={machines} machineName={machineName} db={db} setModal={setModal}/>}
        {view.name==="planning" && canPlan && <Planning interventions={interventions} machines={machines} machineName={machineName} db={db} setModal={setModal}/>}
        {view.name==="pieces" && <Pieces parts={parts} setModal={setModal} db={db}/>}
        {view.name==="analyse" && <Analyse machines={machines} interventions={interventions} org={org} db={db} role={profile.role}/>}
        {view.name==="admin" && isSuper && <>
          <PendingRequests pending={pendingProfiles} orgs={orgs} db={db}/>
          <Toolbar><H2>Clients &amp; usines ({orgs.length})</H2><button className="btn" onClick={()=>setModal("org")}>+ Nouveau client</button></Toolbar>
          {orgs.map(o=>(
            <OrgRow key={o.id} o={o} db={db} onOpen={()=>{setOrgId(o.id);setView({name:"dashboard"});}}/>
          ))}
          {orgs.length===0 && <Empty>Aucun client — créez le premier avec « + Nouveau client ».</Empty>}
        </>}

        <footer style={{marginTop:36,paddingTop:14,borderTop:"1px solid #DDDFE3",textAlign:"center",font:"500 11px system-ui",color:"var(--muted)"}}>
          <a href="#/mentions-legales" style={{color:"var(--muted)"}}>Mentions légales</a>
          <span style={{margin:"0 8px"}}>·</span>
          <a href="#/confidentialite" style={{color:"var(--muted)"}}>Confidentialité (RGPD)</a>
        </footer>
       </div>
      </main>

      {modal==="machine" && <MachineModal onClose={()=>setModal(null)} onSave={db.addMachine}/>}
      {modal==="intervention" && <InterventionModal machines={machines} onClose={()=>setModal(null)} onSave={db.addIntervention}/>}
      {modal==="org" && <OrgModal onClose={()=>setModal(null)} onSave={db.addOrg}/>}
      {modal==="preventif" && <PreventifModal machines={machines} onClose={()=>setModal(null)} onSave={db.addPreventif}/>}
      {modal==="part" && <PartModal onClose={()=>setModal(null)} onSave={db.addPart}/>}
      {modal==="plan" && <PlanningModal machines={machines} db={db} onClose={()=>setModal(null)}/>}
      {modal==="import" && <ImportModal onClose={()=>setModal(null)} onImport={db.importMachines}/>}

      {/* Barre d'onglets du bas (mobile) */}
      <nav className="bottomnav">
        {PRIMARY.map(k=>{
          const it = ITEM[k];
          return (
            <button key={k} className={"btab"+(view.name===k?" active":"")} onClick={()=>setView({name:k})}>
              {it.badge>0 && <span className="bdot"/>}
              <i className={"bico fa-solid "+it.ico} aria-hidden="true"></i>{it.label}
            </button>
          );
        })}
        <button className={"btab"+(SECONDARY.includes(view.name)||navOpen?" active":"")} onClick={()=>setNavOpen(true)}>
          {SECONDARY.some(k=>ITEM[k].badge>0) && <span className="bdot"/>}
          <i className="bico fa-solid fa-ellipsis" aria-hidden="true"></i>Plus
        </button>
      </nav>

      {/* Feuille "Plus" (mobile) */}
      {navOpen && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:90}} onClick={()=>setNavOpen(false)}>
          <div style={{position:"absolute",bottom:0,left:0,right:0,background:"#fff",padding:"16px 16px 22px"}} onClick={e=>e.stopPropagation()}>
            <div style={{font:"800 13px system-ui",textTransform:"uppercase",letterSpacing:".08em",color:"var(--muted)",marginBottom:12}}>Plus</div>
            {SECONDARY.map(k=>{
              const it = ITEM[k];
              return (
                <button key={k} style={{display:"flex",alignItems:"center",gap:12,width:"100%",background:view.name===k?"var(--bg)":"transparent",border:0,padding:"13px 10px",font:"700 14px system-ui",color:"var(--ink)",cursor:"pointer",textAlign:"left"}}
                        onClick={()=>{setView({name:k});setNavOpen(false);}}>
                  <i className={"fa-solid "+it.ico} style={{fontSize:18,width:22,textAlign:"center"}} aria-hidden="true"></i>{it.label}
                  {it.badge>0 && <span className="navbadge" style={{background:it.color||"var(--alarm)",color:it.color==="var(--accent)"?"var(--ink)":"#fff"}}>{it.badge}</span>}
                </button>
              );
            })}
            <div style={{borderTop:"1px solid #E3E5E8",margin:"12px 0 0",paddingTop:12,font:"500 12px system-ui",color:"var(--muted)"}}>
              {profile.full_name} · {ROLES[profile.role]?.label || profile.role}
            </div>
            <button className="btn" style={{width:"100%",marginTop:10}} onClick={()=>sb.auth.signOut()}>Déconnexion</button>
          </div>
        </div>
      )}
    </div>
  );
}

