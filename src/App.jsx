import { useState, useMemo, useEffect, useCallback } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from "recharts";

const CONFIG = {
 CLIENT_ID: "539168919743-55kg9fqnr9jhs8b86etq0fp4o4vmuria.apps.googleusercontent.com",
SHEET_ID:  "1wkh5Vh1sgkIpOnXBGU2U3zsj-bfYIuW_OSYDhBAV23U",
  SHEET_TAB: "Lançamentos",
};

const SCOPES = "https://www.googleapis.com/auth/spreadsheets.readonly";

// Cole aqui a URL da sua logo (pode ser um link do Google Drive, Imgur, etc.)
const LOGO_URL = "https://i.imgur.com/cGuKQVH.png";

function exportPDF(selName, stats, filtered, selectedVisao, fmt, fmtP, fmtN) {
  const style = `
    body { font-family: Arial, sans-serif; color: #1a1a2e; padding: 32px; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .sub { color: #666; font-size: 13px; margin-bottom: 28px; }
    .badge { display: inline-block; padding: 3px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-left: 8px; }
    .ev { background: #e0f0ff; color: #185fa5; }
    .art { background: #fce4f4; color: #a0297e; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
    .card { border: 1px solid #dde; border-radius: 12px; padding: 16px 20px; }
    .card-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #888; margin-bottom: 6px; }
    .card-val { font-size: 22px; font-weight: 800; }
    .green { color: #0e7a4a; } .red { color: #c0192e; } .blue { color: #185fa5; } .amber { color: #b07010; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f0f4ff; text-align: left; padding: 8px 12px; border-bottom: 2px solid #dde; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) td { background: #fafbff; }
    .footer { margin-top: 32px; font-size: 11px; color: #aaa; text-align: center; }
  `;
  const visaoBadge = selectedVisao === "Artista"
    ? '<span class="badge art"> Artista</span>'
    : '<span class="badge ev"> Evento</span>';
  const recRows = filtered.filter(e => e.cat === "Receita");
  const despRows = filtered.filter(e => e.cat === "Despesa");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório — ${selName}</title><style>${style}</style></head><body>
    <h1>${selName} ${visaoBadge}</h1>
    <p class="sub">Gerado em ${new Date().toLocaleString("pt-BR")} · Ao Vivão</p>
    <div class="grid">
      <div class="card"><div class="card-label">Receita Total</div><div class="card-val green">${fmt(stats.rec)}</div></div>
      <div class="card"><div class="card-label">Despesa Total</div><div class="card-val red">${fmt(stats.desp)}</div></div>
      <div class="card"><div class="card-label">Resultado</div><div class="card-val ${stats.res >= 0 ? "green" : "red"}">${fmt(stats.res)}</div></div>
      <div class="card"><div class="card-label">Margem</div><div class="card-val amber">${fmtP(stats.marg)}</div></div>
      <div class="card"><div class="card-label">Público Total</div><div class="card-val blue">${fmtN(stats.pub)}</div></div>
      <div class="card"><div class="card-label">Ticket Médio</div><div class="card-val blue">${fmt(stats.ticket)}</div></div>
      <div class="card"><div class="card-label">Custo por Pessoa</div><div class="card-val red">${fmt(stats.cppub)}</div></div>
      <div class="card"><div class="card-label">ROI</div><div class="card-val ${stats.res >= 0 ? "green" : "red"}">${stats.desp > 0 ? ((stats.res/stats.desp)*100).toFixed(0)+"%" : "—"}</div></div>
    </div>
    <h2 style="font-size:16px;margin-bottom:12px"> Lançamentos (${filtered.length})</h2>
    <table>
      <thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th style="text-align:right">Valor</th></tr></thead>
      <tbody>
        ${filtered.map(r => `<tr><td>${r.desc}</td><td>${r.cat}</td><td>${r.date}</td><td style="text-align:right;font-weight:700;color:${r.cat==="Receita"?"#0e7a4a":"#c0192e"}">${fmt(r.val)}</td></tr>`).join("")}
        <tr style="font-weight:800"><td colspan="3">RESULTADO</td><td style="text-align:right;color:${stats.res>=0?"#0e7a4a":"#c0192e"}">${fmt(stats.res)}</td></tr>
      </tbody>
    </table>
    <p class="footer">Ao Vivão · Dashboard de Performance · ${new Date().getFullYear()}</p>
  </body></html>`;
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 800);
}

const C = {
  bg:"#000000",surface:"#1C1C1E",card:"#2C2C2E",border:"#3A3A3C",
  accent1:"#30D158",accent2:"#FF453A",accent3:"#636366",accent4:"#FFD60A",accent5:"#0A84FF",accent6:"#BF5AF2",
  brand:"#560E11",gold:"#FFB100",cream:"#F3D398",
  muted:"#8E8E93",text:"#F2F2F7",textDim:"#8E8E93",
};
const ECOLS=["#0A84FF","#30D158","#FFD60A","#FF9F0A","#BF5AF2","#FF375F","#5AC8FA","#64D2FF"];

const fmt  = v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0}).format(v||0);
const fmtN = v=>new Intl.NumberFormat("pt-BR").format(v||0);
const fmtP = v=>`${(v*100).toFixed(1)}%`;
const fmtK = v=>v>=1000?`${(v/1000).toFixed(1)}k`:String(v||0);

function calcStats(entries,publicoMap){
  const rec  = entries.filter(e=>e.cat==="Receita").reduce((s,e)=>s+e.val,0);
  const desp = entries.filter(e=>e.cat==="Despesa").reduce((s,e)=>s+e.val,0);
  const res  = rec-desp;
  const marg = rec>0?res/rec:0;
  const eventos=[...new Set(entries.map(e=>e.evento))];
  const pub=eventos.reduce((s,ev)=>s+(publicoMap[ev]||0),0);
  const ticket=pub>0?rec/pub:0;
  const cppub =pub>0?desp/pub:0;
  return{rec,desp,res,marg,pub,ticket,cppub};
}

const Tip=({active,payload,label,totalRec})=>{
  if(!active||!payload?.length)return null;
  return(
    <div style={{background:"#2C2C2E",border:"1px solid #3A3A3C",borderRadius:10,padding:"10px 14px"}}>
      <p style={{color:C.textDim,fontSize:11,marginBottom:4}}>{label}</p>
      {payload.map((p,i)=>{
        const isRec=p.dataKey==="Receita"||p.dataKey==="val";
        const pct=isRec&&totalRec>0?` (${((p.value/totalRec)*100).toFixed(1)}%)`:"";
        return(
          <p key={i} style={{color:p.color,fontSize:13,fontWeight:700}}>
            {p.name}: {typeof p.value==="number"&&p.value>999?fmt(p.value):fmtN(p.value)}{pct}
          </p>
        );
      })}
    </div>
  );
};

const KPI=({label,value,sub,color,icon,small})=>(
  <div style={{background:"#1C1C1E",border:"1px solid #3A3A3C",borderRadius:14,padding:"16px 20px",borderTop:`3px solid ${color}`,boxShadow:"0 2px 12px rgba(0,0,0,0.3)",position:"relative",overflow:"hidden"}}>
        <p style={{color:"#8E8E93",fontSize:10,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>{label}</p>
    <p style={{color,fontSize:small?18:22,fontWeight:800,letterSpacing:"-0.02em",lineHeight:1}}>{value}</p>
    {sub&&<p style={{color:"#8E8E93",fontSize:11,marginTop:4}}>{sub}</p>}
  </div>
);

const Card=({title,sub,children,style={}})=>(
  <div style={{background:"#1C1C1E",border:"1px solid #3A3A3C",borderRadius:16,padding:"20px 22px",...style}}>
    <p style={{fontSize:14,fontWeight:600,marginBottom:2,color:"#F2F2F7"}}>{title}</p>
    {sub&&<p style={{fontSize:11,color:"#8E8E93",marginBottom:14}}>{sub}</p>}
    {children}
  </div>
);

const Chip=({label,selected,color,sub,onClick})=>(
  <button onClick={onClick} style={{background:selected?`${color}18`:"#2C2C2E",color:selected?color:"#8E8E93",border:`1.5px solid ${selected?color:"#3A3A3C"}`,borderRadius:8,padding:"0 14px",fontSize:12,fontWeight:500,cursor:"pointer",transition:"all .15s",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",whiteSpace:"nowrap",height:sub?"44px":"36px",minWidth:"72px",letterSpacing:"0.01em"}}>
    <span style={{lineHeight:1.2}}>{label}</span>
    {sub&&<span style={{fontSize:10,opacity:.7,fontWeight:400,lineHeight:1.2}}>{sub}</span>}
  </button>
);

const FL = {row:"flex",alignItems:"center",gap:0,marginBottom:8};
const FLast = {row:"flex",alignItems:"flex-start",gap:0,borderTop:"1px solid #2C2C2E",paddingTop:8,marginTop:4};
const FL_label = {color:"#636366",fontSize:10,fontWeight:500,letterSpacing:"0.08em",textTransform:"uppercase",width:64,flexShrink:0};

function FilterRow({label,children,last}){
  return(
    <div style={{display:"flex",alignItems:last?"flex-start":"center",gap:0,marginBottom:last?0:8,borderTop:last?"1px solid #2C2C2E":"none",paddingTop:last?8:0,marginTop:last?4:0}}>
      <span style={{color:"#636366",fontSize:10,fontWeight:500,letterSpacing:"0.08em",textTransform:"uppercase",width:64,flexShrink:0,paddingTop:last?6:0}}>{label}</span>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{children}</div>
    </div>
  );
}

function FBtn({label,sel,color,onClick}){
  return(
    <button onClick={onClick} style={{height:32,padding:"0 16px",borderRadius:7,border:`1.5px solid ${sel?color:"#3A3A3C"}`,background:sel?`${color}20`:"transparent",color:sel?color:"#636366",fontSize:12,fontWeight:sel?600:400,cursor:"pointer",transition:"all .15s",whiteSpace:"nowrap",minWidth:64,letterSpacing:"0.01em"}}>
      {label}
    </button>
  );
}

export default function App(){
  const[gapiReady,setGapiReady]=useState(false);
  const[gisReady,setGisReady]=useState(false);
  const[token,setToken]=useState(null);
  const[rawRows,setRawRows]=useState([]);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState("");
  const[selectedEv,setSelectedEv]=useState("all");
  const[tab,setTab]=useState("overview");
  const[lastSync,setLastSync]=useState(null);
  const[selectedAno,setSelectedAno]=useState("all");
  const[selectedTipo,setSelectedTipo]=useState("all");
  const[selectedVisao,setSelectedVisao]=useState("Evento");

  const configured=CONFIG.CLIENT_ID!=="SEU_CLIENT_ID_AQUI.apps.googleusercontent.com";

  useEffect(()=>{
    const s1=document.createElement("script");
    s1.src="https://apis.google.com/js/api.js";
    s1.onload=()=>window.gapi.load("client",async()=>{
      await window.gapi.client.init({discoveryDocs:["https://sheets.googleapis.com/$discovery/rest?version=v4"]});
      setGapiReady(true);
    });
    document.body.appendChild(s1);
    const s2=document.createElement("script");
    s2.src="https://accounts.google.com/gsi/client";
    s2.onload=()=>setGisReady(true);
    document.body.appendChild(s2);
  },[]);

  const login=useCallback(()=>{
    if(!gapiReady||!gisReady)return;
    const client=window.google.accounts.oauth2.initTokenClient({
      client_id:CONFIG.CLIENT_ID,scope:SCOPES,
      callback:async(resp)=>{
        if(resp.error){setError("Erro no login: "+resp.error);return;}
        setToken(resp.access_token);
        window.gapi.client.setToken({access_token:resp.access_token});
        await fetchData();
      },
    });
    client.requestAccessToken();
  },[gapiReady,gisReady]);

  const fetchData=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const res=await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId:CONFIG.SHEET_ID,
        range:`${CONFIG.SHEET_TAB}!B3:I1000`,
      });
      const rows=(res.result.values||[])
        .filter(r=>r[0]&&(r[4]||r[6]))
        .map((r,i)=>({
          id:i,
          evento:r[0]?.trim()||"",
          desc:  r[1]?.trim()||"",
          cat:   r[2]?.trim()||"",
          date:  r[3]?.trim()||"",
          val:   parseFloat((r[4]||"0").toString().replace(/[R$\s]/g,"").replace(/\./g,"").replace(",","."))||0,
          publico:Math.round(parseFloat((r[5]||"0").toString().replace(/[R$\s]/g,"").replace(/\.(\d{3})/g,"$1").replace(",","."))||0),
          artista:parseFloat((r[6]||"0").toString().replace(/[R$\s]/g,"").replace(/\.(\d{3})/g,"$1").replace(",","."))||0,
        }));
      setRawRows(rows);
      setLastSync(new Date());
    }catch(e){setError("Erro ao ler planilha. Verifique o ID e as permissões.");}
    setLoading(false);
  },[]);

  const publicoMap=useMemo(()=>{
    const map={};
    rawRows.forEach(r=>{if(r.publico>0)map[r.evento]=(map[r.evento]||0)+r.publico;});
    return map;
  },[rawRows]);

  const events=useMemo(()=>[...new Set(rawRows.map(r=>r.evento))],[rawRows]);

  const eventStats=useMemo(()=>
    events.map((ev,i)=>{
      const rows=rawRows.filter(r=>r.evento===ev);
      const stats=calcStats(rows,publicoMap);
      const dates=rows.map(r=>r.date).filter(Boolean);
      const date=dates[0]||"";
      // Extract year from each row and use the most common year
      const years=rows.map(r=>{
        const d=r.date||"";
        return d.includes("/")?d.split("/")[2]:d.includes("-")?d.split("-")[0]:"";
      }).filter(Boolean);
      const yearCounts=years.reduce((a,y)=>{a[y]=(a[y]||0)+1;return a;},{});
      const year=Object.entries(yearCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||"";
      const norm=s=>(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
      const temCache=rows.some(r=>norm(r.desc).includes("cache"));
      const temPorta=rows.some(r=>norm(r.desc).includes("venda de ingresso"));
      const tipo=temPorta?"porta":temCache?"cache":"porta";
      return{...stats,name:ev,color:ECOLS[i%ECOLS.length],count:rows.length,date,year,tipo};
    }),
  [events,rawRows,publicoMap]);

  const anos=useMemo(()=>[...new Set(eventStats.map(e=>e.year).filter(Boolean))].sort(),[eventStats]);
  const eventStatsVisao=useMemo(()=>
    events.map((ev,i)=>{
      const rows=selectedVisao==="Artista"
        ? rawRows.filter(r=>r.evento===ev&&r.artista>0).map(r=>({...r,val:r.artista}))
        : rawRows.filter(r=>r.evento===ev);
      const s=calcStats(rows,publicoMap);
      const base=eventStats.find(e=>e.name===ev)||{};
      return{...base,...s,tipo:base.tipo||"porta"};
    }),
  [events,rawRows,publicoMap,selectedVisao,eventStats]);

  const filtered=useMemo(()=>{
    let rows=rawRows;
    if(selectedAno!=="all") rows=rows.filter(r=>{const y=r.date?.includes("/")?r.date.split("/")[2]:r.date?.includes("-")?r.date.split("-")[0]:"";return y===selectedAno;});
    const evOk=new Set(eventStatsVisao.filter(e=>selectedTipo==="all"||e.tipo===selectedTipo).map(e=>e.name));
    rows=rows.filter(r=>evOk.has(r.evento));
    if(selectedEv!=="all") rows=rows.filter(r=>r.evento===selectedEv);
    // Se visão = Artista, usa coluna artista no lugar de val
    if(selectedVisao==="Artista") rows=rows.map(r=>({...r,val:r.artista||0})).filter(r=>r.val>0);
    return rows;
  },[rawRows,selectedEv,selectedAno,selectedTipo,selectedVisao,eventStats]);
  const stats=useMemo(()=>calcStats(filtered,publicoMap),[filtered,publicoMap]);


  const pieRec =useMemo(()=>filtered.filter(e=>e.cat==="Receita").reduce((a,e)=>{const x=a.find(i=>i.name===e.desc);x?x.val+=e.val:a.push({name:e.desc,val:e.val});return a;},[]),[filtered]);
  const pieDesp=useMemo(()=>filtered.filter(e=>e.cat==="Despesa").reduce((a,e)=>{const x=a.find(i=>i.name===e.desc);x?x.val+=e.val:a.push({name:e.desc,val:e.val});return a;},[]),[filtered]);
  const despCat=useMemo(()=>filtered.filter(e=>e.cat==="Despesa").reduce((a,e)=>{const x=a.find(i=>i.name===e.desc);x?x.val+=e.val:a.push({name:e.desc,val:e.val});return a;},[]).sort((a,b)=>b.val-a.val).slice(0,6),[filtered]);

  const barData=eventStatsVisao.map(ev=>({name:ev.name.length>14?ev.name.slice(0,12)+"…":ev.name,Receita:ev.rec,Despesa:ev.desp,Resultado:ev.res}));
  const pubData=eventStatsVisao.map(ev=>({name:ev.name.length>14?ev.name.slice(0,12)+"…":ev.name,Público:ev.pub,"Ticket Médio":Math.round(ev.ticket)}));
  const roiData=eventStatsVisao.map(ev=>({name:ev.name.length>14?ev.name.slice(0,12)+"…":ev.name,ROI:ev.desp>0?((ev.res/ev.desp)*100):0}));

  const pubTotal=Object.values(publicoMap).reduce((s,v)=>s+v,0);
  const selName=selectedEv==="all"?"Todos os Eventos":selectedEv;

  return(
    <div style={{background:"#000000",minHeight:"100vh",fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif",color:"#F2F2F7",paddingBottom:60}}>

      {/* TOP BAR */}
      <div style={{background:"#560E11",borderBottom:"2px solid #FFB100",padding:"12px 28px",minHeight:"70px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          {LOGO_URL
            ? <img src={LOGO_URL} alt="Ao Vivão" style={{height:48,width:"auto",objectFit:"contain",filter:"drop-shadow(0 2px 8px rgba(0,0,0,0.5))"}}/>
            : <div style={{width:48,height:48,borderRadius:10,background:"#FFB100",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:"#560E11"}}>AV</div>
          }
          <div style={{display:"flex",flexDirection:"column",justifyContent:"center"}}>
            <p style={{fontSize:16,fontWeight:800,letterSpacing:"-0.01em",color:"#FFB100",fontFamily:"Arial Black,sans-serif",lineHeight:1.2}}>Ao Vivão</p>
            {lastSync&&<p style={{fontSize:10,color:"rgba(243,211,152,0.6)",marginTop:2,lineHeight:1}}>Sincronizado {lastSync.toLocaleTimeString("pt-BR")}</p>}
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {token&&<button onClick={()=>exportPDF(selName,stats,filtered,selectedVisao,fmt,fmtP,fmtN)} style={{background:"rgba(243,211,152,0.15)",border:"1px solid #F3D398",color:"#F3D398",borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}> Exportar PDF</button>}
          {token&&<button onClick={fetchData} disabled={loading} style={{background:"rgba(243,211,152,0.15)",border:"1px solid #F3D398",color:"#F3D398",borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{loading?"Carregando…":"Sincronizar"}</button>}
          {!token
            ?<button onClick={configured?login:()=>{}} style={{background:"#FFB100",border:"none",color:"#560E11",borderRadius:10,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:"pointer"}}> Entrar com Google</button>
            :<div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(243,211,152,0.15)",border:"1px solid #FFB100",borderRadius:10,padding:"7px 14px"}}><div style={{width:8,height:8,borderRadius:"50%",background:"#FFB100"}}/><p style={{fontSize:12,fontWeight:600,color:"#FFB100"}}>Conectado</p></div>
          }
        </div>
      </div>

      <div style={{padding:"24px 28px",maxWidth:1400,margin:"0 auto"}}>

        {error&&<div style={{background:`${C.accent2}11`,border:`1px solid ${C.accent2}44`,borderRadius:12,padding:"14px 18px",marginBottom:20,color:C.accent2,fontSize:13}}> {error}</div>}

        {!token&&configured&&(
          <div style={{textAlign:"center",padding:"80px 20px"}}>
            <div style={{fontSize:56,marginBottom:16}}>🔐</div>
            <p style={{fontSize:22,fontWeight:800,marginBottom:8}}>Faça login para carregar os dados</p>
            <button onClick={login} style={{background:C.accent1,border:"none",color:C.bg,borderRadius:12,padding:"14px 32px",fontSize:15,fontWeight:700,cursor:"pointer"}}> Entrar com Google</button>
          </div>
        )}

        {token&&rawRows.length===0&&!loading&&(
          <div style={{textAlign:"center",padding:"60px 20px"}}>
            <div style={{fontSize:48,marginBottom:12}}></div>
            <p style={{fontSize:18,fontWeight:700,marginBottom:8}}>Planilha vazia ou sem dados</p>
            <p style={{color:"#8E8E93",fontSize:13,lineHeight:1.7}}>
              Certifique-se que sua planilha tem as colunas:<br/>
              <code style={{color:C.accent4,background:`${C.accent4}11`,padding:"2px 8px",borderRadius:4}}>Evento | Descrição | Categoria | Data | Valor | Público</code>
            </p>
            <button onClick={fetchData} style={{marginTop:20,background:C.accent3,border:"none",color:C.bg,borderRadius:10,padding:"11px 24px",fontSize:13,fontWeight:700,cursor:"pointer"}}> Tentar novamente</button>
          </div>
        )}

        {token&&rawRows.length>0&&(<>

          <div style={{background:"#1C1C1E",border:"1px solid #3A3A3C",borderRadius:14,padding:"16px 20px",marginBottom:20}}>
            <FilterRow label="Visão">
              <FBtn label="Evento" sel={selectedVisao==="Evento"} color="#0A84FF" onClick={()=>setSelectedVisao("Evento")}/>
              <FBtn label="Artista" sel={selectedVisao==="Artista"} color="#BF5AF2" onClick={()=>setSelectedVisao("Artista")}/>
            </FilterRow>
            <FilterRow label="Modelo">
              <FBtn label="Todos" sel={selectedTipo==="all"} color="#30D158" onClick={()=>setSelectedTipo("all")}/>
              <FBtn label="Porta" sel={selectedTipo==="porta"} color="#FF9F0A" onClick={()=>setSelectedTipo("porta")}/>
              <FBtn label="Cachê" sel={selectedTipo==="cache"} color="#FF453A" onClick={()=>setSelectedTipo("cache")}/>
            </FilterRow>
            <FilterRow label="Ano">
              <FBtn label="Todos" sel={selectedAno==="all"} color="#0A84FF" onClick={()=>setSelectedAno("all")}/>
              {anos.map(a=><FBtn key={a} label={a} sel={selectedAno===a} color="#0A84FF" onClick={()=>setSelectedAno(a)}/>)}
            </FilterRow>
            <FilterRow label="Evento" last>
              <FBtn label="Todos" sel={selectedEv==="all"} color="#30D158" onClick={()=>setSelectedEv("all")}/>
              {eventStats.filter(ev=>(selectedAno==="all"||ev.year===selectedAno)&&(selectedTipo==="all"||ev.tipo===selectedTipo)).map(ev=>(
                <button key={ev.name} onClick={()=>setSelectedEv(ev.name)} style={{padding:"5px 14px",borderRadius:7,border:`1.5px solid ${selectedEv===ev.name?ev.color:"#3A3A3C"}`,background:selectedEv===ev.name?`${ev.color}20`:"transparent",color:selectedEv===ev.name?ev.color:"#636366",fontSize:12,fontWeight:selectedEv===ev.name?600:400,cursor:"pointer",transition:"all .15s",display:"flex",flexDirection:"column",alignItems:"center"}}>
                  <span style={{whiteSpace:"nowrap",lineHeight:1.3}}>{ev.name}</span>
                  <span style={{fontSize:10,opacity:.65,lineHeight:1.3}}>{ev.date} · {ev.res>=0?"+":"-"}{fmtP(Math.abs(ev.marg))}</span>
                </button>
              ))}
            </FilterRow>
            {selectedVisao==="Artista"&&(
              <div style={{marginTop:8,padding:"8px 12px",background:"rgba(10,132,255,0.08)",border:"1px solid rgba(10,132,255,0.2)",borderRadius:8,fontSize:12,color:"#0A84FF"}}>
                Exibindo valores da coluna Artista (R$) da planilha
              </div>
            )}
          </div>

          {/* TITLE */}
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
            <div style={{width:4,height:26,borderRadius:2,background:selectedEv==="all"?"#0A84FF":eventStats.find(e=>e.name===selectedEv)?.color||"#0A84FF"}}/>
            <h2 style={{fontSize:20,fontWeight:700,letterSpacing:"-0.02em",color:"#F2F2F7"}}>{selName}</h2>
            <span style={{background:selectedVisao==="Artista"?"#2e1040":"#0a1e2e",color:selectedVisao==="Artista"?C.accent6:C.accent5,fontSize:11,fontWeight:700,borderRadius:20,padding:"3px 12px"}}>
              {selectedVisao==="Artista"?"Artista":"Evento"}
            </span>
            {selectedEv!=="all"&&(
              <span style={{background:stats.res>=0?"#0a2e1e":"#2e0a14",color:stats.res>=0?C.accent1:C.accent2,fontSize:11,fontWeight:700,borderRadius:20,padding:"3px 12px"}}>
                {stats.res>=0?"Lucrativo":"Prejuízo"}
              </span>
            )}
          </div>

          {/* KPIs FINANCEIROS */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:14}}>
            <KPI label="Receita Total"  value={fmt(stats.rec)}  color={C.accent1} sub={`${filtered.filter(e=>e.cat==="Receita").length} lançamentos`}/>
            <KPI label="Despesa Total"  value={fmt(stats.desp)} color={C.accent2} sub={`${filtered.filter(e=>e.cat==="Despesa").length} lançamentos`}/>
            <KPI label="Resultado"      value={fmt(stats.res)}  color={stats.res>=0?C.accent1:C.accent2} sub={stats.res>=0?"Saldo positivo":"Saldo negativo"}/>
            <KPI label="Margem"         value={fmtP(stats.marg)} color={C.accent4} sub="sobre receita"/>
          </div>

          {/* KPIs PÚBLICO */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:22}}>
            <KPI label="Público Total"    value={fmtN(selectedEv==="all"?pubTotal:stats.pub)} color={C.accent5}  sub={selectedEv==="all"?`${events.length} eventos`:"pessoas"}/>
            <KPI label="Ticket Médio"     value={fmt(stats.ticket)}  color={C.accent3} sub="receita por pessoa"/>
            <KPI label="Custo por Pessoa" value={fmt(stats.cppub)}   color={C.accent2} sub="despesa por pessoa" small/>
            <KPI label="ROI"              value={stats.desp>0?`${((stats.res/stats.desp)*100).toFixed(0)}%`:"—"} color={stats.res>=0?C.accent1:C.accent2} sub="retorno sobre despesa"/>
          </div>

          {/* TABS */}
          <div style={{display:"flex",gap:4,marginBottom:18,background:"#1C1C1E",borderRadius:12,padding:4,width:"fit-content",border:"1px solid #3A3A3C"}}>
            {[["overview","Visão Geral"],["publico","Público"],["custos","Custos"],["entries","Lançamentos"],["compare","Comparar"]].map(([t,l])=>(
              <button key={t} onClick={()=>setTab(t)} style={{background:tab===t?"#3A3A3C":"transparent",color:tab===t?"#F2F2F7":"#8E8E93",border:"none",borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .2s"}}>{l}</button>
            ))}
          </div>

          {/* TAB OVERVIEW */}
          {tab==="overview"&&(
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
                <Card title="Receita vs Despesa" sub="por evento">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={barData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3C" vertical={false}/>
                      <XAxis dataKey="name" tick={{fill:"#8E8E93",fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:"#8E8E93",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`}/>
                      <Tooltip content={<Tip totalRec={stats.rec}/>}/><Legend wrapperStyle={{fontSize:12,color:C.textDim}}/>
                      <Bar dataKey="Receita" fill={C.accent1} radius={[5,5,0,0]}/>
                      <Bar dataKey="Despesa" fill={C.accent2} radius={[5,5,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
                <Card title="Resultado Líquido" sub="por evento">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3C" vertical={false}/>
                      <XAxis dataKey="name" tick={{fill:"#8E8E93",fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:"#8E8E93",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`}/>
                      <Tooltip content={<Tip/>}/>
                      <Bar dataKey="Resultado" radius={[5,5,0,0]}>{barData.map((d,i)=><Cell key={i} fill={d.Resultado>=0?C.accent1:C.accent2}/>)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
                <Card title="Composição de Receitas" sub={selName}>
                  {pieRec.length===0?<div style={{height:200,display:"flex",alignItems:"center",justifyContent:"center",color:"#636366"}}>Sem receitas</div>:
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart><Pie data={pieRec} dataKey="val" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                      {pieRec.map((_,i)=><Cell key={i} fill={ECOLS[i%ECOLS.length]}/>)}
                    </Pie><Tooltip content={<Tip totalRec={stats.rec}/>}/><Legend wrapperStyle={{fontSize:11,color:"#8E8E93"}}/></PieChart>
                  </ResponsiveContainer>}
                </Card>
                <Card title="Composição de Despesas" sub={selName}>
                  {pieDesp.length===0?<div style={{height:200,display:"flex",alignItems:"center",justifyContent:"center",color:"#636366"}}>Sem despesas</div>:
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart><Pie data={pieDesp} dataKey="val" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                      {pieDesp.map((_,i)=><Cell key={i} fill={["#FF453A","#FF6B6B","#FF9F9F","#FF8C00","#FFB340","#FFD60A"][i%6]}/>)}
                    </Pie><Tooltip content={<Tip/>}/><Legend wrapperStyle={{fontSize:11,color:"#8E8E93"}}/></PieChart>
                  </ResponsiveContainer>}
                </Card>
              </div>
            </div>
          )}

          {/* TAB PÚBLICO */}
          {tab==="publico"&&(
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
                <Card title="Público por Evento" sub="total de pessoas">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={pubData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3C" vertical={false}/>
                      <XAxis dataKey="name" tick={{fill:"#8E8E93",fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:"#8E8E93",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>fmtK(v)}/>
                      <Tooltip content={<Tip/>}/>
                      <Bar dataKey="Público" radius={[5,5,0,0]}>{pubData.map((_,i)=><Cell key={i} fill={ECOLS[i%ECOLS.length]}/>)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
                <Card title="Ticket Médio por Evento" sub="receita por pessoa (R$)">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={pubData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3C" vertical={false}/>
                      <XAxis dataKey="name" tick={{fill:"#8E8E93",fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:"#8E8E93",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(1)}k`}/>
                      <Tooltip content={<Tip/>}/>
                      <Bar dataKey="Ticket Médio" fill={C.accent3} radius={[5,5,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>
              <Card title="Ranking de Público" sub="eventos ordenados por audiência">
                <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:8}}>
                  {[...eventStats].sort((a,b)=>b.pub-a.pub).map((ev,i)=>{
                    const maxPub=Math.max(...eventStats.map(e=>e.pub),1);
                    return(
                      <div key={ev.name} style={{display:"flex",alignItems:"center",gap:12}}>
                        <span style={{color:C.muted,fontSize:12,width:24,textAlign:"right"}}>#{i+1}</span>
                        <p style={{width:170,fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.name}</p>
                        <div style={{flex:1,background:"#3A3A3C",borderRadius:4,height:8,overflow:"hidden"}}>
                          <div style={{width:`${(ev.pub/maxPub)*100}%`,height:"100%",background:ev.color,borderRadius:4,transition:"width .6s"}}/>
                        </div>
                        <p style={{color:ev.color,fontWeight:700,fontSize:13,width:80,textAlign:"right"}}>{fmtN(ev.pub)}</p>
                        <p style={{color:C.muted,fontSize:11,width:100,textAlign:"right"}}>TM: {fmt(ev.ticket)}</p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* TAB CUSTOS */}
          {tab==="custos"&&(
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
                <Card title="Composição de Despesas" sub={selName}>
                  {pieDesp.length===0?<div style={{height:220,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted}}>Sem despesas</div>:
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart><Pie data={pieDesp} dataKey="val" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                      {pieDesp.map((_,i)=><Cell key={i} fill={["#FF3D6B","#FF6B89","#FF8FA0","#FFAAB5","#FFC4CE","#FFD6DC"][i%6]}/>)}
                    </Pie><Tooltip content={<Tip/>}/><Legend wrapperStyle={{fontSize:11,color:C.textDim}}/></PieChart>
                  </ResponsiveContainer>}
                </Card>
                <Card title="Maiores Despesas" sub={selName}>
                  <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:8}}>
                    {despCat.length===0
                      ?<div style={{height:180,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted}}>Sem despesas</div>
                      :despCat.map((d,i)=>{
                        const maxVal=despCat[0]?.val||1;
                        return(
                          <div key={d.name} style={{display:"flex",alignItems:"center",gap:10}}>
                            <p style={{width:140,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</p>
                            <div style={{flex:1,background:"#3A3A3C",borderRadius:4,height:6,overflow:"hidden"}}>
                              <div style={{width:`${(d.val/maxVal)*100}%`,height:"100%",background:C.accent2,borderRadius:4}}/>
                            </div>
                            <p style={{color:C.accent2,fontWeight:700,fontSize:12,width:90,textAlign:"right"}}>{fmt(d.val)}</p>
                          </div>
                        );
                      })
                    }
                  </div>
                </Card>
              </div>
              <Card title="Custo por Pessoa por Evento" sub="despesa total ÷ público">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={eventStats.map(ev=>({name:ev.name.length>14?ev.name.slice(0,12)+"…":ev.name,"Custo/Pessoa":Math.round(ev.cppub)}))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3C" vertical={false}/>
                    <XAxis dataKey="name" tick={{fill:"#8E8E93",fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:"#8E8E93",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`R$${v}`}/>
                    <Tooltip content={<Tip/>}/>
                    <Bar dataKey="Custo/Pessoa" fill={C.accent2} radius={[5,5,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}

          {/* TAB LANÇAMENTOS */}
          {tab==="entries"&&(
            <div style={{background:"#1C1C1E",border:"1px solid #3A3A3C",borderRadius:16,overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:"2fr 2.5fr 1fr 1fr 1fr 1fr",background:"#2C2C2E",padding:"12px 20px",gap:12,borderBottom:"1px solid #3A3A3C"}}>
                {["Evento","Descrição","Categoria","Data","Valor","Público"].map((h,i)=>(
                  <p key={i} style={{color:"#8E8E93",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em"}}>{h}</p>
                ))}
              </div>
              {filtered.map((row,i)=>{
                const evColor=ECOLS[events.indexOf(row.evento)%ECOLS.length];
                return(
                  <div key={row.id} style={{display:"grid",gridTemplateColumns:"2fr 2.5fr 1fr 1fr 1fr 1fr",padding:"13px 20px",gap:12,borderTop:`1px solid ${C.border}`,background:i%2===0?"transparent":"#FFFFFF05",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:7,height:7,borderRadius:"50%",background:evColor,flexShrink:0}}/>
                      <p style={{fontSize:12,color:C.textDim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.evento}</p>
                    </div>
                    <p style={{fontSize:13,fontWeight:500}}>{row.desc}</p>
                    <span style={{background:row.cat==="Receita"?"#0a2e1e":"#2e0a14",color:row.cat==="Receita"?C.accent1:C.accent2,fontSize:10,fontWeight:700,borderRadius:20,padding:"3px 10px",width:"fit-content"}}>{row.cat}</span>
                    <p style={{fontSize:12,color:C.textDim}}>{row.date}</p>
                    <p style={{fontSize:13,fontWeight:700,color:row.cat==="Receita"?C.accent1:C.accent2}}>{fmt(row.val)}</p>
                    <p style={{fontSize:12,color:row.publico>0?C.accent5:C.muted}}>{row.publico>0?fmtN(row.publico):"—"}</p>
                  </div>
                );
              })}
              <div style={{display:"grid",gridTemplateColumns:"2fr 2.5fr 1fr 1fr 1fr 1fr",padding:"14px 20px",gap:12,borderTop:"1px solid #3A3A3C",background:"#2C2C2E",alignItems:"center"}}>
                <p style={{fontSize:11,fontWeight:700,color:C.textDim,gridColumn:"1/4"}}>TOTAL — {filtered.length} lançamentos</p>
                <div/>
                <p style={{fontSize:13,fontWeight:800,color:stats.res>=0?C.accent1:C.accent2}}>{fmt(stats.res)}</p>
                <p style={{fontSize:12,fontWeight:700,color:C.accent5}}>{fmtN(stats.pub)}</p>
              </div>
            </div>
          )}

          {/* TAB COMPARAR */}
          {tab==="compare"&&(
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
                {[...eventStatsVisao].sort((a,b)=>b.res-a.res).map((ev,i)=>(
                  <div key={ev.name} onClick={()=>setSelectedEv(ev.name)} style={{background:"#1C1C1E",border:`1px solid ${selectedEv===ev.name?ev.color:"#3A3A3C"}`,borderLeft:`4px solid ${ev.color}`,borderRadius:14,padding:"18px 20px",cursor:"pointer",transition:"border-color .2s"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                      <div>
                        <span style={{background:C.bg,color:C.muted,fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 8px"}}>#{i+1}</span>
                        <p style={{fontSize:14,fontWeight:700,marginTop:5,lineHeight:1.3}}>{ev.name}</p>
                      </div>
                      <span style={{fontSize:18}}>{i===0?"#1":i===1?"#2":i===2?"#3":"–"}</span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                      {[["Receita",fmt(ev.rec),C.accent1],["Despesa",fmt(ev.desp),C.accent2],["Resultado",fmt(ev.res),ev.res>=0?C.accent1:C.accent2],["Margem",fmtP(ev.marg),C.accent4],["Público",fmtN(ev.pub),C.accent5],["Ticket Médio",fmt(ev.ticket),C.accent3]].map(([l,v,c])=>(
                        <div key={l}>
                          <p style={{color:C.muted,fontSize:9,marginBottom:2,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</p>
                          <p style={{color:c,fontWeight:700,fontSize:12}}>{v}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{background:"#3A3A3C",borderRadius:4,height:4,overflow:"hidden"}}>
                      <div style={{width:`${Math.max(0,Math.min(100,ev.marg*100))}%`,height:"100%",background:ev.color,borderRadius:4,transition:"width .6s"}}/>
                    </div>
                  </div>
                ))}
              </div>
              <Card title="Comparativo Completo" sub="todos os eventos lado a lado">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3C" vertical={false}/>
                    <XAxis dataKey="name" tick={{fill:"#8E8E93",fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:"#8E8E93",fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`}/>
                    <Tooltip content={<Tip/>}/><Legend wrapperStyle={{fontSize:12,color:C.textDim}}/>
                    <Bar dataKey="Receita"   fill={C.accent1} radius={[4,4,0,0]}/>
                    <Bar dataKey="Despesa"   fill={C.accent2} radius={[4,4,0,0]}/>
                    <Bar dataKey="Resultado" fill={C.accent3} radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}
