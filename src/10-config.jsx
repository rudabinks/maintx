/* ============================================================
   MaintX v0.3 — QR · Documents · Fiche machine · Préventif · Analyse
   ============================================================ */
const SUPABASE_URL = "https://krfrzuxdymgzttkdcaab.supabase.co";
const SUPABASE_KEY = "sb_publishable_KXSWUiTsFqU6aDf67rF51g_t_px3jkt";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// pdf.js : extraction du texte des PDF dans le navigateur (pour l'indexation Mécano)
if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
// URL des Edge Functions (attention : le slug est figé au déploiement, le renommage ne le change pas)
const FN = {
  voice:     SUPABASE_URL+"/functions/v1/voice-report",
  brief:     SUPABASE_URL+"/functions/v1/rapid-function",
  ask:       SUPABASE_URL+"/functions/v1/swift-api",
  directive: SUPABASE_URL+"/functions/v1/quick-function",
  // (indexation PDF : désormais côté navigateur via pdf.js, plus d'Edge Function)
};

const { useState, useEffect, useMemo, useRef } = React;

const STATUS = {
  running:{label:"En marche",color:"var(--run)"},
  stopped:{label:"Arrêtée",color:"var(--muted)"},
  maintenance:{label:"En maintenance",color:"var(--warn)"},
  degraded:{label:"Dégradé autorisé",color:"var(--accent)"},
  alarm:{label:"En panne",color:"var(--alarm)"},
};
const ITYPE = {curative:"Curatif",preventive:"Préventif",improvement:"Amélioratif"};
const ROLES = {
  operator:{label:"Opérateur",desc:"Déclare les pannes"},
  technician:{label:"Technicien",desc:"Intervient et clôture"},
  manager:{label:"Manager",desc:"KPI, config, analyse"},
};
const FAILCAUSE = {
  mecanique:{label:"Mécanique",color:"#B3541E"},
  electrique:{label:"Électrique",color:"#E8940A"},
  pneumatique:{label:"Pneumatique",color:"#2C74B3"},
  hydraulique:{label:"Hydraulique",color:"#144272"},
  cn_automatisme:{label:"CN / Automatisme",color:"#6B4FA1"},
  autre:{label:"Autre",color:"#8A8F98"},
};
const ISTATUS = {
  open:{label:"Ouverte",color:"var(--alarm)"},
  in_progress:{label:"En cours",color:"var(--warn)"},
  waiting_parts:{label:"Attente pièces",color:"var(--muted)"},
  done:{label:"Clôturée",color:"var(--run)"},
};
const CRIT = {
  1:{label:"Secondaire",desc:"Un arrêt ne bloque pas la production",color:"var(--muted)"},
  2:{label:"Importante",desc:"Un arrêt gêne la production mais reste contournable",color:"var(--warn)"},
  3:{label:"Critique",desc:"Un arrêt stoppe la production ou pose un risque sécurité",color:"var(--alarm)"},
};
const DOCCAT = {
  electrique:{label:"Électrique",color:"#B3541E"},
  pneumatique:{label:"Pneumatique",color:"#2C74B3"},
  hydraulique:{label:"Hydraulique",color:"#144272"},
  maintenance:{label:"Maintenance",color:"#1FA254"},
  autre:{label:"Autre",color:"#8A8F98"},
};
const today = () => new Date().toISOString().slice(0,10);
const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10); };
// Gamme due au compteur : la machine a dépassé last_done_hours + freq_hours
const planHoursDue = (p,machines) => {
  const m = machines.find(x=>x.id===p.machine_id);
  return !!(p.freq_hours && m && +m.meter_hours >= +p.last_done_hours + +p.freq_hours);
};
const partLow = p => +p.min_qty>0 && +p.qty<=+p.min_qty;

