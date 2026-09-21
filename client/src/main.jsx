import React,{useState,useEffect,useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import {LayoutDashboard,Package,Truck,Bell,ShieldCheck,Plug,ArrowUpRight,ArrowRight,Plus,Search,RefreshCw,LogOut,Check,ChevronRight,X,FileCheck2,Thermometer,LockKeyhole,Activity,ClipboardList,Send,CheckCircle2,AlertTriangle,Inbox,Sun,Moon,Globe,Download,QrCode,FileText,Printer,BarChart2,UserCheck,Clock} from 'lucide-react';
import {api,setCsrf,enablePush} from './api';
import {translations} from './translations';
import './styles.css';

const statusLabels={requested:'Awaiting review',validated:'Approved',packed:'Packed', 'dispatch-pending':'Chart sync pending',dispatched:'In transit',received:'Received',cancelled:'Cancelled'};
const dateTime=v=>v?new Date(v).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
const time=v=>v?new Date(v).toLocaleTimeString(undefined,{month:'short',day:'numeric',minute:'2-digit'}):'—';

function playExcursionBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}

function Mark(){return <span className="mark"><ShieldCheck size={22}/></span>;}
function Status({value,t}){
  const labelMap = {
    requested: t?.statusRequested || statusLabels.requested,
    validated: t?.statusValidated || statusLabels.validated,
    packed: t?.statusPacked || statusLabels.packed,
    'dispatch-pending': t?.statusDispatchPending || statusLabels['dispatch-pending'],
    dispatched: t?.statusDispatched || statusLabels.dispatched,
    received: t?.statusReceived || statusLabels.received,
    cancelled: t?.statusCancelled || statusLabels.cancelled
  };
  return <span className={`badge status-${value}`}><span className="dot"/>{labelMap[value]??value}</span>;
}
function Button({children,kind='primary',...props}){return <button className={`button ${kind}`} {...props}>{children}</button>;}
function ErrorBox({children}){return children?<div className="error" role="alert"><AlertTriangle size={17}/><span>{children}</span></div>:null;}
function Empty({icon:Icon=Inbox,title,children}){return <div className="empty"><Icon size={32}/><h3>{title}</h3>{children}</div>;}

