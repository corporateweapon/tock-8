/* Tock engine: the sounds, kits, built-in beats, song renderer and file writers.
   Shared by index.html (the pocket machine) and studio.html (the desktop studio). No dependencies, no network.
   Everything hangs off window.Tock. See CLAUDE.md for the data formats. */
(function(){
'use strict';
var T={version:'4.1'};

/* ================= kits and built-in beats ================= */
var TRACKS=[['KICK','Kick'],['SNARE','Snare'],['HAT','Closed hat'],['OPEN','Open hat'],['CLAP','Clap'],['TOM','Tom'],['RIM','Rimshot'],['BELL','Cowbell']];
var HARD_TR=[['KICK','Hard kick'],['SNARE','Snare'],['HAT','Closed hat'],['OPEN','Open hat'],['CLAP','Clap'],['BASS','Reverse bass'],['LEAD','Screech lead'],['CRASH','Crash']];
/* kick recipe per kit: f = pitch of the tail in Hz, top = how high the pitch drop starts, sw = drop time, len = tail length,
   d1/d2 = distortion before and after the mid boost, mid/midG = where and how hard the mids are pushed, lp = brightness, punch = clean thump on top */
var KITS=[
 {id:'CLASSIC',tr:TRACKS},
 {id:'HARD',tr:HARD_TR,k:{f:55,top:7,sw:0.11,len:0.36,d1:6,mid:850,midG:10,d2:3,lp:7000,punch:1}},
 {id:'JUMP',tr:HARD_TR,k:{f:55,top:5,sw:0.08,len:0.24,d1:3.5,mid:500,midG:7,d2:2,lp:4500,punch:1.15}},
 {id:'TEKK',tr:HARD_TR,k:{f:49,top:5,sw:0.13,len:0.27,d1:9,mid:320,midG:9,d2:4,lp:3200,punch:0.8}},
 {id:'CORE',tr:HARD_TR,k:{f:55,top:8,sw:0.16,len:0.30,d1:18,mid:1300,midG:8,d2:6,lp:9000,punch:0.7}}
];
var MINOR=[0,2,3,5,7,8,10,12];
var SLOTS=['A','B','C','D'];
/* x = hit, X = loud, o = soft. Rows: kick, snare, hat, open hat, clap, tom, rim, bell */
var PRESETS=[
 {name:'DUSTY',style:'Hip-hop',bpm:92,swing:32,space:14,p:[[
  'x......x..x.....','....x.......x...','x.x.x.xxx.x.x.x.','..............x.',
  '............x...','................','..x......x......','................'],[
  'x......x..x..x..','....x..o....x..o','x.x.x.xxx.x.x...','..............x.',
  '............x...','.............xx.','..x......x......','................']]},
 {name:'BOOMBAP',style:'Hip-hop',bpm:88,swing:28,space:10,crunch:22,p:[[
  'X.x.......xx....','....X.......X...','x.xox.x.x.xox.x.','................',
  '....x.......x...','................','.......o.......o','................'],[
  'X.x....x..x.....','....X.......X.oo','x.xox.x.x.xox...','..............x.',
  '....x.......x...','................','.......o........','................']]},
 {name:'TRAP',style:'Hip-hop',bpm:140,swing:0,space:18,tn:[-3,0,2,0,0,0,0,0],p:[[
  'X.....x......x..','........X.......','x.x.x.xoX.x.xoxo','....x...........',
  '........X.......','................','...........x..x.','................'],[
  'X..x..x......xx.','........X.......','xoxox.x.X.xoxoxX','..x.............',
  '........X.......','..............x.','...........x....','................']]},
 {name:'RAINY',style:'Hip-hop',bpm:76,swing:40,space:38,crunch:30,tn:[-2,-2,-1,0,0,0,0,0],p:[[
  'X.....x..x......','....x.......x...','x.o.x.o.x.o.x.o.','................',
  '................','................','....x.......x...','................'],[
  'X.....x..x...o..','....x.......x..o','x.o.x.o.x.o.x...','..............x.',
  '................','................','....x.......x...','................']]},
 {name:'CELLAR',style:'House and techno',bpm:124,swing:6,space:16,p:[[
  'x...x...x...x...','...............x','xx.xxx.xxx.xxx.x','..x...x...x...x.',
  '....x.......x...','..........x..x..','.......x........','................'],[
  'x...x...x...x...','............o.xX','xx.xxx.xxx.xxx.x','..x...x...x...x.',
  '....x.......x...','..........x..x..','.......x........','................']]},
 {name:'BUNKER',style:'House and techno',bpm:132,swing:0,space:24,crunch:18,tn:[-2,0,0,0,0,-4,0,0],p:[[
  'X...X...X...X...','................','x.oxx.oxx.oxx.ox','..x...x...x...x.',
  '....x.......x...','......o......o..','...x..x...x..x..','................'],[
  'X...X...X...X.x.','..............oX','x.oxx.oxx.oxx.ox','..x...x...x...x.',
  '....x.......x...','......o...o..o..','...x..x...x..x..','................']]},
 {name:'GLITTER',style:'House and techno',bpm:118,swing:0,space:20,p:[[
  'X...X...X...X...','....X.......X...','xx.oxx.oxx.oxx.o','..x...x...x...x.',
  '....x.......x...','................','................','................'],[
  'X...X...X...X...','....X.......X.xx','xx.oxx.oxx.oxx.o','..x...x...x...x.',
  '....x.......x...','.............xx.','................','x...x...x...x...']]},
 {name:'TWOSTEP',style:'House and techno',bpm:132,swing:24,space:16,p:[[
  'X.....x...x.....','....X.......X...','x.xx..xxx.xx..xx','..............x.',
  '....x.......x...','................','.......x.....x..','................']]},
 {name:'ROBOT',style:'Electro',bpm:116,swing:0,space:8,p:[[
  'x.....x...x..x..','....x.......x...','x.xxx.xxx.xxx.xx','.......x........',
  '............x...','.............x.x','..x..x..........','..x.x...x.x.....'],[
  'x.....x...x..x..','....x.......x...','x.xxx.xxx.xxx.xx','.......x.......x',
  '............x...','........x..x.x.x','..x..x..........','x.x.x...x.x.....']]},
 {name:'NEON',style:'Electro',bpm:126,swing:0,space:12,p:[[
  'X..x..x...x.x...','....X.......X...','x.x.x.x.x.x.x.x.','................',
  '....x.......x..x','................','................','x.x.xx.xx.x.xx.x']]},
 {name:'FOUNDRY',style:'Electro',bpm:150,swing:0,space:10,crunch:65,tn:[-1,-3,0,0,0,-5,0,-4],p:[[
  'X.x.X.x.X.x.X.x.','....X.......X..x','xoxoxoxoxoxoxoxo','................',
  '....x.......x...','..........x.x.xx','................','..x...x...x...x.']]},
 {name:'POCKET',style:'Breaks',bpm:104,swing:18,space:12,p:[[
  'X.x.......x..x..','....X..o.o..X..o','x.x.x.x.x.x.x...','..............x.',
  '................','................','................','................'],[
  'X.x.......x..x..','....X..o.o..X.oo','x.x.x.x.x.x.x.x.','................',
  '............x...','.............x.x','................','..x...x...x.....']]},
 {name:'LIQUID',style:'Breaks',bpm:172,swing:0,space:26,p:[[
  'X.........x.....','....X..o.o..X...','x.x.x.x.x.x.x.x.','................',
  '................','................','................','................'],[
  'X.........x..x..','....X..o.o..X.oX','x.x.x.x.x.x.x.x.','......x.........',
  '................','................','................','................']]},
 {name:'BREAKER',style:'Breaks',bpm:165,swing:0,space:14,crunch:28,tn:[2,3,0,0,0,0,0,0],p:[[
  'X.x.......xx....','....X..o.o..X..o','x.x.x.x.x.x.x.x.','................',
  '................','................','................','................'],[
  'X.x.......x.....','....X..o.o....X.','x.x.x.x.x...x.x.','..........x.....',
  '................','................','................','................']]},
 {name:'STOMP',style:'Breaks',bpm:80,swing:0,space:32,tn:[-2,-2,0,0,0,-3,0,0],p:[[
  'X.....x.X.x.....','....X.......X...','x.x.x.x.x.x.x.x.','................',
  '....x.......x...','................','................','................'],[
  'X.....x.X.x.....','....X.......X...','x.x.x.x.x.x.....','................',
  '....x.......x...','x............xxX','................','................']]},
 {name:'DEMBOW',style:'Further afield',bpm:96,swing:0,space:14,p:[[
  'X...X...X...X...','......x.......x.','x.x.x.x.x.x.x.x.','................',
  '................','................','...x..x....x..x.','................']]},
 {name:'IPANEMA',style:'Further afield',bpm:120,swing:0,space:22,lv:[80,100,70,100,100,100,110,100],p:[[
  'X..oX..oX..oX..o','................','xoxoxoxoxoxoxoxo','................',
  '................','................','x..x..x...x..x..','................']]},
 {name:'LAGOS',style:'Further afield',bpm:108,swing:12,space:16,p:[[
  'X.....x.x.....x.','................','x.xxx.xxx.xxx.xx','................',
  '....x.......x...','......x......xx.','..x.x..x..x.x..x','x..x..x...x.x...']]},
 /* hard kits. Rows: kick, snare, hat, open hat, clap, reverse bass, screech lead, crash. n = notes (scale steps 1 to 8) per row */
 {name:'HARDSTYLE',style:'Hard dance',kit:1,bpm:150,swing:0,space:18,crunch:20,lv:[100,90,60,70,85,85,70,60],p:[[
  'X...X...X...X...','................','.o.o.o.o.o.o.o.o','..x...x...x...x.',
  '....x.......x...','................','..x..x..x..x.x..','................'],[
  'X...X...X...X.xx','............xxxX','.o.o.o.o.o.o....','..x...x...x.....',
  '....x.......x...','................','..x..x..x..x.x..','x...............']],
  n:[{6:'..1..1..3..5.4..'},{6:'..1..1..3..7.8..'}]},
 {name:'EUPHORIC',style:'Hard dance',kit:1,bpm:150,swing:0,space:34,crunch:10,lv:[100,90,60,65,80,85,75,55],p:[[
  'X...X...X...X...','................','................','..x...x...x...x.',
  '....x.......x...','................','x.x.x.x.x.x.x.x.','................'],[
  'X...X...X...X...','..............xx','................','..x...x...x...x.',
  '....x.......x...','................','x.x.x.x.x.x.x.x.','x...............']],
  n:[{6:'1.3.5.8.5.3.5.3.'},{6:'6.8.3.8.7.2.4.2.'}]},
 {name:'RAWSTYLE',style:'Hard dance',kit:1,bpm:155,swing:0,space:12,crunch:48,tn:[-2,0,0,0,0,-2,0,0],lv:[100,90,60,70,75,85,65,60],p:[[
  'X...X...X..xX.x.','................','................','..x...x...x...x.',
  '....x.......x...','................','X.......X.......','................'],[
  'X..xX..xX.x.XxXx','................','................','..x...x...x.....',
  '....x.......x...','................','X.......X.....x.','x...............']],
  n:[{0:'1...1...1..31.4.',6:'8.......7.......'},{0:'1..31..31.5.1314',6:'8.......7.....5.'}]},
 {name:'REVERSE',style:'Hard dance',kit:1,bpm:150,swing:0,space:14,crunch:25,lv:[100,90,55,60,85,95,70,60],p:[[
  'X...X...X...X...','................','.o.o.o.o.o.o.o.o','................',
  '....x.......x...','..x...x...x...x.','................','................'],[
  'X...X...X...X...','............x.xX','.o.o.o.o.o.o....','................',
  '....x.......x...','..x...x...x...x.','................','x...............']],
  n:[{},{5:'..1...1...3...4.'}]},
 {name:'JUMPSTYLE',style:'Hard dance',kit:2,bpm:145,swing:0,space:12,crunch:22,lv:[100,90,60,70,85,95,65,60],p:[[
  'X...X...X..xX...','................','x.x.x.x.x.x.x.x.','................',
  '....x.......x...','..x...x...x...x.','...x..x....x..x.','................'],[
  'X...X..xX...X.xx','..............xx','x.x.x.x.x.x.x...','................',
  '....x.......x...','..x...x...x.....','...x..x....x..x.','................']],
  n:[{6:'...1..3....1..5.'},{6:'...1..3....4..3.'}]},
 {name:'TEKK',style:'Hard dance',kit:3,bpm:170,swing:0,space:10,crunch:30,lv:[100,90,60,70,85,90,65,60],p:[[
  'X...X...X...X...','................','................','..x...x...x...x.',
  '....x.......x...','..xx..xx..xx..xx','................','................'],[
  'X...X...X...X...','............x.xx','................','..x...x...x.....',
  '....x.......x...','..xx..xx..xx..xx','.......x.......x','................']],
  n:[{},{5:'..11..11..33..44',6:'.......5.......8'}]},
 {name:'HARDTEKK',style:'Hard dance',kit:3,bpm:180,swing:0,space:10,crunch:45,tn:[-1,0,0,0,0,-1,0,0],lv:[100,90,60,65,85,90,65,60],p:[[
  'X...X..xX...X.x.','................','................','..x...x...x...x.',
  '....X.......X...','..x...x...x...x.','x..x..x.x..x..x.','................'],[
  'X...X..xX...X.x.','................','................','..x...x...x...x.',
  '....X.......X...','..x...x...x...x.','x..x..x.x..x..x.','................']],
  n:[{6:'1..1..3.1..1..5.'},{6:'4..4..5.4..4..7.'}]},
 {name:'GABBER',style:'Hard dance',kit:4,bpm:185,swing:0,space:8,crunch:55,lv:[100,90,60,70,80,85,65,60],p:[[
  'X...X...X...X...','....x.......x...','................','..x...x...x...x.',
  '................','................','x.....x...x.....','................'],[
  'X...X...X.x.XxXx','....x.......x...','................','..x...x...x.....',
  '................','................','x.....x...x.....','x...............']],
  n:[{6:'1.....3...2.....'},{6:'1.....3...5.....'}]},
 {name:'FRENCHCORE',style:'Hard dance',kit:4,bpm:200,swing:0,space:10,crunch:40,lv:[100,85,55,70,80,95,65,60],p:[[
  'X...X...X...X...','....x.......x...','o.o.o.o.o.o.o.o.','................',
  '................','..x...x...x...x.','..x...x...x...x.','................'],[
  'X...X...X...X...','....x.......x.xx','o.o.o.o.o.o.o...','................',
  '................','..x...x...x...x.','..x...x...x...x.','................']],
  n:[{6:'..5...5...6...4.'},{6:'..3...3...4...2.'}]}
];
var STYLE_ORDER=['Hard dance','Hip-hop','House and techno','Electro','Breaks','Further afield'];

var CH={'.':0,x:1,X:2,o:3},VEL=[0,1,1.35,0.42];
function emptyP(){ var a=[],t; for(t=0;t<8;t++) a.push(new Array(16).fill(0)); return a; }
function parseP(rows){ return rows.map(function(s){ var r=[],i; for(i=0;i<16;i++) r.push(CH[s.charAt(i)]||0); return r; }); }
function fill8(v){ return [v,v,v,v,v,v,v,v]; }
/* compact beat (the form used in PRESETS) -> full beat */
function fromPreset(p){
  var pats=[],pit=[],i,t,s;
  for(i=0;i<4;i++){
    pats.push(p.p&&p.p[i]?parseP(p.p[i]):emptyP());
    var n=emptyP(),src=p.n&&p.n[i];
    if(src) for(t in src) for(s=0;s<16;s++){ var d=+String(src[t]).charAt(s); if(d>=1&&d<=8) n[+t][s]=d-1; }
    pit.push(n);
  }
  return {name:String(p.name||'BEAT').toUpperCase().slice(0,10),kit:p.kit||0,bpm:p.bpm||120,swing:p.swing||0,space:p.space||0,crunch:p.crunch||0,
    lv:(p.lv||fill8(100)).slice(),tn:(p.tn||fill8(0)).slice(),pats:pats,pit:pit};
}
/* beats saved by older versions have no kit or notes: fill them in */
function norm(b){
  b.kit=b.kit|0; if(b.kit<0||b.kit>=KITS.length) b.kit=0;
  if(!Array.isArray(b.pit)||b.pit.length!==4) b.pit=[emptyP(),emptyP(),emptyP(),emptyP()];
  return b;
}
function okBeat(b){
  if(!b||typeof b.name!=='string'||!Array.isArray(b.pats)||b.pats.length!==4||!Array.isArray(b.lv)||!Array.isArray(b.tn)) return false;
  for(var i=0;i<4;i++){ if(!Array.isArray(b.pats[i])||b.pats[i].length!==8) return false; for(var t=0;t<8;t++) if(!Array.isArray(b.pats[i][t])||b.pats[i][t].length!==16) return false; }
  return true;
}
/* accept either form of beat and return a full one, or throw with a useful message */
function readBeat(b){
  if(b&&Array.isArray(b.p)){
    b.p.forEach(function(pat,i){
      if(!Array.isArray(pat)||pat.length!==8) throw new Error('pattern '+i+' needs 8 rows');
      pat.forEach(function(r,j){ if(typeof r!=='string'||r.length!==16) throw new Error('pattern '+i+' row '+j+' must be a 16 character string of . x X o'); });
    });
    return fromPreset(b);
  }
  if(okBeat(b)) return norm(JSON.parse(JSON.stringify(b)));
  throw new Error('not a beat: give {name,kit,bpm,swing,space,crunch,p:[[8 rows of 16 chars]],n:[{row:"digits"}]} or a full beat from getBeat()');
}
var SCALES={minor:[0,2,3,5,7,8,10],phrygian:[0,1,3,5,7,8,10],harmonic:[0,2,3,5,7,8,11],major:[0,2,4,5,7,9,11]};
T.TRACKS=TRACKS; T.HARD_TR=HARD_TR; T.KITS=KITS; T.MINOR=MINOR; T.PRESETS=PRESETS; T.STYLE_ORDER=STYLE_ORDER; T.VEL=VEL; T.SCALES=SCALES;
T.emptyP=emptyP; T.fill8=fill8; T.fromPreset=fromPreset; T.norm=norm; T.okBeat=okBeat; T.readBeat=readBeat;

/* ================= sound: everything is synthesised ================= */
/* The voices read these while they run: R = the rig being played into, CK = kick recipe, CSD = seconds per step,
   CLEN = note length in seconds (0 = the voice's own), CCH = chord ratios, CID = a key so two synth tracks do not cut each other off */
var R=null,CK=null,CSD=0.1,CLEN=0,CCH=null,CID='';
function crunchCurve(amt){
  var n=1024,c=new Float32Array(n),k=amt/100*28,i,x;
  for(i=0;i<n;i++){ x=i/(n-1)*2-1; c[i]=(1+k)*x/(1+k*Math.abs(x)); }
  return c;
}
function makeNoise(ac){
  var len=ac.sampleRate,b=ac.createBuffer(1,len,ac.sampleRate),d=b.getChannelData(0);
  for(var i=0;i<len;i++) d[i]=Math.random()*2-1; return b;
}
function makeRoom(ac){
  var len=Math.floor(ac.sampleRate*1.7),b=ac.createBuffer(2,len,ac.sampleRate),c,i,d;
  for(c=0;c<2;c++){ d=b.getChannelData(c); for(i=0;i<len;i++){ var t=i/len; d[i]=(Math.random()*2-1)*Math.pow(1-t,3.2)*(i<ac.sampleRate*0.004?i/(ac.sampleRate*0.004):1); } }
  return b;
}
function makeComp(ac){
  var comp=ac.createDynamicsCompressor();
  comp.threshold.value=-12; comp.knee.value=8; comp.ratio.value=5; comp.attack.value=0.003; comp.release.value=0.12;
  return comp;
}
/* the pocket machine's rig: 8 voice buses -> crunch -> compressor, with one room reverb on the whole mix */
T.buildRig=function(ac,withScope){
  var rig={ac:ac,bus:[],openHat:null,noise:makeNoise(ac)};
  rig.master=ac.createGain(); rig.master.gain.value=0.8;
  rig.shaper=ac.createWaveShaper(); rig.shaper.oversample='2x';
  rig.trim=ac.createGain();
  var comp=makeComp(ac);
  rig.conv=ac.createConvolver(); rig.conv.buffer=makeRoom(ac);
  var hp=ac.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=320;
  rig.wet=ac.createGain();
  rig.out=ac.createGain();
  rig.master.connect(rig.shaper); rig.shaper.connect(rig.trim); rig.trim.connect(comp);
  rig.trim.connect(hp); hp.connect(rig.conv); rig.conv.connect(rig.wet); rig.wet.connect(comp);
  if(withScope){
    rig.analyser=ac.createAnalyser(); rig.analyser.fftSize=1024; rig.analyser.smoothingTimeConstant=0;
    comp.connect(rig.out); rig.out.connect(rig.analyser); rig.analyser.connect(ac.destination);
  } else { comp.connect(rig.out); rig.out.connect(ac.destination); }
  for(var i=0;i<8;i++){ var g=ac.createGain(); g.connect(rig.master); rig.bus.push(g); }
  return rig;
};
T.applyRig=function(rig,s){
  if(!rig) return;
  rig.shaper.curve=crunchCurve(s.crunch);
  rig.trim.gain.value=1/(1+s.crunch/100*0.9);
  rig.wet.gain.value=s.space/100*0.7;
  rig.out.gain.value=s.kit?0.55:1; /* the hard kits are dense and distorted: bring them down to sit nearer the classic kit */
  for(var i=0;i<8;i++) rig.bus[i].gain.value=s.lv[i]/100;
};
function gainEnv(time,peak,decay,dest){
  var g=R.ac.createGain();
  g.gain.setValueAtTime(0.0001,time);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002,peak),time+0.002);
  g.gain.exponentialRampToValueAtTime(0.0001,time+decay);
  g.connect(dest); return g;
}
function osc(type,time,f0,f1,sweep,dur,dest){
  var o=R.ac.createOscillator(); o.type=type;
  o.frequency.setValueAtTime(f0,time);
  if(f1) o.frequency.exponentialRampToValueAtTime(f1,time+sweep);
  o.connect(dest); o.start(time); o.stop(time+dur+0.05); return o;
}
function noise(time,dur,dest){
  var n=R.ac.createBufferSource(); n.buffer=R.noise; n.loop=true;
  n.connect(dest); n.start(time,Math.random()*0.5); n.stop(time+dur+0.05); return n;
}
function filter(type,freq,q,dest){
  var f=R.ac.createBiquadFilter(); f.type=type; f.frequency.value=Math.min(freq,R.ac.sampleRate*0.45); if(q) f.Q.value=q; f.connect(dest); return f;
}
/* cut off a ringing sound (open hat, kick tail, bass, lead) when the next one starts */
function choke(name,time){
  var oh=R[name];
  if(oh){
    try{
      if(oh.gain.cancelAndHoldAtTime) oh.gain.cancelAndHoldAtTime(time); else oh.gain.cancelScheduledValues(time);
      oh.gain.setTargetAtTime(0.0001,time,0.005);
    }catch(e){}
    R[name]=null;
  }
}
function chokeOpenHat(time){ choke('openHat',time); }
var curves={};
function driveCurve(k){
  if(curves[k]) return curves[k];
  var n=2048,c=new Float32Array(n),i,x,t=Math.tanh(k);
  for(i=0;i<n;i++){ x=i/(n-1)*2-1; c[i]=Math.tanh(k*x)/t; }
  return (curves[k]=c);
}
function shaper(k,dest){ var w=R.ac.createWaveShaper(); w.curve=driveCurve(k); w.oversample='2x'; w.connect(dest); return w; }
function peaking(freq,gain,q,dest){ var f=R.ac.createBiquadFilter(); f.type='peaking'; f.frequency.value=freq; f.gain.value=gain; f.Q.value=q; f.connect(dest); return f; }
/* each voice: (time, loudness, pitch ratio, output) */
var VOICE=[
  function kick(time,v,r,d){
    osc('sine',time,165*r,46*r,0.12,0.45,gainEnv(time,v,0.45,d));
    noise(time,0.02,filter('lowpass',2800,0,gainEnv(time,0.3*v,0.018,d)));
  },
  function snare(time,v,r,d){
    noise(time,0.22,filter('highpass',1500*r,0,gainEnv(time,0.62*v,0.2,d)));
    osc('triangle',time,215*r,140*r,0.07,0.13,gainEnv(time,0.5*v,0.12,d));
  },
  function hat(time,v,r,d){
    chokeOpenHat(time);
    noise(time,0.07,filter('bandpass',9800*r,0.9,filter('highpass',7000*r,0,gainEnv(time,0.5*v,0.05,d))));
  },
  function open(time,v,r,d){
    chokeOpenHat(time);
    var g=gainEnv(time,0.42*v,0.36,d); R.openHat=g;
    noise(time,0.4,filter('bandpass',9200*r,0.7,filter('highpass',6500*r,0,g)));
  },
  function clap(time,v,r,d){
    var g=R.ac.createGain(),k; g.connect(d);
    g.gain.setValueAtTime(0.0001,time);
    for(k=0;k<3;k++){ g.gain.setValueAtTime(0.7*v,time+k*0.011); g.gain.exponentialRampToValueAtTime(0.07*v,time+k*0.011+0.009); }
    g.gain.setValueAtTime(0.65*v,time+0.033); g.gain.exponentialRampToValueAtTime(0.0001,time+0.26);
    noise(time,0.3,filter('bandpass',1150*r,0.9,filter('highpass',650*r,0,g)));
  },
  function tom(time,v,r,d){
    osc('sine',time,190*r,92*r,0.22,0.34,gainEnv(time,0.85*v,0.32,d));
    osc('triangle',time,380*r,184*r,0.1,0.1,gainEnv(time,0.12*v,0.08,d));
  },
  function rim(time,v,r,d){
    osc('square',time,1760*r,0,0,0.03,filter('highpass',900,0,gainEnv(time,0.22*v,0.022,d)));
    osc('triangle',time,470*r,0,0,0.05,gainEnv(time,0.5*v,0.04,d));
  },
  function bell(time,v,r,d){
    var g=R.ac.createGain(); g.connect(d);
    g.gain.setValueAtTime(0.0001,time); g.gain.exponentialRampToValueAtTime(0.4*v,time+0.002);
    g.gain.exponentialRampToValueAtTime(0.14*v,time+0.04); g.gain.exponentialRampToValueAtTime(0.0001,time+0.34);
    var f=filter('bandpass',1450*r,1.1,g);
    osc('square',time,562*r,0,0,0.36,f); osc('square',time,845*r,0,0,0.36,f);
  }
];
/* hard dance voices. The kick is a sine that drops in pitch, driven hard, pushed in the mids and driven again, with a clean thump on top */
function hardKick(time,v,r,d){
  var K=CK,ac=R.ac,f=K.f*r;
  choke('kickG',time); choke('bassG',time);
  var amp=ac.createGain(); amp.connect(d);
  amp.gain.setValueAtTime(0.0001,time);
  amp.gain.exponentialRampToValueAtTime(0.32*v,time+0.004);
  amp.gain.setValueAtTime(0.32*v,time+0.03);
  amp.gain.exponentialRampToValueAtTime(0.22*v,time+K.len*0.7);
  amp.gain.exponentialRampToValueAtTime(0.0001,time+K.len);
  R.kickG=amp;
  var pre=ac.createGain();
  pre.gain.setValueAtTime(1,time); pre.gain.exponentialRampToValueAtTime(0.5,time+K.len);
  pre.connect(shaper(K.d1,peaking(K.mid,K.midG,1.1,shaper(K.d2,filter('lowpass',K.lp,0.5,amp)))));
  var o=ac.createOscillator(); o.type='sine';
  o.frequency.setValueAtTime(f*K.top,time);
  o.frequency.exponentialRampToValueAtTime(f*1.6,time+K.sw*0.35);
  o.frequency.exponentialRampToValueAtTime(f,time+K.sw);
  o.connect(pre); o.start(time); o.stop(time+K.len+0.05);
  osc('sine',time,190,52,0.06,0.12,gainEnv(time,0.6*v*K.punch,0.11,d));
  noise(time,0.02,filter('highpass',1800,0,gainEnv(time,0.25*v*K.punch,0.014,d)));
}
function hardSnare(time,v,r,d){
  noise(time,0.3,filter('highpass',1200*r,0,gainEnv(time,0.58*v,0.26,d)));
  noise(time,0.12,filter('bandpass',2400*r,1.2,gainEnv(time,0.5*v,0.09,d)));
  osc('triangle',time,230*r,150*r,0.06,0.14,gainEnv(time,0.55*v,0.13,d));
}
/* reverse bass: the kick's tail swelling in, for the off-beat */
function revBass(time,v,r,d){
  var K=CK,ac=R.ac,f=K.f*r,dur=Math.min(0.24,CSD*1.9);
  choke('bassG',time);
  var amp=ac.createGain(); amp.connect(d);
  amp.gain.setValueAtTime(0.02*v,time);
  amp.gain.exponentialRampToValueAtTime(0.3*v,time+dur*0.82);
  amp.gain.exponentialRampToValueAtTime(0.0001,time+dur);
  R.bassG=amp;
  var o=ac.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(f,time);
  o.connect(shaper(K.d1,peaking(K.mid*0.7,K.midG*0.7,1,shaper(2,filter('lowpass',1700,0.5,amp)))));
  o.start(time); o.stop(time+dur+0.05);
}
/* screech lead: three detuned saws and a square, driven, with a resonant peak sweeping down */
function lead(time,v,r,d){
  var ac=R.ac,f=220*r,dur=CLEN||Math.min(0.3,CSD*1.8),i;
  choke('leadG'+CID,time);
  var amp=ac.createGain(); amp.connect(d);
  amp.gain.setValueAtTime(0.0001,time);
  amp.gain.exponentialRampToValueAtTime(0.17*v,time+0.006);
  amp.gain.setValueAtTime(0.17*v,time+dur*0.6);
  amp.gain.exponentialRampToValueAtTime(0.0001,time+dur);
  R['leadG'+CID]=amp;
  var pk=ac.createBiquadFilter(); pk.type='peaking'; pk.Q.value=5; pk.gain.value=15;
  pk.frequency.setValueAtTime(Math.min(f*10,7500),time); pk.frequency.exponentialRampToValueAtTime(Math.max(f*3,800),time+dur);
  pk.connect(filter('highpass',170,0,amp));
  var mix=ac.createGain(); mix.gain.value=0.45; mix.connect(shaper(4,pk));
  for(i=-1;i<=1;i++){
    var o=ac.createOscillator(); o.type='sawtooth'; o.detune.value=i*15;
    o.frequency.setValueAtTime(f*1.05,time); o.frequency.exponentialRampToValueAtTime(f,time+0.035);
    o.connect(mix); o.start(time); o.stop(time+dur+0.05);
  }
  var sq=ac.createOscillator(),sg=ac.createGain(); sq.type='square'; sq.frequency.setValueAtTime(f*2,time); sg.gain.value=0.3;
  sq.connect(sg); sg.connect(mix); sq.start(time); sq.stop(time+dur+0.05);
}
function crash(time,v,r,d){
  noise(time,1.2,filter('highpass',4200*r,0,gainEnv(time,0.34*v,1.1,d)));
  noise(time,0.3,filter('bandpass',7000*r,0.8,gainEnv(time,0.3*v,0.25,d)));
}
var HARDV=[hardKick,hardSnare,VOICE[2],VOICE[3],VOICE[4],revBass,lead,crash];

