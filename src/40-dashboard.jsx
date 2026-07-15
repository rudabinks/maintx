/* ------------------------- VUES ------------------------- */
function WeeklyBrief({org,machines,interventions,preventifs,machineName,db}) {
  const wk = isoWeek();
  const cached = org?.settings?.weekly_brief;
  const [busy,setBusy] = useState(false);
  const [err,setErr] = useState(null);
  const text = cached?.week===wk ? cached.text : null;
  const buildStats = () => {
    const d7 = new Date(Date.now()-7*864e5).toISOString();
    const lastWeek = interventions.filter(i=>i.type==="curative" && i.reported_at>d7);
    const byM = {}; lastWeek.forEach(i=>{byM[i.machine_id]=(byM[i.machine_id]||0)+1;});
    const topM = Object.entries(byM).sort((a,b)=>b[1]-a[1])[0];
    const byC = {}; lastWeek.forEach(i=>{
      if (!i.failure_cause) return;
      const lbl = FAILCAUSE[i.failure_cause]?.label || i.failure_cause;
      byC[lbl] = (byC[lbl]||0)+1;
    });
    return {
      pannes_7_derniers_jours: lastWeek.length,
      machine_la_plus_touchee: topM ? `${machineName(topM[0])} (${topM[1]} pannes)` : null,
      causes: byC,
      interventions_encore_ouvertes: interventions.filter(i=>i.status!=="done" && i.triage!=="pending").length,
      preventifs_en_retard: preventifs.filter(p=>p.active && (p.next_due<=today() || planHoursDue(p,machines))).length,
      preventifs_dus_sous_7_jours: preventifs.filter(p=>p.active && p.next_due>today() && p.next_due<=addDays(today(),7)).length,
      machines_en_mode_degrade: machines.filter(m=>m.status==="degraded").map(m=>m.name),
    };
  };
  const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const printReport = () => {
    const s = buildStats();
    const rows = [
      ["Pannes (7 derniers jours)", s.pannes_7_derniers_jours],
      ["Machine la plus touchée", s.machine_la_plus_touchee || "—"],
      ["Causes identifiées", Object.entries(s.causes).map(([k,n])=>`${k} ×${n}`).join(", ") || "—"],
      ["Interventions ouvertes", s.interventions_encore_ouvertes],
      ["Préventifs en retard", s.preventifs_en_retard],
      ["Préventifs à venir (7 j)", s.preventifs_dus_sous_7_jours],
      ["Machines en mode dégradé", s.machines_en_mode_degrade.join(", ") || "aucune"],
    ];
    const w = window.open("","_blank","width=820,height=980");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Rapport hebdo ${wk} — ${esc(org?.name||"")}</title></head>
<body style="font-family:system-ui,sans-serif;color:#1B1D21;margin:0;padding:40px 46px">
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:5px solid #FFC400;padding-bottom:16px">
    <div>
      <div style="font-family:'Arial Black',sans-serif;font-size:24px;text-transform:uppercase">${esc(org?.name||"")}</div>
      <div style="font-size:11px;color:#8A8F98;font-weight:700;text-transform:uppercase;letter-spacing:.12em;margin-top:4px">Rapport hebdomadaire maintenance · Semaine ${wk}</div>
    </div>
    ${org?.logo_url ? `<img src="${esc(org.logo_url)}" style="height:56px;max-width:180px;object-fit:contain"/>` : `<div style="font-family:'Arial Black',sans-serif;font-size:16px"><span style="color:#FFC400">▮▮</span> MAINT<span style="color:#FFC400">X</span></div>`}
  </div>
  <h2 style="font-family:'Arial Black',sans-serif;font-size:14px;text-transform:uppercase;letter-spacing:.05em;margin:28px 0 10px">Synthèse</h2>
  <p style="font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap">${esc(text||"")}</p>
  <h2 style="font-family:'Arial Black',sans-serif;font-size:14px;text-transform:uppercase;letter-spacing:.05em;margin:30px 0 10px">Chiffres de la semaine</h2>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    ${rows.map(([k,v])=>`<tr><td style="padding:9px 4px;border-bottom:1px solid #E3E5E8;font-weight:700;width:46%">${esc(k)}</td><td style="padding:9px 4px;border-bottom:1px solid #E3E5E8">${esc(v)}</td></tr>`).join("")}
  </table>
  <div style="margin-top:44px;font-size:10px;color:#8A8F98">Généré par MaintX le ${new Date().toLocaleDateString("fr-FR")} · document interne maintenance</div>
</body></html>`);
    w.document.close(); w.focus(); setTimeout(()=>w.print(), 400);
  };
  const gen = async () => {
    setBusy(true); setErr(null);
    try {
      const stats = buildStats();
      const res = await fetch(FN.brief, {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+SUPABASE_KEY,"apikey":SUPABASE_KEY},
        body:JSON.stringify({stats, org:org?.name}),
      });
      const p = await res.json();
      if (!res.ok || p.error) throw new Error(p.error||res.status);
      await db.saveWeeklyBrief(wk, p.text);
    } catch(e) { setErr("Brief momentanément indisponible, réessayez dans un instant. ("+(e.message||e)+")"); }
    setBusy(false);
  };
  return (
    <div style={{background:"#fff",borderLeft:"4px solid var(--accent)",padding:"12px 16px",marginBottom:16,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{flex:"1 1 300px"}}>
        <div style={{font:"700 10px system-ui",textTransform:"uppercase",letterSpacing:".1em",color:"var(--muted)"}}>Brief de la semaine · {wk}</div>
        {text
          ? <div style={{font:"500 13px system-ui",marginTop:4,whiteSpace:"pre-wrap"}}>{text}</div>
          : <div style={{font:"500 12px system-ui",color:"var(--muted)",marginTop:4}}>{err || "Pas encore généré cette semaine."}</div>}
      </div>
      {text && <button className="btn sm" onClick={printReport}><i className="fa-solid fa-print" aria-hidden="true"></i> PDF</button>}
      <button className="btn ghost sm" disabled={busy} onClick={gen}>{busy?"Génération…":text?"↻ Régénérer":"Générer"}</button>
    </div>
  );
}

function ChronicAlert({chroniques}) {
  const [,force] = useState(0);
  // masquable ; réapparaît si le nombre de pannes augmente (nouvelle clé)
  const visible = chroniques.filter(c=>localStorage.getItem(`mx_chronic_${c.mid}_${c.n}`)!=="1");
  if (!visible.length) return null;
  const dismiss = () => { visible.forEach(c=>localStorage.setItem(`mx_chronic_${c.mid}_${c.n}`,"1")); force(x=>x+1); };
  return (
    <div style={{background:"#FDECEA",border:"1px solid var(--alarm)",color:"var(--alarm)",padding:"12px 16px",margin:"16px 0",font:"600 13px system-ui",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <span style={{flex:1}}><i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Panne récurrente : {visible.map(c=>`${c.m?.name} (${c.n} curatifs / 90 j)`).join(", ")}</span>
      <button className="btn ghost sm" style={{borderColor:"var(--alarm)",color:"var(--alarm)"}} onClick={dismiss}>Masquer</button>
    </div>
  );
}

/* --- Temps réel (plan Connect) : la passerelle FOCAS écrit machine_events
       et le statut andon ; on re-lit les deux toutes les 10 s sans recharger
       la page, pour que le dashboard vive tout seul. --- */
function useLiveParc(machines) {
  const ids = machines.map(m=>m.id).join(",");
  const [live,setLive] = useState({statuses:null,events:[]});
  useEffect(()=>{
    if (!ids) { setLive({statuses:null,events:[]}); return; }
    let stop = false;
    const tick = async () => {
      const idList = ids.split(",");
      const [ms,ev] = await Promise.all([
        sb.from("machines").select("id,status").in("id",idList),
        sb.from("machine_events").select("machine_id,event,at,alarm_no,alarm_msg,alarm_type")
          .in("machine_id",idList).order("at",{ascending:false}).limit(40),
      ]);
      if (stop || ms.error || ev.error) return;
      setLive({statuses:Object.fromEntries(ms.data.map(r=>[r.id,r.status])), events:ev.data});
    };
    tick();
    const t = setInterval(tick, 10000);
    return ()=>{ stop=true; clearInterval(t); };
  },[ids]);
  return live;
}

function LiveAlarms({machines,statusOf,events,setView}) {
  const alarms = machines.filter(m=>statusOf(m)==="alarm")
    .map(m=>({m, e:events.find(e=>e.machine_id===m.id && e.event==="alarm")}));
  if (!alarms.length) return null;
  return (
    <div style={{background:"#FDECEA",borderLeft:"4px solid var(--alarm)",padding:"10px 16px",marginBottom:16}}>
      <div style={{font:"700 10px system-ui",textTransform:"uppercase",letterSpacing:".08em",color:"var(--alarm)",marginBottom:6}}>
        <i className="fa-solid fa-tower-broadcast" aria-hidden="true"></i> Alarmes machines — temps réel
      </div>
      {alarms.map(({m,e})=>(
        <div key={m.id} style={{display:"flex",gap:10,alignItems:"baseline",flexWrap:"wrap",padding:"4px 0",cursor:"pointer",font:"500 13px system-ui"}}
             onClick={()=>setView({name:"machine",id:m.id})}>
          <b>{m.name}</b>
          {e?.alarm_type && <span style={{font:"700 11px system-ui",background:"var(--alarm)",color:"#fff",padding:"1px 7px"}}>{e.alarm_type} {e.alarm_no}</span>}
          <span style={{flex:1}}>{e?.alarm_msg || "Panne déclarée (QR / manuel)"}</span>
          {e && <span style={{color:"var(--muted)",font:"500 11px system-ui"}}>{new Date(e.at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</span>}
        </div>
      ))}
    </div>
  );
}

function Dashboard({machines,interventions,preventifs,parts,org,kpi,machineName,db,setView}) {
  const live = useLiveParc(machines);
  const statusOf = m => (live.statuses && live.statuses[m.id]) || m.status;
  const degOver = machines.filter(m=>m.status==="degraded" && m.degraded_deadline && m.degraded_deadline<today());
  const cnt = {running:0,degraded:0,alarm:0};
  machines.forEach(m=>{ const s=statusOf(m); if(s==="running")cnt.running++; else if(s==="degraded")cnt.degraded++; else if(s==="alarm")cnt.alarm++; });
  const recent = interventions.filter(i=>i.triage!=="pending").slice(0,8);
  return <>
    {kpi.pending>0 && (
      <div style={{background:"var(--accent)",padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",cursor:"pointer"}} onClick={()=>setView({name:"interventions"})}>
        <i className="fa-solid fa-bell" style={{fontSize:18}} aria-hidden="true"></i>
        <span style={{flex:1,font:"700 14px system-ui",color:"var(--ink)"}}>
          {kpi.pending} nouvelle{kpi.pending>1?"s":""} demande{kpi.pending>1?"s":""} d'intervention à valider
        </span>
        <span className="btn sm">Voir →</span>
      </div>
    )}
    <WeeklyBrief org={org} machines={machines} interventions={interventions} preventifs={preventifs} machineName={machineName} db={db}/>
    <div style={{background:"var(--panel)",borderBottom:"3px solid var(--accent)",marginBottom:20,padding:"10px 16px 12px"}}>
      <div style={{display:"flex",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
        <span style={{font:"700 10px system-ui",textTransform:"uppercase",letterSpacing:".08em",color:"var(--muted)",flex:1}}>État du parc</span>
        {machines.length>0 && (
          <span style={{font:"600 11px system-ui",color:"var(--muted)"}}>
            {cnt.running} en marche{cnt.degraded>0?` · ${cnt.degraded} dégradé${cnt.degraded>1?"es":"e"}`:""}{cnt.alarm>0?` · `:""}
            {cnt.alarm>0 && <span style={{color:"var(--alarm)",fontWeight:700}}>{cnt.alarm} en panne</span>}
          </span>
        )}
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {machines.length===0 && <span style={{font:"500 13px system-ui",color:"var(--muted)"}}>Aucune machine — ajoutez votre parc dans « Machines ».</span>}
        {machines.map(m=>(
          <div key={m.id} className="andon" title={`${m.name} — ${STATUS[statusOf(m)].label}`} onClick={()=>setView({name:"machine",id:m.id})}>
            <span className={"lamp"+(statusOf(m)==="alarm"?" blink":"")} style={{background:STATUS[statusOf(m)].color}}/>
            <span className="andon-code">{m.code||"—"}</span>
          </div>
        ))}
      </div>
    </div>
    <LiveAlarms machines={machines} statusOf={statusOf} events={live.events} setView={setView}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
      <Kpi label="Machines en panne" value={kpi.pannes} alert={kpi.pannes>0} color="var(--alarm)"/>
      <Kpi label="Interventions ouvertes" value={kpi.ouvertes}/>
      <Kpi label="MTTR moyen" value={kpi.mttr?kpi.mttr+" min":"—"}/>
      <Kpi label="Préventifs en retard" value={kpi.retard} alert={kpi.retard>0} color="var(--warn)"/>
      <Kpi label="Pièces en stock bas" value={kpi.lowStock} alert={kpi.lowStock>0} color="var(--warn)"/>
    </div>
    {degOver.length>0 && (
      <div style={{background:"#FDECEA",border:"1px solid var(--alarm)",color:"var(--alarm)",padding:"12px 16px",margin:"16px 0 0",font:"600 13px system-ui",cursor:"pointer"}}
           onClick={()=>setView({name:"machine",id:degOver[0].id})}>
        <i className="fa-solid fa-clock" aria-hidden="true"></i> Mode dégradé dépassé : {degOver.map(m=>`${m.name} (à réparer avant le ${m.degraded_deadline})`).join(", ")} — planifiez la réparation.
      </div>
    )}
    <ChronicAlert chroniques={kpi.chroniques}/>
    <H2>Dernières interventions</H2>
    <IntTable rows={recent} machineName={machineName} db={db} parts={parts}/>
    {recent.length===0 && <Empty>Aucune intervention pour l'instant.</Empty>}
  </>;
}

