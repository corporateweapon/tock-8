/* Tock live board: a DJ board that plays along with the studio. It only shows the song; nothing here edits it.
   Two decks carry the patterns as records (one ring per track, one turn per bar), the tower between them shows the
   effects, and the bank underneath has a strip for every track. studio.html feeds it each step it schedules.
   No dependencies, no network. Everything hangs off window.TockBoard. */
(function(){
'use strict';
var W=1600,H=900,TAU=Math.PI*2,HALF=Math.PI/2,STEP=TAU/16,RW=830;
var MONO='"Cascadia Mono","SFMono-Regular",Consolas,"DejaVu Sans Mono",Menlo,monospace';
var LOGO='"Arial Black","Segoe UI Black","Helvetica Neue",Impact,sans-serif';
var C={room:'#080c0a',bone:'#f1ecdf',tang:'#ff7a1a',mint:'#8ff0c8',violet:'#b9a2ff',ink:'#1d2822',print:'#8d968f'};
var LABELS=[C.tang,C.mint,C.bone,C.violet];
var NOTE=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
var SHOTS=[['riser','RISER'],['fall','FALL'],['boom','BOOM'],['zap','ZAP'],['crash','CRASH'],['siren','SIREN'],['scratch','SCRATCH']],SHW=63.3;
var FXK=[['open','OPEN UP'],['close','CLOSE'],['thin','THIN OUT'],['gate','CHOP'],['pump','PUMP']],FXH=31;

var host=null,T=null,root=null,cv=null,g=null,chrome=null,btn={},raf=0,opened=false,from=null,scrollWas='';
var k=1,ox=0,oy=0,pw=0,ph=0,dpr=1,reduce=false;
var P=null,L=null,cache={},trs={},Q=[],cur=null,frac=0,lastT=0,lastSec=-1,stamp='';
var decks=[{ang:0,key:'',fade:1,trail:[]},{ang:0,key:'',fade:1,trail:[]}];
var sparks=[],shocks=[],touches=[],spec=new Float32Array(24),freq=null,spr={},labels={};
var E={kick:0,flash:0,xf:0,filter:0,room:0,echo:0,live:0,soon:0,energy:0.3,heat:[0,0],spin:0,fps:60,bpm:150,keyv:0};

/* ---------------- small helpers ---------------- */
var RGB={};
function rgba(hex,a){ var c=RGB[hex]; if(!c){ var n=parseInt(hex.slice(1),16); c=RGB[hex]=[(n>>16)&255,(n>>8)&255,n&255]; } return 'rgba('+c[0]+','+c[1]+','+c[2]+','+(a<0?0:a>1?1:a).toFixed(3)+')'; }
function mix(a,b,t){ rgba(a,1); rgba(b,1); var x=RGB[a],y=RGB[b]; return '#'+[0,1,2].map(function(i){ var v=Math.round(x[i]+(y[i]-x[i])*t).toString(16); return v.length<2?'0'+v:v; }).join(''); }
function mood(e){ return e<0.5?mix(C.mint,C.bone,e*2):mix(C.bone,C.tang,(e-0.5)*2); }
function clamp(v,a,b){ return v<a?a:v>b?b:v; }
function rr(c,x,y,w,h,r){ r=Math.min(r,w/2,h/2); c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
function circ(c,x,y,r){ c.beginPath(); c.arc(x,y,r,0,TAU); c.fill(); }
function lin(c,x0,y0,x1,y1,st){ var gr=c.createLinearGradient(x0,y0,x1,y1); st.forEach(function(s){ gr.addColorStop(s[0],s[1]); }); return gr; }
function rad(c,x,y,r0,r1,st){ var gr=c.createRadialGradient(x,y,r0,x,y,r1); st.forEach(function(s){ gr.addColorStop(s[0],s[1]); }); return gr; }
function tx(c,s,x,y,font,col,al,bl){ c.font=font; c.fillStyle=col; c.textAlign=al||'left'; c.textBaseline=bl||'middle'; c.fillText(s,x,y); }
function F(px,w){ return (w||600)+' '+px+'px '+MONO; }
function FL(px){ return '900 '+px+'px '+LOGO; }
function fmt(sec){ sec=Math.max(0,Math.floor(sec)); return Math.floor(sec/60)+':'+(sec%60<10?'0':'')+(sec%60); }
function noteName(m){ return NOTE[((m%12)+12)%12]+(Math.floor(m/12)-1); }
function sprite(w,h){ var s=document.createElement('canvas'); s.width=Math.max(1,Math.ceil(w*k*dpr)); s.height=Math.max(1,Math.ceil(h*k*dpr)); var c=s.getContext('2d'); c.scale(k*dpr,k*dpr); return {cv:s,c:c}; }
function hueOf(t){ var gr=T.inst(t.inst).group; return gr==='Bass'?C.tang:gr==='Synths'?C.mint:gr==='Effects'?C.violet:C.bone; }
function isKick(t){ return /kick$/.test(t.inst); }
function held(I){ return I.group==='Synths'||I.group==='Bass'||I.id==='riser'||I.id==='fall'||I.id==='siren'||I.id==='scratch'; }
/* seconds per step: parts can run at their own speed, so ask the step that is playing */
function SD(){ return (cur&&cur.sd)||T.stepSec(P); }
function sdOf(sec){ return T.secSd?T.secSd(P,sec):T.stepSec(P); }
function stampOf(){ return P.id+'|'+P.tracks.length+'|'+P.song.length+'|'+P.patterns.length+'|'+P.bpm+'|'+P.song.map(function(s){ return s.speed||100; }).join(); }
function audible(t,sec){ return T.audible(P,t)&&!(sec&&sec.off&&sec.off[t.id]); }
function pid(i){ return T.patById(P,P.song[i].pat).id; }

/* ---------------- the song, measured once ---------------- */
function plan(){
  P=host.project();
  var n=P.tracks.length,sw=Math.min(160,1536/n),R=200,rOut=R*0.965,rIn=R*0.37,sp=Math.min(15,(rOut-rIn)/n),i,par=0;
  L={n:n,sw:sw,x0:800-n*sw/2,R:R,rl:R*0.32,sp:sp,rr:[],col:[],pit:[],decks:[{cx:318,cy:322,side:-1},{cx:1282,cy:322,side:1}],par:[],len:[],en:[],total:0,shots:{}};
  P.tracks.forEach(function(t,i){
    var I=T.inst(t.inst);
    L.rr.push(rOut-sp*(i+0.5)); L.col.push(hueOf(t)); L.pit.push(!!I.pitched&&!isKick(t));
    if(!trs[t.id]) trs[t.id]={hit:0,m:0,pk:0,t0:-9,t1:-9,len:0,note:'',fp:0,ft:0,init:false};
    (L.shots[t.inst]=L.shots[t.inst]||[]).push(t.id);
  });
  cache={};
  var mx=0;
  P.song.forEach(function(s,i){
    var pat=T.patById(P,s.pat),e=0;
    if(i&&pid(i-1)!==pat.id) par=1-par;
    var dur=s.rep*pat.bars*16*sdOf(s); L.par.push(par); L.len.push(dur); L.total+=dur;
    P.tracks.forEach(function(t){ if(audible(t,s)&&cells(pat,t).any) e+=isKick(t)?3:T.inst(t.inst).group==='Bass'?2:1; });
    L.en.push(e); if(e>mx) mx=e;
  });
  L.en=L.en.map(function(e){ return mx?e/mx:0; });
  stamp=stampOf();
}
/* one pattern row, a cell per step: loudness, where in the cell the mark starts and ends, and the note */
function cells(pat,t){
  var key=pat.id+'|'+t.id,c=cache[key]; if(c) return c;
  var N=pat.bars*16,row=pat.rows[t.id],I=T.inst(t.inst),v=new Uint8Array(N),f0=new Float32Array(N),f1=new Float32Array(N),nn=new Int8Array(N),any=false,s,j,l;
  if(row) for(s=0;s<N;s++){
    if(!row.v[s]) continue;
    any=true; l=held(I)?Math.max(1,row.l[s]|0):1;
    for(j=0;j<l&&s+j<N;j++){
      if(j&&row.v[s+j]) break;
      v[s+j]=row.v[s]; nn[s+j]=clamp(row.n[s]|0,-7,14); f0[s+j]=j?0:0.14; f1[s+j]=1;
    }
    f1[s+j-1]=j>1?0.78:0.62;
  }
  return cache[key]={N:N,v:v,f0:f0,f1:f1,n:nn,any:any};
}

/* ---------------- sprites that never change between frames ---------------- */
function makeVinyl(){
  var R=L.R,s=sprite(2*R+4,2*R+4),c=s.c,r,i;
  c.translate(R+2,R+2);
  c.fillStyle=rad(c,0,0,R*0.3,R,[[0,'#0f1512'],[0.6,'#060908'],[1,'#0c110f']]); circ(c,0,0,R);
  c.lineWidth=0.6;
  for(r=R*0.35,i=0;r<R*0.985;r+=2.3,i++){ c.strokeStyle='rgba(255,255,255,'+(0.014+0.022*((i*0.618)%1)).toFixed(3)+')'; c.beginPath(); c.arc(0,0,r,0,TAU); c.stroke(); }
  c.strokeStyle='rgba(255,255,255,.13)'; c.lineWidth=1.2; c.beginPath(); c.arc(0,0,R-0.8,0,TAU); c.stroke();
  return s.cv;
}
function makeSheen(){
  var R=L.R,s=sprite(2*R+4,2*R+4),c=s.c;
  c.translate(R+2,R+2);
  if(c.createConicGradient){
    var gr=c.createConicGradient(-0.95,0,0);
    [[0,0],[0.05,0],[0.105,0.13],[0.16,0],[0.5,0],[0.56,0],[0.61,0.1],[0.665,0],[1,0]].forEach(function(p){ gr.addColorStop(p[0],'rgba(255,255,255,'+p[1]+')'); });
    c.fillStyle=gr;
  } else c.fillStyle=lin(c,-R,-R,R,R,[[0,'rgba(255,255,255,0)'],[0.5,'rgba(255,255,255,.07)'],[1,'rgba(255,255,255,0)']]);
  c.beginPath(); c.arc(0,0,R-1,0,TAU); c.arc(0,0,L.rl+2,0,TAU,true); c.fill();
  return s.cv;
}
function arcText(c,str,r,mid,font,col,track){
  var ws=[],w=0,i,a;
  c.font=font; c.fillStyle=col; c.textAlign='center'; c.textBaseline='middle';
  for(i=0;i<str.length;i++){ ws[i]=c.measureText(str[i]).width+track; w+=ws[i]; }
  a=mid-w/r/2;
  for(i=0;i<str.length;i++){ a+=ws[i]/r/2; c.save(); c.rotate(a+HALF); c.fillText(str[i],0,-r); c.restore(); a+=ws[i]/r/2; }
}
function labelFor(pat){
  var idx=P.patterns.indexOf(pat),key=pat.id+'|'+pat.name+'|'+idx,s=labels[key]; if(s) return s;
  var r=L.rl,sp=sprite(2*r+2,2*r+2),c=sp.c,col=LABELS[(idx<0?0:idx)%LABELS.length],i;
  c.translate(r+1,r+1);
  c.fillStyle=rad(c,-r*0.3,-r*0.35,0,r*1.5,[[0,mix(col,'#ffffff',0.25)],[0.6,col],[1,mix(col,'#000000',0.35)]]); circ(c,0,0,r);
  c.fillStyle='rgba(20,28,24,.9)'; c.beginPath(); c.arc(0,0,r*0.985,0.5,2.6); c.arc(0,0,r*0.56,2.6,0.5,true); c.closePath(); c.fill();
  c.strokeStyle='rgba(20,28,24,.55)'; c.lineWidth=1; c.beginPath(); c.arc(0,0,r*0.5,0,TAU); c.stroke();
  for(i=0;i<3;i++){ c.save(); c.rotate(-0.2+i*0.2); c.fillStyle='rgba(20,28,24,.8)'; c.fillRect(r*0.56,-1.5,r*0.4,3); c.restore(); }
  arcText(c,pat.name.slice(0,14),r*0.76,-HALF,FL(r*0.24),'#1b241f',0.6);
  arcText(c,'TOCK-8  '+pat.bars+(pat.bars>1?' BARS':' BAR'),r*0.775,HALF,F(r*0.15,700),col,0.9);
  c.fillStyle='#0a0e0c'; circ(c,0,0,r*0.2);
  c.fillStyle=rad(c,-1,-1.5,0,r*0.11,[[0,'#f3f0e8'],[1,'#77807a']]); circ(c,0,0,r*0.1);
  return labels[key]=sp.cv;
}

/* ---------------- the board itself, painted once per size or song ---------------- */
function cap(c,x,y,w,h,r,top,bot,edge){
  rr(c,x,y+3,w,h,r); c.fillStyle=edge; c.fill();
  rr(c,x,y,w,h,r); c.fillStyle=lin(c,0,y,0,y+h,[[0,top],[1,bot]]); c.fill();
  c.strokeStyle='rgba(255,255,255,.09)'; c.lineWidth=1; rr(c,x+0.5,y+0.5,w-1,h-1,r); c.stroke();
}
function charCap(c,x,y,w,h,r){ cap(c,x,y,w,h,r,'#3a4640','#262f2b','#080b0a'); }
function lcd(c,x,y,w,h){
  rr(c,x-4,y-4,w+8,h+8,6); c.fillStyle='#070a09'; c.fill();
  rr(c,x,y,w,h,3); c.fillStyle=lin(c,0,y,0,y+h,[[0,'#c9d6c2'],[0.6,'#bccab6'],[1,'#aab9a4']]); c.fill();
  c.save(); c.clip();
  c.fillStyle='rgba(255,255,255,.07)'; for(var yy=y;yy<y+h;yy+=3) c.fillRect(x,yy,w,1);
  c.fillStyle=lin(c,x,y,x+w*0.6,y+h,[[0,'rgba(255,255,255,.2)'],[0.45,'rgba(255,255,255,0)']]); c.fillRect(x,y,w,h);
  c.restore();
}
function glass(c,x,y,w,h){
  rr(c,x,y,w,h,3); c.fillStyle=lin(c,0,y,0,y+h,[[0,'#050807'],[1,'#0b100e']]); c.fill();
  c.strokeStyle='rgba(255,255,255,.07)'; c.lineWidth=1; rr(c,x+0.5,y+0.5,w-1,h-1,3); c.stroke();
}
function pointer(c,x,y,r,val,col){
  var a=(-135+270*clamp(val,0,1))*Math.PI/180;
  c.strokeStyle=col; c.lineWidth=Math.max(1.6,r*0.17); c.lineCap='round';
  c.beginPath(); c.moveTo(x+Math.sin(a)*r*0.2,y-Math.cos(a)*r*0.2); c.lineTo(x+Math.sin(a)*r*0.84,y-Math.cos(a)*r*0.84); c.stroke(); c.lineCap='butt';
}
/* val and from are 0 to 1; from is where the setting rests (0, or 0.5 for left/right style knobs) */
function knob(c,x,y,r,val,from,col){
  c.fillStyle='rgba(0,0,0,.5)'; circ(c,x,y+r*0.22,r*1.08);
  c.fillStyle=rad(c,x,y-r*0.5,0,r*1.6,[[0,'#59645e'],[0.65,'#28322d'],[1,'#151b18']]); circ(c,x,y,r);
  c.fillStyle=rad(c,x,y-r*0.3,0,r,[[0,'#3b4741'],[1,'#1f2824']]); circ(c,x,y,r*0.7);
  if(val==null) return;
  var a0=(-135+270*Math.min(val,from)-90)*Math.PI/180,a1=(-135+270*Math.max(val,from)-90)*Math.PI/180;
  c.strokeStyle='rgba(255,255,255,.08)'; c.lineWidth=Math.max(1.2,r*0.16); c.beginPath(); c.arc(x,y,r*1.3,-225*Math.PI/180,45*Math.PI/180); c.stroke();
  if(a1-a0>0.02){ c.strokeStyle=rgba(col,0.85); c.beginPath(); c.arc(x,y,r*1.3,a0,a1); c.stroke(); }
  pointer(c,x,y,r,val,C.bone);
}
function stripX(i){ return L.x0+(i+0.5)*L.sw; }
function paintChrome(){
  var c=chrome.getContext('2d'),i,j,x,y;
  c.setTransform(1,0,0,1,0,0); c.clearRect(0,0,chrome.width,chrome.height); c.setTransform(k*dpr,0,0,k*dpr,ox*dpr,oy*dpr);
  /* body */
  c.save(); c.shadowColor='rgba(0,0,0,.75)'; c.shadowBlur=46*k*dpr; c.shadowOffsetY=16*k*dpr; rr(c,16,16,1568,868,30); c.fillStyle='#121815'; c.fill(); c.restore();
  rr(c,16,16,1568,868,30); c.fillStyle=lin(c,0,16,0,884,[[0,'#232d28'],[0.45,'#19211d'],[1,'#111714']]); c.fill();
  c.strokeStyle='rgba(255,255,255,.1)'; c.lineWidth=1.5; rr(c,17.5,17.5,1565,865,29); c.stroke();
  [[36,36],[1564,36],[36,864],[1564,864]].forEach(function(p,i){
    c.fillStyle=rad(c,p[0]-1.5,p[1]-2,0,7,[[0,'#aab3ac'],[0.7,'#4d5751'],[1,'#2a322e']]); circ(c,p[0],p[1],6);
    c.save(); c.translate(p[0],p[1]); c.rotate(0.4+i*1.1); c.fillStyle='#161c19'; c.fillRect(-4,-0.8,8,1.6); c.fillRect(-0.8,-4,1.6,8); c.restore();
  });
  /* name plate and the song ribbon's slot */
  tx(c,'TOCK-8',58,50,FL(25),C.bone); x=58+c.measureText('TOCK-8').width+9;
  c.fillStyle=C.tang; circ(c,x+4,50,5); tx(c,'LIVE',x+16,50,FL(25),C.tang);
  rr(c,296,29,RW+8,40,8); c.fillStyle='#070a09'; c.fill(); c.strokeStyle='rgba(255,255,255,.07)'; c.lineWidth=1; rr(c,296.5,29.5,RW+7,39,8); c.stroke();
  /* decks */
  L.decks.forEach(function(d,di){
    var R=L.R,cx=d.cx,cy=d.cy,px=d.side<0?66:1534,py;
    c.fillStyle=rad(c,cx,cy,R,R+26,[[0,'#050706'],[0.75,'#0a0e0c'],[1,'#1b2420']]); circ(c,cx,cy,R+26);
    c.strokeStyle=lin(c,0,cy-R-26,0,cy+R+26,[[0,'rgba(0,0,0,.6)'],[1,'rgba(255,255,255,.13)']]); c.lineWidth=2; c.beginPath(); c.arc(cx,cy,R+25,0,TAU); c.stroke();
    c.strokeStyle=lin(c,cx-R,cy-R,cx+R,cy+R,[[0,'#59635d'],[0.3,'#2a332f'],[0.55,'#69736d'],[0.8,'#272f2b'],[1,'#4d5751']]); c.lineWidth=13; c.beginPath(); c.arc(cx,cy,R+9.5,0,TAU); c.stroke();
    /* corners: letter and lamp, beat lamps, window, start key */
    tx(c,di?'B':'A',cx-226,cy-211,FL(42),C.bone);
    for(j=0;j<4;j++){ c.fillStyle='#050706'; circ(c,cx+152+j*23,cy-213,7.5); c.fillStyle='#1c2420'; circ(c,cx+152+j*23,cy-213,5.5); }
    tx(c,'BEAT',cx+141,cy-193,F(8),C.print);
    lcd(c,cx-224,cy+196,86,38);
    charCap(c,cx+142,cy+195,84,38,8);
    /* tempo slide */
    tx(c,'TEMPO',px,cy-166,F(8),C.print,'center');
    rr(c,px-4,cy-146,8,292,4); c.fillStyle='#050706'; c.fill();
    for(j=0;j<=10;j++){ c.fillStyle=j===5?rgba(C.bone,0.7):'rgba(255,255,255,.2)'; c.fillRect(px-(j===5?17:13),cy-140+j*28-0.5,j===5?9:5,1); c.fillRect(px+(j===5?8:8),cy-140+j*28-0.5,j===5?9:5,1); }
  });
  /* tower: screen */
  rr(c,570,84,460,132,12); c.fillStyle=lin(c,0,84,0,216,[[0,'#0c100e'],[1,'#151b18']]); c.fill();
  lcd(c,582,96,436,108);
  /* effect keys, filter, master knobs */
  FXK.forEach(function(f,i){ charCap(c,580,232+i*FXH,112,25,6); tx(c,f[1],636,245+i*FXH,F(9,700),rgba(C.bone,0.45),'center'); });
  knob(c,800,304,50,null);
  for(j=0;j<25;j++){ var a=(-135+270*j/24)*Math.PI/180; c.fillStyle='#070a09'; circ(c,800+Math.sin(a)*70,304-Math.cos(a)*70,3.6); }
  tx(c,'FILTER',800,388,F(10,700),C.bone,'center');
  tx(c,'MUFFLED',722,376,F(7.5),C.print,'center'); tx(c,'THIN',878,376,F(7.5),C.print,'center');
  [[922,264,'CRUNCH',P.crunch/100,P.crunch],[998,264,'SWING',P.swing/60,P.swing],[922,344,'VOLUME',P.vol/100,P.vol],[998,344,'KEY',(P.key+6)/12,null]].forEach(function(q){
    knob(c,q[0],q[1],19,q[2]==='KEY'?null:q[3],0,C.tang);
    tx(c,q[2],q[0],q[1]+36,F(8),C.print,'center');
  });
  /* one-shots, sends, crossfader */
  SHOTS.forEach(function(s,i){ charCap(c,580+i*SHW,404,57,40,7); tx(c,s[1],608.5+i*SHW,424,F(8,700),rgba(C.bone,L.shots[s[0]]?0.5:0.2),'center'); });
  [['ROOM',580],['ECHO',812]].forEach(function(s){
    tx(c,s[0],s[1],470,F(8.5,700),C.print);
    for(j=0;j<14;j++){ rr(c,s[1]+42+j*12,463,9,14,2); c.fillStyle='#070a09'; c.fill(); }
  });
  rr(c,640,512,320,24,12); c.fillStyle='#050706'; c.fill(); c.strokeStyle='rgba(255,255,255,.08)'; c.lineWidth=1; rr(c,640.5,512.5,319,23,12); c.stroke();
  for(j=0;j<=8;j++){ c.fillStyle=j===4?rgba(C.bone,0.6):'rgba(255,255,255,.18)'; c.fillRect(662+j*34.5-0.5,541,1,j%4?5:9); }
  tx(c,'A',612,524,FL(22),C.bone,'center'); tx(c,'B',988,524,FL(22),C.bone,'center');
  /* the bank: one strip per track */
  rr(c,L.x0-8,576,L.n*L.sw+16,300,14); c.fillStyle='rgba(0,0,0,.28)'; c.fill();
  P.tracks.forEach(function(t,i){
    var cx=stripX(i),w=L.sw,col=L.col[i],I=T.inst(t.inst),kx=cx+Math.min(24,w*0.25),name=(t.name||I.name).toUpperCase();
    if(i){ c.fillStyle='rgba(255,255,255,.05)'; c.fillRect(cx-w/2-0.5,586,1,280); }
    c.fillStyle=col; circ(c,cx-w/2+11,592,3);
    tx(c,name.slice(0,Math.max(4,Math.floor((w-22)/6.4))),cx-w/2+18,592.5,F(10.5,700),C.bone);
    glass(c,cx-w/2+6,602,w-12,20);
    for(j=0;j<14;j++){ rr(c,cx-w*0.5+8,774-j*10.4,7,8,1.5); c.fillStyle='#070a09'; c.fill(); }
    x=cx-Math.min(12,w*0.13);
    rr(c,x-3,634,6,150,3); c.fillStyle='#050706'; c.fill();
    for(j=0;j<=6;j++){ c.fillStyle='rgba(255,255,255,.16)'; c.fillRect(x+7,641+j*22.6,4,1); }
    [['TUNE',0.5+t.tn/48,0.5],['SIDE',0.5+t.pan/200,0.5],['ROOM',t.verb/100,0],['ECHO',t.echo/100,0],['DRIVE',(t.drive|0)/100,0],['TONE',0.5+(t.tone|0)/200,0.5]].forEach(function(q,j){
      knob(c,kx,641+j*25.4,7.2,q[1],q[2],col);
      tx(c,q[0],kx,641+j*25.4+14.6,F(6.4),C.print,'center');
    });
    rr(c,cx-w/2+6,800,w-12,66,9); c.fillStyle='#070a09'; c.fill();
    rr(c,cx-w/2+8,802,w-16,60,7); c.fillStyle=lin(c,0,802,0,862,[[0,mix('#222b27',col,0.12)],[1,'#161d1a']]); c.fill();
    c.strokeStyle='rgba(255,255,255,.07)'; c.lineWidth=1; rr(c,cx-w/2+8.5,802.5,w-17,59,7); c.stroke();
    tx(c,I.name.toUpperCase().slice(0,Math.max(4,Math.floor((w-20)/5))),cx,852,F(7.5),rgba(C.bone,0.4),'center');
  });
}

/* ---------------- what the studio tells us ---------------- */
function nowTime(){
  var rig=host.rig(); if(!rig) return performance.now()/1000;
  return rig.ac.currentTime-Math.min(0.2,rig.ac.outputLatency||0);
}
function touch(x,y){ if(touches.length<40) touches.push({x:x,y:y,a:1}); }
function emit(x,y,col,n,pow){
  if(reduce) return;
  while(n-->0){
    if(sparks.length>520) sparks.shift();
    var sp=(0.3+Math.random()*0.7)*pow;
    sparks.push({x:x,y:y+(Math.random()-0.5)*3,vx:sp*(0.5+Math.random()*0.6),vy:-sp*(0.05+Math.random()*0.5),a:1,d:1.3+Math.random()*2.3,col:Math.random()<0.25?'#ffffff':col});
  }
}
function fire(e){
  var pat=T.patById(P,e.pat),sd=e.sd||T.stepSec(P),dk=e.mode==='song'?L.par[e.sec]||0:0,d=L.decks[dk],s=e.step&15,pow=TAU/(16*sd);
  e.hits.forEach(function(id){
    var i=-1,j; for(j=0;j<P.tracks.length;j++) if(P.tracks[j].id===id){ i=j; break; }
    if(i<0) return;
    var t=P.tracks[i],I=T.inst(t.inst),row=pat.rows[id],st=trs[id]; if(!row||!st) return;
    var v=row.v[e.step]||1,n=clamp(row.n[e.step]|0,-7,14),l=held(I)?Math.max(1,row.l[e.step]|0):1,vel=(T.VEL&&T.VEL[v])||1,col=L.col[i],
        r0=L.rr[i]+(L.pit[i]?(n-3.5)/10.5*L.sp*0.3:0),kick=isKick(t);
    st.hit=1; st.t0=e.t; st.len=l*sd; st.t1=e.t+(l>1?l*sd*0.92:0.05); st.pk=clamp(t.lv/125*(0.4+0.45*vel),0.08,1); st.m=Math.max(st.m,st.pk);
    st.note=I.pitched?noteName((I.base||57)+t.tn+(P.key|0)+(e.shift|0)+T.degSemis(n,P.scale)):'';
    if(I.id==='scratch'){ decks[dk].scr0=e.t; decks[dk].scr1=e.t+l*sd; decks[dk].scrP=2*sd; }
    decks[dk].trail.push({r:r0,s:s,span:Math.min(15.9,l>1?l-0.22:0.62),col:col,w:L.sp*(v===2?0.7:v===3?0.4:0.56),t1:st.t1,v:vel});
    emit(d.cx+1,d.cy-r0,col,kick?20:v===2?10:v===3?3:6,pow*r0*(kick?1.3:1));
    E.heat[dk]=1;
    if(kick){ E.kick=1; shocks.push({x:d.cx,y:d.cy,r:L.R+12,a:0.8,col:mood(E.energy)}); }
    if(I.id==='boom') shocks.push({x:800,y:330,r:60,a:0.9,col:C.violet,big:true});
    E.room=Math.min(1,E.room+t.verb/100*vel*0.55); E.echo=Math.min(1,E.echo+t.echo/100*vel*0.7);
    if(I.group==='Effects'||I.id==='crash'){ for(j=0;j<SHOTS.length;j++) if(SHOTS[j][0]===I.id) touch(608.5+j*SHW,424); }
  });
  if(e.mode==='song'&&e.sec!==lastSec){
    var jump=lastSec<0?0:L.en[e.sec]-(L.en[lastSec]||0), fx=P.song[e.sec].fx;
    if(jump>0.25&&!reduce) E.flash=Math.min(1,jump*1.6);
    for(var q=0;q<FXK.length;q++) if(FXK[q][0]===fx) touch(636,245+q*FXH);
    lastSec=e.sec;
  }
}
/* which record sits on which deck right now, and how far through it we are */
function plans(){
  var S=P.song,n=S.length,res=[null,null],e=cur,mode=host.mode(),i,j,q,pat,nd=-1,Ld;
  E.soon=0;
  if(mode==='pat'&&e){
    pat=T.patById(P,e.pat);
    res[0]={pat:pat,mode:'live',sec:null,bar:e.step>>4,step:e.step&15,cont:true}; res[1]={pat:pat,mode:'cue',sec:null}; E.live=0; return res;
  }
  i=mode==='song'&&e?e.sec:clamp(host.part(),0,n-1); Ld=L.par[i]||0; pat=T.patById(P,S[i].pat);
  for(j=1;j<n;j++){ q=(i+j)%n; if(pid(q)!==pat.id){ nd=q; break; } }
  if(mode==='song'&&e){
    var last=e.rep+1>=S[i].rep,cont=!last||pid((i+1)%n)===pat.id,rs=i,bars=e.rep*pat.bars+(e.step>>4);
    while(rs>0&&pid(rs-1)===pat.id){ rs--; bars+=S[rs].rep*pat.bars; }
    res[Ld]={pat:pat,mode:'live',sec:S[i],bar:e.step>>4,step:e.step&15,cont:cont};
    if(rs>0&&bars<1) res[1-Ld]={pat:T.patById(P,S[rs-1].pat),mode:'spent',sec:null};
    else res[1-Ld]={pat:nd<0?pat:T.patById(P,S[nd].pat),mode:'cue',sec:nd<0?null:S[nd]};
    if(!cont&&(e.step>>4)===pat.bars-1) E.soon=((e.step&15)+frac)/16;
  } else {
    res[Ld]={pat:pat,mode:'cue',sec:S[i]};
    res[1-Ld]={pat:nd<0?pat:T.patById(P,S[nd].pat),mode:'cue',sec:nd<0?null:S[nd]};
  }
  E.live=Ld; return res;
}

/* ---------------- drawing a frame ---------------- */
function drawRings(pl,fade){
  var pat=pl.pat,i,s,live=pl.mode==='live';
  for(i=0;i<L.n;i++){
    var t=P.tracks[i],c=cells(pat,t); if(!c.any) continue;
    var a=(audible(t,pl.sec)?0.52:0.1)*fade*(live?1:0.62),col=L.col[i],r0=L.rr[i];
    for(s=0;s<16;s++){
      var src=live?(s>=pl.step?pl.bar:pl.bar+1):0;
      if(src>=pat.bars){ if(pl.cont) src=0; else continue; }
      var ix=src*16+s,v=c.v[ix]; if(!v) continue;
      g.strokeStyle=rgba(col,a*(v===2?1.3:v===3?0.55:1)); g.lineWidth=L.sp*(v===2?0.62:v===3?0.34:0.5);
      g.beginPath(); g.arc(0,0,r0+(L.pit[i]?(c.n[ix]-3.5)/10.5*L.sp*0.3:0),-HALF-(s+c.f1[ix])*STEP,-HALF-(s+c.f0[ix])*STEP); g.stroke();
    }
  }
}
function drawDeck(di,pl,now,dt,playing){
  var d=L.decks[di],D=decks[di],R=L.R,cx=d.cx,cy=d.cy,live=pl.mode==='live',key=pl.pat.id+(pl.mode==='spent'?'|x':''),i,j,sd=SD(),
      ang=D.ang+(D.scr1&&now<D.scr1?0.5*Math.sin((now-D.scr0)/D.scrP*TAU):0); /* a scratch drags the record back and forth */
  if(key!==D.key){ if(pl.mode==='cue'&&D.key&&D.key!==pl.pat.id) D.fade=0; D.key=key; }
  D.fade=Math.min(1,D.fade+dt*2.2);
  /* strobe dots on the rim */
  g.fillStyle=rgba(C.bone,0.34); g.beginPath();
  for(j=0;j<72;j++){ var a=ang+j*TAU/72; g.moveTo(cx+Math.cos(a)*(R+9.5)+1.7,cy+Math.sin(a)*(R+9.5)); g.arc(cx+Math.cos(a)*(R+9.5),cy+Math.sin(a)*(R+9.5),1.7,0,TAU); }
  g.fill();
  g.fillStyle=rad(g,cx-(R+9)*0.72,cy+(R+9)*0.72,0,46,[[0,rgba(C.tang,0.5+0.3*E.heat[di])],[1,rgba(C.tang,0)]]); circ(g,cx-(R+9)*0.72,cy+(R+9)*0.72,46);
  g.drawImage(spr.vinyl,cx-R-2,cy-R-2,2*R+4,2*R+4);
  g.save(); g.translate(cx,cy); g.rotate(ang);
  if(pl.mode!=='spent') drawRings(pl,D.fade);
  var lab=labelFor(pl.pat); g.globalAlpha=pl.mode==='spent'?0.55:0.35+0.65*D.fade; g.drawImage(lab,-L.rl-1,-L.rl-1,2*L.rl+2,2*L.rl+2); g.globalAlpha=1;
  /* what is sounding or has just sounded glows and trails away with the turn */
  g.globalCompositeOperation='lighter';
  for(i=D.trail.length-1;i>=0;i--){
    var tr=D.trail[i],age=now-tr.t1,al=age<0?1:1-age/(sd*4.5);
    if(al<=0){ D.trail.splice(i,1); continue; }
    var a0=-HALF-(tr.s+0.14+tr.span)*STEP,a1=-HALF-(tr.s+0.14)*STEP;
    g.strokeStyle=rgba(tr.col,0.3*al); g.lineWidth=tr.w*2.4; g.beginPath(); g.arc(0,0,tr.r,a0,a1); g.stroke();
    g.strokeStyle=rgba(tr.col,0.95*al); g.lineWidth=tr.w; g.beginPath(); g.arc(0,0,tr.r,a0,a1); g.stroke();
    if(age<0.06){ g.strokeStyle='rgba(255,255,255,.8)'; g.lineWidth=tr.w*0.5; g.beginPath(); g.arc(0,0,tr.r,a0,a1); g.stroke(); }
  }
  g.globalCompositeOperation='source-over';
  g.restore();
  g.drawImage(spr.sheen,cx-R-2,cy-R-2,2*R+4,2*R+4);
  /* the reading head: a glass rail across the rings with a hot line down the middle */
  var y0=cy-R-36,y1=cy-L.rl-5,heat=E.heat[di];
  rr(g,cx-9,y0+18,18,y1-y0-18,6); g.fillStyle='rgba(14,22,18,.5)'; g.fill(); g.strokeStyle='rgba(255,255,255,.16)'; g.lineWidth=1; g.stroke();
  g.strokeStyle=rgba(live?C.tang:C.mint,live?0.5+0.5*heat:0.16); g.lineWidth=1.6; g.beginPath(); g.moveTo(cx,y0+26); g.lineTo(cx,y1-5); g.stroke();
  if(live){
    g.globalCompositeOperation='lighter';
    g.strokeStyle=rgba(C.tang,0.22*heat); g.lineWidth=9; g.beginPath(); g.moveTo(cx,y0+26); g.lineTo(cx,y1-5); g.stroke();
    for(i=0;i<L.n;i++){ var h=trs[P.tracks[i].id].hit; if(h>0.04&&audible(P.tracks[i],pl.sec)){ g.fillStyle=rgba(L.col[i],h); circ(g,cx,cy-L.rr[i],1.6+3.2*h); } }
    g.globalCompositeOperation='source-over';
  }
  charCap(g,cx-34,y0,68,24,6);
  for(j=0;j<4;j++){ var on=live&&j<pl.pat.bars,nowBar=live&&j===pl.bar; g.fillStyle=nowBar?C.tang:on?rgba(C.tang,0.28):'#0a0e0c'; rr(g,cx-25+j*13.4,y0+8,10,7,2); g.fill(); }
  /* corners */
  var lamp=live?C.tang:pl.mode==='cue'?C.mint:C.print,blink=pl.mode==='cue'&&playing&&E.soon>0.5?(Math.floor(E.soon*16)%2?1:0.25):1;
  g.fillStyle='#050706'; circ(g,cx-178,cy-219,6.5);
  g.fillStyle=rgba(lamp,(pl.mode==='spent'?0.2:live?1:0.75)*blink); circ(g,cx-178,cy-219,4.5);
  if(live||pl.mode==='cue'){ g.globalCompositeOperation='lighter'; g.fillStyle=rad(g,cx-178,cy-219,0,16,[[0,rgba(lamp,0.5*blink)],[1,rgba(lamp,0)]]); circ(g,cx-178,cy-219,16); g.globalCompositeOperation='source-over'; }
  tx(g,live?'LIVE':pl.mode==='cue'?'CUED':'OUT',cx-178,cy-200,F(8.5,700),rgba(lamp,0.95),'center');
  var beat=cur&&playing?(cur.step&15)>>2:-1;
  for(j=0;j<4;j++) if(j===beat){ var bc=live?(j?C.bone:C.tang):C.mint,ba=(live?1:0.45)*(1-0.6*((cur.step&3)+frac)/4);
    g.fillStyle=rgba(bc,ba); circ(g,cx+152+j*23,cy-213,5.5);
    g.globalCompositeOperation='lighter'; g.fillStyle=rad(g,cx+152+j*23,cy-213,0,17,[[0,rgba(bc,0.55*ba)],[1,rgba(bc,0)]]); circ(g,cx+152+j*23,cy-213,17); g.globalCompositeOperation='source-over'; }
  tx(g,pl.pat.name.slice(0,12),cx-219,cy+208,F(10,700),C.ink);
  tx(g,live?'BAR '+(pl.bar+1)+' OF '+pl.pat.bars:pl.mode==='cue'?'UP NEXT':'PLAYED',cx-219,cy+223,F(8.5,600),rgba(C.ink,0.8));
  var px=d.side<0?66:1534,py=cy+140-280*clamp((E.bpm-50)/230,0,1);
  cap(g,px-14,py-9,28,18,4,'#f7f4ee','#d9d5ca','#6f6b62'); g.fillStyle=C.tang; g.fillRect(px-11,py-1,22,2);
  tx(g,String(Math.round(E.bpm)),px,cy+166,F(11,700),C.bone,'center');
  g.fillStyle=playing?(live?C.tang:C.mint):rgba(C.bone,0.55);
  g.beginPath(); if(playing){ g.rect(cx+175,cy+206,6,16); g.rect(cx+187,cy+206,6,16); } else { g.moveTo(cx+177,cy+205); g.lineTo(cx+193,cy+214); g.lineTo(cx+177,cy+223); g.closePath(); }
  g.fill();
}
function drawRibbon(pos,now,playing){
  var x=300,i,S=P.song,loop=host.mode()==='pat';
  if(loop) playing=false;
  for(i=0;i<S.length;i++){
    var w=RW*L.len[i]/L.total,en=L.en[i],h=7+en*23,curr=pos.sec===i,past=playing&&i<pos.sec;
    rr(g,x+1,65-h,Math.max(2,w-2),h,3);
    g.fillStyle=curr&&playing?C.tang:curr?rgba(C.bone,0.85):rgba(mood(en),past?0.6:0.28); g.fill();
    if(w>30){ g.save(); g.beginPath(); g.rect(x,29,w-2,40); g.clip(); tx(g,S[i].name,x+5,h>21?59:59-h+ -4,F(8,700),h>21?(curr?'#3b1700':rgba('#000000',0.75)):rgba(C.bone,curr?0.95:0.5)); g.restore(); }
    if(curr&&playing){ var px=x+w*pos.prog; g.fillStyle='#fff'; g.fillRect(px-1,31,2,36); g.globalCompositeOperation='lighter'; g.fillStyle=rad(g,px,49,0,22,[[0,rgba(C.tang,0.6)],[1,rgba(C.tang,0)]]); circ(g,px,49,22); g.globalCompositeOperation='source-over'; }
    x+=w;
  }
  tx(g,loop?'LOOP':playing&&cur?fmt(cur.el+frac*SD())+' / '+fmt(L.total):fmt(L.total),RW+314,50,F(11.5,700),C.bone);
}
function drawScreen(pos,playing){
  var S=P.song,mode=host.mode(),sec=S[pos.sec],i,j,keyN=NOTE[(((9+(P.key|0)+(mode==='song'&&cur?sec.shift|0:0))%12)+12)%12];
  tx(g,(mode==='song'?'PLAYING':mode==='pat'?'LOOPING':'READY')+'  '+P.name.toUpperCase().slice(0,22),594,109,F(10,700),C.ink);
  tx(g,Math.round(E.bpm)+' BPM  '+keyN+' '+String(P.scale||'minor').toUpperCase(),1006,109,F(10,700),C.ink,'right');
  g.fillStyle=rgba(C.ink,0.3); g.fillRect(594,118,412,1);
  var title=mode==='pat'&&cur?T.patById(P,cur.pat).name:sec.name;
  g.save(); g.beginPath(); g.rect(590,120,236,50); g.clip(); tx(g,title,593,147,FL(title.length>9?26:34),C.ink); g.restore();
  var line2='',line3='';
  if(mode==='song'&&cur){
    var n=T.patById(P,sec.pat).bars*16,left=Math.ceil((sec.rep*n-(cur.rep*n+cur.step))/16),nx=S[pos.sec+1];
    line2='PART '+(pos.sec+1)+' OF '+S.length+'   BAR '+((cur.step>>4)+1)+'.'+(((cur.step&15)>>2)+1);
    line3=(nx?nx.name:'THE START')+' IN '+left+(left===1?' BAR':' BARS');
  } else if(mode==='pat'&&cur){ line2='BAR '+((cur.step>>4)+1)+'.'+(((cur.step&15)>>2)+1); line3='ONE PATTERN, ROUND AND ROUND'; }
  else { line2='PART '+(pos.sec+1)+' OF '+S.length; line3='PRESS SPACE TO PLAY'; }
  tx(g,line2,594,178,F(10,700),C.ink); tx(g,line3,594,194,F(10,700),rgba(C.ink,0.78));
  /* what is coming out, low notes on the left */
  for(i=0;i<24;i++){
    var rows=Math.round(spec[i]*12);
    for(j=0;j<12;j++){ g.fillStyle=j<rows?C.ink:rgba(C.ink,0.09); g.fillRect(838+i*7,192-j*5.6,5.4,4.2); }
  }
}
function drawTower(pos,now,playing,dt){
  var sec=P.song[pos.sec],mode=host.mode(),fx=mode==='song'&&cur?sec.fx:'none',target=0,i,j;
  if(fx==='open') target=-1+pos.prog; else if(fx==='close') target=-pos.prog; else if(fx==='thin') target=pos.prog;
  else if(fx==='pump'&&cur) target=-0.8*Math.min(1,((cur.step&3)+frac)/3.7);
  E.filter+=(target-E.filter)*Math.min(1,dt*(fx==='pump'?40:Math.abs(target-E.filter)>0.3?7:30));
  /* effect keys */
  FXK.forEach(function(f,i){
    if(f[0]!==fx||(fx==='gate'&&cur&&(cur.step&1))) return; /* the chop key blinks with the cuts */
    var y=232+i*FXH;
    g.save(); g.shadowColor=C.tang; g.shadowBlur=20*k*dpr; rr(g,580,y+1,112,24,6); g.fillStyle=lin(g,0,y,0,y+25,[[0,'#ffa550'],[1,'#f26a0c']]); g.fill(); g.restore();
    tx(g,f[1],636,y+13,F(9,700),'#3b1700','center');
  });
  /* filter knob and its ring of lamps */
  var v=E.filter,pi=Math.round(12+v*12);
  for(j=0;j<25;j++){
    var lit=(v<-0.02&&j>=pi&&j<=12)||(v>0.02&&j<=pi&&j>=12)||(Math.abs(v)<=0.02&&j===12);
    if(!lit) continue;
    var a=(-135+270*j/24)*Math.PI/180,lx=800+Math.sin(a)*70,ly=304-Math.cos(a)*70,lc=Math.abs(v)<=0.02?C.bone:v<0?C.mint:C.tang;
    g.fillStyle=lc; circ(g,lx,ly,3);
    g.globalCompositeOperation='lighter'; g.fillStyle=rad(g,lx,ly,0,11,[[0,rgba(lc,0.5)],[1,rgba(lc,0)]]); circ(g,lx,ly,11); g.globalCompositeOperation='source-over';
  }
  pointer(g,800,304,50,(v+1)/2,Math.abs(v)<=0.02?C.bone:v<0?C.mint:C.tang);
  /* the key knob follows a part that is shifted up or down */
  E.keyv+=(((P.key|0)+(mode==='song'&&cur?sec.shift|0:0))-E.keyv)*Math.min(1,dt*8);
  pointer(g,998,344,19,clamp((E.keyv+18)/36,0,1),Math.abs(E.keyv-(P.key|0))>0.2?C.tang:C.bone);
  /* one-shots: lit while they sound, filling as a riser climbs */
  SHOTS.forEach(function(s,i){
    var ids=L.shots[s[0]],best=0,prog=0; if(!ids) return;
    ids.forEach(function(id){ var st=trs[id]; if(st.hit>best){ best=st.hit; prog=st.len>0.2?clamp((now-st.t0)/st.len,0,1):1; } });
    if(best<0.04) return;
    var x=580+i*SHW,col=s[0]==='crash'?C.bone:C.violet;
    g.save(); g.shadowColor=col; g.shadowBlur=20*k*dpr*best; rr(g,x,405,57,39,7); g.fillStyle=rgba(col,0.3+0.5*best); g.fill(); g.restore();
    g.save(); rr(g,x,405,57,39,7); g.clip(); g.fillStyle=rgba(col,0.9); g.fillRect(x,405,57*prog,39); g.restore();
    tx(g,s[1],x+28.5,424,F(8,700),'#16101f','center');
  });
  /* how much is going to the room and the echo */
  [[E.room,622,C.mint],[E.echo,854,C.mint]].forEach(function(s){
    var n=Math.round(s[0]*14);
    for(j=0;j<n;j++){ rr(g,s[1]+j*12,463,9,14,2); g.fillStyle=j>10?C.tang:s[2]; g.fill(); }
  });
  /* crossfader */
  E.xf+=(E.live-E.xf)*Math.min(1,dt*20);
  var cx=662+E.xf*276;
  cap(g,cx-22,504,44,40,7,'#f7f4ee','#d6d2c7','#6f6b62'); g.fillStyle=C.tang; g.fillRect(cx-1.5,508,3,32);
  [[612,0],[988,1]].forEach(function(p){
    var liveSide=E.live===p[1],col=liveSide?C.tang:C.mint,a=liveSide?1:(playing&&E.soon>0.5?(Math.floor(E.soon*16)%2?0.9:0.15):0.3);
    g.fillStyle=rgba(col,a); circ(g,p[0],547,4);
    g.globalCompositeOperation='lighter'; g.fillStyle=rad(g,p[0],547,0,15,[[0,rgba(col,0.5*a)],[1,rgba(col,0)]]); circ(g,p[0],547,15); g.globalCompositeOperation='source-over';
  });
}
function drawBank(pos,now,dt,playing){
  var sec=host.mode()==='song'&&cur?P.song[pos.sec]:null,i,j;
  P.tracks.forEach(function(t,i){
    var st=trs[t.id],cx=stripX(i),w=L.sw,col=L.col[i],on=audible(t,sec),isHeld=now<st.t1,fx=cx-Math.min(12,w*0.13),target=on?clamp(t.lv/150,0,1):0;
    if(!st.init){ st.fp=st.ft=target; st.init=true; }
    if(Math.abs(target-st.ft)>0.01){ st.ft=target; touch(fx,776-136*st.fp); }
    st.fp+=(st.ft-st.fp)*Math.min(1,dt*9);
    st.hit*=Math.exp(-dt*(isHeld?2:10)); if(isHeld&&st.hit<0.6) st.hit=0.6;
    if(isHeld) st.m=Math.max(st.m,st.pk*(0.82+0.1*Math.sin(now*37+i*2.1))); else st.m=Math.max(0,st.m-dt*1.9);
    /* note window */
    if(on){ if(st.note&&st.hit>0.02) tx(g,st.note,cx,612.5,F(11,700),rgba(col,0.35+0.65*Math.min(1,st.hit*1.6)),'center');
      else if(st.hit>0.02){ g.fillStyle=rgba(col,st.hit); g.fillRect(cx-(w-24)/2*st.hit,610,(w-24)*st.hit,5); } }
    else tx(g,'OUT',cx,612.5,F(9,700),rgba(C.print,0.55),'center');
    /* meter */
    var n=Math.round(st.m*14);
    for(j=0;j<n;j++){ rr(g,cx-w*0.5+8,774-j*10.4,7,8,1.5); g.fillStyle=j>11?C.tang:j>8?mix(col,C.tang,0.5):col; g.fill(); }
    /* fader */
    var fy=776-136*st.fp;
    cap(g,fx-12,fy-8,24,16,3.5,on?'#f7f4ee':'#8c9089',on?'#d6d2c7':'#5d625c','#3a3d38'); g.fillStyle=on?col:'#2a2f2b'; g.fillRect(fx-9,fy-1,18,2);
    /* pad */
    if(!on){ g.save(); rr(g,cx-w/2+8,802,w-16,60,7); g.clip(); g.strokeStyle='rgba(255,255,255,.05)'; g.lineWidth=3; g.beginPath(); for(j=-60;j<w;j+=10){ g.moveTo(cx-w/2+j,862); g.lineTo(cx-w/2+j+60,802); } g.stroke(); g.restore(); }
    else if(st.hit>0.02){
      rr(g,cx-w/2+8,802,w-16,60,7); g.fillStyle=rgba(col,0.12+0.88*st.hit); g.fill();
      g.globalCompositeOperation='lighter'; g.fillStyle=rad(g,cx,832,10,w*0.8,[[0,rgba(col,0.45*st.hit)],[1,rgba(col,0)]]); g.fillRect(cx-w,832-w,2*w,2*w); g.globalCompositeOperation='source-over';
      if(st.hit>0.35) tx(g,T.inst(t.inst).name.toUpperCase().slice(0,Math.max(4,Math.floor((w-20)/5))),cx,852,F(7.5,700),'rgba(10,16,13,.8)','center');
    }
  });
}
function frame(tms){ raf=requestAnimationFrame(frame); draw(tms); }
function draw(tms){
  var t=tms/1000,dt=clamp(t-lastT,0.001,0.1),now,mode,playing,i; lastT=t;
  E.fps+=(1/dt-E.fps)*0.05;
  if(host.project()!==P||stamp!==stampOf()){ plan(); labels={}; paintChrome(); }
  now=nowTime(); mode=host.mode(); playing=!!mode;
  if(!playing){ Q.length=0; cur=null; lastSec=-1; frac=0; }
  while(Q.length&&Q[0].t+Q[0].sw<=now){ cur=Q.shift(); fire(cur); }
  if(cur) frac=clamp((now-cur.t)/SD(),0,1.2);
  var pls=plans(),pos={sec:playing&&cur&&mode==='song'?cur.sec:clamp(host.part(),0,P.song.length-1),prog:0};
  if(playing&&cur&&mode==='song'){ var n=T.patById(P,P.song[cur.sec].pat).bars*16; pos.prog=clamp((cur.rep*n+cur.step+frac)/(P.song[cur.sec].rep*n),0,1); }
  /* things that settle on their own */
  E.kick*=Math.exp(-dt*8); E.flash*=Math.exp(-dt*5); E.room*=Math.exp(-dt*2.6); E.echo*=Math.exp(-dt*1.3); E.heat[0]*=Math.exp(-dt*7); E.heat[1]*=Math.exp(-dt*7);
  E.energy+=((playing?L.en[pos.sec]:0.25)-E.energy)*Math.min(1,dt*3);
  var speed=TAU/(16*SD());
  E.bpm+=((playing&&cur?15/SD():P.bpm)-E.bpm)*Math.min(1,dt*7);
  if(playing&&cur){ decks[0].ang=decks[1].ang=((cur.step&15)+frac)*STEP; E.spin=speed; }
  else { E.spin+=(0.5-E.spin)*Math.min(1,dt*1.4); decks[0].ang+=E.spin*dt; decks[1].ang+=E.spin*dt; }
  var rig=host.rig();
  if(rig&&rig.analyser){
    if(!freq||freq.length!==rig.analyser.frequencyBinCount) freq=new Uint8Array(rig.analyser.frequencyBinCount);
    rig.analyser.getByteFrequencyData(freq);
    var hz=rig.ac.sampleRate/2/freq.length;
    for(i=0;i<24;i++){ var a=Math.floor(40*Math.pow(300,i/24)/hz),b=Math.max(a+1,Math.floor(40*Math.pow(300,(i+1)/24)/hz)),m=0,j; for(j=a;j<b&&j<freq.length;j++) if(freq[j]>m) m=freq[j];
      var val=clamp((m/255-0.25)/0.7,0,1); spec[i]=val>spec[i]?val:Math.max(val,spec[i]-dt*2.2); }
  }

  /* paint */
  var mc=mood(E.energy),bump=reduce?0:E.kick*2.6,KD=k*dpr;
  g.setTransform(1,0,0,1,0,0); g.globalCompositeOperation='source-over'; g.globalAlpha=1;
  g.fillStyle=C.room; g.fillRect(0,0,cv.width,cv.height);
  g.setTransform(KD,0,0,KD,ox*dpr,oy*dpr);
  /* light leaking out from under the board */
  var ug=0.16+0.2*E.energy+(reduce?0:0.3*E.kick);
  g.fillStyle=rad(g,800,450,300,1150,[[0,rgba(mc,ug)],[0.75,rgba(mc,ug*0.35)],[1,rgba(mc,0)]]); g.fillRect(-800,-600,3200,2100);
  g.setTransform(1,0,0,1,0,Math.round(bump*KD)); g.drawImage(chrome,0,0);
  g.setTransform(KD,0,0,KD,ox*dpr,oy*dpr+bump*KD);
  drawRibbon(pos,now,playing); drawScreen(pos,playing); drawTower(pos,now,playing,dt); drawBank(pos,now,dt,playing);
  drawDeck(0,pls[0],now,dt,playing); drawDeck(1,pls[1],now,dt,playing);
  /* stage light falling across the board */
  g.globalCompositeOperation='lighter';
  var sa=0.035+0.06*E.energy+(reduce?0:0.045*E.kick),ld=L.decks[E.live];
  g.fillStyle=rad(g,800+520*Math.sin(t*0.21),300+170*Math.cos(t*0.33),0,560,[[0,rgba(mc,sa)],[1,rgba(mc,0)]]); g.fillRect(0,0,W,H);
  g.fillStyle=rad(g,800-520*Math.sin(t*0.17+1),520+150*Math.sin(t*0.29),0,520,[[0,rgba(C.mint,sa*0.7)],[1,rgba(C.mint,0)]]); g.fillRect(0,0,W,H);
  if(!reduce&&E.kick>0.02){ g.fillStyle=rad(g,ld.cx,ld.cy,L.R*0.6,L.R*2.1,[[0,rgba(mc,0.1*E.kick)],[1,rgba(mc,0)]]); g.fillRect(0,0,W,H); }
  /* shock rings, sparks, touches */
  for(i=shocks.length-1;i>=0;i--){
    var s=shocks[i]; s.r+=dt*(s.big?900:260); s.a-=dt*(s.big?1.5:3.2);
    if(s.a<=0){ shocks.splice(i,1); continue; }
    g.strokeStyle=rgba(s.col,s.a*0.5); g.lineWidth=s.big?5:2.5; g.beginPath(); g.arc(s.x,s.y,s.r,0,TAU); g.stroke();
  }
  g.lineWidth=1.7; g.lineCap='round';
  for(i=sparks.length-1;i>=0;i--){
    var p=sparks[i]; p.vy+=1500*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.a-=p.d*dt;
    if(p.a<=0){ sparks.splice(i,1); continue; }
    g.strokeStyle=rgba(p.col,p.a); g.beginPath(); g.moveTo(p.x,p.y); g.lineTo(p.x-p.vx*0.024,p.y-p.vy*0.024); g.stroke();
  }
  g.lineCap='butt';
  for(i=touches.length-1;i>=0;i--){
    var q=touches[i]; q.a-=dt*3.4; if(q.a<=0){ touches.splice(i,1); continue; }
    g.strokeStyle=rgba(C.bone,q.a*0.55); g.lineWidth=1.5; g.beginPath(); g.arc(q.x,q.y,7+(1-q.a)*13,0,TAU); g.stroke();
  }
  if(E.flash>0.01){ g.fillStyle=rgba(mix(C.bone,C.tang,0.3),E.flash*0.3); g.fillRect(-800,-600,3200,2100); }
  g.globalCompositeOperation='source-over';
  if(btn.play&&btn.play._on!==playing){ btn.play._on=playing; btn.play.textContent=playing?'Stop':'Play'; btn.play.setAttribute('aria-pressed',playing?'true':'false'); }
}

/* ---------------- opening, closing, sizing ---------------- */
function build(){
  var st=document.createElement('style');
  st.textContent='#tockBoard{position:fixed;inset:0;z-index:60;background:'+C.room+';overflow:hidden;outline:0}#tockBoard canvas{position:absolute;inset:0;width:100%;height:100%;display:block}'+
    '#tockBoard button{position:absolute;display:flex;align-items:center;justify-content:center;border:0;cursor:pointer;font-family:'+MONO+';font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#e9e6df;'+
    'background:linear-gradient(180deg,#3a4640,#262f2b);box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 3px 0 #080b0a}'+
    '#tockBoard button:active{transform:translateY(2px);box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 1px 0 #080b0a}'+
    '#tockBoard button:focus-visible{outline:2px solid '+C.mint+';outline-offset:2px}'+
    '#tockBoard button.lit{color:#0f3d2b;background:linear-gradient(180deg,#c8f5e2,#8fdcba);box-shadow:inset 0 1px 0 #fff,0 3px 0 #3f8d6e}#tockBoard button.go{color:#3b1700;background:linear-gradient(180deg,#ff9440,#f56f10);box-shadow:inset 0 1px 0 #ffc79a,0 3px 0 #a84608}';
  document.head.appendChild(st);
  root=document.createElement('div'); root.id='tockBoard'; root.tabIndex=-1; root.hidden=true;
  root.setAttribute('role','dialog'); root.setAttribute('aria-label','Live board. It shows the song playing and does not change it.');
  cv=document.createElement('canvas'); cv.setAttribute('aria-hidden','true'); root.appendChild(cv);
  [['play','Play','go'],['calm','Calm',''],['full','Full screen',''],['close','Back','']].forEach(function(b){
    var el=document.createElement('button'); el.type='button'; el.textContent=b[1]; el.className=b[2]; root.appendChild(el); btn[b[0]]=el;
  });
  btn.play.title='Play or stop the song (Space)'; btn.calm.title='Calm: no sparks, shake or flashes (M)'; btn.calm.addEventListener('click',function(){ setCalm(!reduce,true); }); btn.full.title='Fill the whole screen (F)'; btn.close.title='Back to the studio (Esc)';
  btn.play.addEventListener('click',toggle); btn.close.addEventListener('click',close);
  btn.full.addEventListener('click',full);
  document.body.appendChild(root);
  g=cv.getContext('2d'); chrome=document.createElement('canvas');
  cv.addEventListener('click',function(e){
    var r=cv.getBoundingClientRect(),x=(e.clientX-r.left-ox)/k,y=(e.clientY-r.top-oy)/k,i,acc=300;
    if(y>=26&&y<=72&&x>=300&&x<=300+RW){ for(i=0;i<P.song.length;i++){ acc+=RW*L.len[i]/L.total; if(x<acc){ host.play(i); return; } } }
    for(i=0;i<2;i++){ var d=L.decks[i]; if(Math.hypot(x-d.cx,y-d.cy)<L.R||(x>d.cx+142&&x<d.cx+226&&y>d.cy+195&&y<d.cy+236)){ toggle(); return; } }
  });
  window.addEventListener('resize',function(){ if(opened) resize(); });
  document.addEventListener('fullscreenchange',function(){ if(opened) resize(); });
  document.addEventListener('keydown',function(e){
    if(!opened||e.ctrlKey||e.metaKey||e.altKey) return;
    if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); close(); }
    else if(e.code==='Space'){ e.preventDefault(); e.stopPropagation(); toggle(); }
    else if(e.key==='f'||e.key==='F'){ e.preventDefault(); e.stopPropagation(); full(); }
    else if(e.key==='m'||e.key==='M'){ e.preventDefault(); e.stopPropagation(); setCalm(!reduce,true); }
  },true);
}
/* calm follows the computer's reduced-motion setting until the viewer picks for themselves */
function setCalm(on,keep){
  reduce=!!on; if(reduce){ sparks.length=0; shocks.length=0; E.flash=0; }
  if(btn.calm){ btn.calm.setAttribute('aria-pressed',reduce?'true':'false'); btn.calm.className=reduce?'lit':''; }
  if(keep) try{ localStorage.setItem('tock8.board.calm',reduce?'1':'0'); }catch(e){}
}
/* playback started over or stopped: forget what was sounding, so nothing stays lit from before */
function reset(){
  Q.length=0; cur=null; lastSec=-1; frac=0;
  for(var id in trs){ trs[id].t1=-9; trs[id].hit=0; trs[id].m=0; }
  decks.forEach(function(d){ d.trail.length=0; d.scr1=0; });
}
function toggle(){ if(host.mode()) host.stop(); else host.play(); }
function full(){ if(document.fullscreenElement){ document.exitFullscreen(); } else if(root.requestFullscreen) root.requestFullscreen().catch(function(){}); }
function resize(){
  var r=root.getBoundingClientRect(); pw=r.width||window.innerWidth; ph=r.height||window.innerHeight;
  dpr=Math.min(window.devicePixelRatio||1,1.5); k=Math.min(pw/W,ph/H); ox=(pw-W*k)/2; oy=(ph-H*k)/2;
  cv.width=chrome.width=Math.max(1,Math.round(pw*dpr)); cv.height=chrome.height=Math.max(1,Math.round(ph*dpr));
  [['play',1240,34,70],['calm',1318,34,62],['full',1388,34,104],['close',1500,34,58]].forEach(function(b){
    var s=btn[b[0]].style; s.left=(ox+b[1]*k)+'px'; s.top=(oy+b[2]*k)+'px'; s.width=(b[3]*k)+'px'; s.height=(30*k)+'px'; s.borderRadius=(7*k)+'px'; s.fontSize=Math.max(8,9.5*k)+'px';
  });
  plan(); labels={}; spr.vinyl=makeVinyl(); spr.sheen=makeSheen(); paintChrome();
}
function open(h){
  if(h) host=h; if(!host) return false;
  T=host.T; if(!root) build();
  if(opened) return true;
  var saved=null; try{ saved=localStorage.getItem('tock8.board.calm'); }catch(e){}
  setCalm(saved==null?!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches):saved==='1');
  from=document.activeElement; root.hidden=false; opened=true; scrollWas=document.documentElement.style.overflow; document.documentElement.style.overflow='hidden'; trs={}; Q.length=0; cur=null; lastSec=-1; sparks.length=0; shocks.length=0; touches.length=0;
  decks.forEach(function(d){ d.key=''; d.fade=1; d.trail.length=0; });
  resize(); E.xf=L.par[clamp(host.part(),0,P.song.length-1)]||0;
  lastT=performance.now()/1000; raf=requestAnimationFrame(frame); root.focus();
  return true;
}
function close(){
  if(!opened) return;
  opened=false; cancelAnimationFrame(raf); raf=0; root.hidden=true; document.documentElement.style.overflow=scrollWas;
  if(document.fullscreenElement&&document.exitFullscreen) document.exitFullscreen();
  if(from&&from.focus) from.focus();
}
window.TockBoard={
  open:open,close:close,reset:reset,isOpen:function(){ return opened; },calm:function(on){ if(on!=null) setCalm(on); return reduce; },render:function(){ if(opened) draw(performance.now()); },canvas:function(){ return cv; },
  /* the studio calls this for every step it schedules: {t, sw, sec, step, pat, rep, hits, el, mode} */
  step:function(e){ if(opened){ Q.push(e); if(Q.length>96) Q.shift(); } },
  /* a plain description of what the board is showing, for checking it from a script */
  state:function(){
    if(!opened) return {open:false};
    var pls=plans();
    return {open:true,playing:host.mode()||'',fps:Math.round(E.fps),scale:+k.toFixed(3),part:cur?cur.sec:host.part(),step:cur?cur.step:null,liveDeck:E.live?'B':'A',crossfader:+E.xf.toFixed(2),filter:+E.filter.toFixed(2),
      decks:pls.map(function(p,i){ return {deck:i?'B':'A',record:p.pat.name,state:p.mode,trails:decks[i].trail.length}; }),
      hits:P.tracks.reduce(function(o,t){ o[t.id]=+trs[t.id].hit.toFixed(2); return o; },{}),sparks:sparks.length,faders:P.tracks.map(function(t){ return +(trs[t.id]?trs[t.id].fp:0).toFixed(2); }),lit:P.tracks.filter(function(t){ return trs[t.id]&&trs[t.id].hit>0.3; }).map(function(t){ return t.id; })};
  }
};
})();