/* play one of the pocket machine's 8 voices. kit 0 = classic, 1 to 4 = hard kits */
T.hit=function(rig,kit,ti,time,vel,ratio,dest,sd){
  R=rig; CK=KITS[kit].k||KITS[1].k; CSD=sd; CLEN=0; CCH=null; CID='';
  (kit?HARDV:VOICE)[ti](time,vel,ratio,dest);
};

/* ---------------- studio-only voices ---------------- */
function ampHold(time,peak,att,dur,rel,dest){
  var g=R.ac.createGain(),p=Math.max(0.0002,peak),h=Math.max(att+0.001,dur);
  g.gain.setValueAtTime(0.0001,time); g.gain.exponentialRampToValueAtTime(p,time+att);
  g.gain.setValueAtTime(p,time+h); g.gain.exponentialRampToValueAtTime(0.0001,time+h+rel);
  g.connect(dest); return g;
}
function panned(p,dest){ if(!R.ac.createStereoPanner) return dest; var n=R.ac.createStereoPanner(); n.pan.value=p; n.connect(dest); return n; }
/* supersaw: seven detuned saws spread left and right, for big melodies */
function supersaw(time,v,r,d){
  var ac=R.ac,f=220*r,dur=CLEN||CSD*1.8,dets=[-27,-16,-7,0,7,16,27],i;
  choke('sawG'+CID,time);
  var amp=ampHold(time,0.2*v,0.008,dur*0.92,0.07,d); R['sawG'+CID]=amp;
  var lp=ac.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=0.8;
  lp.frequency.setValueAtTime(Math.min(f*14,11000),time); lp.frequency.exponentialRampToValueAtTime(Math.min(f*6,7000),time+Math.min(dur,0.25)); lp.connect(amp);
  var left=panned(-0.6,lp),right=panned(0.6,lp);
  for(i=0;i<7;i++){
    var o=ac.createOscillator(),g=ac.createGain(); o.type='sawtooth'; o.frequency.value=f; o.detune.value=dets[i]; g.gain.value=0.16;
    o.connect(g); g.connect(i===3?lp:(i%2?left:right)); o.start(time); o.stop(time+dur+0.15);
  }
}
function pluck(time,v,r,d){
  var ac=R.ac,f=220*r,dec=Math.max(0.16,Math.min(CLEN||0.28,0.7)),amp=gainEnv(time,0.3*v,dec,d);
  var lp=ac.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=3;
  lp.frequency.setValueAtTime(Math.min(f*12,10000),time); lp.frequency.exponentialRampToValueAtTime(f*1.5,time+0.14); lp.connect(amp);
  osc('sawtooth',time,f,0,0,dec,lp);
  var g=ac.createGain(); g.gain.value=0.4; g.connect(lp); osc('square',time,f*2.005,0,0,dec,g);
}
function sub(time,v,r,d){
  var f=55*r,dur=CLEN||CSD*1.9;
  choke('subG'+CID,time);
  var amp=ampHold(time,0.5*v,0.006,dur*0.95,0.04,d); R['subG'+CID]=amp;
  osc('sine',time,f,0,0,dur+0.1,shaper(1.6,amp));
}
/* chord stab: three notes of the scale at once, driven */
function stab(time,v,r,d){
  var ac=R.ac,dur=CLEN?Math.min(CLEN,2.5):CSD*1.5,ch=CCH||[1,1.1892,1.4983],amp=ampHold(time,0.2*v,0.004,dur*0.8,0.09,d);
  var mix=ac.createGain(); mix.gain.value=0.3; mix.connect(shaper(2.5,filter('lowpass',6000,0.7,amp)));
  ch.forEach(function(c){ [-12,12].forEach(function(det){
    var o=ac.createOscillator(); o.type='sawtooth'; o.frequency.value=220*r*c; o.detune.value=det; o.connect(mix); o.start(time); o.stop(time+dur+0.2);
  }); });
}
function zap(time,v,r,d){ osc('sawtooth',time,2400*r,110*r,0.14,0.16,filter('lowpass',6000,2,gainEnv(time,0.3*v,0.16,d))); }
/* riser and fall: noise and a saw sweeping up (or down) across the length of the note. Use them before and after a drop */
function sweep(time,v,r,d,up){
  var ac=R.ac,dur=CLEN||CSD*16,amp=ac.createGain(); amp.connect(d);
  amp.gain.setValueAtTime(up?0.01:0.34*v,time); amp.gain.exponentialRampToValueAtTime(up?0.34*v:0.004,time+dur*0.97); amp.gain.exponentialRampToValueAtTime(0.0001,time+dur+0.03);
  var bp=ac.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=1.4;
  bp.frequency.setValueAtTime(up?350:9000,time); bp.frequency.exponentialRampToValueAtTime(up?9000:250,time+dur); bp.connect(amp); noise(time,dur,bp);
  var o=ac.createOscillator(),g=ac.createGain(); o.type='sawtooth'; g.gain.value=0.25;
  o.frequency.setValueAtTime((up?110:880)*r,time); o.frequency.exponentialRampToValueAtTime((up?880:110)*r,time+dur);
  o.connect(g); g.connect(filter('lowpass',3000,0,amp)); o.start(time); o.stop(time+dur+0.05);
}
function riser(time,v,r,d){ sweep(time,v,r,d,true); }
function fall(time,v,r,d){ sweep(time,v,r,d,false); }
function boom(time,v,r,d){
  osc('sine',time,130*r,34*r,0.5,1.5,shaper(2,gainEnv(time,0.8*v,1.4,d)));
  noise(time,0.5,filter('lowpass',900,0,gainEnv(time,0.5*v,0.4,d)));
}
/* hoover: the rave lead. A stack of saws with a square an octave down, drifting slightly out of tune with each other,
   that swoops up into every note and sags as it lets go */