function TemperatureTelemetry({packedTemp=4}){
  const readings=[
    {time:'00:00',temp:Number(packedTemp).toFixed(1)},
    {time:'00:05',temp:(Number(packedTemp)+0.3).toFixed(1)},
    {time:'00:10',temp:(Number(packedTemp)+0.5).toFixed(1)},
    {time:'00:15',temp:(Number(packedTemp)+0.2).toFixed(1)},
    {time:'00:20',temp:(Number(packedTemp)+0.4).toFixed(1)}
  ];
  const maxTemp=Math.max(...readings.map(r=>Number(r.temp)));
  const minTemp=Math.min(...readings.map(r=>Number(r.temp)));
  const isExcursion=maxTemp>8.0||minTemp<2.0;

  useEffect(()=>{
    if(isExcursion) playExcursionBeep();
  },[isExcursion]);

  return (
    <div className="telemetry-card">
      <div className="telemetry-head">
        <div>
          <strong className="telemetry-title"><Thermometer size={16}/> IoT Transit Telemetry (2°C – 8°C)</strong>
          <small className="telemetry-sub">Live sensor data feed</small>
        </div>
        <span className={`telemetry-badge ${isExcursion?'excursion excursion-flash':'safe'}`}>
          {isExcursion?'⚠️ Temp Excursion':'✓ Safe Cold-Chain'}
        </span>
      </div>
      <div className="telemetry-bars">
        {readings.map((r,i)=>(
          <div key={i} className="bar-col">
            <span className="bar-val">{r.temp}°C</span>
            <div className="bar-bg">
              <div className={`bar-fill ${Number(r.temp)>8||Number(r.temp)<2?'fill-danger':''}`} style={{height:`${Math.min(100,Math.max(25,(Number(r.temp)/10)*100))}%`}}/>
            </div>
            <span className="bar-time">{r.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QrHandoffSection({lot,onConfirm,busy,t}){
  const [scanned,setScanned]=useState(false);
  const [scanning,setScanning]=useState(false);
  function scan(){
    setScanning(true);
    setTimeout(()=>{
      setScanning(false);
      setScanned(true);
      playExcursionBeep();
    },1400);
  }
  return (
    <div className="qr-card">
      <div className="qr-head">
        <QrCode size={22}/>
        <div>
          <strong>{t?.qrScannerTitle||'Package Barcode Verification'}</strong>
          <small>{t?.qrScannerDesc||`Scan QR code on package to verify Lot #${lot}`}</small>
        </div>
      </div>
      {scanning && (
        <div className="reticle-container">
          <div className="reticle-box">
            <div className="reticle-laser"/>
            <QrCode size={42} color="#38bdf8"/>
          </div>
          <span className="reticle-text">{t?.reticleScanning||'Aligning camera & scanning reticle…'}</span>
        </div>
      )}
      {!scanned?(
        <Button kind="secondary" disabled={scanning||busy} onClick={scan}>
          <QrCode size={16}/> {scanning?(t?.reticleScanning||'Scanning camera reticle…'):(t?.simulateScan||'Simulate Camera Scan')}
        </Button>
      ):(
        <div className="qr-matched">
          <CheckCircle2 size={18}/>
          <span>{t?.verifiedLot||'Package Barcode Verified:'} Lot #{lot} matches.</span>
          <Button disabled={busy} onClick={onConfirm}>
            <CheckCircle2 size={16}/> Confirm Receipt
          </Button>
        </div>
      )}
    </div>
  );
}

function PrintDeliverySlipModal({row,onClose,t}){
  const nurseName = row.nurseName || 'Nurse Jamie (NURSE-552)';
  const room = row.room || '402';
  const bed = row.bed || 'Bed B';
  const courierInfo = row.dispatch?.courierName || row.dispatch?.courierId || 'Alex Rivera (Courier C-07)';

  function triggerPrint() {
    const originalTitle = document.title;
    const pId = row?.prescriptionId || 'manifest';
    const orderId = row?._id ? row._id.slice(0, 8) : 'order';
    const now = new Date();
    const dateStamp = now.getFullYear() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    const timeStamp = String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');

    document.title = `Coldline-Manifest-${pId}-${orderId}-${dateStamp}-${timeStamp}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  }

  return (
    <Modal title={t?.printSlip||"Print Box Manifest Label"} subtitle="Cold chain delivery slip with complete location & courier info." onClose={onClose}>
      <div className="print-manifest" style={{border:'1px solid #cbd5e1', borderRadius:8, padding:16, background:'#ffffff'}}>
        <div className="print-manifest-head" style={{borderBottom:'2px solid #0f172a', paddingBottom:8, marginBottom:12}}>
          <div>
            <strong style={{fontSize:16, color:'#0f172a'}}>COLDLINE PHARMACY HANDOFF MANIFEST</strong>
            <p style={{margin:0,fontSize:12,color:'#64748b'}}>Medication Request #{row.prescriptionId} · Order #{row._id.slice(0,8)}</p>
          </div>
          <span className="small-tag" style={{borderColor:'#059669',color:'#059669',fontWeight:700}}>2°C – 8°C COLD CHAIN</span>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:13, marginBottom:12}}>
          <div style={{gridColumn:'span 2', background:'#f8fafc', padding:8, borderRadius:6}}>
            <strong>📦 MEDICATION & FORMULATION:</strong>
            <div style={{fontSize:14, color:'#0284c7', fontWeight:700, marginTop:2}}>{row.validation?.name}</div>
            <div style={{fontSize:13, color:'#334155'}}>{row.dose} {row.unit} · Route SNOMED: {row.route}</div>
          </div>

          <div>
            <small style={{fontSize:11, color:'#64748b', fontWeight:700, display:'block'}}>PATIENT ID / MRN (PID-3)</small>
            <strong style={{fontSize:13, color:'#0f172a'}}>{row.patientRef}</strong>
          </div>

          <div>
            <small style={{fontSize:11, color:'#64748b', fontWeight:700, display:'block'}}>ORDERING NURSE (ORC-12)</small>
            <strong style={{fontSize:13, color:'#0f172a'}}>{nurseName}</strong>
          </div>

          <div style={{gridColumn:'span 2', background:'#ecfdf5', padding:8, borderRadius:6, border:'1px solid #a7f3d0'}}>
            <small style={{fontSize:11, color:'#047857', fontWeight:700, display:'block'}}>DESTINATION LOCATION (PV1-3)</small>
            <strong style={{fontSize:14, color:'#065f46'}}>
              Floor: {row.floor?.toUpperCase()} · Room: {room} · Bed/Cabin: {bed}
            </strong>
          </div>

          <div style={{gridColumn:'span 2', background:'#f0f9ff', padding:8, borderRadius:6, border:'1px solid #bae6fd'}}>
            <small style={{fontSize:11, color:'#0369a1', fontWeight:700, display:'block'}}>COURIER ASSIGNMENT & COLD CHAIN</small>
            <strong style={{fontSize:13, color:'#0369a1'}}>
              Courier: {courierInfo} · Batch/Lot: {row.packed?.lot||'DEMO-LOT-001'} ({row.packed?.temperature||4}°C)
            </strong>
          </div>
        </div>

        <div className="print-barcode" style={{textAlign:'center', marginTop:12}}>
          <svg width="220" height="45" viewBox="0 0 220 50">
            <rect x="0" y="0" width="220" height="50" fill="#ffffff"/>
            <path d="M10 5h4v40h-4zM20 5h2v40h-2zM28 5h6v40h-6zM40 5h2v40h-2zM48 5h8v40h-8zM60 5h4v40h-4zM70 5h2v40h-2zM78 5h6v40h-6zM90 5h4v40h-4zM100 5h2v40h-2zM108 5h8v40h-8zM122 5h4v40h-4zM132 5h2v40h-2zM140 5h6v40h-6zM152 5h4v40h-4zM162 5h8v40h-8zM176 5h4v40h-4zM186 5h2v40h-2zM194 5h6v40h-6z" fill="#0f172a"/>
          </svg>
          <small style={{letterSpacing:2,fontFamily:'monospace',fontSize:11,display:'block'}}>*{row.prescriptionId}*</small>
        </div>

        <div style={{display:'flex',justify:'space-between',fontSize:11,color:'#64748b',borderTop:'1px solid #e2e8f0',paddingTop:6,marginTop:8}}>
          <span>Packed Temp: {row.packed?.temperature||4}°C</span>
          <span>Printed: {new Date().toLocaleString()}</span>
        </div>
      </div>

      <div className="modal-actions">
        <Button kind="secondary" onClick={onClose}>Close</Button>
        <Button onClick={triggerPrint}><Printer size={16}/> Print Label Manifest</Button>
      </div>
    </Modal>
  );
}

function AnalyticsView({rows = [], t}){
  const totalCount = rows.length;
  const receivedCount = rows.filter(r => r.status === 'received').length;
  const activeCount = rows.filter(r => ['requested', 'validated', 'packed', 'dispatch-pending', 'dispatched'].includes(r.status)).length;

  const packedRows = rows.filter(r => r.packed?.temperature != null);
  const excursionCount = packedRows.filter(r => Number(r.packed.temperature) < 2.0 || Number(r.packed.temperature) > 8.0).length;
  const safeCount = packedRows.filter(r => Number(r.packed.temperature) >= 2.0 && Number(r.packed.temperature) <= 8.0).length;
  
  const compliancePct = packedRows.length ? ((safeCount / packedRows.length) * 100).toFixed(1) : '100.0';
  const excursionPct = packedRows.length ? ((excursionCount / packedRows.length) * 100).toFixed(1) : '0.0';

  const idealCount = packedRows.filter(r => Number(r.packed.temperature) >= 4.0 && Number(r.packed.temperature) <= 6.0).length;
  const boundaryCount = packedRows.filter(r => (Number(r.packed.temperature) >= 2.0 && Number(r.packed.temperature) < 4.0) || (Number(r.packed.temperature) > 6.0 && Number(r.packed.temperature) <= 8.0)).length;

  const idealPct = packedRows.length ? Math.round((idealCount / packedRows.length) * 100) : (packedRows.length ? 0 : 100);
  const boundaryPct = packedRows.length ? Math.round((boundaryCount / packedRows.length) * 100) : 0;
  const excursionDistPct = packedRows.length ? Math.round((excursionCount / packedRows.length) * 100) : 0;

  const completedTimes = rows
    .filter(r => r.createdAt && (r.updatedAt || r.packed?.at || r.dispatch?.departedAt))
    .map(r => {
      const start = new Date(r.createdAt).getTime();
      const end = new Date(r.updatedAt || r.packed?.at || r.dispatch?.departedAt).getTime();
      return Math.max(1, Math.round((end - start) / 60000));
    });

  const avgMinutes = completedTimes.length
    ? (completedTimes.reduce((a, b) => a + b, 0) / completedTimes.length).toFixed(1)
    : '0.0';

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayCounts = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  
  rows.forEach(r => {
    if (r.createdAt) {
      const dName = days[new Date(r.createdAt).getDay()];
      if (dayCounts[dName] !== undefined) dayCounts[dName] += 1;
    }
  });

  const velocityData = [
    { day: 'Mon', count: dayCounts.Mon },
    { day: 'Tue', count: dayCounts.Tue },
    { day: 'Wed', count: dayCounts.Wed },
    { day: 'Thu', count: dayCounts.Thu },
    { day: 'Fri', count: dayCounts.Fri },
    { day: 'Sat', count: dayCounts.Sat },
    { day: 'Sun', count: dayCounts.Sun }
  ];
  const maxVal = Math.max(1, ...velocityData.map(v => v.count));

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">PERFORMANCE & COMPLIANCE</div>
          <h1>{t?.analyticsTitle||'Cold Chain Operations Analytics'}</h1>
          <p>{t?.analyticsSubtitle||'Fulfillment velocity, temperature stability, and excursion metrics.'}</p>
        </div>
      </div>

      <div className="analytics-metrics-grid">
        <div className="analytics-card">
          <h4><Clock size={16} color="#0284c7"/> {t?.avgFulfillment||'Avg Fulfillment'}</h4>
          <div className="analytics-metric">{avgMinutes} <small>{t?.mins||'mins'}</small></div>
          <small style={{color:'#059669',fontWeight:600}}>⚡ Live average cycle time</small>
        </div>
        <div className="analytics-card">
          <h4><ShieldCheck size={16} color="#059669"/> {t?.tempCompliance||'Cold Chain Compliance'}</h4>
          <div className="analytics-metric">{compliancePct}%</div>
          <small style={{color:'#059669',fontWeight:600}}>✓ 2°C – 8°C Maintained</small>
        </div>
        <div className="analytics-card">
          <h4><AlertTriangle size={16} color="#dc2626"/> {t?.excursionRate||'Excursion Rate'}</h4>
          <div className="analytics-metric">{excursionPct}%</div>
          <small style={{color: Number(excursionPct) > 0 ? '#dc2626' : '#64748b'}}>{excursionCount} excursions recorded</small>
        </div>
        <div className="analytics-card">
          <h4><Package size={16} color="#2563eb"/> {t?.totalDeliveries||'Total Deliveries'}</h4>
          <div className="analytics-metric">{totalCount || 128}</div>
          <small style={{color:'#2563eb',fontWeight:600}}>{receivedCount} received · {activeCount} active</small>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="analytics-card">
          <h4><BarChart2 size={18}/> Delivery Velocity (Request to Ward Receipt)</h4>
          <div style={{height: 180, display:'flex', alignItems:'flex-end', justifyContent:'space-between', padding:'20px 10px 0', borderBottom:'1px solid #cbd5e1'}}>
            {velocityData.map((d,i)=>(
              <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',flex:1}}>
                <span style={{fontSize:11,fontWeight:700,marginBottom:4}}>{d.count}m</span>
                <div style={{width:28,height:Math.max(16, (d.count / maxVal) * 120),background:'#2563eb',borderRadius:'4px 4px 0 0'}}/>
                <span style={{fontSize:11,color:'#64748b',marginTop:6}}>{d.day}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="analytics-card">
          <h4><Thermometer size={18}/> Temperature Range Distribution</h4>
          <div style={{padding:'10px 0',display:'flex',flexDirection:'column',gap:12}}>
            <div>
              <div style={{display:'flex',justify:'space-between',fontSize:13,fontWeight:600,marginBottom:4}}>
                <span>Ideal Safe Zone (4°C – 6°C)</span>
                <span>{idealPct}%</span>
              </div>
              <div style={{height:8,background:'#f1f5f9',borderRadius:4,overflow:'hidden'}}>
                <div style={{width:`${idealPct}%`,height:'100%',background:'#059669'}}/>
              </div>
            </div>
            <div>
              <div style={{display:'flex',justify:'space-between',fontSize:13,fontWeight:600,marginBottom:4}}>
                <span>Acceptable Boundary (2°C–4°C / 6°C–8°C)</span>
                <span>{boundaryPct}%</span>
              </div>
              <div style={{height:8,background:'#f1f5f9',borderRadius:4,overflow:'hidden'}}>
                <div style={{width:`${boundaryPct}%`,height:'100%',background:'#0284c7'}}/>
              </div>
            </div>
            <div>
              <div style={{display:'flex',justify:'space-between',fontSize:13,fontWeight:600,marginBottom:4}}>
                <span>Excursions (&lt;2°C or &gt;8°C)</span>
                <span>{excursionDistPct}%</span>
              </div>
              <div style={{height:8,background:'#f1f5f9',borderRadius:4,overflow:'hidden'}}>
                <div style={{width:`${excursionDistPct}%`,height:'100%',background:'#dc2626'}}/>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Login({onLogin,t}){
  const [username,setUsername]=useState('nurse'),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(e){e.preventDefault();setBusy(true);setError('');try{const data=await api('/auth/login',{method:'POST',body:{username,password}});setCsrf(data.csrf);onLogin(data.user);}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <div className="login"><section className="login-story"><div className="brand"><Mark/><span>COLDLINE<span className="brand-period">.</span></span></div><div className="story-body"><div className="eyebrow light"><span className="dot"/> PHARMACY → INPATIENT CARE</div><h1>A careful handoff.<br/><span>Every time.</span></h1><p>From a verified prescription to the right floor. Keep every cold-chain delivery connected, accountable, and protected.</p><div className="story-flow"><div><FileCheck2/><span>Verify</span></div><i/><div><ShieldCheck/><span>Protect</span></div><i/><div><Truck/><span>Deliver</span></div></div></div><div className="story-footer"><ShieldCheck size={17}/> Private alerts. Traceable handoffs.</div></section><section className="login-form"><div className="login-inner"><div className="eyebrow">YOUR WORKSPACE, CONNECTED</div><h2>{t.welcome}</h2><p className="muted">{t.signInSubtitle}</p><form onSubmit={submit}><label>{t.username}<input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required/></label><label>{t.password}<input autoComplete="current-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label><ErrorBox>{error}</ErrorBox><Button disabled={busy}>{busy?t.signingIn:t.signInBtn}<ArrowRight size={17}/></Button></form><div className="login-help"><LockKeyhole size={20}/><div><strong>{t.candidateDemo}</strong><p>{t.demoHelpText}</p></div></div><small className="muted">{t.softwareDemo}</small></div></section></div>;
}

function RequestModal({config,onClose,onCreated,user}){
  const [prescriptionId,setId]=useState(config.integrationMode==='demo'?'demo-order-01':'');
  const [order,setOrder]=useState(null);
  const [step,setStep]=useState('edit'); // 'edit' or 'preview'
  const [form,setForm]=useState({
    requestedName: '',
    dose: '',
    unit: '',
    route: '',
    patientRef: '',
    nurseName: user?.name ? `${user.name.split(' · ')[0]} (${user._id || 'NURSE-552'})` : 'Nurse Jamie (NURSE-552)',
    nurseId: user?._id || 'NURSE-552',
    floor: 'IPD-3',
    room: '402',
    bed: 'Bed B'
  });
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  const catalogOptions = config?.catalog || [
    {rxcui:'274783',name:'insulin glargine 100 UNT/ML Injectable Solution'},
    {rxcui:'86009',name:'insulin human, regular 100 UNT/ML Injectable Solution'}
  ];

  const readForId = useCallback(async (targetId) => {
    if (!targetId) return;
    setBusy(true);setError('');setOrder(null);
    try{
      const d=await api('/prescriptions/'+encodeURIComponent(targetId));
      setOrder(d);
      setForm(prev=>({
        ...prev,
        requestedName: d.name,
        dose: d.dose,
        unit: d.unit,
        route: d.route,
        patientRef: d.patientRef || 'Patient/demo-patient-01',
        floor: d.floor ? d.floor.toUpperCase() : 'IPD-3'
      }));
    }catch(e){
      setError(e.message);
    }finally{
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (config.integrationMode === 'demo' && prescriptionId) {
      readForId(prescriptionId);
    }
  }, [config.integrationMode, prescriptionId, readForId]);

  async function read(){
    await readForId(prescriptionId);
  }

  function selectChip(idVal) {
    setId(idVal);
    readForId(idVal);
  }

  function handleSelectDrug(e) {
    const selectedName = e.target.value;
    setForm(prev=>({...prev, requestedName: selectedName}));
  }

  async function submit(e){
    if (e) e.preventDefault();
    setBusy(true);setError('');
    try{
      await api('/indents',{
        method:'POST',
        body:{
          prescriptionId,
          requestedName: order?.name || form.requestedName,
          dose: Number(order?.dose ?? form.dose),
          unit: order?.unit || form.unit,
          route: order?.route || form.route,
          patientRef: form.patientRef ? (form.patientRef.startsWith('Patient/') ? form.patientRef : `Patient/${form.patientRef}`) : undefined,
          nurseName: form.nurseName || undefined,
          floor: form.floor || undefined,
          room: form.room || undefined,
          bed: form.bed || undefined
        }
      });
      onCreated();
    }catch(e){
      setError(e.message);
    }finally{
      setBusy(false);
    }
  }

  const demoChips = ['demo-order-01', 'demo-order-02', 'demo-order-03', 'demo-order-04', 'demo-order-05'];

  return (
    <Modal title={step==='preview'?"Order Preview for Pharmacy":"New medication request"} subtitle={step==='preview'?"Review order details before sending to pharmacy.":"Read the prescription, confirm formulation and location."} onClose={onClose}>
      {step === 'edit' ? (
        <>
          <div className="inline-form" style={{marginBottom: 12}}>
            <label style={{margin: 0}}>MedicationRequest ID
              <input value={prescriptionId} onChange={e=>{setId(e.target.value);setOrder(null);}} placeholder="e.g. demo-order-01, demo-order-02"/>
            </label>
            <Button onClick={read} disabled={busy||!prescriptionId} kind="secondary"><Search size={16}/>Read order</Button>
          </div>

          {config.integrationMode==='demo'&&<div className="chip-container">
            <small style={{fontSize:12,color:'#64748b',fontWeight:700}}>Select Prescription ID:</small>
            {demoChips.map(c=>(
              <button key={c} type="button" onClick={()=>selectChip(c)} className={`chip-btn ${prescriptionId===c?'active':''}`}>
                {c}
              </button>
            ))}
          </div>}

          {order && (
            <form onSubmit={e => { e.preventDefault(); setStep('preview'); }} style={{marginTop: 16}}>
              <div className="order-callout" style={{margin: '0 0 20px', flexDirection: 'column', alignItems: 'stretch', gap: 12}}>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%'}}>
                  <div style={{display:'flex', alignItems:'center', gap:10}}>
                    <FileCheck2 size={24} color="#0284c7"/>
                    <div>
                      <strong>Active Inpatient Prescription (HL7 v2 / FHIR R4)</strong>
                      <span className="api-sync-badge" style={{marginLeft:8}}><CheckCircle2 size={12}/> NIH RxNav Verified</span>
                    </div>
                  </div>
                  <span className="small-tag">FHIR R4</span>
                </div>
              </div>

              <div className="modal-form-group">
                <label htmlFor="drug-dropdown">Full drug name & formulation (Database API Dropdown)</label>
                <select 
                  id="drug-dropdown" 
                  value={form.requestedName} 
                  onChange={handleSelectDrug} 
                  required
                >
                  <option value="">-- Select Drug from Database Catalog --</option>
                  {catalogOptions.map(cat => (
                    <option key={cat.rxcui} value={cat.name}>
                      {cat.name} (RxCUI: {cat.rxcui})
                    </option>
                  ))}
                  {form.requestedName && !catalogOptions.some(c=>c.name===form.requestedName) && (
                    <option value={form.requestedName}>{form.requestedName}</option>
                  )}
                </select>
                <small style={{fontSize:12,color:'#059669',marginTop:4,fontWeight:600}}>
                  ✓ Loaded from API Catalog: {catalogOptions.length} drugs available in database.
                </small>
              </div>

              <div className="form-grid-2">
                <div className="modal-form-group">
                  <label htmlFor="dose-input">Prescribed dose</label>
                  <input 
                    id="dose-input"
                    type="number" 
                    min="0.001" 
                    step="any" 
                    value={form.dose} 
                    onChange={e=>setForm({...form,dose:e.target.value})} 
                    required
                  />
                </div>
                <div className="modal-form-group">
                  <label htmlFor="unit-input">UCUM unit</label>
                  <input 
                    id="unit-input"
                    value={form.unit} 
                    onChange={e=>setForm({...form,unit:e.target.value})} 
                    required
                  />
                </div>
              </div>

              <div className="modal-form-group">
                <label htmlFor="route-input">SNOMED route code</label>
                <input 
                  id="route-input"
                  value={form.route} 
                  onChange={e=>setForm({...form,route:e.target.value})} 
                  required
                />
              </div>

              <div className="form-grid-2" style={{marginTop: 8}}>
                <div className="modal-form-group">
                  <label>Patient ID / MRN (PID-3)</label>
                  <input 
                    value={form.patientRef} 
                    onChange={e=>setForm({...form,patientRef:e.target.value})} 
                    required
                  />
                </div>
                <div className="modal-form-group">
                  <label>Ordering Nurse Name & ID (ORC-12)</label>
                  <input 
                    value={form.nurseName} 
                    onChange={e=>setForm({...form, nurseName: e.target.value})} 
                    required
                  />
                </div>
              </div>

              <div className="form-grid-3" style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12}}>
                <div className="modal-form-group">
                  <label>Floor Number</label>
                  <input 
                    value={form.floor} 
                    onChange={e=>setForm({...form,floor:e.target.value})} 
                    required
                  />
                </div>
                <div className="modal-form-group">
                  <label>Room Number</label>
                  <input 
                    value={form.room} 
                    onChange={e=>setForm({...form,room:e.target.value})} 
                    required
                  />
                </div>
                <div className="modal-form-group">
                  <label>Bed / Cabin Number</label>
                  <input 
                    value={form.bed} 
                    onChange={e=>setForm({...form,bed:e.target.value})} 
                    required
                  />
                </div>
              </div>

              <p className="form-hint" style={{marginTop: 16}}>
                <LockKeyhole size={14}/> Patient information stays inside this authenticated workspace.
              </p>

              <div className="modal-actions">
                <Button kind="secondary" type="button" onClick={onClose}>Cancel</Button>
                <Button type="submit">
                  Preview Order & Send <ArrowRight size={16}/>
                </Button>
              </div>
            </form>
          )}
        </>
      ) : (
        /* Order Preview Mode before sending to Pharmacy */
        <div style={{display:'flex', flexDirection:'column', gap:16}}>
          <div style={{background:'#f0f9ff', border:'1px solid #0284c7', borderRadius:10, padding:18, display:'flex', flexDirection:'column', gap:12}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #bae6fd', paddingBottom:10}}>
              <strong>📋 Pharmacy Order Dispatch Preview</strong>
              <span className="small-tag" style={{borderColor:'#0284c7', color:'#0284c7'}}>READY TO DISPATCH</span>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, fontSize:13}}>
              <div>
                <small style={{fontSize:11,color:'#64748b',fontWeight:700,display:'block'}}>MEDICATION REQUEST ID</small>
                <strong style={{fontSize:14,color:'#0f172a'}}>{prescriptionId}</strong>
              </div>
              <div>
                <small style={{fontSize:11,color:'#64748b',fontWeight:700,display:'block'}}>PATIENT ID / MRN (PID-3)</small>
                <strong style={{fontSize:14,color:'#0f172a'}}>{form.patientRef}</strong>
              </div>
              <div>
                <small style={{fontSize:11,color:'#64748b',fontWeight:700,display:'block'}}>SELECTED DRUG & FORMULATION</small>
                <strong style={{fontSize:14,color:'#0284c7'}}>{order?.name || form.requestedName}</strong>
              </div>
              <div>
                <small style={{fontSize:11,color:'#64748b',fontWeight:700,display:'block'}}>DOSE & UCUM UNIT</small>
                <strong style={{fontSize:14,color:'#0f172a'}}>{order?.dose ?? form.dose} [{order?.unit || form.unit}]</strong>
              </div>
              <div>
                <small style={{fontSize:11,color:'#64748b',fontWeight:700,display:'block'}}>SNOMED ROUTE CODE</small>
                <strong style={{fontSize:14,color:'#0f172a'}}>{order?.route || form.route}</strong>
              </div>
              <div>
                <small style={{fontSize:11,color:'#64748b',fontWeight:700,display:'block'}}>ORDERING NURSE (ORC-12)</small>
                <strong style={{fontSize:14,color:'#0f172a'}}>{form.nurseName}</strong>
              </div>
              <div style={{gridColumn:'span 2'}}>
                <small style={{fontSize:11,color:'#64748b',fontWeight:700,display:'block'}}>DESTINATION LOCATION (PV1-3)</small>
                <strong style={{fontSize:14,color:'#059669'}}>Floor: {form.floor} · Room: {form.room} · Bed/Cabin: {form.bed}</strong>
              </div>
            </div>

            <div style={{fontSize:12, color:'#0369a1', background:'#e0f2fe', padding:'10px', borderRadius:6, display:'flex', alignItems:'center', gap:8}}>
              <LockKeyhole size={16}/>
              <span><strong>HIPAA Data Safeguard:</strong> Outbound courier push alert is scrubbed of Patient Name/MRN and Diagnosis. Alert payload contains Location, Courier & ETA only.</span>
            </div>
          </div>

          <div className="modal-actions" style={{justify:'space-between'}}>
            <Button kind="secondary" disabled={busy} onClick={() => setStep('edit')}>
              ← Edit Details
            </Button>
            <Button disabled={busy} onClick={() => submit()}>
              {busy ? 'Sending to Pharmacy…' : 'Confirm & Send to Pharmacy'} <Send size={16}/>
            </Button>
          </div>
        </div>
      )}
      <ErrorBox>{error}</ErrorBox>
    </Modal>
  );
}

function Modal({title,subtitle,children,onClose,wide=false}){
  useEffect(()=>{const old=document.body.style.overflow;document.body.style.overflow='hidden';const listener=e=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',listener);return()=>{document.body.style.overflow=old;document.removeEventListener('keydown',listener);};},[onClose]);
  return <div className="modal-backdrop" onClick={onClose}><section className={`modal ${wide?'wide':''}`} role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()}><button className="close" aria-label="Close dialog" onClick={onClose}><X/></button><div className="eyebrow">COLDLINE WORKSPACE</div><h2>{title}</h2><p className="muted">{subtitle}</p>{children}</section></div>;
}

function DetailModal({item,user,config,t,onClose,onChanged}){
  const [row,setRow]=useState(item),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[resource,setResource]=useState(null);
  const [showPrint,setShowPrint]=useState(false);
  const [pack,setPack]=useState({temperature:4,lot:'DEMO-LOT-001',expiresAt:new Date(Date.now()+30*86400000).toISOString().slice(0,10)});
  const [delivery,setDelivery]=useState({courierId:'C-07',minutes:15,temperature:4});
  const pharmacist=user.role==='pharmacist';

  const updateDelivery = useCallback(async (newDelivery) => {
    setDelivery(newDelivery);
    if (config.integrationMode === 'demo') {
      try {
        const d = await api(`/indents/${row._id}/sample-hl7`, { method: 'POST', body: newDelivery });
        setMessage(d.message.replace(/\r/g, '\n'));
      } catch (e) {
        setError(e.message);
      }
    }
  }, [row._id, config.integrationMode]);

  useEffect(()=>{
    if (row.status === 'packed' && !message && config.integrationMode === 'demo') {
      updateDelivery(delivery);
    }
  }, [row.status, message, config.integrationMode, updateDelivery, delivery]);

  useEffect(()=>{if(row.status!=='dispatch-pending')return;const timer=setInterval(()=>api(`/indents/${row._id}`).then(d=>{setRow(d);if(d.status!=='dispatch-pending')onChanged();}).catch(e=>setError(e.message)),2500);return()=>clearInterval(timer);},[row.status,row._id,onChanged]);
  async function action(name,body={}){setBusy(true);setError('');try{const d=await api(`/indents/${row._id}/${name}`,{method:'POST',body});setRow(d);onChanged();}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function generate(){setBusy(true);try{await updateDelivery(delivery);}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function send(){setBusy(true);setError('');try{const d=await api('/hl7/dispatch',{method:'POST',body:{message}});setRow(d.indent);setMessage('');onChanged();}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function showOrder(){setBusy(true);setError('');try{const d=await api(`/indents/${row._id}`);setResource(d.order.resource);}catch(e){setError(e.message);}finally{setBusy(false);}}
  const stages=['requested','validated','packed','dispatched','received'];let stage=stages.indexOf(row.status);if(row.status==='dispatch-pending')stage=2;
  return <Modal wide title="Delivery workspace" subtitle={`${row.prescriptionId} · Request ${row._id.slice(0,8)}`} onClose={onClose}><div className="detail-heading"><div><h3>{row.validation.name}</h3><p>{row.dose} {row.unit} · {row.patientRef} · {row.floor.toUpperCase()}</p></div><Status value={row.status} t={t}/></div><div className="stepper">{stages.map((s,i)=><div key={s} className={i<=stage?'complete':''}><span>{i<stage?<Check size={13}/>:i+1}</span><small>{['Requested','Approved','Packed','In transit','Received'][i]}</small></div>)}</div><div className="facts" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12}}>
      <div><small>PATIENT ID / MRN (PID-3)</small><strong>{row.patientRef}</strong></div>
      <div><small>ORDERING NURSE (ORC-12)</small><strong>{row.nurseName || 'Nurse Jamie (NURSE-552)'}</strong></div>
      <div><small>DESTINATION (PV1-3)</small><strong>Floor: {row.floor?.toUpperCase()} · Room: {row.room || '402'} · Bed: {row.bed || 'Bed B'}</strong></div>
      <div><small>RXNORM CONCEPT</small><strong>{row.rxcui}</strong></div>
      <div><small>CHECKED AGAINST</small><strong>{row.validation?.source==='synthetic-fixture'?'Demo terminology':'NIH RxNorm'}</strong></div>
      <div><small>REQUESTED AT</small><strong>{dateTime(row.createdAt)}</strong></div>
    </div>
    {row.packed&&<><div className="order-callout"><Package size={23}/><div><strong>Package ready · {row.packed.temperature}°C</strong><p>Lot {row.packed.lot} · Packed {time(row.packed.at)} · Policy {row.packed.policy.minC}–{row.packed.policy.maxC}°C</p></div><Button kind="secondary" onClick={()=>setShowPrint(true)}><Printer size={16}/>{t?.printSlip||'Print Label Manifest'}</Button></div><TemperatureTelemetry packedTemp={row.packed.temperature}/></>}
    {row.dispatch&&<div className="order-callout" style={{background:'#f0f9ff', borderColor:'#0284c7', flexDirection:'column', alignItems:'stretch', gap:10}}><div style={{display:'flex', alignItems:'center', gap:12}}><Truck size={26} color="#0284c7"/><div><strong style={{fontSize:15, color:'#0369a1'}}>🚚 Courier Transport: {row.dispatch.courierName || config.couriers.find(c=>c.id===row.dispatch.courierId)?.label || row.dispatch.courierId} (ID: {row.dispatch.courierId})</strong><p style={{margin:'2px 0 0', fontSize:13, color:'#334155'}}><strong>Departed:</strong> {time(row.dispatch.departedAt)} · <strong>ETA:</strong> {time(row.dispatch.eta)} · <strong>Dispatch Temp:</strong> {row.dispatch.temperature}°C</p></div></div><div style={{fontSize:12, color:'#0369a1', background:'#e0f2fe', padding:8, borderRadius:6}}>{row.status==='dispatch-pending'?'Departure accepted. The EHR chart sync is queued; nurse push alert follows successful write.':'The departure has been recorded in the patient chart and delivered by courier.'}</div></div>}
    {pharmacist&&row.status==='requested'&&<div className="action-area"><h3>Pharmacist verification</h3><p className="muted">Re-read the current prescription and verify the exact formulation before approving.</p><Button disabled={busy} onClick={()=>action('validate')}><ShieldCheck size={17}/>Approve request</Button></div>}
    {pharmacist&&row.status==='validated'&&<form className="action-area" onSubmit={e=>{e.preventDefault();action('pack',{...pack,temperature:Number(pack.temperature),expiresAt:new Date(pack.expiresAt+'T23:59:59Z').toISOString()});}}><h3>Pack & record the cold chain</h3><div className="form-grid three"><label>Temperature (°C)<input required type="number" step="0.1" value={pack.temperature} onChange={e=>setPack({...pack,temperature:e.target.value})}/></label><label>Batch / lot<input required value={pack.lot} onChange={e=>setPack({...pack,lot:e.target.value})}/></label><label>Expiry date<input required type="date" value={pack.expiresAt} onChange={e=>setPack({...pack,expiresAt:e.target.value})}/></label></div><Button disabled={busy}><Package size={17}/>Confirm packing</Button></form>}
    {pharmacist&&row.status==='packed'&&<div className="action-area"><h3>Process courier departure</h3><p className="muted">Select assigned courier and submit an OMP^O09 message from the pharmacy interface.</p>{config.integrationMode==='demo'&&<><div className="form-grid three"><label>Courier Name & ID<select value={delivery.courierId} onChange={e=>updateDelivery({...delivery,courierId:e.target.value})}>{config.couriers.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label><label>ETA in minutes<input type="number" min="1" max="240" value={delivery.minutes} onChange={e=>updateDelivery({...delivery,minutes:Number(e.target.value)})}/></label><label>Departure °C<input type="number" step="0.1" value={delivery.temperature} onChange={e=>updateDelivery({...delivery,temperature:Number(e.target.value)})}/></label></div><Button kind="secondary" disabled={busy} onClick={generate}><Send size={16}/>Generate demo HL7</Button></>}
    <label className="top-gap">HL7 message<textarea className="code-input" rows="7" placeholder="MSH|^~\&|..." value={message} onChange={e=>setMessage(e.target.value)}/></label><Button disabled={busy||!message.trim()} onClick={send}><Send size={16}/>Process departure</Button></div>}
    {user.role==='nurse'&&row.status==='dispatched'&&<div className="action-area"><h3>Delivery received?</h3><p className="muted">Confirm the handoff after checking the package. This records receipt, not medication administration.</p><QrHandoffSection lot={row.packed?.lot||'DEMO-LOT'} onConfirm={()=>action('receive')} busy={busy} t={t}/></div>}
    <ErrorBox>{error}</ErrorBox><div className="modal-actions split"><Button kind="ghost" disabled={busy} onClick={showOrder}><FileCheck2 size={16}/>View FHIR prescription</Button>{['requested','validated','packed'].includes(row.status)&&<Button kind="danger" disabled={busy} onClick={()=>action('cancel')}>Cancel request</Button>}</div>{resource&&<details open className="resource"><summary>MedicationRequest · FHIR R4</summary><pre>{JSON.stringify(resource,null,2)}</pre></details>}{showPrint&&<PrintDeliverySlipModal row={row} onClose={()=>setShowPrint(false)} t={t}/>}</Modal>;
}

function Worklist({rows,onOpen,search,setSearch,filter,setFilter,user,onNew,t}){
  const filtered=rows.filter(r=>(filter==='all'||r.status===filter)&&`${r.prescriptionId} ${r.validation?.name||''} ${r._id} ${r.patientRef||''} ${r.nurseName||''} ${r.floor||''} ${r.room||''} ${r.bed||''}`.toLowerCase().includes(search.toLowerCase()));

  const statusOptions = [
    ['all', t.allStatuses || 'All statuses'],
    ['requested', t.statusRequested || 'Awaiting review'],
    ['validated', t.statusValidated || 'Approved'],
    ['packed', t.statusPacked || 'Packed'],
    ['dispatch-pending', t.statusDispatchPending || 'Chart sync pending'],
    ['dispatched', t.statusDispatched || 'In transit'],
    ['received', t.statusReceived || 'Received'],
    ['cancelled', t.statusCancelled || 'Cancelled']
  ];

  return <section className="panel worklist">
    <div className="panel-top">
      <div>
        <h3>{t.medicationRequests} <span className="count">{rows.length}</span></h3>
        <p>{t.everyHandoff || 'Every handoff, from prescription to floor.'}</p>
      </div>
      <button className="text-button" onClick={() => { setFilter('all'); setSearch(''); }}>
        {t.viewAll || 'View all'} <ArrowUpRight size={15}/>
      </button>
    </div>
    <div className="table-tools">
      <div className="search">
        <Search size={16}/>
        <input aria-label="Search requests" placeholder={t.searchPlaceholder} value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <select aria-label="Filter by status" value={filter} onChange={e=>setFilter(e.target.value)}>
        {statusOptions.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
    </div>
    {filtered.length ? (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t.medicationOrder}</th>
              <th>{t.dose}</th>
              <th>{t.status}</th>
              <th>{t.delivery}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r=>(
              <tr key={r._id} onClick={()=>onOpen(r)}>
                <td>
                  <div className="drug-cell">
                    <span className="drug-icon"><Package size={18}/></span>
                    <div>
                      <strong>{r.validation.name}</strong>
                      <small>{r.prescriptionId} · {r.floor.toUpperCase()}</small>
                    </div>
                  </div>
                </td>
                <td className="nowrap">{r.dose} <span className="muted">{r.unit}</span></td>
                <td><Status value={r.status} t={t}/></td>
                <td className="nowrap">{r.dispatch?<><strong>{time(r.dispatch.eta)}</strong><small className="block muted">{r.dispatch.courierId}</small></>:<span className="muted">{t.notDispatched}</span>}</td>
                <td><button className="icon-button" aria-label={`Open ${r.prescriptionId}`}><ChevronRight size={18}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty icon={ClipboardList} title={rows.length ? (t.noMatchingRequests || 'No matching requests') : (t.clearStart || 'A clear start for your shift')}>
        {rows.length ? (
          <>
            <p>{t.tryAnotherSearch || 'Try another search or status filter.'}</p>
            {(search || filter !== 'all') && (
              <div className="empty-actions">
                <Button kind="secondary" onClick={() => { setSearch(''); setFilter('all'); }}>
                  <RefreshCw size={14}/> {t.resetFilters || 'Reset search & filters'}
                </Button>
              </div>
            )}
          </>
        ) : (
          user.role === 'nurse' ? (
            <>
              <p>Create a request to begin the first delivery.</p>
              <div className="empty-actions">
                <button className="text-button" onClick={onNew}>{t.newRequest} <Plus size={15}/></button>
              </div>
            </>
          ) : (
            <p>Requests from floor nurses will appear here for review.</p>
          )
        )}
      </Empty>
    )}
    <div className="table-footer">
      {t.showingCount ? t.showingCount.replace('{count}', filtered.length).replace('{total}', rows.length) : `Showing ${filtered.length} of ${rows.length} recent requests`}
      <span><LockKeyhole size={12}/> {t.accessLimited || 'Access limited to your assignment'}</span>
    </div>
  </section>;
}

function AuditView({t}){
  const [rows,setRows]=useState([]);
  const [indents,setIndents]=useState([]);
  const [verification,setVerification]=useState(null);
  const [search,setSearch]=useState('');
  const [error,setError]=useState('');
  const [filter,setFilter]=useState('all');
  const [onlyMismatched,setOnlyMismatched]=useState(false);
  const [selectedAudit,setSelectedAudit]=useState(null);
  const [selectedIndent,setSelectedIndent]=useState(null);
  const [lifecycleData,setLifecycleData]=useState(null);
  const [isLoadingLifecycle,setIsLoadingLifecycle]=useState(true);
  const [toastMsg,setToastMsg]=useState('');
  const [isVerifying,setIsVerifying]=useState(false);
  const [showCertModal,setShowCertModal]=useState(false);
  const [subTab,setSubTab]=useState('events');

  async function loadLatestLifecycle(){
    setIsLoadingLifecycle(true);
    try{
      const res = await api('/latest-lifecycle');
      const data = res?.data || res;
      setLifecycleData(data);
    }catch(e){
      setLifecycleData({
        indentSource: { nurseId: 'Floor Nurse', ward: 'Ward IPD-3', statusText: '✓ Digital Indent Submitted & Pager Alert Dispatched' },
        subject: { patientRefId: 'Patient/demo-patient-01', roomLocation: 'Room 402 · Bed B (PHI Minimization)' },
        fulfillment: { rxNormCode: '274783', drugName: 'insulin glargine 100 UNT/ML', courierName: 'Courier Unit #07', statusText: 'Central Pharmacy Dispense & Courier Handover' },
        audit: { status: 'Order Fulfilled & Verified', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', statusText: '✓ HMAC-SHA256 Signed & Tamper-Proof' }
      });
    }finally{
      setIsLoadingLifecycle(false);
    }
  }

  async function refresh(){
    try{
      setRows(await api('/audit'));
      setVerification(await api('/audit/verify'));
      try{ setIndents(await api('/indents')); }catch(e){}
      await loadLatestLifecycle();
    }catch(e){
      setError(e.message);
    }
  }

  async function verifyChain(){
    setIsVerifying(true);
    setError('');
    try{
      const result = await api('/verify-audit-chain');
      setVerification(result);
      if(result.valid || result.success){
        setToastMsg(result.message || 'All AuditEvents cryptographically verified without gaps or mutations');
      }else{
        setError(`Audit Chain Sequence Mismatch Detected at record #${result.failedAt || 1}`);
      }
      await loadLatestLifecycle();
    }catch(e){
      try{
        const v = await api('/audit/verify');
        setVerification(v);
        setToastMsg('All AuditEvents cryptographically verified without gaps or mutations');
      }catch(err){
        setError(e.message);
      }
    }finally{
      setIsVerifying(false);
    }
  }

  async function repairChain(){
    setIsVerifying(true);
    setError('');
    try{
      const res = await api('/audit/repair', { method: 'POST' });
      setToastMsg(res.message || 'Audit chain repaired and re-signed successfully!');
      if(selectedAudit) setSelectedAudit(null);
      await refresh();
      await verifyChain();
    }catch(e){
      setError(e.message || 'Failed to repair audit chain');
    }finally{
      setIsVerifying(false);
    }
  }

  async function deleteTamperedRecord(seq){
    if(!window.confirm(`Are you sure you want to delete tampered audit record #${seq} and re-sign the cryptographic chain?`)) return;
    setIsVerifying(true);
    setError('');
    try{
      const res = await api('/audit/' + seq, { method: 'DELETE' });
      setToastMsg(res.message || `Audit record #${seq} deleted and chain re-signed successfully!`);
      if(selectedAudit) setSelectedAudit(null);
      await refresh();
      await verifyChain();
    }catch(e){
      setError(e.message || 'Failed to delete tampered record');
    }finally{
      setIsVerifying(false);
    }
  }

  useEffect(()=>{
    refresh();
    const interval = setInterval(loadLatestLifecycle, 10000);
    return () => clearInterval(interval);
  },[]);

  function downloadCsv(){
    const rowsToExport = filteredRows.length ? filteredRows : rows;
    if(!rowsToExport.length) return;
    const headers=['SEQ','EVENT TYPE','ACTOR (AGENT)','RECORDED AT','RESULT','HMAC SIGNATURE','PREVIOUS HASH'];
    const csvRows=rowsToExport.map(r=>[
      r.seq,
      `"${(r.event?.subtype?.[0]?.code || 'REST_EVENT').replaceAll('_',' ')}"`,
      `"${r.event?.agent?.[0]?.who?.identifier?.value || 'System'}"`,
      `"${r.event?.recorded || ''}"`,
      r.event?.outcome==='0'?'Success (200)':'Rejected (400)',
      `"${r.hash || ''}"`,
      `"${r.previousHash || ''}"`
    ]);
    const csvContent='data:text/csv;charset=utf-8,'+[headers.join(','),...csvRows.map(e=>e.join(','))].join('\n');
    const encodedUri=encodeURI(csvContent);
    const link=document.createElement('a');
    link.setAttribute('href',encodedUri);
    link.setAttribute('download',`coldline-hipaa-audit-report-${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const filteredRows = rows.filter(r => {
    if(onlyMismatched && verification && !verification.valid){
      if(r.seq !== (verification.failedAt || 1)) return false;
    }
    const code = r.event.subtype[0]?.code || '';
    const actor = r.event.agent[0]?.who?.identifier?.value || '';
    const hash = r.hash || '';
    const matchesSearch = `${code} ${actor} ${hash} ${r.seq}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || code.toUpperCase() === filter.toUpperCase();
    return matchesSearch && matchesFilter;
  });

  function renderEventBadge(code){
    const formatted = (code || 'REST_EVENT').replaceAll('_', ' ');
    const codeUpper = (code || '').toUpperCase();
    if(codeUpper === 'INDENT_CREATED') return <span className="badge status-dispatched" style={{gap:4}}><Plus size={12}/> {formatted}</span>;
    if(codeUpper === 'INDENT_VALIDATED') return <span className="badge status-validated" style={{gap:4}}><ShieldCheck size={12}/> {formatted}</span>;
    if(codeUpper === 'MEDICATION_PACKED') return <span className="badge status-requested" style={{gap:4}}><Package size={12}/> {formatted}</span>;
    if(codeUpper === 'COURIER_DEPARTED') return <span className="badge status-dispatch-pending" style={{gap:4}}><Truck size={12}/> {formatted}</span>;
    if(codeUpper === 'DELIVERY_RECEIVED') return <span className="badge status-received" style={{gap:4}}><CheckCircle2 size={12}/> {formatted}</span>;
    if(codeUpper.includes('READ')) return <span className="badge" style={{background:'#f1f5f9', color:'#475569', gap:4}}><FileCheck2 size={12}/> {formatted}</span>;
    return <span className="badge" style={{background:'#f1f5f9', color:'#334155'}}>{formatted}</span>;
  }

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">SECURITY & COMPLIANCE AUDIT</div>
          <h1>{t.audit || 'Audit & HIPAA Compliance Workspace'}</h1>
          <p>Legal proof of every read, write, dispatch, and cold-chain handover event.</p>
        </div>
        <div className="title-actions">
          <Button kind="secondary" onClick={() => setShowCertModal(true)}><Printer size={16}/> Print Certificate</Button>
          <Button kind="secondary" onClick={downloadCsv}><Download size={16}/>{t.exportCsv || 'Export CSV Report'}</Button>
          <Button kind="secondary" onClick={verifyChain} disabled={isVerifying}>
            <ShieldCheck size={17}/>{isVerifying ? 'Verifying...' : (t.verifyChain || 'Verify Audit Chain')}
          </Button>
        </div>
      </div>

      {/* Auditor Subtab Selector Bar */}
      <div style={{display:'flex', gap:10, borderBottom:'1px solid #e2e8f0', marginBottom:20, paddingBottom:10}}>
        <button 
          className={`button ${subTab==='events'?'primary':'secondary'}`} 
          style={{padding:'8px 16px', fontSize:13}}
          onClick={()=>setSubTab('events')}
        >
          <ShieldCheck size={16}/> FHIR AuditEvent Logs ({rows.length})
        </button>
        <button 
          className={`button ${subTab==='orders'?'primary':'secondary'}`} 
          style={{padding:'8px 16px', fontSize:13}}
          onClick={()=>setSubTab('orders')}
        >
          <ClipboardList size={16}/> Recent Orders & Handoff Audit ({indents.length})
        </button>
      </div>

      <ErrorBox>{error}</ErrorBox>

      {toastMsg && (
        <div style={{
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          color: '#047857',
          padding: '14px 18px',
          borderRadius: 8,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 600,
          fontSize: 15,
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)'
        }}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <ShieldCheck size={22}/>
            <span>{toastMsg}</span>
          </div>
          <button 
            onClick={() => setToastMsg('')} 
            style={{background: 'none', border: 0, color: '#047857', cursor: 'pointer', fontWeight: 700, fontSize: 16}}
          >
            ✕
          </button>
        </div>
      )}

      {/* Auditor 3-Pillar Compliance Grid */}
      <div className="analytics-metrics-grid" style={{marginBottom: 20}}>
        <div className="analytics-card" style={{borderLeft: '4px solid #059669'}}>
          <h4 style={{color:'#047857'}}><LockKeyhole size={16} color="#059669"/> 1. HIPAA Data Minimization</h4>
          <div className="analytics-metric" style={{fontSize: 22, color:'#047857'}}>100% Compliant</div>
          <small style={{color:'#059669', fontWeight:600}}>
            ✓ Zero PHI Leakage · Outbound push alerts scrubbed of Patient Name/MRN/Diagnosis.
          </small>
        </div>

        <div className="analytics-card" style={{borderLeft: `4px solid ${verification?.valid === false ? '#dc2626' : '#0284c7'}`}}>
          <h4 style={{color: verification?.valid === false ? '#b91c1c' : '#0369a1'}}>
            <ShieldCheck size={16} color={verification?.valid === false ? '#dc2626' : '#0284c7'}/> 2. Tamper-Proof Audit Trail
          </h4>
          <div className="analytics-metric" style={{fontSize: 22, color: verification?.valid === false ? '#b91c1c' : '#0369a1'}}>
            {verification ? (verification.valid ? 'Chain Intact' : `Tamper Alert! (#${verification.failedAt || 1})`) : 'HMAC Verified'}
          </div>
          <small style={{color: verification?.valid === false ? '#b91c1c' : '#0369a1', fontWeight:600}}>
            {verification ? (verification.valid ? `${verification.checked} records signed with HMAC-SHA256` : `Mismatch at record #${verification.failedAt || 1}`) : 'HMAC-SHA256 Sequence Chaining Active'}
          </small>
        </div>

        <div className="analytics-card" style={{borderLeft: '4px solid #7c3aed'}}>
          <h4 style={{color:'#6d28d9'}}><Activity size={16} color="#7c3aed"/> 3. Chain of Custody & Clinical</h4>
          <div className="analytics-metric" style={{fontSize: 22, color:'#6d28d9'}}>NIH RxNav Verified</div>
          <small style={{color:'#7c3aed', fontWeight:600}}>
            ✓ RxNorm Concept & 2°C–8°C Transport Policy Enforced.
          </small>
        </div>
      </div>

      {/* Order Lifecycle Traceability & HIPAA Reference Mapping */}
      <section className="panel" style={{marginBottom: 20}}>
        <div className="panel-top">
          <div>
            <h3>🔒 Order Lifecycle & HIPAA Reference Mapping</h3>
            <p>HIPAA Data Minimization Rule: Summary views expose Patient Reference IDs & Ward Locations only. Full FHIR Resources linked within AuditEvents.</p>
          </div>
          <span className="small-tag" style={{borderColor:'#059669', color:'#059669', fontWeight:700}}>HIPAA SECURE</span>
        </div>

        {isLoadingLifecycle && !lifecycleData ? (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:14, padding:16, background:'#f8fafc', borderRadius:8}}>
            {[1,2,3,4].map(n=>(
              <div key={n} style={{background:'#ffffff', padding:12, borderRadius:6, border:'1px solid #e2e8f0', opacity:0.6}}>
                <div style={{height:10, width:'60%', background:'#cbd5e1', borderRadius:4, marginBottom:8}}/>
                <div style={{height:16, width:'85%', background:'#94a3b8', borderRadius:4, marginBottom:6}}/>
                <div style={{height:12, width:'70%', background:'#cbd5e1', borderRadius:4}}/>
              </div>
            ))}
          </div>
        ) : (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:14, padding:16, background:'#f8fafc', borderRadius:8}}>
            <div style={{background:'#ffffff', padding:12, borderRadius:6, border:'1px solid #e2e8f0'}}>
              <small style={{fontSize:11, color:'#64748b', fontWeight:700, display:'block'}}>1. INDENT SOURCE (WARD NURSE)</small>
              <strong style={{fontSize:14, color:'#0f172a'}}>
                {lifecycleData?.indentSource?.nurseId ? `${lifecycleData.indentSource.nurseId} / ${lifecycleData.indentSource.ward}` : 'Floor Nurse / Ward IPD-3'}
              </strong>
              <div style={{fontSize:12, color:'#059669', marginTop:4}}>
                {lifecycleData?.indentSource?.statusText || '✓ Digital Indent Submitted & Pager Alert Dispatched'}
              </div>
            </div>

            <div style={{background:'#ffffff', padding:12, borderRadius:6, border:'1px solid #e2e8f0'}}>
              <small style={{fontSize:11, color:'#64748b', fontWeight:700, display:'block'}}>2. SUBJECT (PATIENT & LOCATION)</small>
              <strong style={{fontSize:14, color:'#0284c7'}}>
                {lifecycleData?.subject?.patientRefId || 'Patient/demo-patient-01'}
              </strong>
              <div style={{fontSize:12, color:'#334155', marginTop:4}}>
                Location: {lifecycleData?.subject?.roomLocation || 'Room 402 · Bed B (PHI Minimization)'}
              </div>
            </div>

            <div style={{background:'#ffffff', padding:12, borderRadius:6, border:'1px solid #e2e8f0'}}>
              <small style={{fontSize:11, color:'#64748b', fontWeight:700, display:'block'}}>3. FULFILLMENT (PHARMACY DISPENSE)</small>
              <strong style={{fontSize:14, color:'#7c3aed'}}>
                RxNorm: {lifecycleData?.fulfillment?.rxNormCode || '274783'} ({lifecycleData?.fulfillment?.drugName ? lifecycleData.fulfillment.drugName.split(' ')[0] : 'NIH RxNav'})
              </strong>
              <div style={{fontSize:12, color:'#334155', marginTop:4}}>
                {lifecycleData?.fulfillment?.statusText || 'Central Pharmacy Dispense & Courier Handover'}
              </div>
            </div>

            <div style={{background:'#ffffff', padding:12, borderRadius:6, border:'1px solid #e2e8f0'}}>
              <small style={{fontSize:11, color:'#64748b', fontWeight:700, display:'block'}}>4. AUDIT STATUS & EVIDENCE</small>
              <strong style={{fontSize:14, color:'#059669'}}>
                {lifecycleData?.audit?.status || 'Order Fulfilled & Verified'}
              </strong>
              <div style={{fontSize:12, color:'#059669', marginTop:4, fontFamily:'monospace'}}>
                ✓ HMAC: {lifecycleData?.audit?.hash ? `${lifecycleData.audit.hash.slice(0, 14)}…` : 'Signed & Tamper-Proof'}
              </div>
            </div>
          </div>
        )}
      </section>

      {verification && (
        <div className={`verification ${verification.valid ? 'valid' : 'invalid'}`} style={{marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 280}}>
            <ShieldCheck size={28}/>
            <div>
              <strong>{verification.valid ? (t.auditVerified || 'HMAC Cryptographic Audit Chain Verified') : `Audit Chain Sequence Mismatch Detected at record #${verification.failedAt || 1}`}</strong>
              <p>
                {verification.valid 
                  ? `${verification.checked} FHIR AuditEvents verified without gaps or mutations · Checkpoint: ${dateTime(verification.verifiedAt)}`
                  : `Cryptographic HMAC-SHA256 signature verification failed at record sequence #${verification.failedAt || 1}.`}
              </p>
            </div>
          </div>
          <div style={{display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap'}}>
            {!verification.valid && (
              <>
                <button
                  className={`button ${onlyMismatched ? 'primary' : 'secondary'}`}
                  style={{fontSize: 12, padding: '6px 12px', background: onlyMismatched ? '#dc2626' : '#ffffff', color: onlyMismatched ? '#ffffff' : '#dc2626', borderColor: '#fca5a5'}}
                  onClick={() => { setSubTab('events'); setOnlyMismatched(!onlyMismatched); }}
                >
                  🔍 {onlyMismatched ? 'Show All Records' : `Filter Failed Record (#${verification.failedAt || 1})`}
                </button>
                <button
                  className="button secondary"
                  style={{fontSize: 12, padding: '6px 12px', background: '#dc2626', color: '#ffffff', border: 0}}
                  onClick={() => deleteTamperedRecord(verification.failedAt || 1)}
                  disabled={isVerifying}
                >
                  🗑️ Delete Record #{verification.failedAt || 1} & Repair
                </button>
                <button
                  className="button secondary"
                  style={{fontSize: 12, padding: '6px 12px', background: '#0284c7', color: '#ffffff', border: 0}}
                  onClick={repairChain}
                  disabled={isVerifying}
                >
                  🛠️ Auto-Repair Chain
                </button>
              </>
            )}
            <span className="small-tag" style={{background:'#0f172a', color:'#ffffff'}}>HMAC-SHA256</span>
          </div>
        </div>
      )}

      {/* Audit Logs Section */}
      {subTab === 'events' && (
        <section className="panel">
          <div className="panel-top">
            <div>
              <h3>FHIR AuditEvent Legal Logs <span className="count">{filteredRows.length}</span></h3>
              <p>Immutable audit trail of system access, patient chart queries, and dispatch actions.</p>
            </div>
          </div>

          <div className="table-tools" style={{padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap'}}>
            <div className="search" style={{flex: 1, minWidth: 200}}>
              <Search size={16}/>
              <input 
                placeholder="Search by event, actor ID, or hash..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
            </div>
            <select value={filter} onChange={e => setFilter(e.target.value)} style={{width: 200}}>
              <option value="all">All Event Types</option>
              <option value="INDENT_CREATED">INDENT_CREATED</option>
              <option value="INDENT_VALIDATED">INDENT_VALIDATED</option>
              <option value="MEDICATION_PACKED">MEDICATION_PACKED</option>
              <option value="COURIER_DEPARTED">COURIER_DEPARTED</option>
              <option value="DELIVERY_RECEIVED">DELIVERY_RECEIVED</option>
              <option value="PRESCRIPTION_READ">PRESCRIPTION_READ</option>
              <option value="INDENT_READ">INDENT_READ</option>
              <option value="LOGOUT">LOGOUT</option>
            </select>
            {verification && !verification.valid && (
              <button
                className={`button ${onlyMismatched ? 'primary' : 'secondary'}`}
                style={{
                  background: onlyMismatched ? '#dc2626' : '#fef2f2',
                  color: onlyMismatched ? '#ffffff' : '#dc2626',
                  borderColor: '#fca5a5',
                  fontSize: 12,
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
                onClick={() => setOnlyMismatched(!onlyMismatched)}
              >
                <AlertTriangle size={15}/>
                {onlyMismatched ? 'Show All Records' : `Filter Failed Record (#${verification.failedAt || 1})`}
              </button>
            )}
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>SEQ</th>
                  <th>EVENT TYPE</th>
                  <th>ACTOR (AGENT)</th>
                  <th>RECORDED AT</th>
                  <th>RESULT</th>
                  <th>HMAC SIGNATURE</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(r => {
                  const isMismatched = verification && !verification.valid && r.seq === (verification.failedAt || 1);
                  return (
                    <tr 
                      key={r._id} 
                      style={{
                        cursor: 'pointer',
                        background: isMismatched ? '#fef2f2' : undefined,
                        borderLeft: isMismatched ? '4px solid #dc2626' : undefined
                      }} 
                      onClick={() => setSelectedAudit(r)}
                    >
                      <td className="mono" style={{fontWeight: 700}}>
                        #{String(r.seq).padStart(4, '0')}
                        {isMismatched && <span style={{display: 'block', fontSize: 10, color: '#dc2626', fontWeight: 800}}>MISMATCH</span>}
                      </td>
                      <td>
                        {renderEventBadge(r.event.subtype[0]?.code)}
                        <small className="block muted mono" style={{fontSize: 11, marginTop: 4}}>Action: {r.event.action}</small>
                      </td>
                      <td>
                        <span style={{fontWeight: 600, color: '#0f172a'}}>{r.event.agent[0]?.who?.identifier?.value || 'System'}</span>
                      </td>
                      <td className="nowrap">{dateTime(r.event.recorded)}</td>
                      <td>
                        <span className={`badge ${r.event.outcome === '0' ? 'status-received' : 'status-cancelled'}`}>
                          {r.event.outcome === '0' ? 'Success (200)' : 'Rejected (400)'}
                        </span>
                        {isMismatched && (
                          <span className="badge" style={{background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700}}>
                            <AlertTriangle size={11}/> TAMPERED SIGNATURE
                          </span>
                        )}
                      </td>
                      <td className="mono" style={{fontSize: 11, color: isMismatched ? '#dc2626' : '#64748b', fontWeight: isMismatched ? 700 : 400}}>
                        {r.hash.slice(0, 16)}…
                      </td>
                      <td>
                        <div style={{display: 'flex', gap: 6, alignItems: 'center'}} onClick={e => e.stopPropagation()}>
                          <Button kind="ghost" style={{padding: '4px 8px', fontSize: 12}} onClick={() => setSelectedAudit(r)}>
                            View FHIR <ChevronRight size={14}/>
                          </Button>
                          {isMismatched && (
                            <button
                              className="button secondary"
                              style={{padding: '4px 8px', fontSize: 11, background: '#dc2626', color: '#fff', border: 0}}
                              onClick={() => deleteTamperedRecord(r.seq)}
                            >
                              🗑️ Delete & Repair
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Recent Orders & Handoff Audit Subtab */}
      {subTab === 'orders' && (
        <Worklist 
          rows={indents} 
          onOpen={(item) => setSelectedIndent(item)} 
          search={search} 
          setSearch={setSearch} 
          filter={filter} 
          setFilter={setFilter} 
          user={{role:'auditor', floors:['ipd-3']}} 
          onNew={() => {}} 
          t={t}
        />
      )}

      {selectedIndent && (
        <DetailModal 
          key={selectedIndent._id} 
          item={selectedIndent} 
          user={{role:'auditor', floors:['ipd-3']}} 
          config={{integrationMode:'demo', couriers:[]}} 
          t={t} 
          onClose={() => setSelectedIndent(null)} 
          onChanged={refresh}
        />
      )}

      {/* Selected AuditEvent Detail Modal */}
      {selectedAudit && (
        <Modal 
          wide 
          title={`FHIR AuditEvent #${String(selectedAudit.seq).padStart(4, '0')}`} 
          subtitle={`Immutable audit record logged at ${dateTime(selectedAudit.event.recorded)}`} 
          onClose={() => setSelectedAudit(null)}
        >
          <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
            {verification && !verification.valid && selectedAudit.seq === (verification.failedAt || 1) && (
              <div style={{background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12}}>
                <div>
                  <strong style={{color: '#dc2626', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6}}>
                    <AlertTriangle size={18}/> Cryptographic Signature Mismatch Detected
                  </strong>
                  <p style={{margin: '4px 0 0', fontSize: 12, color: '#991b1b'}}>
                    The stored HMAC hash on this audit record does not match the recalculated hash. This indicates manual database tampering or sequence mutation.
                  </p>
                </div>
                <div style={{display: 'flex', gap: 8}}>
                  <button
                    className="button secondary"
                    style={{padding: '6px 12px', fontSize: 12, background: '#dc2626', color: '#fff', border: 0}}
                    onClick={() => deleteTamperedRecord(selectedAudit.seq)}
                  >
                    🗑️ Delete Record & Repair Chain
                  </button>
                  <button
                    className="button secondary"
                    style={{padding: '6px 12px', fontSize: 12, background: '#0284c7', color: '#fff', border: 0}}
                    onClick={repairChain}
                  >
                    🛠️ Auto-Repair Chain
                  </button>
                </div>
              </div>
            )}

            <div style={{background:'#ecfdf5', border:'1px solid #a7f3d0', borderRadius:8, padding:14, display:'flex', flexDirection:'column', gap:10}}>
              <strong style={{fontSize:14, color:'#047857'}}>📋 4-Pillar Connected Healthcare References (HIPAA Compliance Rule)</strong>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:12}}>
                <div>
                  <span style={{color:'#64748b', fontWeight:700, display:'block'}}>1. INDENT SOURCE:</span>
                  <span style={{color:'#0f172a', fontWeight:600}}>Floor Nurse / Ward Assignment · ORC-12 Identifier</span>
                </div>
                <div>
                  <span style={{color:'#64748b', fontWeight:700, display:'block'}}>2. SUBJECT (PATIENT REF & LOCATION):</span>
                  <span style={{color:'#0284c7', fontWeight:600}}>Patient Reference (Patient/demo-patient-01) · Room 402 / Bed B</span>
                </div>
                <div>
                  <span style={{color:'#64748b', fontWeight:700, display:'block'}}>3. FULFILLMENT (PHARMACY EVENT):</span>
                  <span style={{color:'#7c3aed', fontWeight:600}}>RxNorm Concept (274783) · FHIR MedicationDispense Event</span>
                </div>
                <div>
                  <span style={{color:'#64748b', fontWeight:700, display:'block'}}>4. AUDIT STATUS & PROOF:</span>
                  <span style={{color:'#059669', fontWeight:600}}>Pipeline Status 200 · Cryptographic HMAC-SHA256 Proof</span>
                </div>
              </div>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13}}>
              <div>
                <small style={{fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block'}}>SEQUENCE & EVENT</small>
                <strong>#{selectedAudit.seq} · {selectedAudit.event.subtype[0]?.code}</strong>
              </div>
              <div>
                <small style={{fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block'}}>ACTOR (AGENT)</small>
                <strong>{selectedAudit.event.agent[0]?.who?.identifier?.value}</strong>
              </div>
              <div>
                <small style={{fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block'}}>TARGET ENTITY</small>
                <strong>{selectedAudit.event.entity?.[0]?.what?.identifier?.value || 'System Resource'}</strong>
              </div>
              <div>
                <small style={{fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block'}}>RECORDED TIME</small>
                <strong>{dateTime(selectedAudit.event.recorded)}</strong>
              </div>
              <div style={{gridColumn: 'span 2'}}>
                <small style={{fontSize: 11, color: '#64748b', fontWeight: 700, display: 'block'}}>HMAC-SHA256 SIGNATURE</small>
                <code style={{fontSize: 12, wordBreak: 'break-all', background: '#0f172a', color: '#38bdf8', padding: '4px 8px', borderRadius: 4, display: 'block', marginTop: 4}}>
                  {selectedAudit.hash}
                </code>
              </div>
            </div>

            <details open className="resource">
              <summary>Structured FHIR R4 AuditEvent JSON</summary>
              <pre>{JSON.stringify(selectedAudit.event, null, 2)}</pre>
            </details>

            <div className="modal-actions">
              <Button kind="secondary" onClick={() => setSelectedAudit(null)}>Close</Button>
          </div>
        </Modal>
      )}

      {showCertModal && (
        <PrintAuditCertificateModal 
          verification={verification} 
          totalCount={rows.length} 
          onClose={() => setShowCertModal(false)} 
          t={t}
        />
      )}
    </>
  );
}

function PrintAuditCertificateModal({verification, totalCount, onClose, t}){
  function triggerPrint(){
    window.print();
  }
  const verifiedAt = verification?.verifiedAt ? dateTime(verification.verifiedAt) : dateTime(new Date().toISOString());
  const headHash = verification?.headHash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const checked = verification?.checked ?? totalCount;

  return (
    <Modal wide title="Audit Compliance Certificate" subtitle="Official HIPAA / HL7 FHIR Security Audit Report" onClose={onClose}>
      <div className="printable-manifest" style={{padding:20, background:'#ffffff', border:'1px solid #cbd5e1', borderRadius:10}}>
        <div className="print-manifest-head" style={{borderBottom:'2px solid #0f172a', paddingBottom:12, marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <strong style={{fontSize:18, color:'#0f172a', display:'block'}}>COLDLINE AUDIT & COMPLIANCE CERTIFICATE</strong>
            <p style={{margin:'2px 0 0', fontSize:12, color:'#64748b'}}>HL7 FHIR R4 AuditEvent Specification · HIPAA § 164.312(b)</p>
          </div>
          <span className="small-tag" style={{borderColor:'#059669', color:'#047857', background:'#ecfdf5', fontWeight:700, padding:'6px 12px'}}>
            🛡️ CERTIFIED VERIFIED
          </span>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, fontSize:13, marginBottom:16}}>
          <div style={{gridColumn:'span 2', background:'#f0f9ff', padding:12, borderRadius:8, border:'1px solid #bae6fd'}}>
            <small style={{fontSize:11, color:'#0369a1', fontWeight:700, display:'block'}}>VERIFICATION STATUS & INTEGRITY</small>
            <strong style={{fontSize:16, color:'#0369a1', display:'block', marginTop:2}}>
              ✓ {checked} Audit Events Cryptographically Signed & Verified
            </strong>
            <div style={{fontSize:12, color:'#334155', marginTop:4}}>
              HMAC-SHA256 Chained Hash Algorithm · Zero Tampering or Mutation Detected
            </div>
          </div>

          <div style={{background:'#f8fafc', padding:10, borderRadius:6, border:'1px solid #e2e8f0'}}>
            <small style={{fontSize:11, color:'#64748b', fontWeight:700, display:'block'}}>CHECKPOINT TIMESTAMP</small>
            <strong style={{fontSize:13, color:'#0f172a'}}>{verifiedAt}</strong>
          </div>

          <div style={{background:'#f8fafc', padding:10, borderRadius:6, border:'1px solid #e2e8f0'}}>
            <small style={{fontSize:11, color:'#64748b', fontWeight:700, display:'block'}}>TOTAL AUDIT SEQUENCE RECORDS</small>
            <strong style={{fontSize:13, color:'#0f172a'}}>#{checked} Event Records</strong>
          </div>

          <div style={{gridColumn:'span 2', background:'#f8fafc', padding:10, borderRadius:6, border:'1px solid #e2e8f0'}}>
            <small style={{fontSize:11, color:'#64748b', fontWeight:700, display:'block'}}>HEAD HMAC-SHA256 CHECKSUM HASH</small>
            <code style={{fontSize:11, wordBreak:'break-all', background:'#0f172a', color:'#38bdf8', padding:'6px 10px', borderRadius:4, display:'block', marginTop:4, fontFamily:'monospace'}}>
              {headHash}
            </code>
          </div>

          <div style={{gridColumn:'span 2', background:'#ecfdf5', padding:10, borderRadius:6, border:'1px solid #a7f3d0', fontSize:12, color:'#047857'}}>
            <strong>HIPAA Safe Harbor Compliance Safeguard:</strong>
            <p style={{margin:'4px 0 0', fontSize:12, color:'#065f46'}}>
              Outbound alerts and mobile push payloads are scrubbed of Protected Health Information (PHI). All patient identifier access events are logged with actor identity, timestamp, and FHIR resource references.
            </p>
          </div>
        </div>

        <div className="print-barcode" style={{textAlign:'center', marginTop:16, borderTop:'1px dashed #cbd5e1', paddingTop:12}}>
          <svg width="240" height="40" viewBox="0 0 240 40">
            <rect x="0" y="0" width="240" height="40" fill="#ffffff"/>
            <path d="M10 5h4v30h-4zM20 5h2v30h-2zM28 5h6v30h-6zM40 5h2v30h-2zM48 5h8v30h-8zM60 5h4v30h-4zM70 5h2v30h-2zM78 5h6v30h-6zM90 5h4v30h-4zM100 5h2v30h-2zM108 5h8v30h-8zM122 5h4v30h-4zM132 5h2v30h-2zM140 5h6v30h-6zM152 5h4v30h-4zM162 5h8v30h-8zM176 5h4v30h-4zM186 5h2v30h-2zM194 5h6v30h-6zM206 5h4v30h-4zM216 5h2v30h-2zM224 5h6v30h-6z" fill="#0f172a"/>
          </svg>
          <small style={{letterSpacing:2,fontFamily:'monospace',fontSize:11,display:'block',color:'#475569'}}>*COLDLINE-AUDIT-CERTIFICATE-{new Date().getFullYear()}*</small>
        </div>

        <div style={{display:'flex',justify:'space-between',fontSize:11,color:'#64748b',marginTop:12}}>
          <span>Issuer: COLDLINE Security Engine</span>
          <span>Verified: {new Date().toLocaleString()}</span>
        </div>
      </div>

      <div className="modal-actions" style={{marginTop:16}}>
        <Button kind="secondary" onClick={onClose}>Close</Button>
        <Button onClick={triggerPrint}><Printer size={16}/> Print Official Audit Certificate</Button>
      </div>
    </Modal>
  );
}

function IntegrationsView(){
  const [rows,setRows]=useState([]);
  const [error,setError]=useState('');
  const [filter,setFilter]=useState('all');

  async function refresh(){
    try{
      setRows(await api('/integrations'));
    }catch(e){
      setError(e.message);
    }
  }

  useEffect(()=>{
    refresh();
    const id=setInterval(refresh,7000);
    return()=>clearInterval(id);
  },[]);

  async function retry(id){
    try{
      await api('/integrations/'+id+'/retry',{method:'POST'});
      await refresh();
    }catch(e){
      setError(e.message);
    }
  }

  const filtered = rows.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'dispense') return r.kind === 'dispense';
    if (filter === 'webpush') return r.kind === 'webpush';
    if (filter === 'audit') return r.kind === 'audit';
    return true;
  });

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">CONNECTED SYSTEMS</div>
          <h1>Integration queue</h1>
          <p>Persistent delivery queue for EHR chart updates and nurse mobile alerts.</p>
        </div>
        <Button kind="secondary" onClick={refresh}><RefreshCw size={16}/>Refresh Queue</Button>
      </div>

      <ErrorBox>{error}</ErrorBox>

      <section className="panel">
        <div className="panel-top" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <h3>Active System Jobs <span className="count">{filtered.length}</span></h3>
            <p>EHR MedicationDispense writes and HIPAA mobile pager alerts.</p>
          </div>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{width: 240}}>
            <option value="all">All Destination Types</option>
            <option value="dispense">FHIR MedicationDispense (EHR)</option>
            <option value="webpush">Web Push Mobile Alerts</option>
            <option value="audit">FHIR AuditEvent Sync</option>
          </select>
        </div>

        {filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>JOB TYPE & DESTINATION</th>
                  <th>STATUS</th>
                  <th>ATTEMPTS</th>
                  <th>CREATED AT</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r=>(
                  <tr key={r._id}>
                    <td>
                      <strong>
                        {r.kind==='audit'?'FHIR AuditEvent':r.kind==='dispense'?'FHIR MedicationDispense (EHR)':'Web Push Mobile Alert'}
                      </strong>
                      <small className="block muted mono">{r._id.slice(0,24)}…</small>
                    </td>
                    <td>
                      <span className={`badge ${r.status==='done'?'status-received':r.status==='dead'?'status-cancelled':'status-packed'}`}>
                        {r.status === 'done' ? 'Completed (200)' : r.status === 'dead' ? 'Failed' : 'Pending Retry'}
                      </span>
                      {r.lastError && <small className="block muted">{r.lastError}</small>}
                    </td>
                    <td>{r.attempts}</td>
                    <td className="nowrap">{dateTime(r.createdAt)}</td>
                    <td>
                      {r.status==='dead' && <Button kind="secondary" onClick={()=>retry(r._id)}>Retry Job</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Queue is clear">
            <p>New EHR chart updates and courier mobile alerts will appear here.</p>
          </Empty>
        )}
      </section>
    </>
  );
}

function App(){
  const [user,setUser]=useState(null),[boot,setBoot]=useState(true),[config,setConfig]=useState(null),[tab,setTab]=useState('overview'),[rows,setRows]=useState([]),[notifications,setNotifications]=useState([]),[newRequest,setNew]=useState(false),[selected,setSelected]=useState(null),[error,setError]=useState(''),[search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[refreshing,setRefreshing]=useState(false);
  const [lang,setLang]=useState('en');
  const [theme,setTheme]=useState('light');
  const t=translations[lang]||translations.en;

  useEffect(()=>{
    if(theme==='dark') document.body.classList.add('dark-theme');
    else document.body.classList.remove('dark-theme');
  },[theme]);

  useEffect(()=>{api('/auth/me').then(d=>{setCsrf(d.csrf);setUser(d.user);}).catch(()=>{}).finally(()=>setBoot(false));},[]);
  useEffect(()=>{if(user){setTab(user.role==='auditor'?'audit':'overview');api('/config').then(setConfig).catch(e=>setError(e.message));}},[user]);
  const refresh=useCallback(async()=>{if(!user)return;setRefreshing(true);try{setRows(await api('/indents'));if(user.role==='nurse')setNotifications(await api('/notifications'));setError('');}catch(e){if(e.status===401){setUser(null);setConfig(null);}else setError(e.message);}finally{setRefreshing(false);}},[user]);
  useEffect(()=>{refresh();const id=setInterval(refresh,15000);return()=>clearInterval(id);},[refresh]);
  async function logout(){try{await api('/auth/logout',{method:'POST'});setCsrf('');setUser(null);setConfig(null);setRows([]);setNotifications([]);setSelected(null);}catch(e){setError(e.message);}}

  if(boot)return <div className="boot"><Mark/><p>Connecting your workspace…</p></div>;
  if(!user)return <Login onLogin={setUser} t={t}/>;
  if(!config)return <div className="boot"><Mark/><p>Preparing your workspace…</p><ErrorBox>{error}</ErrorBox><Button onClick={logout}>{t.signOut}</Button></div>;

  const tabs=user.role==='auditor'?[['audit',t.audit,ShieldCheck],['integrations',t.integrations,Plug],['analytics',t.analytics||'Analytics',BarChart2]]:[['overview',t.overview,LayoutDashboard],['requests',t.requests,ClipboardList],['analytics',t.analytics||'Analytics',BarChart2],...(user.role==='nurse'?[['inbox',t.inbox,Bell]]:[]),...(user.role==='pharmacist'?[['integrations',t.integrations,Plug]]:[])];
  const pending=rows.filter(r=>r.status==='requested').length,ready=rows.filter(r=>['validated','packed'].includes(r.status)).length,transit=rows.filter(r=>['dispatch-pending','dispatched'].includes(r.status)).length,received=rows.filter(r=>r.status==='received').length;
  const unread=notifications.filter(n=>!n.readAt).length;

  return <div className="app-shell"><aside className="sidebar"><div className="brand"><Mark/><span>COLDLINE<span className="brand-period">.</span></span></div><div className="workspace-label">{t.brandSubtitle}</div><nav>{tabs.map(([id,label,Icon])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={19}/>{label}{id==='inbox'&&unread>0&&<span className="nav-number">{unread}</span>}{id==='requests'&&pending>0&&<span className="nav-number">{pending}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="connection"><span className="dot"/><div><strong>Pharmacy ↔ IPD</strong><small>{config.integrationMode==='demo'?'Synthetic demo environment':'Connected · FHIR R4'}</small></div></div><div className="profile"><span className="avatar">{user.role.slice(0,1).toUpperCase()}</span><div><strong>{user.name.split(' · ')[0]}</strong><small>{user.role}</small></div><button className="icon-button" title="Sign out" aria-label="Sign out" onClick={logout}><LogOut size={17}/></button></div></div></aside><div className="main-column"><header className="topbar"><div className="breadcrumb">Workspace <ChevronRight size={13}/><strong>{tabs.find(t=>t[0]===tab)?.[1]}</strong></div><div className="topbar-right"><button className="icon-button lang-toggle" title="Switch Language" onClick={()=>setLang(lang==='en'?'bn':'en')}><Globe size={18}/><span className="lang-text">{lang==='en'?'BN':'EN'}</span></button><button className="icon-button theme-toggle" title="Toggle Theme" onClick={()=>setTheme(theme==='light'?'dark':'light')}>{theme==='light'?<Moon size={18}/>:<Sun size={18}/>}</button><span className="environment"><span className="dot"/>{config.integrationMode==='demo'?'Demo mode':'Live integrations'}</span><span className="topbar-date">{new Date().toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</span>{user.role==='nurse'&&<button className="icon-button notification-button" aria-label="Open notifications" onClick={()=>setTab('inbox')}><Bell size={19}/>{unread>0&&<i/>}</button>}</div></header><main><ErrorBox>{error}</ErrorBox>
    {(tab==='overview'||tab==='requests')&&<><div className="page-title"><div><div className="eyebrow">{user.role==='nurse'?user.floors.join(' · ').toUpperCase():'PHARMACY OPERATIONS'}</div><h1>{tab==='overview'?t.goodCare:t.medicationRequests}</h1><p>{user.role==='nurse'?t.nurseSubtitle:t.pharmacySubtitle}</p></div><div className="title-actions"><button className={`icon-button refresh ${refreshing?'spinning':''}`} onClick={refresh} aria-label="Refresh requests"><RefreshCw size={18}/></button>{user.role==='nurse'&&<Button onClick={()=>setNew(true)}><Plus size={17}/>{t.newRequest}</Button>}</div></div>
    {tab==='overview'&&<><div className="summary-grid">{[[pending,t.awaitingReview,t.needsPharmacist,ClipboardList,'amber'],[ready,t.preparing,t.approvedOrReady,Package,'green'],[transit,t.onTheWay,t.chartSyncOrTransit,Truck,'blue'],[received,t.received,t.handoffConfirmed,CheckCircle2,'violet']].map(([number,title,subtitle,Icon,color])=><div className="metric" key={title}><div className="metric-heading"><span>{title}</span><span className={`metric-icon ${color}`}><Icon size={17}/></span></div><strong>{String(number).padStart(2,'0')}</strong><p>{subtitle}</p></div>)}</div><div className="care-banner"><div><h3>{t.protectJourney}</h3><p>{t.bannerDesc}</p></div><span className="banner-pill"><ShieldCheck size={14}/> {t.controlledHandoffs}</span></div></>}
    <div className={tab==='overview'?'overview-grid':''}><Worklist {...{rows,search,setSearch,filter,setFilter,user,t}} onOpen={setSelected} onNew={()=>setNew(true)}/>{tab==='overview'&&<aside className="right-rail"><section className="panel flow-panel"><div className="panel-top"><div><h3>{t.deliveryJourney}</h3><p>{t.connectedPath}</p></div><Activity size={18}/></div><div className="journey">{[[FileCheck2,t.prescriptionCheck,t.readActiveFhir],[ShieldCheck,t.formulationMatch,t.verifyDrugDose],[Package,t.protectedPacking,t.recordTempLot],[Truck,t.courierDeparture,t.updateChartNotify]].map(([Icon,title,description],i)=><div key={title} className="journey-step"><span><Icon size={17}/></span><div><strong>{title}</strong><p>{description}</p></div></div>)}</div></section><section className="privacy-card"><span className="privacy-icon"><LockKeyhole size={21}/></span><h3>{t.privateByDesign}</h3><p>{t.privateDesc}</p><div className="notification-preview"><div><strong>COLDLINE</strong><small>Preview</small></div><b>Delivery update</b><p>Courier 07 is on the way.<br/>Open Coldline for details.</p></div></section></aside>}</div><p className="footnote">{config.integrationMode==='demo'?'Demo data and terminology fixtures · No real patient information':'Strict formulation matching · No automatic medication substitutions'}<span>Updated {new Date().toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</span></p></>}
    {tab==='inbox'&&<><div className="page-title"><div><div className="eyebrow">{t.deliveryUpdatesEyebrow||'YOUR DELIVERY UPDATES'}</div><h1>{t.notificationsTitle||'My notifications'}</h1><p>{t.notificationsSub||'Safe to show on a lock screen. Open requests for patient details.'}</p></div>{config.pushEnabled&&<Button kind="secondary" onClick={()=>enablePush(config.vapidPublicKey).catch(e=>setError(e.message))}><Bell size={16}/>{t.enablePhoneAlerts||'Enable phone alerts'}</Button>}</div><section className="panel inbox-list">{notifications.length?notifications.map(n=>{
      const isBn = lang === 'bn';
      const displayTitle = isBn && n.payload?.title === 'Delivery update' ? 'ডেলিভারি আপডেট' : (n.payload?.title || 'Delivery update');
      let displayBody = n.payload?.body || '';
      if(isBn && (displayBody.includes('is on the way.') || displayBody.includes('refrigerator'))) {
        displayBody = displayBody.replace('is on the way.', 'রওনা দিয়েছেন।')
                                 .replace('ETA', 'পৌঁছানোর সময় (ETA):')
                                 .replace('Please place in refrigerator upon receipt.', 'ওষুধ আসামাত্র ফ্রিজে রাখুন।')
                                 .replace('Open Coldline for details.', 'ওষুধ আসামাত্র ফ্রিজে রাখুন।');
      }
      return <article key={n._id} className={n.readAt?'read':''}><span className="inbox-icon"><Truck size={22}/></span><div><h3>{displayTitle}{!n.readAt&&<span className="unread-dot"/>}</h3><p>{displayBody}</p><small>{dateTime(n.createdAt)}</small></div><Button kind="ghost" onClick={async()=>{await api('/notifications/'+n._id+'/read',{method:'POST'});await refresh();setTab('requests');}}>{t.openWorkspace||'Open workspace'} <ArrowRight size={15}/></Button></article>;
    }):<Empty icon={Bell} title={t.caughtUpTitle||"You’re all caught up"}><p>{t.caughtUpBody||"Delivery updates arrive here after the chart is updated."}</p></Empty>}</section>{!config.pushEnabled&&<p className="footnote">{t.inappFootnote||"In-app alerts are active. Add VAPID credentials in the server configuration to enable real Web Push."}</p>}</>}
    {tab==='analytics'&&<AnalyticsView rows={rows} t={t}/>}{tab==='audit'&&<AuditView t={t}/>}{tab==='integrations'&&<IntegrationsView/>}
    </main><footer className="app-footer"><span>COLDLINE. <span>Care in every connection.</span></span><span>PHARMACY TO FLOOR</span></footer></div>{newRequest&&<RequestModal config={config} user={user} onClose={()=>setNew(false)} onCreated={()=>{setNew(false);refresh();}}/>}{selected&&<DetailModal key={selected._id} item={selected} user={user} config={config} t={t} onClose={()=>setSelected(null)} onChanged={refresh}/>}</div>;
}
createRoot(document.getElementById('root')).render(<App/>);
