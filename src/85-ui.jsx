/* ------------------- Petits composants ------------------- */
function Dropdown({value,options,onChange,width,align="left",style,placeholder}) {
  const [open,setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const sel = options.find(o=>o.value===value);
  return (
    <div ref={ref} style={{position:"relative",width,...style}}>
      <button type="button" className="dd-btn" onClick={()=>setOpen(!open)}>
        {sel?.color && <span className="dd-dot" style={{background:sel.color}}/>}
        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:sel?"var(--ink)":"var(--muted)"}}>{sel?.label ?? placeholder ?? "Sélectionner…"}</span>
        <span className="dd-chev" style={open?{transform:"rotate(180deg)"}:null}>▼</span>
      </button>
      {open && (
        <div className="dd-menu" style={align==="right"?{right:0}:{left:0}}>
          {options.map(o=>(
            <button type="button" key={o.value} className={"dd-opt"+(o.value===value?" sel":"")}
                    onClick={()=>{onChange(o.value);setOpen(false);}}>
              {o.color && <span className="dd-dot" style={{background:o.color}}/>}
              <span style={{flex:1}}>
                {o.label}
                {o.sub && <span className="dd-sub">{o.sub}</span>}
              </span>
              {o.value===value && <span style={{color:"var(--accent)",fontWeight:800}}>✔</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const H2 = ({children}) => <h2 style={{fontFamily:"var(--display)",fontSize:15,textTransform:"uppercase",letterSpacing:".05em",margin:"28px 0 12px"}}>{children}</h2>;

function Foldable({title,children,defaultOpen=false}) {
  const [open,setOpen] = useState(defaultOpen);
  return (
    <div style={{marginTop:24}}>
      <button onClick={()=>setOpen(!open)}
              style={{display:"flex",alignItems:"center",gap:8,background:"transparent",border:0,cursor:"pointer",font:"700 12px system-ui",textTransform:"uppercase",letterSpacing:".06em",color:"var(--muted)",padding:"6px 0"}}>
        <span style={{display:"inline-block",transition:"transform .15s",transform:open?"rotate(90deg)":"none"}}>▶</span> {title}
      </button>
      {open && <div style={{marginTop:8}}>{children}</div>}
    </div>
  );
}
const Toolbar = ({children}) => <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>{children}</div>;
const Empty = ({children}) => <div style={{font:"500 13px system-ui",color:"var(--muted)",padding:"20px 0"}}>{children}</div>;
const Row = ({children,style}) => <div style={{background:"var(--panel)",padding:"12px 16px",display:"flex",alignItems:"center",gap:12,marginBottom:8,flexWrap:"wrap",...style}}>{children}</div>;

function Kpi({label,value,alert,color}) {
  const c = color || "var(--ink)";
  return (
    <div style={{background:"var(--panel)",padding:"16px 16px 13px",borderTop:`4px solid ${alert?c:"var(--ink)"}`}}>
      <div style={{fontFamily:"var(--display)",fontSize:30,lineHeight:1,color:alert?c:"var(--ink)"}}>{value}</div>
      <div style={{font:"600 11px system-ui",textTransform:"uppercase",letterSpacing:".07em",color:"var(--muted)",marginTop:6}}>{label}</div>
    </div>
  );
}

const PILL = {
  open:{bg:"rgba(214,59,47,.14)",fg:"#8A241B",label:"Ouverte"},
  in_progress:{bg:"rgba(232,148,10,.16)",fg:"#8A5A06",label:"En cours"},
  waiting_parts:{bg:"rgba(136,143,152,.18)",fg:"#4A4E55",label:"Attente pièces"},
  done:{bg:"rgba(31,162,84,.14)",fg:"#0F6E56",label:"Clôturée"},
};
const StatusPill = ({st}) => {
  const p = PILL[st] || {bg:"var(--bg)",fg:"var(--muted)",label:st};
  return <span style={{background:p.bg,color:p.fg,padding:"2px 8px",borderRadius:9,font:"600 11px system-ui",whiteSpace:"nowrap"}}>{p.label}</span>;
};
const prioColor = p => p===3?"var(--alarm)":p===2?"var(--warn)":"var(--muted)";
const prioLabel = p => p===3?"Critique":p===2?"Normale":"Basse";