function hoover(time,v,r,d){
  var ac=R.ac,f=220*r,dur=CLEN||CSD*1.8,sw=Math.min(0.055,dur*0.4),hold=Math.max(sw+0.01,dur*0.9);
  choke('hoovG'+CID,time);
  var amp=ampHold(time,0.2*v,0.01,hold,0.1,d); R['hoovG'+CID]=amp;
  var lp=ac.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=2;
  lp.frequency.setValueAtTime(1000,time); lp.frequency.exponentialRampToValueAtTime(Math.min(5200,Math.max(2600,f*10)),time+sw+0.02);
  lp.connect(filter('highpass',150,0,amp));
  var mix=ac.createGain(); mix.gain.value=0.5; mix.connect(shaper(3,lp));
  var lfo=ac.createOscillator(),ld=ac.createGain(); lfo.frequency.value=5.2; ld.gain.value=16; lfo.connect(ld); lfo.start(time); lfo.stop(time+hold+0.3);
  [[1,-33,0.2,0],[1,-11,0.2,1],[1,10,0.2,0],[1,32,0.2,1],[0.5,-6,0.3,0],[0.5,7,0.26,2],[2,4,0.08,1]].forEach(function(p){
    var o=ac.createOscillator(),g=ac.createGain(); o.type=p[3]===2?'square':'sawtooth'; g.gain.value=p[2]; o.detune.value=p[1];
    o.frequency.setValueAtTime(f*p[0]*0.6,time); o.frequency.exponentialRampToValueAtTime(f*p[0],time+sw);
    o.frequency.setValueAtTime(f*p[0],time+hold); o.frequency.exponentialRampToValueAtTime(f*p[0]*0.84,time+hold+0.12);
    if(p[3]===1) ld.connect(o.detune);
    o.connect(g); g.connect(mix); o.start(time); o.stop(time+hold+0.25);
  });
}
/* acid line: one saw through a squelchy filter that snaps shut on every note, then driven. A loud note opens the filter further,
   and a note that starts while the one before it is still held slides into place */
