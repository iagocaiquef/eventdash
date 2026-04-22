import { useState, useMemo, useEffect, useCallback } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

// ═══════════════════════════════════════════════════════════════
//  ⚙️  CONFIGURAÇÃO — preencha após seguir o guia de setup
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
  CLIENT_ID: "539168919743-55kg9fqnr9jhs8b86etq0fp4o4vmuria.apps.googleusercontent.com",
  SHEET_ID:  "1wkh5Vh1sgkIpOnXBGU2U3zsj-bfYIuW_OSYDhBAV23U",
  // Aba da planilha onde ficam os lançamentos (padrão: "Lançamentos")
  SHEET_TAB: "Lançamentos",
};
// ═══════════════════════════════════════════════════════════════

const SCOPES = "https://www.googleapis.com/auth/spreadsheets.readonly";

const C = {
  bg: "#080B14", surface: "#0F1220", card: "#161A2E",
  border: "#1E2340", accent1: "#00F0C0", accent2: "#FF3D6B",
  accent3: "#7C6AF7", accent4: "#FFB547", muted: "#4A5168",
  text: "#DCE4F5", textDim: "#6B7A99",
};
const ECOLS = ["#00F0C0","#FF3D6B","#7C6AF7","#FFB547","#38BDF8","#86EFAC","#FB923C","#F472B6"];

const fmt  = v => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0}).format(v||0);
const fmtP = v => `${(v*100).toFixed(1)}%`;

function calcStats(entries) {
  const rec  = entries.filter(e=>e.cat==="Receita").reduce((s,e)=>s+e.val,0);
  const desp = entries.filter(e=>e.cat==="Despesa").reduce((s,e)=>s+e.val,0);
  return { rec, desp, res: rec-desp, margem: rec>0?(rec-desp)/rec:0 };
}

// ── Custom Tooltip ──────────────────────────────────────────────
const Tip = ({active,payload,label}) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px"}}>
      <p style={{color:C.textDim,fontSize:11,marginBottom:4}}>{label}</p>
      {payload.map((p,i)=>(
        <p key={i} style={{color:p.color,fontSize:13,fontWeight:700}}>
          {p.name}: {p.value>999?fmt(p.value):p.value}
        </p>
      ))}
    </div>
  );
};

// ── KPI Card ────────────────────────────────────────────────────
const KPI = ({label,value,sub,color,icon}) => (
  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 22px",borderTop:`3px solid ${color}`,position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:14,right:18,fontSize:24,opacity:.12}}>{icon}</div>
    <p style={{color:C.textDim,fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>{label}</p>
    <p style={{color,fontSize:24,fontWeight:800,letterSpacing:"-0.02em",lineHeight:1}}>{value}</p>
    {sub&&<p style={{color:C.muted,fontSize:11,marginTop:5}}>{sub}</p>}
  </div>
);

// ── Chart Card ──────────────────────────────────────────────────
const Card = ({title,sub,children,style={}}) => (
  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"20px 22px",...style}}>
    <p style={{fontSize:14,fontWeight:700,marginBottom:2}}>{title}</p>
    {sub&&<p style={{fontSize:11,color:C.muted,marginBottom:14}}>{sub}</p>}
    {children}
  </div>
);

