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
        <input placeholder="Mot de passe" type="password" value={pwd} onChange={e=>setPwd(e.target.value)}
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
      </div>
    </Center>
  );
}