function acid(time,v,r,d){
  var ac=R.ac,f=110*r,k='acid'+CID,dur=Math.max(0.03,(CLEN||CSD)-CSD*0.4),acc=v>1.2,last=R[k+'F'],slide=last&&R[k+'T']>time+0.01;
  choke(k+'G',time);
  var amp=ampHold(time,0.22*Math.min(v,1.1),0.004,dur,0.04,d); R[k+'G']=amp;
  var lp=ac.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=acc?17:11;
  lp.frequency.setValueAtTime(Math.min(f*(acc?26:13),9000),time); lp.frequency.exponentialRampToValueAtTime(Math.max(f*1.7,240),time+(acc?0.24:0.13));
  lp.connect(shaper(3.5,filter('highpass',100,0,amp)));
  var o=ac.createOscillator(),pre=ac.createGain(); o.type='sawtooth'; pre.gain.value=0.45;
  if(slide){ o.frequency.setValueAtTime(last,time); o.frequency.exponentialRampToValueAtTime(f,time+0.045); } else o.frequency.setValueAtTime(f,time);
  o.connect(pre); pre.connect(lp); o.start(time); o.stop(time+dur+0.1);
  R[k+'F']=f; R[k+'T']=time+(CLEN||CSD);
}
/* dark choir: a chord of saws through three vowel filters, swelling in slowly. For breaks and intros */
function choir(time,v,r,d){
  var ac=R.ac,f=220*r,dur=CLEN||CSD*16,att=Math.min(0.3,dur*0.4),end=Math.max(att+0.01,dur),ch=CCH||[1];
  var amp=ac.createGain(); amp.connect(d);
  amp.gain.setValueAtTime(0.0001,time); amp.gain.linearRampToValueAtTime(0.5*v,time+att); amp.gain.setValueAtTime(0.5*v,time+end); amp.gain.setTargetAtTime(0.0001,time+end,0.16);
  var mix=ac.createGain(); mix.gain.value=0.25;
  [[520,5,1],[940,5,0.6],[2600,4,0.3]].forEach(function(fm){ var g=ac.createGain(); g.gain.value=fm[2]; mix.connect(g); g.connect(filter('bandpass',fm[0],fm[1],amp)); });
  var left=panned(-0.7,mix),right=panned(0.7,mix);
  ch.forEach(function(c){ [-14,0,13].forEach(function(det,j){
    var o=ac.createOscillator(); o.type='sawtooth'; o.frequency.value=f*c; o.detune.value=det;
    o.connect(j===1?mix:j?right:left); o.start(time); o.stop(time+end+1);
  }); });
}
/* Every sound the studio can put on a track.
   gm = General MIDI drum note (exported on the drum channel). pitched = follows the project key and has a piano roll.
   base = MIDI note of scale step 0. kit = which kick recipe it uses. defLen = default note length in steps. */
var INSTR=[
 {id:'kick',name:'Kick',group:'Classic drums',fn:VOICE[0],gm:36},
 {id:'snare',name:'Snare',group:'Classic drums',fn:VOICE[1],gm:38},
 {id:'hat',name:'Closed hat',group:'Classic drums',fn:VOICE[2],gm:42},
 {id:'open',name:'Open hat',group:'Classic drums',fn:VOICE[3],gm:46},
 {id:'clap',name:'Clap',group:'Classic drums',fn:VOICE[4],gm:39},
 {id:'tom',name:'Tom',group:'Classic drums',fn:VOICE[5],gm:45},
 {id:'rim',name:'Rimshot',group:'Classic drums',fn:VOICE[6],gm:37},
 {id:'bell',name:'Cowbell',group:'Classic drums',fn:VOICE[7],gm:56},
 {id:'hkick',name:'Hard kick',group:'Hard drums',fn:hardKick,kit:1,gm:36,pitched:true,base:33},
 {id:'jkick',name:'Jump kick',group:'Hard drums',fn:hardKick,kit:2,gm:36,pitched:true,base:33},
 {id:'tkick',name:'Tekk kick',group:'Hard drums',fn:hardKick,kit:3,gm:36,pitched:true,base:31},
 {id:'ckick',name:'Core kick',group:'Hard drums',fn:hardKick,kit:4,gm:36,pitched:true,base:33},
 {id:'hsnare',name:'Hard snare',group:'Hard drums',fn:hardSnare,gm:38},
 {id:'crash',name:'Crash',group:'Hard drums',fn:crash,gm:49},
 {id:'rbass',name:'Reverse bass',group:'Bass',fn:revBass,kit:1,pitched:true,base:33,prog:38},
 {id:'tbass',name:'Tekk bass',group:'Bass',fn:revBass,kit:3,pitched:true,base:31,prog:38},
 {id:'sub',name:'Sub bass',group:'Bass',fn:sub,pitched:true,base:33,prog:38,defLen:2},
 {id:'screech',name:'Screech lead',group:'Synths',fn:lead,pitched:true,base:57,prog:81,defLen:2},
 {id:'saw',name:'Supersaw',group:'Synths',fn:supersaw,pitched:true,base:57,prog:81,defLen:2},
 {id:'pluck',name:'Pluck',group:'Synths',fn:pluck,pitched:true,base:57,prog:80},
 {id:'stab',name:'Chord stab',group:'Synths',fn:stab,pitched:true,chord:true,base:57,prog:81},
 {id:'hoover',name:'Hoover',group:'Synths',fn:hoover,pitched:true,base:57,prog:62,defLen:2},
 {id:'acid',name:'Acid line',group:'Synths',fn:acid,pitched:true,base:45,prog:38},
 {id:'choir',name:'Dark choir',group:'Synths',fn:choir,pitched:true,chord:true,base:57,prog:52,defLen:16},
 {id:'zap',name:'Zap',group:'Effects',fn:zap},
 {id:'riser',name:'Riser',group:'Effects',fn:riser,defLen:16},
 {id:'fall',name:'Fall',group:'Effects',fn:fall,defLen:16},
 {id:'boom',name:'Boom',group:'Effects',fn:boom,gm:35}
],BY={};
INSTR.forEach(function(I){ BY[I.id]=I; });
T.INSTR=INSTR; T.inst=function(id){ return BY[id]||BY.kick; };
T.play=function(rig,instId,time,vel,ratio,dest,sd,len,chord,key){
  var I=T.inst(instId);
  R=rig; CK=KITS[I.kit||1].k; CSD=sd; CLEN=len||0; CCH=chord||null; CID=key||'';
  I.fn(time,vel,ratio,dest);
};

/* ---------------- the studio's rig ---------------- */
/* each track: level -> pan -> master, with its own sends to a room reverb and a tempo echo.
   master -> crunch -> two sweepable filters (used by section effects) -> compressor -> volume */