// ── Setup Guide ─────────────────────────────────────────────────
const STEPS = [
  {
    num:"01", title:"Criar projeto no Google Cloud",
    items:[
      "Acesse console.cloud.google.com e faça login com sua conta Google",
      'Clique em "Selecionar projeto" (topo) → "Novo projeto"',
      'Dê o nome "EventDash" e clique em "Criar"',
    ]
  },
  {
    num:"02", title:"Ativar a API do Google Sheets",
    items:[
      'No menu lateral, vá em "APIs e serviços" → "Biblioteca"',
      'Pesquise "Google Sheets API" e clique nela',
      'Clique em "Ativar" e aguarde',
    ]
  },
  {
    num:"03", title:"Criar credenciais OAuth",
    items:[
      'Vá em "APIs e serviços" → "Credenciais"',
      'Clique em "+ Criar credenciais" → "ID do cliente OAuth"',
      'Em "Tipo de aplicativo" selecione "Aplicativo da Web"',
      'Em "Origens JavaScript autorizadas" adicione a URL onde o dashboard está hospedado (ex: https://meusite.vercel.app). Para testes locais, adicione também http://localhost:3000',
      'Clique em "Criar" — copie o Client ID gerado',
    ]
  },
  {
    num:"04", title:"Configurar a tela de consentimento",
    items:[
      'Vá em "APIs e serviços" → "Tela de consentimento OAuth"',
      'Selecione "Externo" e clique em "Criar"',
      'Preencha o nome do app ("EventDash") e seu e-mail de suporte',
      'Em "Escopos" clique em "Adicionar ou remover escopos" e adicione "../auth/spreadsheets.readonly"',
      'Em "Usuários de teste" adicione o seu próprio e-mail do Google',
      'Salve e conclua',
    ]
  },
  {
    num:"05", title:"Preparar a planilha Google Sheets",
    items:[
      'Crie uma nova planilha em sheets.google.com',
      'Renomeie a aba para "Lançamentos"',
      'Na linha 1, crie os cabeçalhos exatamente assim (uma coluna cada):',
      '→  A1: Evento  |  B1: Descrição  |  C1: Categoria  |  D1: Data  |  E1: Valor',
      'Em "Categoria" use exatamente "Receita" ou "Despesa"',
      'Copie o ID da planilha da URL: sheets.google.com/spreadsheets/d/[ESTE-TRECHO-AQUI]/edit',
    ]
  },
  {
    num:"06", title:"Inserir as credenciais no dashboard",
    items:[
      'Abra o arquivo EventDash_Sheets.jsx',
      'No topo do arquivo, localize o bloco CONFIG',
      'Cole seu Client ID no campo CLIENT_ID',
      'Cole o ID da planilha no campo SHEET_ID',
      'Salve e faça o deploy (Vercel, Netlify, etc.)',
    ]
  },
];

