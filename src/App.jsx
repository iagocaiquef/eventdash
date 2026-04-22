import { useState, useMemo, useEffect, useCallback } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from "recharts";

const CONFIG = {
  CLIENT_ID: "SEU_CLIENT_ID_AQUI.apps.googleusercontent.com",
  SHEET_ID:  "ID_DA_SUA_PLANILHA_AQUI",
  SHEET_TAB: "Lançamentos",
};

const SCOPES = "https://www.googleapis.com/auth/spreadsheets.readonly";

const C = {
  bg:"#080B14",surface:"#0F1220",card:"#161A2E",border:"#1E2340",
  accent1:"#00F0C0",accent2:"#FF3D6B",accent3:"#7C6AF7",accent4:"#FFB547",accent5:"#38BDF8",
  muted:"#4A5168",text:"#DCE4F5",textDim:"#6B7A99",
};
const ECOLS=["#00F0C0","#FF3D6B","#7C6AF7","#FFB547","#38BDF8","#86EFAC","#FB923C","#F472B6"];

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
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px"}}>
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
  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px 20px",borderTop:`3px solid ${color}`,position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",top:12,right:16,fontSize:22,opacity:.12}}>{icon}</div>
    <p style={{color:C.textDim,fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>{label}</p>
    <p style={{color,fontSize:small?18:22,fontWeight:800,letterSpacing:"-0.02em",lineHeight:1}}>{value}</p>
    {sub&&<p style={{color:C.muted,fontSize:11,marginTop:4}}>{sub}</p>}
  </div>
);

const Card=({title,sub,children,style={}})=>(
  <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"20px 22px",...style}}>
    <p style={{fontSize:14,fontWeight:700,marginBottom:2}}>{title}</p>
    {sub&&<p style={{fontSize:11,color:C.muted,marginBottom:14}}>{sub}</p>}
    {children}
  </div>
);