T.buildStudioRig=function(ac,withScope){
  var rig={ac:ac,tr:{},noise:makeNoise(ac),top:Math.min(20000,ac.sampleRate*0.45),crunch:-1};
  rig.master=ac.createGain(); rig.master.gain.value=0.8;
  rig.shaper=ac.createWaveShaper(); rig.shaper.oversample='2x';
  rig.trim=ac.createGain();
  rig.lpF=ac.createBiquadFilter(); rig.lpF.type='lowpass'; rig.lpF.frequency.value=rig.top; rig.lpF.Q.value=0.9;
  rig.hpF=ac.createBiquadFilter(); rig.hpF.type='highpass'; rig.hpF.frequency.value=10; rig.hpF.Q.value=0.9;
  var comp=makeComp(ac); rig.out=ac.createGain();
  rig.master.connect(rig.shaper); rig.shaper.connect(rig.trim); rig.trim.connect(rig.lpF); rig.lpF.connect(rig.hpF); rig.hpF.connect(comp); comp.connect(rig.out);
  rig.verbIn=ac.createGain();
  var hp=ac.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=320;
  var conv=ac.createConvolver(); conv.buffer=makeRoom(ac);
  rig.verbIn.connect(hp); hp.connect(conv); conv.connect(comp);
  rig.echoIn=ac.createGain(); rig.delay=ac.createDelay(2);
  var tone=ac.createBiquadFilter(); tone.type='lowpass'; tone.frequency.value=2800;
  var fb=ac.createGain(); fb.gain.value=0.38;
  rig.echoIn.connect(rig.delay); rig.delay.connect(tone); tone.connect(fb); fb.connect(rig.delay); tone.connect(comp);
  if(withScope){
    rig.analyser=ac.createAnalyser(); rig.analyser.fftSize=1024; rig.analyser.smoothingTimeConstant=0;
    rig.out.connect(rig.analyser); rig.analyser.connect(ac.destination);
  } else rig.out.connect(ac.destination);
  return rig;
};
T.rigTrack=function(rig,id){
  var t=rig.tr[id],ac=rig.ac; if(t) return t;
  t={in:ac.createGain(),pan:ac.createStereoPanner?ac.createStereoPanner():ac.createGain(),verb:ac.createGain(),echo:ac.createGain()};
  t.verb.gain.value=0; t.echo.gain.value=0;
  t.in.connect(t.pan); t.pan.connect(rig.master); t.pan.connect(t.verb); t.verb.connect(rig.verbIn); t.pan.connect(t.echo); t.echo.connect(rig.echoIn);
  rig.tr[id]=t; return t;
};
T.applyStudio=function(rig,P){
  if(!rig) return;
  if(rig.crunch!==P.crunch){ rig.shaper.curve=crunchCurve(P.crunch); rig.crunch=P.crunch; }
  rig.trim.gain.value=1/(1+P.crunch/100*0.9);
  rig.out.gain.value=P.vol/100;
  rig.delay.delayTime.value=Math.min(1.9,3*60/P.bpm/4); /* a dotted eighth */
  P.tracks.forEach(function(t){
    var n=T.rigTrack(rig,t.id);
    n.in.gain.value=t.lv/100; if(n.pan.pan) n.pan.pan.value=t.pan/100;
    n.verb.gain.value=t.verb/100*0.8; n.echo.gain.value=t.echo/100*0.7;
  });
};

/* ================= songs (studio projects) ================= */
var FX={none:1,open:1,close:1,thin:1};
T.degSemis=function(d,scale){ var s=SCALES[scale]||SCALES.minor,o,i; d=d|0; o=Math.floor(d/7); i=((d%7)+7)%7; return 12*o+s[i]; };
T.audible=function(P,t){ return P.tracks.some(function(x){ return x.solo; })?!!t.solo:!t.mute; };
T.patById=function(P,id){ for(var i=0;i<P.patterns.length;i++) if(P.patterns[i].id===id) return P.patterns[i]; return P.patterns[0]; };
T.stepSec=function(P){ return 60/P.bpm/4; };
T.songSteps=function(P){ return P.song.reduce(function(n,s){ return n+s.rep*T.patById(P,s.pat).bars*16; },0); };
/* fire every hit that falls on one step of one pattern. sec (optional) switches tracks off; only (optional) = a single track id, for stems */
T.scheduleStep=function(rig,P,sec,pat,step,when,sd,only){
  var hits=[],i,t,row,v,I,d,semis,chord;
  for(i=0;i<P.tracks.length;i++){
    t=P.tracks[i];
    if(only!=null){ if(t.id!==only) continue; } else if(!T.audible(P,t)) continue;
    if(sec&&sec.off&&sec.off[t.id]) continue;
    row=pat.rows[t.id]; if(!row) continue;
    v=row.v[step]; if(!v) continue;
    I=T.inst(t.inst); d=row.n[step]|0;
    semis=t.tn+(I.pitched?(P.key|0)+T.degSemis(d,P.scale):0);
    chord=I.chord?[0,2,4].map(function(k){ return Math.pow(2,(T.degSemis(d+k,P.scale)-T.degSemis(d,P.scale))/12); }):null;
    T.play(rig,t.inst,when,VEL[v]||1,Math.pow(2,semis/12),T.rigTrack(rig,t.id).in,sd,Math.max(1,row.l[step]|0)*sd,chord,t.id);
    hits.push(t.id);
  }
  return hits;
};
/* section effects sweep the master filters from the start of a section to its end.
   open = muffled to bright, close = bright to muffled, thin = the bass drains away (the classic build before a drop) */
T.sectionFx=function(rig,fx,t0,t1){
  var lp=rig.lpF.frequency,hp=rig.hpF.frequency,top=rig.top;
  try{ lp.cancelScheduledValues(t0); hp.cancelScheduledValues(t0); }catch(e){}
  lp.setValueAtTime(fx==='open'?260:top,t0); hp.setValueAtTime(10,t0);
  if(fx==='open') lp.exponentialRampToValueAtTime(top,t1);
  else if(fx==='close') lp.exponentialRampToValueAtTime(260,t1);
  else if(fx==='thin') hp.exponentialRampToValueAtTime(1400,t1);
};
/* render a project (or one pattern of it) to WAV bytes.
   o.only = track id for a stem; o.pattern = pattern id to render on its own, o.rep times; o.from / o.to = section range; o.tail = seconds of ring-out */
T.renderProject=function(P,o){
  o=o||{};
  var OAC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  if(!OAC) return Promise.reject(new Error('this browser cannot render audio offline'));
  var secs=o.pattern?[{pat:o.pattern,rep:o.rep||1,fx:'none',off:{}}]:P.song.slice(o.from||0,o.to==null?P.song.length:o.to);
  var sr=44100,sd=T.stepSec(P),steps=secs.reduce(function(n,s){ return n+s.rep*T.patById(P,s.pat).bars*16; },0),tail=o.tail==null?2.2:o.tail;
  if(!steps) return Promise.reject(new Error('nothing to render'));
  var ac=new OAC(2,Math.ceil((steps*sd+tail)*sr),sr),rig=T.buildStudioRig(ac,false),t=0,chunks=[],cur=null;
  T.applyStudio(rig,P);
  /* list every step, grouped a bar at a time */
  secs.forEach(function(sec){
    var pat=T.patById(P,sec.pat),n=pat.bars*16,r,s,end=t+sec.rep*n*sd;
    for(r=0;r<sec.rep;r++) for(s=0;s<n;s++){
      if(!cur||cur.ev.length>=16){ cur={t:t,ev:[]}; chunks.push(cur); }
      cur.ev.push({sec:sec,pat:pat,s:s,t:t,fx:r===0&&s===0?end:0});
      t+=sd;
    }
  });
  function run(c){
    c.ev.forEach(function(e){
      if(e.fx) T.sectionFx(rig,e.sec.fx,e.t,e.fx);
      T.scheduleStep(rig,P,e.sec,e.pat,e.s,e.t+(e.s%2===1?sd*P.swing/100:0),sd,o.only);
    });
  }
  /* Creating every note of a long song up front makes rendering crawl, so where the browser allows it the render pauses
     just before each bar, that bar's notes are added, and it carries on. */
  if(ac.suspend&&chunks.length>1){
    run(chunks[0]);
    chunks.slice(1).forEach(function(c){ ac.suspend(Math.max(0.01,c.t-0.05)).then(function(){ run(c); ac.resume(); }); });
  } else chunks.forEach(run);
  return ac.startRendering().then(function(buf){ return T.wavBytes(buf.getChannelData(0),buf.getChannelData(1),sr); });
};
/* fill in everything a project needs, so hand-written or older projects load. Accepts compact rows:
   "X...x..." (hits only), {v:"x...", n:[...], l:[...]}, or {notes:[[step, scaleStep, lengthInSteps, loudness 1-3], ...]} */
