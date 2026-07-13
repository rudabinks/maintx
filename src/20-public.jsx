/* ------------------------- ROOT + routing ------------------------- */
function Root() {
  const [hash,setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  // Pages publiques : #/qr/<token> (déclarer) et #/suivi/<token> (suivre) — sans compte
  const qrMatch = hash.match(/^#\/qr\/([0-9a-f-]{36})/i);
  if (qrMatch) return <QRPage token={qrMatch[1]}/>;
  const trackMatch = hash.match(/^#\/suivi\/([0-9a-f-]{36})/i);
  if (trackMatch) return <TrackPage token={trackMatch[1]}/>;
  // Pages légales (RGPD) — accessibles sans compte
  if (hash.indexOf("#/mentions-legales") === 0) return <LegalPage tab="mentions"/>;
  if (hash.indexOf("#/confidentialite") === 0) return <LegalPage tab="privacy"/>;
  return <AuthGate/>;
}

function AuthGate() {
  const [session,setSession] = useState(undefined);
  useEffect(() => {
    sb.auth.getSession().then(({data})=>setSession(data.session));
    const {data:{subscription}} = sb.auth.onAuthStateChange((_e,s)=>setSession(s));
    return () => subscription.unsubscribe();
  }, []);
  if (session === undefined) return <Center>Chargement…</Center>;
  if (!session) return <Login/>;
  return <App session={session}/>;
}

function Center({children}) {
  return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>{children}</div>;
}

/* ------------------------- ESPACE TECHNICIEN (scan QR connecté) ------------------------- */
function QRTechPanel({machine,session,onDeclare}) {
  const [profile,setProfile] = useState(null);
  const [ints,setInts] = useState(null);
  const [ntitle,setNtitle] = useState("");
  const [creating,setCreating] = useState(false);
  const load = async () => {
    const {data} = await sb.from("interventions").select("*")
      .eq("machine_id",machine.id).neq("status","done")
      .order("reported_at",{ascending:false});
    setInts(data||[]);
  };
  useEffect(() => {
    sb.from("profiles").select("*").eq("id",session.user.id).single().then(({data})=>setProfile(data));
    load();
  }, []);
  const orgId = () => (ints && ints[0]?.org_id) || profile?.org_id;
  const tdb = {
    addComment: async (iid,body) => {
      const it = (ints||[]).find(x=>x.id===iid);
      await sb.from("intervention_comments").insert({org_id:it?.org_id||orgId(),intervention_id:iid,author_id:profile?.id,body});
    },
    setInterventionCause: async (iid,cause) => { await sb.from("interventions").update({failure_cause:cause}).eq("id",iid); },
    setInterventionStatus: async (i,st) => {
      const patch = {status:st};
      if (st!=="open" && !i.acked_at) patch.acked_at = new Date().toISOString();
      if (st==="in_progress") patch.started_at = new Date().toISOString();
      if (st==="done") patch.finished_at = new Date().toISOString();
      await sb.from("interventions").update(patch).eq("id",i.id);
    },
    fetchComments: async () => [],
  };
  const createInt = async () => {
    if (!ntitle.trim()) return;
    await sb.from("interventions").insert({org_id:profile.org_id,machine_id:machine.id,type:"curative",priority:2,
      title:ntitle.trim(),reported_by:profile.id,triage:"accepted",status:"in_progress",
      started_at:new Date().toISOString(),acked_at:new Date().toISOString()});
    setNtitle(""); setCreating(false); load();
  };
  return (
    <Center>
      <div style={{background:"#fff",padding:24,width:460,maxWidth:"96vw",borderTop:"5px solid var(--accent)"}}>
        <div style={{fontFamily:"var(--display)",fontSize:18,marginBottom:2}}>
          <span style={{color:"var(--accent)"}}>▮▮</span> MAINT<span style={{color:"var(--accent)"}}>X</span>
        </div>
        <div style={{font:"600 11px system-ui",textTransform:"uppercase",letterSpacing:".1em",color:"var(--muted)",marginBottom:16}}>
          Espace technicien{profile?` · ${profile.full_name}`:""}
        </div>
        <div style={{background:"var(--bg)",padding:"12px 16px",marginBottom:18}}>
          <div style={{font:"700 10px ui-monospace,monospace",color:"var(--muted)",textTransform:"uppercase"}}>{machine.code} · {machine.family}</div>
          <div style={{fontWeight:800,fontSize:17}}>{machine.name}</div>
        </div>

        {ints === null && <div style={{font:"500 13px system-ui",color:"var(--muted)"}}>Chargement…</div>}
        {ints && ints.length===0 && <div style={{font:"500 13px system-ui",color:"var(--muted)",marginBottom:14}}>Aucune intervention ouverte sur cette machine.</div>}
        {ints && ints.map(i=>(
          <div key={i.id} style={{border:"1.5px solid #E3E5E8",padding:"12px 14px",marginBottom:12}}>
            <div style={{font:"700 14px system-ui"}}>{i.title}</div>
            <div style={{font:"500 12px system-ui",color:"var(--muted)",margin:"2px 0 10px"}}>
              {ITYPE[i.type]} · {ISTATUS[i.status]?.label} · {i.reported_at?.slice(0,10)}
              {i.triage==="pending" && <span style={{color:"var(--accent)",fontWeight:700}}> · à trier</span>}
            </div>
            <VoiceReport i={i} db={tdb} onApplied={load}/>
          </div>
        ))}

        {creating ? (
          <div style={{border:"1.5px dashed #C9CCD1",padding:"12px 14px"}}>
            <input placeholder="Titre de l'intervention (ex: Graissage glissières)" value={ntitle}
                   onChange={e=>setNtitle(e.target.value)} style={{marginBottom:8}}/>
            <div style={{display:"flex",gap:8}}>
              <button className="btn ghost sm" style={{flex:1}} onClick={()=>{setCreating(false);setNtitle("");}}>Annuler</button>
              <button className="btn sm" style={{flex:2}} disabled={!ntitle.trim()||!profile} onClick={createInt}>Créer et dicter</button>
            </div>
          </div>
        ) : (
          <button className="btn" style={{width:"100%",padding:"13px"}} onClick={()=>setCreating(true)}>+ Nouvelle intervention</button>
        )}

        <button type="button" className="btn ghost" style={{width:"100%",marginTop:12}} onClick={onDeclare}>
          Déclarer une panne (mode opérateur)
        </button>
      </div>
    </Center>
  );
}

/* ------------------------- PAGE PUBLIQUE QR ------------------------- */
function QRPage({token}) {
  const [machine,setMachine] = useState(undefined);
  const [name,setName] = useState("");
  const [desc,setDesc] = useState("");
  const [state,setState] = useState("form"); // form | sending | done | error
  const [track,setTrack] = useState(null);
  const [canRun,setCanRun] = useState(null); // true = peut tourner (dégradé), false = arrêtée (panne)
  const [rec,setRec] = useState(false);
  const recRef = useRef(null);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  useEffect(() => () => { recRef.current?.stop(); recRef.current = null; }, []); // coupe le micro au démontage
  const dictate = () => {
    if (rec) { const r=recRef.current; recRef.current=null; setRec(false); r?.stop(); return; }
    const r = new SR();
    r.lang = "fr-FR"; r.continuous = true; r.interimResults = true;
    let base = desc ? desc+" " : "";
    r.onresult = e => {
      let final = base, interim = "";
      for (let k=e.resultIndex; k<e.results.length; k++) {
        if (e.results[k].isFinal) { final += e.results[k][0].transcript + " "; base = final; }
        else interim += e.results[k][0].transcript;
      }
      setDesc((final+interim).trim());
    };
    r.onend = () => setRec(false);
    r.onerror = () => setRec(false);
    recRef.current = r; r.start(); setRec(true);
  };
  const [session,setSession] = useState(undefined);
  const [techMode,setTechMode] = useState(false); // par défaut : déclaration opérateur ; le technicien passe par un bouton dédié
  useEffect(() => { (async () => {
    const {data,error} = await sb.rpc("qr_get_machine",{qr:token});
    setMachine(error || !data?.length ? null : data[0]);
    const {data:s} = await sb.auth.getSession();
    setSession(s.session || null);
  })(); }, []);
  const [photo,setPhoto] = useState(null);
  const send = async () => {
    setState("sending");
    let path = null;
    if (photo) {
      path = `qr/${machine.id}/${Date.now()}_${photo.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      const {error:e1} = await sb.storage.from("docs").upload(path, photo);
      if (e1) path = null; // la déclaration part quand même, sans photo
    }
    const {data,error} = await sb.rpc("qr_declare",{qr:token, p_title:desc, p_name:name, p_can_run:canRun===true, p_photo:path});
    if (!error && data) setTrack(data);
    setState(error ? "error" : "done");
  };
  if (machine === undefined) return <Center>Chargement…</Center>;
  if (machine === null) return <Center><div style={{font:"600 14px system-ui",color:"var(--alarm)"}}>QR code invalide ou machine supprimée.</div></Center>;
  // Technicien connecté : espace intervention (dictée directe) au lieu de la déclaration opérateur
  if (session && techMode) return <QRTechPanel machine={machine} session={session} onDeclare={()=>setTechMode(false)}/>;
  return (
    <Center>
      <div style={{background:"#fff",padding:28,width:420,maxWidth:"94vw",borderTop:"5px solid var(--accent)"}}>
        <div style={{fontFamily:"var(--display)",fontSize:18,marginBottom:2}}>
          <span style={{color:"var(--accent)"}}>▮▮</span> MAINT<span style={{color:"var(--accent)"}}>X</span>
        </div>
        <div style={{font:"600 11px system-ui",textTransform:"uppercase",letterSpacing:".1em",color:"var(--muted)",marginBottom:20}}>
          Signaler une panne · {machine.org_name}
        </div>
        <div style={{background:"var(--bg)",padding:"12px 16px",marginBottom:18}}>
          <div style={{font:"700 10px ui-monospace,monospace",color:"var(--muted)",textTransform:"uppercase"}}>{machine.code} · {machine.family}</div>
          <div style={{fontWeight:800,fontSize:17}}>{machine.name}</div>
        </div>
        {state === "done" ? (
          <div style={{textAlign:"center",padding:"20px 0 8px"}}>
            <div style={{width:52,height:52,borderRadius:"50%",background:"var(--run)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",font:"700 28px system-ui",margin:"0 auto 12px"}}>✓</div>
            <div style={{font:"700 16px system-ui",color:"var(--run)"}}>Panne déclarée</div>
            <div style={{font:"500 13px system-ui",color:"var(--muted)",marginTop:6}}>L'équipe maintenance est prévenue.</div>
            {track && (
              <>
                <a className="btn" style={{display:"block",textAlign:"center",textDecoration:"none",marginTop:18,padding:"14px"}} href={"#/suivi/"+track}>
                  Suivre la réparation
                </a>
                <div style={{font:"500 11px system-ui",color:"var(--muted)",marginTop:8}}>
                  Gardez ce lien : il vous montre l'avancement en direct, sans compte.
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <label style={{font:"600 12px system-ui",display:"block",marginBottom:6}}>Que se passe-t-il ?</label>
            <textarea placeholder="Ex : alarme broche, fuite d'huile, bruit anormal…" rows={3}
                      value={desc} onChange={e=>setDesc(e.target.value)} style={{marginBottom:8}}/>
            {SR && (
              <button type="button" className="btn ghost sm" style={{width:"100%",marginBottom:14,...(rec?{borderColor:"var(--alarm)",color:"var(--alarm)"}:{})}} onClick={dictate}>
                {rec ? "Arrêter la dictée" : "Décrire à la voix"}
              </button>
            )}
            <label className="btn ghost sm" style={{display:"block",width:"100%",textAlign:"center",marginBottom:14,cursor:"pointer"}}>
              {photo ? "Photo ajoutée : "+(photo.name.length>22?photo.name.slice(0,22)+"…":photo.name) : "Ajouter une photo (optionnel)"}
              <input type="file" accept="image/*" capture="environment" style={{display:"none"}}
                     onChange={e=>setPhoto(e.target.files[0]||null)}/>
            </label>
            <div style={{font:"600 12px system-ui",marginBottom:6}}>La machine peut-elle encore tourner ?</div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              <button type="button" onClick={()=>setCanRun(false)}
                      style={{flex:1,padding:"12px 6px",cursor:"pointer",font:"700 13px system-ui",display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                              border:canRun===false?"2px solid var(--alarm)":"1.5px solid #D5D8DC",
                              background:canRun===false?"#FDECEA":"#fff",color:canRun===false?"var(--alarm)":"var(--ink)"}}>
                <span style={{width:12,height:12,background:"var(--alarm)",borderRadius:2,flex:"none"}}/> Non, arrêtée
              </button>
              <button type="button" onClick={()=>setCanRun(true)}
                      style={{flex:1,padding:"12px 6px",cursor:"pointer",font:"700 13px system-ui",display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                              border:canRun===true?"2px solid var(--warn)":"1.5px solid #D5D8DC",
                              background:canRun===true?"#FFF7DB":"#fff",color:"var(--ink)"}}>
                <span style={{width:12,height:12,background:"var(--warn)",borderRadius:2,flex:"none"}}/> Oui, elle tourne
              </button>
            </div>
            <input placeholder="Votre nom (optionnel)" value={name} onChange={e=>setName(e.target.value)} style={{marginBottom:14}}/>
            {state === "error" && <div style={{color:"var(--alarm)",font:"600 12px system-ui",marginBottom:10}}>Erreur d'envoi — réessayez.</div>}
            <button className="btn" style={{width:"100%",padding:"14px"}} disabled={!desc || canRun===null || state==="sending"} onClick={send}>
              {state === "sending" ? "Envoi…" : "Déclarer la panne"}
            </button>
            <div style={{borderTop:"1px solid #EEE",marginTop:18,paddingTop:12,textAlign:"center"}}>
              <a style={{font:"600 12px system-ui",color:"var(--muted)",cursor:"pointer",textDecoration:"none"}}
                 onClick={()=> session ? setTechMode(true) : (window.location.hash="")}>
                {session ? "Accéder à l'espace technicien →" : "Vous êtes technicien ? Se connecter →"}
              </a>
            </div>
          </>
        )}
      </div>
    </Center>
  );
}

/* ------------------------- PAGE PUBLIQUE SUIVI (pizza tracker) ------------------------- */
function TrackPage({token}) {
  const [t,setT] = useState(undefined);
  useEffect(() => {
    const load = async () => {
      const {data,error} = await sb.rpc("qr_track",{token});
      setT(error || !data?.length ? null : data[0]);
    };
    load();
    const iv = setInterval(load, 30000); // rafraîchit tout seul
    return () => clearInterval(iv);
  }, []);
  if (t === undefined) return <Center>Chargement…</Center>;
  if (t === null) return <Center><div style={{font:"600 14px system-ui",color:"var(--alarm)"}}>Lien de suivi invalide.</div></Center>;
  const fmt = d => d ? d.slice(0,16).replace("T"," à ") : null;
  const seen = !!(t.acked_at || t.started_at || ["in_progress","waiting_parts","done"].includes(t.status));
  const steps = [
    {label:"Panne déclarée", done:true, at:fmt(t.reported_at), desc:"L'équipe maintenance est prévenue."},
    {label:"Prise en compte", done:seen, at:fmt(t.acked_at), desc:"Le technicien a vu votre signalement, la réparation sera planifiée."},
    t.status==="waiting_parts"
      ? {label:"En attente de pièces", done:true, at:null, desc:"La réparation reprendra à réception des pièces."}
      : {label:"Réparation en cours", done:t.status==="in_progress"||t.status==="done"||!!t.started_at, at:fmt(t.started_at), desc:"Un technicien est sur la machine."},
    {label:"Machine réparée", done:t.status==="done", at:fmt(t.finished_at), desc:"C'est terminé, merci d'avoir prévenu !"},
  ];
  return (
    <Center>
      <div style={{background:"#fff",padding:28,width:420,maxWidth:"94vw",borderTop:"5px solid var(--accent)"}}>
        <div style={{fontFamily:"var(--display)",fontSize:18,marginBottom:2}}>
          <span style={{color:"var(--accent)"}}>▮▮</span> MAINT<span style={{color:"var(--accent)"}}>X</span>
        </div>
        <div style={{font:"600 11px system-ui",textTransform:"uppercase",letterSpacing:".1em",color:"var(--muted)",marginBottom:18}}>
          Suivi de réparation
        </div>
        <div style={{background:"var(--bg)",padding:"12px 16px",marginBottom:20}}>
          <div style={{font:"700 10px ui-monospace,monospace",color:"var(--muted)",textTransform:"uppercase"}}>{t.machine_code||"—"}</div>
          <div style={{fontWeight:800,fontSize:16}}>{t.machine_name}</div>
          <div style={{font:"500 13px system-ui",color:"var(--muted)",marginTop:4}}>{t.title}</div>
        </div>
        {steps.map((s,k)=>(
          <div key={k} style={{display:"flex",gap:14,alignItems:"flex-start",paddingBottom:k<steps.length-1?22:0,position:"relative"}}>
            {k<steps.length-1 && <div style={{position:"absolute",left:7,top:36,bottom:0,width:2,background:s.done?"var(--run)":"#D5D8DC"}}/>}
            <span className={"lamp"+(!s.done&&k===steps.findIndex(x=>!x.done)?" blink":"")}
                  style={{background:s.done?"var(--run)":"#D5D8DC",width:16,height:34,flexShrink:0}}/>
            <div>
              <div style={{font:s.done?"800 15px system-ui":"600 15px system-ui",color:s.done?"var(--ink)":"var(--muted)"}}>{s.label}</div>
              {s.at && <div style={{font:"500 12px system-ui",color:"var(--muted)"}}>{s.at}</div>}
              {s.done && <div style={{font:"500 12px system-ui",color:"var(--muted)",marginTop:2}}>{s.desc}</div>}
            </div>
          </div>
        ))}
        <div style={{font:"500 11px system-ui",color:"var(--muted)",marginTop:22,textAlign:"center"}}>
          Cette page se met à jour automatiquement.
        </div>
      </div>
    </Center>
  );
}

/* ------------------------- LOGIN ------------------------- */
function Login() {
  const [mode,setMode] = useState("login"); // login | signup
  const [email,setEmail] = useState("");
  const [pwd,setPwd] = useState("");
  const [name,setName] = useState("");
  const [company,setCompany] = useState("");
  const [err,setErr] = useState(null);
  const [busy,setBusy] = useState(false);
  const [signedUp,setSignedUp] = useState(false);
  const go = async () => {
    setBusy(true); setErr(null);
    const {error} = await sb.auth.signInWithPassword({email, password:pwd});
    if (error) setErr("Identifiants incorrects ou compte inexistant.");
    setBusy(false);
  };
  const register = async () => {
    if (pwd.length < 8) { setErr("Le mot de passe doit faire au moins 8 caractères."); return; }
    setBusy(true); setErr(null);
    const {error} = await sb.auth.signUp({email, password:pwd,
      options:{data:{full_name:name, requested_org:company}}});
    if (error) setErr(error.message.includes("registered") ? "Un compte existe déjà avec cet email." : error.message);
    else setSignedUp(true);
    setBusy(false);
  };
  if (signedUp) return (
    <Center>
      <div style={{background:"#fff",padding:32,width:400,maxWidth:"94vw",borderTop:"5px solid var(--accent)",textAlign:"center"}}>
        <div style={{fontSize:40}}>✓</div>
        <div style={{font:"800 17px system-ui",marginTop:4}}>Demande envoyée</div>
        <div style={{font:"500 13px system-ui",color:"var(--muted)",margin:"10px 0 18px"}}>
          Votre compte est en attente de validation par MaintX. Vous pourrez vous connecter une fois qu'il aura été autorisé.
        </div>
        <button className="btn" style={{width:"100%"}} onClick={()=>{setMode("login");setSignedUp(false);}}>Retour à la connexion</button>
      </div>
    </Center>
  );
  return (
    <Center>
      <div style={{background:"#fff",padding:32,width:380,maxWidth:"94vw",borderTop:"5px solid var(--accent)"}}>
        <div style={{fontFamily:"var(--display)",fontSize:24,marginBottom:4}}>
          <span style={{color:"var(--accent)"}}>▮▮</span> MAINT<span style={{color:"var(--accent)"}}>X</span>
        </div>
        <div style={{font:"600 11px system-ui",textTransform:"uppercase",letterSpacing:".1em",color:"var(--muted)",marginBottom:24}}>
          GMAO · {mode==="login"?"Connexion":"Créer un compte"}
        </div>
        {mode==="signup" && <>
          <input placeholder="Nom et prénom" value={name} onChange={e=>setName(e.target.value)} style={{marginBottom:10}}/>
          <input placeholder="Nom de votre entreprise" value={company} onChange={e=>setCompany(e.target.value)} style={{marginBottom:10}}/>
        </>}
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={{marginBottom:10}}/>
        <input placeholder={mode==="signup" ? "Mot de passe (8 caractères min.)" : "Mot de passe"} type="password" value={pwd} onChange={e=>setPwd(e.target.value)}
               onKeyDown={e=>e.key==="Enter"&&(mode==="login"?go():register())} style={{marginBottom:14}}/>
        {err && <div style={{color:"var(--alarm)",font:"600 12px system-ui",marginBottom:12}}>{err}</div>}
        {mode==="login" ? (
          <button className="btn" style={{width:"100%"}} disabled={busy||!email||!pwd} onClick={go}>{busy?"Connexion…":"Se connecter"}</button>
        ) : (
          <button className="btn" style={{width:"100%"}} disabled={busy||!email||!pwd||!name} onClick={register}>{busy?"Envoi…":"Créer mon compte"}</button>
        )}
        <div style={{font:"500 12px system-ui",color:"var(--muted)",marginTop:16,textAlign:"center"}}>
          {mode==="login" ? (
            <>Pas encore de compte ? <a style={{color:"var(--ink)",fontWeight:700,cursor:"pointer"}} onClick={()=>{setMode("signup");setErr(null);}}>Créer un compte</a></>
          ) : (
            <>Déjà un compte ? <a style={{color:"var(--ink)",fontWeight:700,cursor:"pointer"}} onClick={()=>{setMode("login");setErr(null);}}>Se connecter</a></>
          )}
        </div>
        <div style={{font:"500 11px system-ui",color:"var(--muted)",marginTop:20,paddingTop:14,borderTop:"1px solid #E3E5E8",textAlign:"center"}}>
          <a href="#/mentions-legales" style={{color:"var(--muted)"}}>Mentions légales</a>
          <span style={{margin:"0 8px"}}>·</span>
          <a href="#/confidentialite" style={{color:"var(--muted)"}}>Confidentialité (RGPD)</a>
        </div>
      </div>
    </Center>
  );
}

/* ------------------------- PAGES LÉGALES (RGPD) ------------------------- */
function LegalPage({tab}) {
  const back = () => { window.location.hash = ""; };
  return (
    <div style={{minHeight:"100vh",background:"var(--bg)"}}>
      <div style={{background:"var(--ink)",padding:"14px 20px",display:"flex",alignItems:"center",gap:12}}>
        <a href="#" onClick={e=>{e.preventDefault();back();}} style={{fontFamily:"var(--display)",fontSize:20,color:"#fff",textDecoration:"none"}}>
          <span style={{color:"var(--accent)"}}>▮▮</span> MAINT<span style={{color:"var(--accent)"}}>X</span>
        </a>
        <a href="#" onClick={e=>{e.preventDefault();back();}} style={{marginLeft:"auto",color:"#C9CCD1",font:"600 12px system-ui",textDecoration:"none"}}>← Retour</a>
      </div>
      <div style={{display:"flex",gap:6,padding:"14px 20px 0",maxWidth:820,margin:"0 auto"}}>
        <a href="#/mentions-legales" className="tab" style={{textDecoration:"none",...(tab==="mentions"?{color:"var(--ink)",borderBottom:"3px solid var(--accent)"}:{})}}>Mentions légales</a>
        <a href="#/confidentialite" className="tab" style={{textDecoration:"none",...(tab==="privacy"?{color:"var(--ink)",borderBottom:"3px solid var(--accent)"}:{})}}>Confidentialité (RGPD)</a>
      </div>
      <div style={{maxWidth:820,margin:"0 auto",padding:"18px 20px 60px"}}>
        <div className="card" style={{padding:"26px 30px",lineHeight:1.6,font:"400 14px/1.6 system-ui",color:"var(--ink)"}}>
          {tab==="mentions" ? <LegalMentionsBody/> : <PrivacyBody/>}
        </div>
        <div style={{textAlign:"center",marginTop:16,font:"500 11px system-ui",color:"var(--muted)"}}>
          Dernière mise à jour : {LEGAL.updated}
        </div>
      </div>
    </div>
  );
}

function H({children}) { return <h2 style={{font:"800 16px system-ui",textTransform:"uppercase",letterSpacing:".03em",margin:"26px 0 8px",color:"var(--ink)"}}>{children}</h2>; }

function LegalMentionsBody() {
  return (
    <div>
      <h1 style={{font:"800 22px system-ui",textTransform:"uppercase",margin:"0 0 6px"}}>Mentions légales</h1>
      <p style={{color:"var(--muted)",marginTop:0}}>Conformément aux articles 6-III et 19 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN).</p>

      <H>Éditeur du site</H>
      <p>
        Le site <strong>{LEGAL.site}</strong> est édité à titre {LEGAL.editor.statut ? "professionnel" : "personnel"} par :<br/>
        <strong>{LEGAL.editor.name}</strong>{LEGAL.editor.statut ? " — "+LEGAL.editor.statut : ""}<br/>
        {LEGAL.editor.address ? <>{LEGAL.editor.address}<br/></> : null}
        {LEGAL.editor.siret ? <>SIRET : {LEGAL.editor.siret}<br/></> : null}
        {LEGAL.editor.tva ? <>N° TVA intracommunautaire : {LEGAL.editor.tva}<br/></> : null}
        E-mail : <a href={"mailto:"+LEGAL.editor.email}>{LEGAL.editor.email}</a>
        {LEGAL.editor.phone ? <><br/>Téléphone : {LEGAL.editor.phone}</> : null}
      </p>

      <H>Directeur de la publication</H>
      <p>{LEGAL.editor.name}</p>

      <H>Hébergement</H>
      <p>
        <strong>Toutes les données clients</strong> (comptes, machines, interventions, documents, photos) <strong>sont hébergées dans l'Union européenne</strong>, sur l'infrastructure Supabase (base de données, authentification, stockage) :<br/>
        Supabase Inc., 970 Toa Payoh North, Singapour — serveurs situés dans l'Union européenne.
      </p>
      <p>
        La diffusion des pages du site (fichiers statiques : interface et code uniquement, <strong>ne contenant aucune donnée client</strong>) est assurée par :<br/>
        GitHub Pages — GitHub Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis.
      </p>

      <H>Propriété intellectuelle</H>
      <p>L'ensemble des contenus (structure, textes, interface, logo, code) présents sur {LEGAL.site} est la propriété exclusive de l'éditeur, sauf mentions contraires. Toute reproduction sans autorisation est interdite.</p>

      <H>Contact</H>
      <p>Pour toute question : <a href={"mailto:"+LEGAL.editor.email}>{LEGAL.editor.email}</a>.</p>
    </div>
  );
}

function PrivacyBody() {
  return (
    <div>
      <h1 style={{font:"800 22px system-ui",textTransform:"uppercase",margin:"0 0 6px"}}>Politique de confidentialité</h1>
      <p style={{color:"var(--muted)",marginTop:0}}>Traitement des données personnelles conformément au Règlement (UE) 2016/679 (RGPD) et à la loi Informatique et Libertés.</p>

      <H>1. Responsable du traitement</H>
      <p>{LEGAL.editor.name}, éditeur de {LEGAL.site}. Contact : <a href={"mailto:"+LEGAL.editor.email}>{LEGAL.editor.email}</a>.</p>

      <H>2. Données collectées</H>
      <p>Dans le cadre de l'utilisation de la GMAO MaintX, sont traitées :</p>
      <ul>
        <li><strong>Compte utilisateur</strong> : nom, prénom, adresse e-mail, mot de passe (chiffré), rôle, entreprise de rattachement.</li>
        <li><strong>Données d'exploitation</strong> : interventions, commentaires, photos, historique d'activité liés au compte.</li>
        <li><strong>Données techniques</strong> : jeton de session (stocké dans le navigateur), horodatages de connexion.</li>
      </ul>

      <H>3. Finalités et base légale</H>
      <ul>
        <li>Fournir le service de GMAO (gestion de maintenance) — <em>exécution du contrat</em> (art. 6.1.b).</li>
        <li>Authentifier et sécuriser les accès — <em>intérêt légitime</em> (art. 6.1.f).</li>
        <li>Envoyer les notifications liées au service (ex. affectation d'intervention) — <em>exécution du contrat</em>.</li>
      </ul>

      <H>4. Destinataires et sous-traitants</H>
      <p>Les données ne sont jamais vendues. Elles sont accessibles à l'éditeur et aux sous-traitants techniques suivants :</p>
      <ul>
        <li><strong>Supabase</strong> — hébergement base de données, authentification, stockage des fichiers (UE).</li>
        <li><strong>Resend</strong> — envoi des e-mails transactionnels (notifications). Des garanties de transfert (clauses contractuelles types) s'appliquent le cas échéant.</li>
        <li><strong>GitHub Pages</strong> — diffusion des pages web (fichiers statiques uniquement, aucune donnée personnelle applicative).</li>
      </ul>

      <H>5. Isolation des données (multi-tenant)</H>
      <p>Chaque organisation cliente dispose d'un espace isolé. Les règles de sécurité au niveau base de données (RLS) garantissent qu'un utilisateur n'accède qu'aux données de son organisation.</p>

      <H>6. Durée de conservation</H>
      <p>Les données sont conservées pendant toute la durée de la relation contractuelle, puis supprimées ou anonymisées dans un délai de 3 ans après la fin du contrat, sauf obligation légale contraire.</p>

      <H>7. Vos droits</H>
      <p>Conformément au RGPD, vous disposez des droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos données. Pour les exercer : <a href={"mailto:"+LEGAL.editor.email}>{LEGAL.editor.email}</a>.</p>
      <p>Vous pouvez introduire une réclamation auprès de la <strong>CNIL</strong> (<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>).</p>

      <H>8. Cookies et traceurs</H>
      <p>{LEGAL.site} <strong>n'utilise aucun cookie publicitaire ni de mesure d'audience</strong>. Seul un jeton de session strictement nécessaire au fonctionnement (connexion) est stocké dans votre navigateur ; il ne requiert pas de consentement au sens de l'article 82 de la loi Informatique et Libertés.</p>

      <H>9. Sécurité</H>
      <p>Les échanges sont chiffrés (HTTPS/TLS). Les mots de passe sont stockés sous forme chiffrée. L'accès aux données est cloisonné par organisation.</p>
    </div>
  );
}