const Chip=({label,selected,color,sub,onClick})=>(
  <button onClick={onClick} style={{background:selected?color:C.card,color:selected?C.bg:C.text,border:`1px solid ${selected?color:C.border}`,borderRadius:22,padding:sub?"6px 14px":"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .2s",display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
    <span>{label}</span>
    {sub&&<span style={{fontSize:10,opacity:.8,fontWeight:500}}>{sub}</span>}
  </button>
);

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
        range:`${CONFIG.SHEET_TAB}!B3:G1000`,
      });
      const rows=(res.result.values||[])
        .filter(r=>r[0]&&r[4])
        .map((r,i)=>({
          id:i,
          evento:r[0]?.trim()||"",
          desc:  r[1]?.trim()||"",
          cat:   r[2]?.trim()||"",
          date:  r[3]?.trim()||"",
          val:   parseFloat((r[4]||"0").toString().replace(/[R$\s]/g,"").replace(/\./g,"").replace(",","."))||0,
          publico:parseInt((r[5]||"0").toString().replace(/\D/g,""))||0,
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
      return{...stats,name:ev,color:ECOLS[i%ECOLS.length],count:rows.length};
    }),
  [events,rawRows,publicoMap]);

  const filtered=useMemo(()=>selectedEv==="all"?rawRows:rawRows.filter(r=>r.evento===selectedEv),[rawRows,selectedEv]);
  const stats=useMemo(()=>calcStats(filtered,publicoMap),[filtered,publicoMap]);

  const pieRec =useMemo(()=>filtered.filter(e=>e.cat==="Receita").reduce((a,e)=>{const x=a.find(i=>i.name===e.desc);x?x.val+=e.val:a.push({name:e.desc,val:e.val});return a;},[]),[filtered]);
  const pieDesp=useMemo(()=>filtered.filter(e=>e.cat==="Despesa").reduce((a,e)=>{const x=a.find(i=>i.name===e.desc);x?x.val+=e.val:a.push({name:e.desc,val:e.val});return a;},[]),[filtered]);
  const despCat=useMemo(()=>filtered.filter(e=>e.cat==="Despesa").reduce((a,e)=>{const x=a.find(i=>i.name===e.desc);x?x.val+=e.val:a.push({name:e.desc,val:e.val});return a;},[]).sort((a,b)=>b.val-a.val).slice(0,6),[filtered]);

  const barData=eventStats.map(ev=>({name:ev.name.length>14?ev.name.slice(0,12)+"…":ev.name,Receita:ev.rec,Despesa:ev.desp,Resultado:ev.res}));
  const pubData=eventStats.map(ev=>({name:ev.name.length>14?ev.name.slice(0,12)+"…":ev.name,Público:ev.pub,"Ticket Médio":Math.round(ev.ticket)}));
  const roiData=eventStats.map(ev=>({name:ev.name.length>14?ev.name.slice(0,12)+"…":ev.name,ROI:ev.desp>0?((ev.res/ev.desp)*100):0}));

  const pubTotal=Object.values(publicoMap).reduce((s,v)=>s+v,0);
  const selName=selectedEv==="all"?"Todos os Eventos":selectedEv;

  return(
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:"'DM Sans','Segoe UI',sans-serif",color:C.text,paddingBottom:60}}>

      {/* TOP BAR */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"16px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${C.accent1},${C.accent3})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📻</div>
          <div>
            <p style={{fontSize:15,fontWeight:800,letterSpacing:"-0.02em"}}>Ao Vivão</p>
            {lastSync&&<p style={{fontSize:10,color:C.muted}}>Sincronizado {lastSync.toLocaleTimeString("pt-BR")}</p>}
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {token&&<button onClick={fetchData} disabled={loading} style={{background:C.card,border:`1px solid ${C.border}`,color:C.textDim,borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{loading?"⏳ Carregando…":"🔄 Sincronizar"}</button>}
          {!token
            ?<button onClick={configured?login:()=>{}} style={{background:C.accent1,border:"none",color:C.bg,borderRadius:10,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:"pointer"}}>🔑 Entrar com Google</button>
            :<div style={{display:"flex",alignItems:"center",gap:6,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"7px 14px"}}><div style={{width:8,height:8,borderRadius:"50%",background:C.accent1}}/><p style={{fontSize:12,fontWeight:600,color:C.accent1}}>Conectado</p></div>
          }
        </div>
      </div>

      <div style={{padding:"24px 28px",maxWidth:1400,margin:"0 auto"}}>

        {error&&<div style={{background:`${C.accent2}11`,border:`1px solid ${C.accent2}44`,borderRadius:12,padding:"14px 18px",marginBottom:20,color:C.accent2,fontSize:13}}>⚠️ {error}</div>}

        {!token&&configured&&(
          <div style={{textAlign:"center",padding:"80px 20px"}}>
            <div style={{fontSize:56,marginBottom:16}}>🔐</div>
            <p style={{fontSize:22,fontWeight:800,marginBottom:8}}>Faça login para carregar os dados</p>
            <button onClick={login} style={{background:C.accent1,border:"none",color:C.bg,borderRadius:12,padding:"14px 32px",fontSize:15,fontWeight:700,cursor:"pointer"}}>🔑 Entrar com Google</button>
          </div>
        )}

        {token&&rawRows.length===0&&!loading&&(
          <div style={{textAlign:"center",padding:"60px 20px"}}>
            <div style={{fontSize:48,marginBottom:12}}>📊</div>
            <p style={{fontSize:18,fontWeight:700,marginBottom:8}}>Planilha vazia ou sem dados</p>
            <p style={{color:C.textDim,fontSize:13,lineHeight:1.7}}>
              Certifique-se que sua planilha tem as colunas:<br/>
              <code style={{color:C.accent4,background:`${C.accent4}11`,padding:"2px 8px",borderRadius:4}}>Evento | Descrição | Categoria | Data | Valor | Público</code>
            </p>
            <button onClick={fetchData} style={{marginTop:20,background:C.accent3,border:"none",color:C.bg,borderRadius:10,padding:"11px 24px",fontSize:13,fontWeight:700,cursor:"pointer"}}>🔄 Tentar novamente</button>
          </div>
        )}

        {token&&rawRows.length>0&&(<>
          {/* EVENT SELECTOR */}
          <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap",alignItems:"center"}}>
            <p style={{color:C.textDim,fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginRight:4}}>Filtrar:</p>
            <Chip label="Todos" selected={selectedEv==="all"} color={C.accent3} onClick={()=>setSelectedEv("all")}/>
            {eventStats.map(ev=>(
              <Chip key={ev.name} label={ev.name} selected={selectedEv===ev.name} color={ev.color}
                sub={ev.res>=0?`✅ ${fmtP(ev.marg)}`:`⚠️ ${fmtP(ev.marg)}`}
                onClick={()=>setSelectedEv(ev.name)}/>
            ))}
          </div>

          {/* TITLE */}
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
            <div style={{width:4,height:26,borderRadius:2,background:selectedEv==="all"?C.accent3:eventStats.find(e=>e.name===selectedEv)?.color||C.accent1}}/>
            <h2 style={{fontSize:20,fontWeight:800,letterSpacing:"-0.02em"}}>{selName}</h2>
            {selectedEv!=="all"&&(
              <span style={{background:stats.res>=0?"#0a2e1e":"#2e0a14",color:stats.res>=0?C.accent1:C.accent2,fontSize:11,fontWeight:700,borderRadius:20,padding:"3px 12px"}}>
                {stats.res>=0?"✅ Lucrativo":"⚠️ Prejuízo"}
              </span>
            )}
          </div>

          {/* KPIs FINANCEIROS */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:14}}>
            <KPI label="Receita Total"  value={fmt(stats.rec)}  color={C.accent1} icon="💰" sub={`${filtered.filter(e=>e.cat==="Receita").length} lançamentos`}/>
            <KPI label="Despesa Total"  value={fmt(stats.desp)} color={C.accent2} icon="💸" sub={`${filtered.filter(e=>e.cat==="Despesa").length} lançamentos`}/>
            <KPI label="Resultado"      value={fmt(stats.res)}  color={stats.res>=0?C.accent1:C.accent2} icon="📈" sub={stats.res>=0?"Saldo positivo":"Saldo negativo"}/>
            <KPI label="Margem"         value={fmtP(stats.marg)} color={C.accent4} icon="🎯" sub="sobre receita"/>
          </div>

          {/* KPIs PÚBLICO */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:22}}>
            <KPI label="Público Total"    value={fmtN(selectedEv==="all"?pubTotal:stats.pub)} color={C.accent5}  icon="👥" sub={selectedEv==="all"?`${events.length} eventos`:"pessoas"}/>
            <KPI label="Ticket Médio"     value={fmt(stats.ticket)}  color={C.accent3} icon="🎟️" sub="receita por pessoa"/>
            <KPI label="Custo por Pessoa" value={fmt(stats.cppub)}   color={C.accent2} icon="💡" sub="despesa por pessoa" small/>
            <KPI label="ROI"              value={stats.desp>0?`${((stats.res/stats.desp)*100).toFixed(0)}%`:"—"} color={stats.res>=0?C.accent1:C.accent2} icon="📊" sub="retorno sobre despesa"/>
          </div>

          {/* TABS */}
          <div style={{display:"flex",gap:4,marginBottom:18,background:C.surface,borderRadius:12,padding:4,width:"fit-content",border:`1px solid ${C.border}`}}>
            {[["overview","📊 Visão Geral"],["publico","👥 Público"],["custos","💸 Custos"],["entries","📋 Lançamentos"],["compare","🔀 Comparar"]].map(([t,l])=>(
              <button key={t} onClick={()=>setTab(t)} style={{background:tab===t?C.accent3:"transparent",color:tab===t?C.bg:C.textDim,border:"none",borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .2s"}}>{l}</button>
            ))}
          </div>

          {/* TAB OVERVIEW */}
          {tab==="overview"&&(
            <div style={{display:"flex",flexDirection:"column",gap:18}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
                <Card title="Receita vs Despesa" sub="por evento">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={barData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                      <XAxis dataKey="name" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`}/>
                      <Tooltip content={<Tip totalRec={stats.rec}/>}/><Legend wrapperStyle={{fontSize:12,color:C.textDim}}/>
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
                      <Bar dataKey="Resultado" radius={[5,5,0,0]}>{barData.map((d,i)=><Cell key={i} fill={d.Resultado>=0?C.accent1:C.accent2}/>)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
                <Card title="Composição de Receitas" sub={selName}>
                  {pieRec.length===0?<div style={{height:200,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted}}>Sem receitas</div>:
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart><Pie data={pieRec} dataKey="val" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                      {pieRec.map((_,i)=><Cell key={i} fill={ECOLS[i%ECOLS.length]}/>)}
                    </Pie><Tooltip content={<Tip totalRec={stats.rec}/>}/><Legend wrapperStyle={{fontSize:11,color:C.textDim}}/></PieChart>
                  </ResponsiveContainer>}
                </Card>
                <Card title="ROI por Evento" sub="retorno sobre despesa (%)">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={roiData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                      <XAxis dataKey="name" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`${v.toFixed(0)}%`}/>
                      <Tooltip content={<Tip/>}/>
                      <Bar dataKey="ROI" radius={[5,5,0,0]}>{roiData.map((d,i)=><Cell key={i} fill={d.ROI>=0?C.accent3:C.accent2}/>)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
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
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                      <XAxis dataKey="name" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>fmtK(v)}/>
                      <Tooltip content={<Tip/>}/>
                      <Bar dataKey="Público" radius={[5,5,0,0]}>{pubData.map((_,i)=><Cell key={i} fill={ECOLS[i%ECOLS.length]}/>)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
                <Card title="Ticket Médio por Evento" sub="receita por pessoa (R$)">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={pubData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                      <XAxis dataKey="name" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(1)}k`}/>
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
                        <div style={{flex:1,background:C.border,borderRadius:4,height:8,overflow:"hidden"}}>
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
                            <div style={{flex:1,background:C.border,borderRadius:4,height:6,overflow:"hidden"}}>
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
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                    <XAxis dataKey="name" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`R$${v}`}/>
                    <Tooltip content={<Tip/>}/>
                    <Bar dataKey="Custo/Pessoa" fill={C.accent2} radius={[5,5,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}

          {/* TAB LANÇAMENTOS */}
          {tab==="entries"&&(
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden"}}>
              <div style={{display:"grid",gridTemplateColumns:"2fr 2.5fr 1fr 1fr 1fr 1fr",background:C.card,padding:"12px 20px",gap:12}}>
                {["Evento","Descrição","Categoria","Data","Valor","Público"].map((h,i)=>(
                  <p key={i} style={{color:C.textDim,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>{h}</p>
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
              <div style={{display:"grid",gridTemplateColumns:"2fr 2.5fr 1fr 1fr 1fr 1fr",padding:"14px 20px",gap:12,borderTop:`2px solid ${C.accent1}44`,background:C.card,alignItems:"center"}}>
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
                {[...eventStats].sort((a,b)=>b.res-a.res).map((ev,i)=>(
                  <div key={ev.name} onClick={()=>setSelectedEv(ev.name)} style={{background:C.card,border:`1px solid ${selectedEv===ev.name?ev.color:C.border}`,borderLeft:`4px solid ${ev.color}`,borderRadius:14,padding:"18px 20px",cursor:"pointer",transition:"border-color .2s"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                      <div>
                        <span style={{background:C.bg,color:C.muted,fontSize:10,fontWeight:700,borderRadius:20,padding:"2px 8px"}}>#{i+1}</span>
                        <p style={{fontSize:14,fontWeight:700,marginTop:5,lineHeight:1.3}}>{ev.name}</p>
                      </div>
                      <span style={{fontSize:18}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":"📊"}</span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                      {[["Receita",fmt(ev.rec),C.accent1],["Despesa",fmt(ev.desp),C.accent2],["Resultado",fmt(ev.res),ev.res>=0?C.accent1:C.accent2],["Margem",fmtP(ev.marg),C.accent4],["Público",fmtN(ev.pub),C.accent5],["Ticket Médio",fmt(ev.ticket),C.accent3]].map(([l,v,c])=>(
                        <div key={l}>
                          <p style={{color:C.muted,fontSize:9,marginBottom:2,textTransform:"uppercase",letterSpacing:"0.06em"}}>{l}</p>
                          <p style={{color:c,fontWeight:700,fontSize:12}}>{v}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{background:C.border,borderRadius:4,height:4,overflow:"hidden"}}>
                      <div style={{width:`${Math.max(0,Math.min(100,ev.marg*100))}%`,height:"100%",background:ev.color,borderRadius:4,transition:"width .6s"}}/>
                    </div>
                  </div>
                ))}
              </div>
              <Card title="Comparativo Completo" sub="todos os eventos lado a lado">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                    <XAxis dataKey="name" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`}/>
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