T.normProject=function(p){
  p=JSON.parse(JSON.stringify(p||{}));
  function num(v,lo,hi,def){ v=+v; return isFinite(v)?Math.max(lo,Math.min(hi,Math.round(v))):def; }
  var seen={},seenP={},k=0;
  function uid(pre){ do{ k++; }while(seen[pre+k]||seenP[pre+k]); return pre+k; }
  p.v=1; p.id=typeof p.id==='string'&&p.id?p.id:'s'+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36);
  p.name=String(p.name||'UNTITLED').slice(0,28);
  p.bpm=num(p.bpm,50,220,150); p.swing=num(p.swing,0,60,0); p.key=num(p.key,-6,6,0); p.scale=SCALES[p.scale]?p.scale:'minor';
  p.crunch=num(p.crunch,0,100,0); p.vol=num(p.vol,0,100,55);
  p.tracks=(Array.isArray(p.tracks)?p.tracks:[]).slice(0,16).map(function(t){
    t=t||{}; var id=typeof t.id==='string'&&t.id&&!seen[t.id]?t.id:uid('t'); seen[id]=1;
    var I=BY[t.inst]?BY[t.inst]:BY.kick;
    return {id:id,name:String(t.name||I.name).toUpperCase().slice(0,12),inst:I.id,lv:num(t.lv,0,150,100),pan:num(t.pan,-100,100,0),tn:num(t.tn,-24,24,0),
      verb:num(t.verb,0,100,0),echo:num(t.echo,0,100,0),mute:!!t.mute,solo:!!t.solo};
  });
  if(!p.tracks.length) p.tracks.push({id:uid('t'),name:'KICK',inst:'hkick',lv:100,pan:0,tn:0,verb:0,echo:0,mute:false,solo:false});
  p.patterns=(Array.isArray(p.patterns)?p.patterns:[]).slice(0,32).map(function(q,qi){
    q=q||{}; var id=typeof q.id==='string'&&q.id&&!seenP[q.id]?q.id:uid('p'); seenP[id]=1;
    var bars=[1,2,4].indexOf(+q.bars)>=0?+q.bars:1,N=bars*16,rows={};
    p.tracks.forEach(function(t){
      var src=q.rows&&q.rows[t.id],I=BY[t.inst],dl=I.defLen||1,v=new Array(N).fill(0),n=new Array(N).fill(0),l=new Array(N).fill(dl),i,c;
      if(typeof src==='string') src={v:src};
      if(src){
        if(typeof src.v==='string'){ for(i=0;i<N&&i<src.v.length;i++) v[i]=CH[src.v.charAt(i)]||0; }
        else if(Array.isArray(src.v)){ for(i=0;i<N&&i<src.v.length;i++) v[i]=num(src.v[i],0,3,0); }
        if(Array.isArray(src.n)) for(i=0;i<N&&i<src.n.length;i++) n[i]=num(src.n[i],-14,21,0);
        if(Array.isArray(src.l)) for(i=0;i<N&&i<src.l.length;i++) l[i]=num(src.l[i],1,64,dl);
        if(Array.isArray(src.notes)) src.notes.forEach(function(e){
          if(!Array.isArray(e)) return; c=num(e[0],0,N-1,-1); if(c<0) return;
          v[c]=num(e[3],1,3,1); n[c]=num(e[1],-14,21,0); l[c]=num(e[2],1,64,dl);
        });
      }
      rows[t.id]={v:v,n:n,l:l};
    });
    return {id:id,name:String(q.name||'PATTERN '+(qi+1)).slice(0,16),bars:bars,rows:rows};
  });
  if(!p.patterns.length){ var e={}; p.tracks.forEach(function(t){ var dl=BY[t.inst].defLen||1; e[t.id]={v:new Array(16).fill(0),n:new Array(16).fill(0),l:new Array(16).fill(dl)}; }); p.patterns.push({id:uid('p'),name:'PATTERN 1',bars:1,rows:e}); }
  var pids={}; p.patterns.forEach(function(q){ pids[q.id]=1; });
  p.song=(Array.isArray(p.song)?p.song:[]).slice(0,64).map(function(s,si){
    s=s||{}; var off={},x;
    if(s.off) for(x in s.off) if(s.off[x]&&p.tracks.some(function(t){ return t.id===x; })) off[x]=true;
    /* "only" is a shorthand: list the tracks that play and the rest are switched off */
    if(Array.isArray(s.only)) p.tracks.forEach(function(t){ if(s.only.indexOf(t.id)<0) off[t.id]=true; });
    return {name:String(s.name||'PART '+(si+1)).slice(0,14),pat:pids[s.pat]?s.pat:p.patterns[0].id,rep:num(s.rep,1,64,4),fx:FX[s.fx]?s.fx:'none',off:off};
  });
  if(!p.song.length) p.song.push({name:'PART 1',pat:p.patterns[0].id,rep:4,fx:'none',off:{}});
  return p;
};
/* turn a pocket-machine beat into a studio project: 8 tracks, one pattern per filled slot, each played four times */
T.projectFromBeat=function(b){
  b=readBeat(b);
  var hard=b.kit>0,kicks=[null,'hkick','jkick','tkick','ckick'],
      ids=hard?[kicks[b.kit],'hsnare','hat','open','clap',b.kit===3?'tbass':'rbass','screech','crash']:['kick','snare','hat','open','clap','tom','rim','bell'],
      names=KITS[b.kit].tr,tracks=[],patterns=[],song=[];
  ids.forEach(function(id,i){ tracks.push({id:'t'+(i+1),name:names[i][0],inst:id,lv:b.lv[i],tn:b.tn[i],verb:b.space}); });
  b.pats.forEach(function(pat,pi){
    if(!pat.some(function(r){ return r.some(Boolean); })) return;
    var rows={}; pat.forEach(function(r,i){ rows['t'+(i+1)]={v:r.slice(),n:b.pit[pi][i].slice()}; });
    patterns.push({id:'p'+(pi+1),name:'PATTERN '+SLOTS[pi],bars:1,rows:rows});
    song.push({name:'PART '+SLOTS[pi],pat:'p'+(pi+1),rep:4});
  });
  return T.normProject({name:b.name,bpm:b.bpm,swing:b.swing,crunch:b.crunch,vol:hard?55:100,tracks:tracks,patterns:patterns,song:song});
};
T.emptyProject=function(){
  return T.normProject({name:'NEW SONG',bpm:150,vol:55,
    tracks:[{id:'t1',inst:'hkick',name:'KICK'},{id:'t2',inst:'clap'},{id:'t3',inst:'hat',name:'HAT',lv:60},{id:'t4',inst:'open',name:'OPEN',lv:70},{id:'t5',inst:'rbass',name:'BASS',lv:90},{id:'t6',inst:'saw',name:'LEAD',lv:80,verb:25}],
    patterns:[{id:'p1',name:'MAIN',bars:1,rows:{t1:'X...X...X...X...'}}],song:[{name:'PART 1',pat:'p1',rep:4}]});
};
/* a small finished arrangement to learn from: intro, break, build, drop, outro. A minor, 150 BPM */
T.starterProject=function(){
  var mel=[[0,7,3],[3,9,3],[6,11,2],[8,12,3],[11,11,3],[14,9,2],[16,11,3],[19,13,3],[22,11,2],[24,10,3],[27,8,3],[30,10,2]],
      riff=[[2,0,2],[5,0,2],[8,2,2],[11,4,2],[13,3,2],[18,0,2],[21,0,2],[24,2,2],[27,6,2],[29,7,2]];
  return T.normProject({name:'FIRST DROP',bpm:150,key:0,scale:'minor',crunch:20,vol:50,
    tracks:[
      {id:'kick',inst:'hkick',name:'KICK'},{id:'bass',inst:'rbass',name:'BASS',lv:90},{id:'clap',inst:'clap',name:'CLAP',lv:85,verb:15},
      {id:'hat',inst:'hat',name:'HAT',lv:55},{id:'open',inst:'open',name:'OPEN',lv:70},{id:'snare',inst:'hsnare',name:'SNARE',lv:85,verb:20},
      {id:'crash',inst:'crash',name:'CRASH',lv:60,verb:30},{id:'boom',inst:'boom',name:'BOOM',lv:90,verb:25},
      {id:'lead',inst:'screech',name:'SCREECH',lv:70,echo:15},{id:'saw',inst:'saw',name:'MELODY',lv:105,verb:35,echo:20},{id:'riser',inst:'riser',name:'RISER',lv:80,verb:20}],
    patterns:[
      {id:'main',name:'MAIN',bars:2,rows:{
        kick:'X...X...X...X...X...X...X...X...',bass:'..x...x...x...x...x...x...x...x.',clap:'....x.......x.......x.......x...',
        hat:'.o.o.o.o.o.o.o.o.o.o.o.o.o.o.o.o',open:'..x...x...x...x...x...x...x...x.',crash:'x...............................',boom:'X...............................',
        lead:{notes:riff},saw:{notes:mel}}},
      {id:'build',name:'BUILD',bars:2,rows:{
        kick:'X...X...X...X...................',snare:'x...x...x...x...x.x.x.x.xxxxXXXX',saw:{notes:mel},riser:{notes:[[0,0,32]]}}}],
    song:[
      {name:'INTRO',pat:'main',rep:4,fx:'open',only:['kick','hat','open']},
      {name:'BREAK',pat:'main',rep:4,only:['saw','clap','crash']},
      {name:'BUILD',pat:'build',rep:2,fx:'thin'},
      {name:'DROP',pat:'main',rep:1,off:{bass:true,riser:true,snare:true}},
      {name:'DROP ON',pat:'main',rep:7,off:{bass:true,riser:true,snare:true,crash:true,boom:true}},
      {name:'OUTRO',pat:'main',rep:4,fx:'close',only:['kick','hat','bass']}]});
};

/* ---------------- demo songs ---------------- */
/* Finished arrangements that ship with the studio. Each is written in the compact project form (see CLAUDE.md).
   Everything lives in one or two patterns; the parts choose which tracks play. */
function J(){ return Array.prototype.join.call(arguments,''); }
function rpt(s,n){ var o=''; while(n-->0) o+=s; return o; }
function barN(degs){ var a=[],i; degs.forEach(function(d){ for(i=0;i<16;i++) a.push(d); }); return a; }
/* one note per listed scale step, every `every` steps: per bar, a list of scale steps */
function run(barsOf,every,len){ var out=[]; barsOf.forEach(function(b,i){ b.forEach(function(d,j){ out.push([i*16+j*every,d,len]); }); }); return out; }
var F4='X...X...X...X...',OFF='..x...x...x...x.',CL='....x.......x...',E16='................',H16='.o.o.o.o.o.o.o.o',
    ROLL=J('x...x...x...x...','x...x...x...x...','x.x.x.x.x.x.x.x.');