// Parse un CSV collé/importé → lignes {name,code,family,crit,year}
function parseMachinesCSV(text) {
  const lines = (text||"").split(/\r?\n/).filter(l=>l.trim());
  if (!lines.length) return {rows:[]};
  const cand = [";","\t",","];
  const sep = cand.map(s=>({s,n:(lines[0].split(s).length-1)})).sort((a,b)=>b.n-a.n)[0].s;
  const splitLine = l => {
    const out=[]; let cur="", q=false;
    for (let k=0;k<l.length;k++){
      const c=l[k];
      if (c==='"'){ if(q && l[k+1]==='"'){cur+='"';k++;} else q=!q; }
      else if (c===sep && !q){ out.push(cur); cur=""; }
      else cur+=c;
    }
    out.push(cur);
    return out.map(s=>s.trim());
  };
  const norm = s => (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
  const header = splitLine(lines[0]).map(norm);
  const idx = names => header.findIndex(h=>names.includes(h));
  const iName=idx(["nom","name","machine","designation","libelle","intitule"]);
  const iCode=idx(["code","reference","ref","n parc","n° parc","numero","matricule"]);
  const iFam=idx(["famille","family","type","categorie"]);
  const iCrit=idx(["criticite","criticality","crit","importance","niveau"]);
  const iYear=idx(["annee","year","mise en service","date"]);
  const hasHeader = iName>=0 || iCode>=0 || iFam>=0;
  const critVal = v => {
    const n=norm(v);
    if (n.startsWith("critique")||n==="3") return 3;
    if (n.startsWith("import")||n==="2") return 2;
    if (n.startsWith("second")||n==="1") return 1;
    const num=parseInt(v); return (num>=1&&num<=3)?num:2;
  };
  const data = hasHeader ? lines.slice(1) : lines;
  const rows = data.map(l=>{
    const c=splitLine(l), g=i=>i>=0?(c[i]||""):"";
    return hasHeader
      ? {name:g(iName)||c[0], code:g(iCode), family:g(iFam), crit:critVal(g(iCrit)), year:g(iYear)}
      : {name:c[0]||"", code:c[1]||"", family:c[2]||"", crit:critVal(c[3]), year:c[4]||""};
  }).filter(r=>r.name);
  return {rows, sep, hasHeader};
}

const isoWeek = () => {
  const d = new Date();
  const t = new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const day = t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(),0,1));
  return t.getUTCFullYear()+"-S"+String(Math.ceil((((t-y0)/864e5)+1)/7)).padStart(2,"0");
};

// Score de forme machine 0-100 (heuristique sans capteurs, façon Whoop)
function computeHealth(machine, its, plans) {
  const reasons = [];
  let score = 100;
  const now = Date.now();
  const cur30 = its.filter(i=>i.type==="curative" && now-new Date(i.reported_at)<30*864e5).length;
  const cur90 = its.filter(i=>i.type==="curative" && now-new Date(i.reported_at)<90*864e5).length;
  if (cur30>0) { const d=Math.min(36,cur30*12); score-=d; reasons.push(`${cur30} panne${cur30>1?"s":""} sur 30 jours (−${d})`); }
  const older = cur90-cur30;
  if (older>0) { const d=Math.min(12,older*4); score-=d; reasons.push(`${older} panne${older>1?"s":""} de plus sur 90 jours (−${d})`); }
  const late = plans.filter(p=>p.active && (p.next_due<=today() || planHoursDue(p,[machine]))).length;
  if (late>0) { const d=Math.min(30,late*15); score-=d; reasons.push(`${late} préventif${late>1?"s":""} en retard (−${d})`); }
  const counts = {};
  its.filter(i=>i.type==="curative" && i.failure_cause && now-new Date(i.reported_at)<90*864e5)
     .forEach(i=>{counts[i.failure_cause]=(counts[i.failure_cause]||0)+1;});
  const rec = Object.entries(counts).find(([,n])=>n>=3);
  if (rec) { score-=10; reasons.push(`cause récurrente : ${FAILCAUSE[rec[0]]?.label} ×${rec[1]} (−10)`); }
  if (machine.status==="alarm") { score-=15; reasons.push("machine actuellement en panne (−15)"); }
  if (machine.status==="degraded") { score-=8; reasons.push("en mode dégradé autorisé (−8)"); }
  score = Math.max(0, Math.min(100, score));
  return {score, reasons, color: score>=80?"var(--run)":score>=55?"var(--warn)":"var(--alarm)"};
}