function SetupGuide({onClose}) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  return (
    <div style={{position:"fixed",inset:0,background:"#000000CC",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,width:"100%",maxWidth:560,overflow:"hidden"}}>
        {/* header */}
        <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:"18px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p style={{fontSize:16,fontWeight:800,color:C.accent1}}>⚙️ Guia de Configuração</p>
            <p style={{fontSize:11,color:C.muted,marginTop:2}}>Conectar com Google Sheets — {step+1} de {STEPS.length}</p>
          </div>
          <button onClick={onClose} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:8,width:32,height:32,cursor:"pointer",fontSize:14}}>✕</button>
        </div>
        {/* progress */}
        <div style={{height:3,background:C.border}}>
          <div style={{height:"100%",background:C.accent1,width:`${((step+1)/STEPS.length)*100}%`,transition:"width .3s ease"}} />
        </div>
        {/* content */}
        <div style={{padding:"24px 28px",minHeight:280}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
            <div style={{width:40,height:40,borderRadius:12,background:`${C.accent1}22`,border:`1px solid ${C.accent1}44`,display:"flex",alignItems:"center",justifyContent:"center",color:C.accent1,fontSize:13,fontWeight:800}}>{s.num}</div>
            <p style={{fontSize:17,fontWeight:800}}>{s.title}</p>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {s.items.map((item,i)=>(
              <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                <div style={{width:20,height:20,borderRadius:"50%",background:`${C.accent3}33`,border:`1px solid ${C.accent3}55`,display:"flex",alignItems:"center",justifyContent:"center",color:C.accent3,fontSize:10,fontWeight:800,flexShrink:0,marginTop:1}}>{i+1}</div>
                <p style={{fontSize:13,color:item.startsWith("→")?C.accent4:C.text,lineHeight:1.6,fontFamily:item.startsWith("→")?"'Courier New',monospace":"inherit",background:item.startsWith("→")?`${C.accent4}11`:"transparent",padding:item.startsWith("→")?"4px 8px":"0",borderRadius:6}}>{item}</p>
              </div>
            ))}
          </div>
        </div>
        {/* nav */}
        <div style={{padding:"16px 28px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",gap:10}}>
          <button onClick={()=>setStep(p=>Math.max(0,p-1))} disabled={step===0} style={{background:C.card,border:`1px solid ${C.border}`,color:step===0?C.muted:C.text,borderRadius:10,padding:"10px 20px",fontSize:13,fontWeight:600,cursor:step===0?"not-allowed":"pointer"}}>← Anterior</button>
          {step<STEPS.length-1
            ? <button onClick={()=>setStep(p=>p+1)} style={{background:C.accent1,border:"none",color:C.bg,borderRadius:10,padding:"10px 24px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Próximo →</button>
            : <button onClick={onClose} style={{background:C.accent3,border:"none",color:C.bg,borderRadius:10,padding:"10px 24px",fontSize:13,fontWeight:700,cursor:"pointer"}}>✅ Concluído!</button>
          }
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  MAIN APP
// ════════════════════════════════════════════════════════════════
export default function App() {
  const [gapiReady,  setGapiReady]  = useState(false);
  const [gisReady,   setGisReady]   = useState(false);
  const [token,      setToken]      = useState(null);
  const [rawRows,    setRawRows]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [selectedEv, setSelectedEv] = useState("all");
  const [tab,        setTab]        = useState("overview");
  const [showGuide,  setShowGuide]  = useState(false);
  const [lastSync,   setLastSync]   = useState(null);

  const configured = CONFIG.CLIENT_ID !== "SEU_CLIENT_ID_AQUI.apps.googleusercontent.com";

  // ── Load GAPI + GIS scripts ──
  useEffect(()=>{
    const gapiScript = document.createElement("script");
    gapiScript.src = "https://apis.google.com/js/api.js";
    gapiScript.onload = () => {
      window.gapi.load("client", async () => {
        await window.gapi.client.init({ discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"] });
        setGapiReady(true);
      });
    };
    document.body.appendChild(gapiScript);

    const gisScript = document.createElement("script");
    gisScript.src = "https://accounts.google.com/gsi/client";
    gisScript.onload = () => setGisReady(true);
    document.body.appendChild(gisScript);
  },[]);

  // ── OAuth login ──
  const login = useCallback(()=>{
    if (!gapiReady||!gisReady) return;
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: SCOPES,
      callback: async (resp) => {
        if (resp.error) { setError("Erro no login: " + resp.error); return; }
        setToken(resp.access_token);
        window.gapi.client.setToken({ access_token: resp.access_token });
        await fetchData();
      },
    });
    client.requestAccessToken();
  },[gapiReady, gisReady]);

  // ── Fetch sheet data ──
  const fetchData = useCallback(async()=>{
    setLoading(true);
    setError("");
    try {
      const res = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: CONFIG.SHEET_ID,
        range: `${CONFIG.SHEET_TAB}!B3:F1000`,
      });
      const rows = (res.result.values || [])
        .filter(r => r[0] && r[4])
        .map((r,i) => ({
          id: i,
          evento: r[0]?.trim() || "",
          desc:   r[1]?.trim() || "",
          cat:    r[2]?.trim() || "",
          date:   r[3]?.trim() || "",
          val: parseFloat((r[4]||"0").toString().replace(/[R$\s]/g,"").replace(/\./g,"").replace(",",".")) || 0,
        }));
      setRawRows(rows);
      setLastSync(new Date());
    } catch(e) {
      setError("Erro ao ler planilha. Verifique o ID e as permissões.");
    }
    setLoading(false);
  },[]);

  // ── Derived data ──
  const events = useMemo(()=>[...new Set(rawRows.map(r=>r.evento))],[rawRows]);

  const eventStats = useMemo(()=>
    events.map((ev,i)=>{
      const rows = rawRows.filter(r=>r.evento===ev);
      return { name:ev, color:ECOLS[i%ECOLS.length], ...calcStats(rows), count:rows.length };
    }),
  [events, rawRows]);

  const filtered = useMemo(()=>
    selectedEv==="all" ? rawRows : rawRows.filter(r=>r.evento===selectedEv),
  [rawRows, selectedEv]);

  const stats = useMemo(()=>calcStats(filtered),[filtered]);

  const pieRec  = useMemo(()=>filtered.filter(e=>e.cat==="Receita").reduce((a,e)=>{ const x=a.find(i=>i.name===e.desc); x?x.val+=e.val:a.push({name:e.desc,val:e.val}); return a; },[]),[filtered]);
  const pieDesp = useMemo(()=>filtered.filter(e=>e.cat==="Despesa").reduce((a,e)=>{ const x=a.find(i=>i.name===e.desc); x?x.val+=e.val:a.push({name:e.desc,val:e.val}); return a; },[]),[filtered]);

  const barData = eventStats.map(ev=>({
    name: ev.name.length>14 ? ev.name.slice(0,12)+"…" : ev.name,
    Receita: ev.rec, Despesa: ev.desp, Resultado: ev.res,
  }));

  const selName = selectedEv==="all" ? "Todos os Eventos" : selectedEv;

  // ════════════════════════════════════════════════════════════
  return (
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:"'DM Sans','Segoe UI',sans-serif",color:C.text,paddingBottom:60}}>

      {/* ── TOP BAR ── */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"16px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${C.accent1},${C.accent3})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🎪</div>
          <div>
            <p style={{fontSize:15,fontWeight:800,letterSpacing:"-0.02em"}}>EventDash</p>
            {lastSync && <p style={{fontSize:10,color:C.muted}}>Sincronizado {lastSync.toLocaleTimeString("pt-BR")}</p>}
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {!configured && (
            <button onClick={()=>setShowGuide(true)} style={{background:`${C.accent4}22`,border:`1px solid ${C.accent4}55`,color:C.accent4,borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              ⚙️ Configurar
            </button>
          )}
          {token && (
            <button onClick={fetchData} disabled={loading} style={{background:C.card,border:`1px solid ${C.border}`,color:C.textDim,borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
              {loading ? "⏳ Carregando…" : "🔄 Sincronizar"}
            </button>
          )}
          {!token ? (
            <button onClick={configured ? login : ()=>setShowGuide(true)} style={{background:C.accent1,border:"none",color:C.bg,borderRadius:10,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
              {configured ? "🔑 Entrar com Google" : "⚙️ Ver Tutorial"}
            </button>
          ) : (
            <div style={{display:"flex",alignItems:"center",gap:6,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"7px 14px"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:C.accent1}} />
              <p style={{fontSize:12,fontWeight:600,color:C.accent1}}>Conectado</p>
            </div>
          )}
        </div>
      </div>

      <div style={{padding:"24px 28px",maxWidth:1400,margin:"0 auto"}}>

        {/* ── NOT CONFIGURED BANNER ── */}
        {!configured && (
          <div style={{background:`${C.accent4}11`,border:`1px solid ${C.accent4}33`,borderRadius:14,padding:"18px 22px",marginBottom:24,display:"flex",gap:16,alignItems:"flex-start"}}>
            <span style={{fontSize:24}}>📋</span>
            <div style={{flex:1}}>
              <p style={{fontWeight:700,color:C.accent4,marginBottom:4}}>Dashboard ainda não configurado</p>
              <p style={{fontSize:13,color:C.textDim,lineHeight:1.6}}>Para conectar com sua planilha Google Sheets, siga o tutorial passo a passo. Você vai precisar criar um projeto gratuito no Google Cloud e configurar 2 campos no código.</p>
            </div>
            <button onClick={()=>setShowGuide(true)} style={{background:C.accent4,border:"none",color:C.bg,borderRadius:10,padding:"10px 18px",fontSize:13,fontWeight:700,cursor:"pointer",flexShrink:0}}>
              Abrir Tutorial →
            </button>
          </div>
        )}

        {/* ── ERROR ── */}
        {error && (
          <div style={{background:`${C.accent2}11`,border:`1px solid ${C.accent2}44`,borderRadius:12,padding:"14px 18px",marginBottom:20,color:C.accent2,fontSize:13}}>
            ⚠️ {error}
          </div>
        )}

        {/* ── NOT LOGGED IN STATE ── */}
        {!token && configured && (
          <div style={{textAlign:"center",padding:"80px 20px"}}>
            <div style={{fontSize:56,marginBottom:16}}>🔐</div>
            <p style={{fontSize:22,fontWeight:800,marginBottom:8}}>Faça login para carregar os dados</p>
            <p style={{color:C.textDim,fontSize:14,marginBottom:28}}>O dashboard vai ler sua planilha Google Sheets com segurança via OAuth</p>
            <button onClick={login} style={{background:C.accent1,border:"none",color:C.bg,borderRadius:12,padding:"14px 32px",fontSize:15,fontWeight:700,cursor:"pointer"}}>
              🔑 Entrar com Google
            </button>
          </div>
        )}

        {/* ── EMPTY SHEET ── */}
        {token && rawRows.length===0 && !loading && (
          <div style={{textAlign:"center",padding:"60px 20px"}}>
            <div style={{fontSize:48,marginBottom:12}}>📊</div>
            <p style={{fontSize:18,fontWeight:700,marginBottom:8}}>Planilha vazia ou sem dados</p>
            <p style={{color:C.textDim,fontSize:13,lineHeight:1.7}}>
              Certifique-se que sua planilha tem a aba <strong style={{color:C.accent1}}>"{CONFIG.SHEET_TAB}"</strong> com as colunas:<br/>
              <code style={{color:C.accent4,background:`${C.accent4}11`,padding:"2px 8px",borderRadius:4}}>Evento | Descrição | Categoria | Data | Valor</code>
            </p>
            <button onClick={fetchData} style={{marginTop:20,background:C.accent3,border:"none",color:C.bg,borderRadius:10,padding:"11px 24px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
              🔄 Tentar novamente
            </button>
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {token && rawRows.length>0 && (
          <>
            {/* Event selector */}
            <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap",alignItems:"center"}}>
              <p style={{color:C.textDim,fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginRight:4}}>Filtrar:</p>
              <Chip label="Todos" selected={selectedEv==="all"} color={C.accent3} onClick={()=>setSelectedEv("all")} />
              {eventStats.map(ev=>(
                <Chip key={ev.name} label={ev.name} selected={selectedEv===ev.name} color={ev.color}
                  sub={ev.res>=0?`✅ ${fmtP(ev.margem)}`:`⚠️ ${fmtP(ev.margem)}`}
                  onClick={()=>setSelectedEv(ev.name)} />
              ))}
            </div>

            {/* Section title */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
              <div style={{width:4,height:26,borderRadius:2,background:selectedEv==="all"?C.accent3:eventStats.find(e=>e.name===selectedEv)?.color||C.accent1}} />
              <h2 style={{fontSize:20,fontWeight:800,letterSpacing:"-0.02em"}}>{selName}</h2>
              {selectedEv!=="all" && (
                <span style={{background:stats.res>=0?"#0a2e1e":"#2e0a14",color:stats.res>=0?C.accent1:C.accent2,fontSize:11,fontWeight:700,borderRadius:20,padding:"3px 12px"}}>
                  {stats.res>=0?"✅ Lucrativo":"⚠️ Prejuízo"}
                </span>
              )}
            </div>

            {/* KPIs */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:22}}>
              <KPI label="Receita Total"    value={fmt(stats.rec)}   color={C.accent1} icon="💰" sub={`${filtered.filter(e=>e.cat==="Receita").length} lançamentos`} />
              <KPI label="Despesa Total"    value={fmt(stats.desp)}  color={C.accent2} icon="💸" sub={`${filtered.filter(e=>e.cat==="Despesa").length} lançamentos`} />
              <KPI label="Resultado"        value={fmt(stats.res)}   color={stats.res>=0?C.accent1:C.accent2} icon="📈" sub={stats.res>=0?"Saldo positivo":"Saldo negativo"} />
              <KPI label="Margem"           value={fmtP(stats.margem)} color={C.accent4} icon="🎯" sub="sobre receita" />
            </div>

            {/* Tabs */}
            <div style={{display:"flex",gap:4,marginBottom:18,background:C.surface,borderRadius:12,padding:4,width:"fit-content",border:`1px solid ${C.border}`}}>
              {[["overview","📊 Visão Geral"],["entries","📋 Lançamentos"],["compare","🔀 Comparar"]].map(([t,l])=>(
                <button key={t} onClick={()=>setTab(t)} style={{background:tab===t?C.accent3:"transparent",color:tab===t?C.bg:C.textDim,border:"none",borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all .2s"}}>{l}</button>
              ))}
            </div>

            {/* ── TAB: OVERVIEW ── */}
            {tab==="overview" && (
              <div style={{display:"flex",flexDirection:"column",gap:18}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
                  <Card title="Receita vs Despesa" sub="por evento">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={barData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                        <XAxis dataKey="name" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`}/>
                        <Tooltip content={<Tip/>}/>
                        <Legend wrapperStyle={{fontSize:12,color:C.textDim}}/>
                        <Bar dataKey="Receita" fill={C.accent1} radius={[5,5,0,0]}/>
                        <Bar dataKey="Despesa" fill={C.accent2} radius={[5,5,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                  <Card title="Resultado Líquido" sub="por evento">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                        <XAxis dataKey="name" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`}/>
                        <Tooltip content={<Tip/>}/>
                        <Bar dataKey="Resultado" radius={[5,5,0,0]}>
                          {barData.map((d,i)=><Cell key={i} fill={d.Resultado>=0?C.accent1:C.accent2}/>)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
                  <Card title="Composição de Receitas" sub={selName}>
                    {pieRec.length===0
                      ? <div style={{height:200,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontSize:13}}>Sem receitas lançadas</div>
                      : <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={pieRec} dataKey="val" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                              {pieRec.map((_,i)=><Cell key={i} fill={ECOLS[i%ECOLS.length]}/>)}
                            </Pie>
                            <Tooltip content={<Tip/>}/>
                            <Legend wrapperStyle={{fontSize:11,color:C.textDim}}/>
                          </PieChart>
                        </ResponsiveContainer>
                    }
                  </Card>
                  <Card title="Composição de Despesas" sub={selName}>
                    {pieDesp.length===0
                      ? <div style={{height:200,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontSize:13}}>Sem despesas lançadas</div>
                      : <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={pieDesp} dataKey="val" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                              {pieDesp.map((_,i)=><Cell key={i} fill={["#FF3D6B","#FF6B89","#FF8FA0","#FFAAB5","#FFC4CE"][i%5]}/>)}
                            </Pie>
                            <Tooltip content={<Tip/>}/>
                            <Legend wrapperStyle={{fontSize:11,color:C.textDim}}/>
                          </PieChart>
                        </ResponsiveContainer>
                    }
                  </Card>
                </div>
              </div>
            )}

            {/* ── TAB: LANÇAMENTOS ── */}
            {tab==="entries" && (
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"2fr 2.5fr 1fr 1fr 1fr 36px",background:C.card,padding:"12px 20px",gap:12}}>
                  {["Evento","Descrição","Categoria","Data","Valor",""].map((h,i)=>(
                    <p key={i} style={{color:C.textDim,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>{h}</p>
                  ))}
                </div>
                {filtered.map((row,i)=>{
                  const evColor = ECOLS[events.indexOf(row.evento)%ECOLS.length];
                  return (
                    <div key={row.id} style={{display:"grid",gridTemplateColumns:"2fr 2.5fr 1fr 1fr 1fr 36px",padding:"13px 20px",gap:12,borderTop:`1px solid ${C.border}`,background:i%2===0?"transparent":"#FFFFFF05",alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:7,height:7,borderRadius:"50%",background:evColor,flexShrink:0}}/>
                        <p style={{fontSize:12,color:C.textDim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.evento}</p>
                      </div>
                      <p style={{fontSize:13,fontWeight:500}}>{row.desc}</p>
                      <span style={{background:row.cat==="Receita"?"#0a2e1e":"#2e0a14",color:row.cat==="Receita"?C.accent1:C.accent2,fontSize:10,fontWeight:700,borderRadius:20,padding:"3px 10px",width:"fit-content"}}>{row.cat}</span>
                      <p style={{fontSize:12,color:C.textDim}}>{row.date}</p>
                      <p style={{fontSize:13,fontWeight:700,color:row.cat==="Receita"?C.accent1:C.accent2}}>{fmt(row.val)}</p>
                      <div/>
                    </div>
                  );
                })}
                {/* totals */}
                <div style={{display:"grid",gridTemplateColumns:"2fr 2.5fr 1fr 1fr 1fr 36px",padding:"14px 20px",gap:12,borderTop:`2px solid ${C.accent1}44`,background:C.card,alignItems:"center"}}>
                  <p style={{fontSize:11,fontWeight:700,color:C.textDim,gridColumn:"1/4"}}>TOTAL  —  {filtered.length} lançamentos</p>
                  <div/>
                  <p style={{fontSize:13,fontWeight:800,color:stats.res>=0?C.accent1:C.accent2}}>{fmt(stats.res)}</p>
                  <div/>
                </div>
              </div>
            )}

            {/* ── TAB: COMPARAR ── */}
            {tab==="compare" && (
              <div style={{display:"flex",flexDirection:"column",gap:18}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
                  {[...eventStats].sort((a,b)=>b.res-a.res).map((ev,i)=>(
                    <div key={ev.name} onClick={()=>setSelectedEv(ev.name)} style={{background:C.card,border:`1px solid ${selectedEv===ev.name?ev.color:C.border}`,borderLeft:`4px solid ${ev.color}`,borderRadius:14,padding:"18px 20px",cursor:"pointer",transition:"border-color .2s"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                        <div>
                          <span style={{background:C.bg,color:C.muted,fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 8px"}}>#{i+1}</span>
                          <p style={{fontSize:14,fontWeight:700,marginTop:5,lineHeight:1.3}}>{ev.name}</p>
                        </div>
                        <span style={{fontSize:18}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":"📊"}</span>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                        {[["Receita",fmt(ev.rec),C.accent1],["Despesa",fmt(ev.desp),C.accent2],["Resultado",fmt(ev.res),ev.res>=0?C.accent1:C.accent2],["Margem",fmtP(ev.margem),C.accent4]].map(([l,v,c])=>(
                          <div key={l}>
                            <p style={{color:C.muted,fontSize:9,marginBottom:2,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</p>
                            <p style={{color:c,fontWeight:700,fontSize:13}}>{v}</p>
                          </div>
                        ))}
                      </div>
                      <div style={{background:C.border,borderRadius:4,height:4,overflow:"hidden"}}>
                        <div style={{width:`${Math.max(0,Math.min(100,ev.margem*100))}%`,height:"100%",background:ev.color,borderRadius:4,transition:"width .6s ease"}}/>
                      </div>
                    </div>
                  ))}
                </div>
                <Card title="Comparativo Geral" sub="todos os eventos">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                      <XAxis dataKey="name" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`}/>
                      <Tooltip content={<Tip/>}/>
                      <Legend wrapperStyle={{fontSize:12,color:C.textDim}}/>
                      <Bar dataKey="Receita"   fill={C.accent1} radius={[4,4,0,0]}/>
                      <Bar dataKey="Despesa"   fill={C.accent2} radius={[4,4,0,0]}/>
                      <Bar dataKey="Resultado" fill={C.accent3} radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}
          </>
        )}
      </div>

      {showGuide && <SetupGuide onClose={()=>setShowGuide(false)}/>}
    </div>
  );
}

function Chip({label,selected,color,sub,onClick}) {
  return (
    <button onClick={onClick} style={{background:selected?color:C.card,color:selected?C.bg:C.text,border:`1px solid ${selected?color:C.border}`,borderRadius:22,padding:sub?"6px 14px":"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .2s",display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
      <span>{label}</span>
      {sub&&<span style={{fontSize:10,opacity:.8,fontWeight:500}}>{sub}</span>}
    </button>
  );
}