/* German hardtekk, F minor, 175 BPM. The kick plays the bassline; a hoover carries the riff */
function nachtschicht(){
  var roots=barN([0,0,-2,-1]),
      riff=[[2,7,2],[5,7,1],[6,9,2],[10,8,2],[13,7,1],[14,4,2],[18,7,2],[21,7,1],[22,9,2],[26,10,2],[29,9,1],[30,8,2],
            [34,9,2],[37,9,1],[38,11,2],[42,10,2],[45,9,1],[46,7,2],[50,8,2],[53,8,1],[54,10,2],[58,11,3],[61,10,1],[62,8,2]],
      anthem=[[0,7,5],[6,7,2],[10,9,2],[12,8,4],[16,7,5],[22,7,2],[26,6,2],[28,4,4],[32,5,5],[38,5,2],[42,7,2],[44,9,4],[48,6,5],[54,6,2],[58,8,2],[60,10,4]],
      pad=[[0,0,16],[16,0,16],[32,-2,16],[48,-1,16]],
      arp=run([[7,9,11,9,14,11,9,11],[7,9,11,9,14,11,9,11],[5,7,9,7,12,9,7,9],[6,8,10,8,13,10,8,10]],2,2),
      drums=['kick','bass','clap','hat','open','rim'];
  return {name:'NACHTSCHICHT',bpm:175,key:-4,scale:'minor',crunch:30,vol:50,
    tracks:[
      {id:'kick',inst:'tkick',name:'KICK',tn:2},{id:'bass',inst:'tbass',name:'BASS',tn:2,lv:85},{id:'clap',inst:'clap',name:'CLAP',lv:80,verb:12},
      {id:'hat',inst:'hat',name:'HAT',lv:50,pan:18},{id:'open',inst:'open',name:'OPEN',lv:62,pan:-18},{id:'rim',inst:'rim',name:'RIM',lv:55,pan:30,echo:20},
      {id:'snare',inst:'hsnare',name:'SNARE',lv:80,verb:18},{id:'hoov',inst:'hoover',name:'HOOVER',lv:72,verb:22,echo:18},
      {id:'pad',inst:'choir',name:'CHOIR',lv:68,verb:45},{id:'arp',inst:'pluck',name:'PLUCK',lv:70,pan:-25,verb:20,echo:30},
      {id:'zap',inst:'zap',name:'ZAP',lv:45,pan:40,echo:25},{id:'riser',inst:'riser',name:'RISER',lv:75,verb:20},{id:'fall',inst:'fall',name:'FALL',lv:70,verb:25},
      {id:'boom',inst:'boom',name:'BOOM',lv:90,verb:25},{id:'crash',inst:'crash',name:'CRASH',lv:55,verb:30}],
    patterns:[
      {id:'main',name:'MAIN',bars:4,rows:{
        kick:{v:J(F4,'X...X...X...X.x.',F4,'X...X...X..xX.xx'),n:roots},bass:{v:J(OFF,'..x...x...x.....',OFF,'..x...x.........'),n:roots},
        clap:J(CL,CL,CL,'....x.......x..x'),hat:rpt(H16,4),open:rpt(OFF,4),rim:rpt('...x..x....x..x.',4),
        hoov:{notes:riff},pad:{notes:pad},arp:{notes:arp},zap:J(E16,'..............x.',E16,'..........x.....'),
        fall:{notes:[[0,0,32]]},boom:'X'+rpt('.',63),crash:'x'+rpt('.',63)}},
      {id:'alt',name:'SWITCH',bars:4,rows:{
        kick:{v:J(F4,'X...X...X.x.X.xx',F4,'X...X.x.X.xxXxXx'),n:roots},bass:{v:J(OFF,'..x...x.........',OFF,'..x.............'),n:roots},
        clap:rpt(CL,4),hat:rpt(H16,4),open:rpt(OFF,4),rim:rpt('x..x..x..x..x.x.',4),
        hoov:{notes:anthem},pad:{notes:pad},arp:{notes:arp},zap:J(E16,'..............x.',E16,E16),boom:'X'+rpt('.',63),crash:'x'+rpt('.',63)}},
      {id:'build',name:'BUILD',bars:4,rows:{
        kick:J(F4,F4,E16,E16),snare:J(ROLL,'xxxxxxxxXXXXXXXX'),riser:{notes:[[0,0,64]]},
        hoov:{notes:riff.slice(0,12).concat([[32,7,8],[40,9,8],[48,11,8],[56,14,8]])},pad:{notes:[[0,0,32],[32,0,32]]}}}],
    song:[
      {name:'INTRO',pat:'main',rep:2,fx:'open',only:['kick','hat','rim']},
      {name:'GROOVE',pat:'main',rep:1,only:drums.concat('zap')},
      {name:'BREAK',pat:'main',rep:1,only:['pad','arp','fall']},
      {name:'BREAK ON',pat:'main',rep:1,only:['pad','arp']},
      {name:'RIFF',pat:'main',rep:2,only:['pad','arp','hoov','clap']},
      {name:'BUILD',pat:'build',rep:1,fx:'thin'},
      {name:'DROP',pat:'main',rep:1,only:drums.concat('hoov','boom','crash')},
      {name:'DROP ON',pat:'main',rep:3,only:drums.concat('hoov','zap')},
      {name:'SWITCH',pat:'alt',rep:1,only:drums.concat('hoov','arp','boom','crash')},
      {name:'SWITCH ON',pat:'alt',rep:2,only:drums.concat('hoov','arp','pad','zap')},
      {name:'OUTRO',pat:'main',rep:2,fx:'close',only:['kick','bass','hat','rim']}]};
}
/* Frenchcore, E minor, 200 BPM. A big supersaw melody that stays on through the drop, chord stabs on the off-beat */
function gareDuNord(){
  var roots=barN([0,-2,2,-1]),ch=[0,-2,2,-1],
      mel=[[0,4,2],[2,4,1],[3,2,1],[4,4,2],[6,7,2],[8,6,2],[10,4,2],[12,2,2],[14,4,2],
           [16,5,2],[18,5,1],[19,2,1],[20,5,2],[22,7,2],[24,6,2],[26,5,2],[28,2,2],[30,5,2],
           [32,6,2],[34,6,1],[35,4,1],[36,6,2],[38,9,2],[40,8,2],[42,6,2],[44,4,2],[46,6,2],
           [48,6,2],[50,6,1],[51,3,1],[52,6,2],[54,8,2],[56,7,2],[58,6,2],[60,3,2],[62,1,2]],
      mel2=run([[7,6,4,6,7,6,4,2],[5,4,2,4,5,4,2,0],[6,4,2,4,6,8,9,8],[8,6,3,6]],2,2).concat([[56,8,4],[60,7,2],[62,8,2]]),
      stabs=run(ch.map(function(c){ return [c,c,c,c]; }),4,2).map(function(n){ n[0]+=2; return n; }),
      arp=run([[0,2,4,7,4,2,4,7],[-2,0,2,5,2,0,2,5],[2,4,6,9,6,4,6,9],[-1,1,3,6,3,1,3,6]],2,2),
      pad=ch.map(function(c,i){ return [i*16,c,16]; }),sub=ch.map(function(c,i){ return [i*16,c,15]; }),
      drums=['kick','bass','clap','hat','open'];
  return {name:'GARE DU NORD',bpm:200,key:-5,scale:'minor',crunch:40,vol:50,
    tracks:[
      {id:'kick',inst:'ckick',name:'KICK'},{id:'bass',inst:'rbass',name:'BASS',lv:85},{id:'clap',inst:'clap',name:'CLAP',lv:78,verb:12},
      {id:'snare',inst:'hsnare',name:'SNARE',lv:80,verb:18},{id:'hat',inst:'hat',name:'HAT',lv:48,pan:18},{id:'open',inst:'open',name:'OPEN',lv:60,pan:-18},
      {id:'saw',inst:'saw',name:'MELODY',tn:12,lv:125,verb:30,echo:18},{id:'stab',inst:'stab',name:'STABS',tn:12,lv:36,pan:20,verb:15},
      {id:'arp',inst:'pluck',name:'PLUCK',tn:12,lv:72,pan:-25,verb:22,echo:30},{id:'pad',inst:'choir',name:'CHOIR',lv:80,verb:45},
      {id:'sub',inst:'sub',name:'SUB',tn:12,lv:10},{id:'hoov',inst:'hoover',name:'HOOVER',lv:38,pan:-15,verb:25},
      {id:'riser',inst:'riser',name:'RISER',lv:75,verb:20},{id:'fall',inst:'fall',name:'FALL',lv:70,verb:25},
      {id:'boom',inst:'boom',name:'BOOM',lv:90,verb:25},{id:'crash',inst:'crash',name:'CRASH',lv:55,verb:30}],
    patterns:[
      {id:'main',name:'MAIN',bars:4,rows:{
        kick:{v:J(F4,F4,F4,'X...X...X.x.XxXx'),n:roots},bass:{v:J(OFF,OFF,OFF,'..x...x.........'),n:roots},
        clap:rpt(CL,4),hat:rpt(H16,4),open:rpt(OFF,4),saw:{notes:mel},stab:{notes:stabs},arp:{notes:arp},pad:{notes:pad},sub:{notes:sub},
        fall:{notes:[[0,0,32]]},boom:'X'+rpt('.',63),crash:'x'+rpt('.',63)}},
      {id:'peak',name:'PEAK',bars:4,rows:{
        kick:{v:J(F4,'X...X...X...X.xx',F4,'X...X.x.X.xxXxXx'),n:roots},bass:{v:J(OFF,'..x...x...x.....',OFF,'..x.............'),n:roots},
        clap:rpt(CL,4),hat:rpt(H16,4),open:rpt(OFF,4),saw:{notes:mel2},stab:{notes:stabs},
        hoov:{notes:[[0,4,14],[16,5,14],[32,6,14],[48,6,8],[56,8,8]]},boom:'X'+rpt('.',63),crash:'x'+rpt('.',63)}},
      {id:'build',name:'BUILD',bars:4,rows:{
        kick:{v:J(F4,F4,'X.X.X.X.X.X.X.X.','XXXXXXXXXXXX....'),n:barN([0,0,0]).concat([0,0,0,0,1,1,1,1,2,2,2,2,4,4,4,4])},
        snare:J(ROLL,'xxxxxxxxXXXX....'),riser:{notes:[[0,0,60]]},
        saw:{notes:mel.slice(0,18).concat([[32,6,8],[40,7,8],[48,8,6],[54,9,6]])},pad:{notes:[[0,0,16],[16,-2,16],[32,2,16],[48,-1,12]]}}}],
    song:[
      {name:'INTRO',pat:'main',rep:2,fx:'open',only:['kick','hat','open']},
      {name:'GROOVE',pat:'main',rep:1,only:drums.concat('stab')},
      {name:'BREAK',pat:'main',rep:1,only:['pad','sub','arp','fall']},
      {name:'BREAK ON',pat:'main',rep:1,only:['pad','sub','arp']},
      {name:'MELODY',pat:'main',rep:2,only:['pad','sub','arp','saw','clap']},
      {name:'BUILD',pat:'build',rep:1,fx:'thin'},
      {name:'DROP',pat:'main',rep:1,only:drums.concat('saw','stab','boom','crash')},
      {name:'DROP ON',pat:'main',rep:3,only:drums.concat('saw','stab')},
      {name:'PEAK',pat:'peak',rep:1,only:drums.concat('saw','stab','hoov','boom','crash')},
      {name:'PEAK ON',pat:'peak',rep:3,only:drums.concat('saw','stab','hoov')},
      {name:'OUTRO',pat:'main',rep:2,fx:'close',only:['kick','bass','hat','open','pad']}]};
}
/* Free-party acid tekk, G phrygian, 185 BPM. No tune to speak of: a squelching acid line, tribal toms and a siren */
function acidTeknival(){
  var A1=[[0,0,1,2],[2,0,1],[3,7,1],[5,0,1],[6,1,2],[7,0,1],[8,0,1,2],[10,0,1],[11,2,1],[13,0,1],[14,7,2,2],[15,4,1]],
      A2=[[16,0,1,2],[18,0,1],[19,7,1],[21,0,1],[22,1,2],[23,0,1],[24,0,1,2],[26,2,1],[27,4,2],[28,2,1],[29,1,1],[30,7,2,2],[31,5,1]],
      B2=[[16,1,1,2],[18,1,1],[19,8,1],[21,1,1],[22,2,2],[23,1,1],[24,1,1,2],[26,1,1],[27,8,2],[28,4,1],[29,2,1],[30,1,2,2],[31,0,1]],
      climb=[],i;
  for(i=0;i<32;i++) climb.push([32+i,i>=24?7:i>=16?(i%2?7:0):(i%4===3?7:0),1,i%4===0?2:1]);
  var drums=['kick','bass','rim','hat','open','tom','tom2'];
  return {name:'ACID TEKNIVAL',bpm:185,key:-2,scale:'phrygian',crunch:35,vol:50,
    tracks:[
      {id:'kick',inst:'tkick',name:'KICK',tn:2},{id:'bass',inst:'tbass',name:'BASS',tn:2,lv:85},
      {id:'acid',inst:'acid',name:'ACID',lv:72,verb:10,echo:22},{id:'acid2',inst:'acid',name:'ACID HIGH',tn:12,lv:60,pan:30,echo:30},
      {id:'tom',inst:'tom',name:'TOM',lv:24,pan:-30,verb:15},{id:'tom2',inst:'tom',name:'TOM LOW',tn:-5,lv:24,pan:30,verb:15},
      {id:'rim',inst:'rim',name:'RIM',lv:50,pan:-20,echo:20},{id:'hat',inst:'hat',name:'HAT',lv:50,pan:18},{id:'open',inst:'open',name:'OPEN',lv:60,pan:-18},
      {id:'clap',inst:'clap',name:'CLAP',lv:78,verb:12},{id:'snare',inst:'hsnare',name:'SNARE',lv:80,verb:18},
      {id:'hoov',inst:'hoover',name:'SIREN',lv:52,verb:30,echo:25},{id:'pad',inst:'choir',name:'CHOIR',lv:80,verb:45},
      {id:'zap',inst:'zap',name:'ZAP',lv:45,pan:35,echo:30},{id:'riser',inst:'riser',name:'RISER',lv:75,verb:20},{id:'boom',inst:'boom',name:'BOOM',lv:90,verb:25}],
    patterns:[
      {id:'main',name:'MAIN',bars:2,rows:{
        kick:J(F4,'X...X...X...X.x.'),bass:J(OFF,'..x...x...x.....'),acid:{notes:A1.concat(A2)},
        acid2:{notes:[[3,7,1],[6,7,1,2],[9,8,1],[12,7,2,2],[13,5,1],[19,7,1],[22,7,1,2],[25,9,1],[28,8,2,2],[29,7,1]]},
        tom:J('...x..x....x..x.','...x..x...x..x.x'),tom2:J('.x......xx......','.x......xx..x...'),rim:rpt('x..x..x..x..x.x.',2),
        hat:rpt(H16,2),open:rpt(OFF,2),clap:rpt(CL,2),hoov:{notes:[[0,7,12],[12,8,4],[16,7,12],[28,5,4]]},pad:{notes:[[0,0,24],[24,1,8]]},
        zap:J(E16,'..........x.....'),boom:'X'+rpt('.',31)}},
      {id:'alt',name:'PEAK',bars:2,rows:{
        kick:{v:J(F4,'X...X...X..xX.xx'),n:barN([0,1])},bass:{v:J(OFF,'..x...x.........'),n:barN([0,1])},acid:{notes:A1.concat(B2)},
        acid2:{notes:[[2,7,1],[5,7,1],[8,9,2,2],[9,8,1],[11,7,1],[14,7,1,2],[18,8,1],[21,8,1],[24,10,2,2],[25,9,1],[27,8,1],[30,8,1,2]]},
        tom:J('...x..x....x..x.','...x..x...x..x.x'),tom2:J('.x......xx......','.x......xx..x...'),rim:rpt('x..x..x..x..x.x.',2),
        hat:rpt(H16,2),open:rpt(OFF,2),clap:rpt(CL,2),hoov:{notes:[[0,7,8],[8,9,8],[16,8,8],[24,8,4],[28,7,4]]},pad:{notes:[[0,0,16],[16,1,16]]},
        zap:J(E16,'..........x.....'),boom:'X'+rpt('.',31)}},
      {id:'build',name:'BUILD',bars:4,rows:{
        kick:J(F4,F4,'X.X.X.X.X.X.X.X.',E16),snare:J(ROLL,'xxxxxxxxXXXXXXXX'),riser:{notes:[[0,0,64]]},
        acid:{notes:A1.concat(A2,climb)},pad:{notes:[[0,0,32],[32,1,32]]},hoov:{notes:[[32,7,16],[48,8,16]]}}}],
    song:[
      {name:'INTRO',pat:'main',rep:2,fx:'open',only:['kick','rim','hat']},
      {name:'GROOVE',pat:'main',rep:4,only:drums},
      {name:'ACID IN',pat:'main',rep:4,only:drums.concat('acid','clap')},
      {name:'BREAK',pat:'main',rep:2,fx:'close',only:['acid','pad']},
      {name:'BREAK ON',pat:'main',rep:2,fx:'open',only:['acid','pad','hoov','clap','tom']},
      {name:'BUILD',pat:'build',rep:1,fx:'thin'},
      {name:'DROP',pat:'main',rep:1,only:drums.concat('acid','clap','zap','boom')},
      {name:'DROP ON',pat:'main',rep:7,only:drums.concat('acid','clap','zap')},
      {name:'PEAK',pat:'alt',rep:1,only:drums.concat('acid','acid2','clap','hoov','zap','boom')},
      {name:'PEAK ON',pat:'alt',rep:5,only:drums.concat('acid','acid2','clap','hoov','zap')},
      {name:'OUTRO',pat:'main',rep:4,fx:'close',only:['kick','bass','rim','hat','tom']}]};
}
/* raw = the compact form as written above, for checking; make() returns a project ready to open */
var DEMOS=[
  {id:'first-drop',name:'First Drop',about:'Hardstyle, 150 BPM. A short arrangement to learn from: intro, break, build, drop, outro.',make:function(){ return T.starterProject(); }},
  {id:'nachtschicht',name:'Nachtschicht',about:'German hardtekk, 175 BPM. The kick plays the bassline, a hoover carries the riff, and a choir fills the break.',raw:nachtschicht},
  {id:'gare-du-nord',name:'Gare du Nord',about:'Frenchcore, 200 BPM. A big supersaw melody that stays on through the drop, with chord stabs on the off-beat.',raw:gareDuNord},
  {id:'acid-teknival',name:'Acid Teknival',about:'Free-party acid tekk, 185 BPM. No tune to speak of: a squelching acid line, tribal toms and a siren.',raw:acidTeknival}
];
DEMOS.forEach(function(d){ if(!d.make) d.make=function(){ return T.normProject(d.raw()); }; });
T.DEMOS=DEMOS;
T.demo=function(id){ for(var i=0;i<DEMOS.length;i++) if(DEMOS[i].id===id) return DEMOS[i].make(); return null; };

/* ================= file writers ================= */
T.wavBytes=function(L,Rr,sr){
  var n=L.length,ab=new ArrayBuffer(44+n*4),dv=new DataView(ab),o=44,k,x;
  function str(off,s){ for(var j=0;j<s.length;j++) dv.setUint8(off+j,s.charCodeAt(j)); }
  str(0,'RIFF'); dv.setUint32(4,36+n*4,true); str(8,'WAVEfmt '); dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,2,true);
  dv.setUint32(24,sr,true); dv.setUint32(28,sr*4,true); dv.setUint16(32,4,true); dv.setUint16(34,16,true); str(36,'data'); dv.setUint32(40,n*4,true);
  for(k=0;k<n;k++){ x=Math.max(-1,Math.min(1,L[k])); dv.setInt16(o,x*32767,true); x=Math.max(-1,Math.min(1,Rr[k])); dv.setInt16(o+2,x*32767,true); o+=4; }
  return new Uint8Array(ab);
};
/* keep the second half of a WAV. A pattern rendered twice and cut this way loops without a seam, because the tails wrap round */
T.wavSecondHalf=function(bytes){
  var n=(bytes.length-44)>>2,h=n>>1,out=new Uint8Array(44+(n-h)*4),dv;
  out.set(bytes.subarray(0,44)); out.set(bytes.subarray(44+h*4,44+n*4),44);
  dv=new DataView(out.buffer); dv.setUint32(4,36+(n-h)*4,true); dv.setUint32(40,(n-h)*4,true);
  return out;
};
var crcT=null;
function crc32(u8){
  var n,k,c,i;
  if(!crcT){ crcT=new Uint32Array(256); for(n=0;n<256;n++){ c=n; for(k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; crcT[n]=c>>>0; } }
  c=-1; for(i=0;i<u8.length;i++) c=crcT[(c^u8[i])&255]^(c>>>8);
  return (c^-1)>>>0;
}
function ascii(s){ var u=new Uint8Array(s.length); for(var i=0;i<s.length;i++) u[i]=s.charCodeAt(i)&127; return u; }
/* a plain (uncompressed) zip from [{name, data: Uint8Array}] */
T.zip=function(files){
  var parts=[],central=[],off=0,csize=0;
  files.forEach(function(f){
    var nm=ascii(f.name),crc=crc32(f.data),len=f.data.length,h=new DataView(new ArrayBuffer(30)),c=new DataView(new ArrayBuffer(46));
    h.setUint32(0,0x04034b50,true); h.setUint16(4,20,true); h.setUint16(12,0x21,true); h.setUint32(14,crc,true); h.setUint32(18,len,true); h.setUint32(22,len,true); h.setUint16(26,nm.length,true);
    parts.push(h.buffer,nm,f.data);
    c.setUint32(0,0x02014b50,true); c.setUint16(4,20,true); c.setUint16(6,20,true); c.setUint16(14,0x21,true); c.setUint32(16,crc,true); c.setUint32(20,len,true); c.setUint32(24,len,true); c.setUint16(28,nm.length,true); c.setUint32(42,off,true);
    central.push(c.buffer,nm); off+=30+nm.length+len; csize+=46+nm.length;
  });
  var e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true); e.setUint16(8,files.length,true); e.setUint16(10,files.length,true); e.setUint32(12,csize,true); e.setUint32(16,off,true);
  return new Blob(parts.concat(central,[e.buffer]),{type:'application/zip'});
};
/* a standard MIDI file from [{name, events:[{t,o,b}], head:[bytes]}]; the first track carries the tempo */
function midiFile(bpm,title,total,list){
  var PPQ=480,us=Math.round(60000000/bpm);
  function vlq(n){ var b=[n&127]; while((n>>=7)>0) b.unshift((n&127)|128); return b; }
  function track(name,events,head){
    var out=[0,0xFF,0x03,Math.min(name.length,100)],i,last=0;
    for(i=0;i<Math.min(name.length,100);i++) out.push(name.charCodeAt(i)&127);
    out=out.concat(head||[]);
    events.sort(function(a,b){ return a.t-b.t||a.o-b.o; });
    events.forEach(function(e){ Array.prototype.push.apply(out,vlq(e.t-last)); Array.prototype.push.apply(out,e.b); last=e.t; });
    Array.prototype.push.apply(out,vlq(Math.max(0,total-last))); out.push(0xFF,0x2F,0);
    var n=out.length;
    return [0x4D,0x54,0x72,0x6B,(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255].concat(out);
  }
  var tracks=[track(title,[],[0,0xFF,0x51,3,(us>>>16)&255,(us>>>8)&255,us&255,0,0xFF,0x58,4,4,2,24,8])];
  list.forEach(function(t){ if(t.events.length) tracks.push(track(t.name,t.events,t.head)); });
  var all=[0x4D,0x54,0x68,0x64,0,0,0,6,0,1,(tracks.length>>8)&255,tracks.length&255,(PPQ>>8)&255,PPQ&255];
  tracks.forEach(function(t){ Array.prototype.push.apply(all,t); });
  return new Uint8Array(all);
}
T.midiFile=midiFile;
/* the whole song as MIDI: drums share channel 10, every pitched track gets its own channel. Effects with no pitch are left out */
T.projectMidi=function(P){
  var ST=120,VELO=[0,100,127,60],t=0,drums=[],list=[{name:'Drums',events:drums}],by={},ch=0;
  P.tracks.forEach(function(tr){
    var I=T.inst(tr.inst);
    if(I.gm||!I.pitched||ch>14) return;
    if(ch===9) ch++;
    by[tr.id]={ch:ch,ev:[]}; list.push({name:tr.name,events:by[tr.id].ev,head:[0,0xC0|ch,I.prog||81]}); ch++;
  });
  var total=T.songSteps(P)*ST;
  P.song.forEach(function(sec){
    var pat=T.patById(P,sec.pat),n=pat.bars*16,r,s;
    for(r=0;r<sec.rep;r++) for(s=0;s<n;s++){
      P.tracks.forEach(function(tr){
        if(sec.off[tr.id]) return;
        var row=pat.rows[tr.id],v=row&&row.v[s],I=T.inst(tr.inst); if(!v) return;
        var at=t+(s%2===1?Math.round(ST*P.swing/100):0),note,len,c,ev;
        if(I.gm){ note=I.gm; len=ST/2; c=9; ev=drums; }
        else if(by[tr.id]){ note=I.base+tr.tn+(P.key|0)+T.degSemis(row.n[s],P.scale); len=Math.max(1,row.l[s]|0)*ST-10; c=by[tr.id].ch; ev=by[tr.id].ev; }
        else return;
        note=Math.max(0,Math.min(127,note));
        ev.push({t:at,o:1,b:[0x90|c,note,VELO[v]]}); ev.push({t:Math.min(total,at+len),o:0,b:[0x80|c,note,0]});
      });
      t+=ST;
    }
  });
  return midiFile(P.bpm,'Tock '+P.name,total,list);
};
T.download=function(blob,name){
  var url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(url); },8000);
};
/* Put a file on disk. When the page is served by tools/serve.py on this computer it is written into the renders folder
   and the path comes back; anywhere else it becomes an ordinary browser download. */
T.saveFile=function(name,data,type){
  var blob=data instanceof Blob?data:new Blob([data],{type:type||'application/octet-stream'});
  name=String(name).replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^[^A-Za-z0-9]+/,'')||'tock-file';
  if(/^(localhost|127\.0\.0\.1)$/.test(location.hostname)){
    return fetch('/save/'+name,{method:'POST',body:blob}).then(function(r){ if(!r.ok) throw new Error('save refused'); return r.json(); })
      .catch(function(){ T.download(blob,name); return {downloaded:name}; });
  }
  T.download(blob,name); return Promise.resolve({downloaded:name});
};
/* measurements of a 16-bit stereo WAV made here, for anyone who cannot listen to it:
   length, peak, overall loudness, how much of it is clipped or silent, and how the energy splits into low / mid / high */
T.analyse=function(bytes){
  var dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),sr=dv.getUint32(24,true),n=(bytes.byteLength-44)>>2,i,l,r,m,pk=0,sq=0,clip=0,quiet=0,
      a1=Math.exp(-2*Math.PI*200/sr),a2=Math.exp(-2*Math.PI*2500/sr),y1=0,y2=0,lo=0,mid=0,hi=0,dc=0;
  for(i=0;i<n;i++){
    l=dv.getInt16(44+i*4,true)/32768; r=dv.getInt16(46+i*4,true)/32768; m=(l+r)/2;
    if(Math.abs(l)>pk) pk=Math.abs(l); if(Math.abs(r)>pk) pk=Math.abs(r);
    if(Math.abs(l)>0.999||Math.abs(r)>0.999) clip++;
    if(Math.abs(m)<0.001) quiet++;
    sq+=(l*l+r*r)/2; dc+=m;
    y1=(1-a1)*m+a1*y1; y2=(1-a2)*m+a2*y2;
    lo+=y1*y1; mid+=(y2-y1)*(y2-y1); hi+=(m-y2)*(m-y2);
  }
  function db(x){ return x>0?+(10*Math.log10(x)).toFixed(1):-120; }
  var tot=lo+mid+hi||1;
  return {seconds:+(n/sr).toFixed(2),peak:+pk.toFixed(3),rmsDb:db(sq/Math.max(1,n)),clippedPct:+(100*clip/Math.max(1,n)).toFixed(2),silentPct:+(100*quiet/Math.max(1,n)).toFixed(1),
    lowPct:+(100*lo/tot).toFixed(0),midPct:+(100*mid/tot).toFixed(0),highPct:+(100*hi/tot).toFixed(0),dc:+(dc/Math.max(1,n)).toFixed(4)};
};

window.Tock=T;
})();
