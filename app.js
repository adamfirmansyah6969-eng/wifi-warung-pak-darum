/* KASIR WIFI WARUNG PAK DARUM v1.4.1 — static app, IndexedDB, no external libs.
   QRIS is MANUAL only. MikroTik integration is NOT active in this version. */
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const PRICELIST_VERSION=2;
const DEFAULT_PACKAGES=[
 {id:'6jam',name:'Paket Mabar (6 Jam)',label:'MABAR',price:2000},
 {id:'1hari',name:'Paket Seharian (24 Jam)',label:'SEHARIAN',price:3000},
 {id:'7hari',name:'Paket Mingguan (7 Hari)',label:'MINGGUAN',price:15000},
 {id:'30hari',name:'Paket Sultan (30 Hari)',label:'SULTAN',price:50000}];
const LOW_STOCK=5;
const STAMPS_FOR_FREE=5, FREE_PKG='6jam';
const DEFAULT_PROMOS=[{code:'HEMAT500',type:'rp',value:500,packages:'all',active:true,expires:'',maxUses:0,used:0}];
/* ---------- Batch 3: Promo & Member (logika murni, bisa dites) ---------- */
function txnTotal(t){return Math.max(0,(t.price||0)-(t.discount||0));}
function findPromo(code){code=(code||'').trim().toUpperCase();if(!code)return null;return (settings.promos||[]).find(p=>p.code.toUpperCase()===code)||null;}
function promoDiscount(promo,pkgId,price){
  if(!promo)return {discount:0,reason:''};
  if(!promo.active)return {discount:0,reason:'Kode promo tidak aktif.'};
  if(promo.expires&&promo.expires<todayKey())return {discount:0,reason:'Kode promo sudah kedaluwarsa.'};
  if(promo.maxUses>0&&(promo.used||0)>=promo.maxUses)return {discount:0,reason:'Kode promo sudah habis dipakai.'};
  if(promo.packages&&promo.packages!=='all'&&promo.packages!==pkgId)return {discount:0,reason:'Kode promo tidak berlaku untuk paket ini.'};
  let d=0;
  if(promo.type==='pct'){if(!(promo.value>0&&promo.value<=100))return {discount:0,reason:'Nilai promo persen tidak valid.'};d=Math.floor(price*promo.value/100);}
  else d=Math.max(0,Number(promo.value)||0);
  return {discount:Math.min(d,price),reason:''};
}
function memberForSale(members,cust,custWa,total){
  const wa=normWa(custWa||'');const name=(cust||'').trim();
  if(!wa&&!name)return null;
  let m=null;
  if(wa)m=(members||[]).find(x=>normWa(x.wa||'')===wa);
  if(!m&&name)m=(members||[]).find(x=>(x.name||'').trim().toLowerCase()===name.toLowerCase());
  const now=Date.now();
  if(m){return {id:m.id,name:m.name||name,wa:m.wa||wa,stamps:(m.stamps||0)+1,totalTxns:(m.totalTxns||0)+1,totalSpent:(m.totalSpent||0)+total,createdAt:m.createdAt||now,updatedAt:now};}
  return {id:uid(),name:name||wa,wa,stamps:1,totalTxns:1,totalSpent:total,createdAt:now,updatedAt:now};
}
function canRedeem(member){return member&&(member.stamps||0)>=STAMPS_FOR_FREE;}
let settings=loadSettings();
let selPkg=null, selMethod='TUNAI', currentTxn=null, lastActivity=Date.now();

function loadSettings(){try{const s=JSON.parse(localStorage.getItem('kwd_settings')||'{}');return Object.assign({shopName:'WARUNG PAK DARUM',wifiName:'@WIFI WARUNG PAK DARUM',wa:'',hotspotUrl:'',pinHash:'',autoLock:false,packages:DEFAULT_PACKAGES,qrisImage:''},s);}catch(e){return {shopName:'WARUNG PAK DARUM',wifiName:'@WIFI WARUNG PAK DARUM',wa:'',hotspotUrl:'',pinHash:'',autoLock:false,packages:DEFAULT_PACKAGES,qrisImage:''};}}
function saveSettings(){localStorage.setItem('kwd_settings',JSON.stringify(settings));}
function pkgById(id){return settings.packages.find(p=>p.id===id)||DEFAULT_PACKAGES.find(p=>p.id===id);}
function rp(n){return 'Rp'+(Number(n)||0).toLocaleString('id-ID');}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function todayKey(d){d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function fmtDT(ts){return new Date(ts).toLocaleString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function fmtDate(ts){return new Date(ts).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});}
function uid(){return 'tx_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
async function sha256(str){if(crypto?.subtle){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}let h=0;for(let i=0;i<str.length;i++){h=(h*31+str.charCodeAt(i))>>>0;}return 'simple'+h;}
async function pinHash(pin){return sha256('kwd-pin:'+pin);}
async function checkPin(pin){if(!settings.pinHash)return pin==='1234';return (await pinHash(pin))===settings.pinHash;}

/* ---------- IndexedDB ---------- */
const DB='kasir-wifi-pak-darum', VER=2;
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,VER);
 r.onupgradeneeded=e=>{const db=e.target.result;
  if(!db.objectStoreNames.contains('vouchers')){const v=db.createObjectStore('vouchers',{keyPath:'code'});v.createIndex('byPackageStatus',['package','status'],{unique:false});}
  if(!db.objectStoreNames.contains('transactions')){const t=db.createObjectStore('transactions',{keyPath:'id'});t.createIndex('byDate','dateKey',{unique:false});}
  if(!db.objectStoreNames.contains('closures'))db.createObjectStore('closures',{keyPath:'id'});
  if(!db.objectStoreNames.contains('members')){const m=db.createObjectStore('members',{keyPath:'id'});m.createIndex('byWa','wa',{unique:false});}};
 r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);});}
function txDone(t){return new Promise((res,rej)=>{t.oncomplete=res;t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error);});}
function getAll(store){return openDB().then(db=>new Promise((res,rej)=>{const r=db.transaction(store,'readonly').objectStore(store).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);}));}
function putAll(store,items){return openDB().then(async db=>{const t=db.transaction(store,'readwrite');const s=t.objectStore(store);items.forEach(it=>s.put(it));await txDone(t);});}

/* ---------- CSV: format MikroTik (Username,Password,Profile,Time Limit,Data Limit,Comment)
   Username = kode voucher. Password DIABAIKAN sepenuhnya (tidak disimpan/ditampilkan/dicetak).
   Profile + Time Limit dipakai hanya untuk menebak paket (ditampilkan ke admin untuk dikonfirmasi).
   Format lama 2 kolom (Username,Password) tetap bisa dibaca. */
function parseVoucherCSV(text){
 const rows=[];let row=[],cur='',q=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(q){if(c==='"'){if(text[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=c;}
  else if(c==='"')q=true; else if(c===','){row.push(cur);cur='';} else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cur);rows.push(row);row=[];cur='';}
  else cur+=c;}
 if(cur!==''||row.length){row.push(cur);rows.push(row);}
 const clean=rows.map(r=>r.map(x=>String(x||'').trim())).filter(r=>r.some(x=>x!==''));
 if(!clean.length)return {rows:[],total:0,profile:'',timeLimit:''};
 const head=clean[0].map(h=>h.toLowerCase().replace(/[^a-z]/g,''));
 const col=name=>head.indexOf(name);
 let ui=col('username'); if(ui<0)ui=0;
 const pi=col('profile'), ti=col('timelimit');
 const start=(head.includes('username')||head.includes('user')||head.includes('kode'))?1:0;
 const out=[];for(let i=start;i<clean.length;i++){const code=(clean[i][ui]||'').trim();if(!code)continue;
  out.push({code,profile:pi>=0?(clean[i][pi]||''):'' ,timeLimit:ti>=0?(clean[i][ti]||''):''});}
 const prof=out.length?out[0].profile:''; const tl=out.length?out[0].timeLimit:'';
 return {rows:out,total:out.length,profile:prof,timeLimit:tl};
}
/* Tebak paket dari Profile / Time Limit, mis. "voucher-6-jam-2000" + "6h" -> 6jam.
   Urutan penting: cek 30 dulu, lalu 7, lalu 1 hari, lalu 6 jam. */
function detectPackage(profile,timeLimit){
 const s=((profile||'')+' '+(timeLimit||'')).toLowerCase();
 if(/30\s*[- ]?(hari|day|d\b)|30d\b/.test(s))return '30hari';
 if(/\b7\s*[- ]?(hari|day|d\b)|7d\b/.test(s))return '7hari';
 if(/1\s*[- ]?hari|24h|\b1d\b/.test(s))return '1hari';
 if(/6\s*[- ]?(jam|h\b)|6h\b/.test(s))return '6jam';
 return null;
}

/* Lebar karakter Helvetica (satuan /1000 em, dari AFM) — dipakai agar teks
   tidak pernah keluar dari lebar kertas 58mm. Perkiraan lama (0.52×ukuran
   per karakter) terlalu kecil untuk huruf kapital tebal, itulah yang membuat
   struk terpotong di kanan dan kode voucher menimpa baris di atasnya. */
function pdfEscape(s){return String(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');}
const _W={ ' ':278,'!':278,'"':355,'#':556,'$':556,'%':889,'&':667,"'":191,'(':333,')':333,'*':389,'+':584,',':278,'-':333,'.':278,'/':278,'0':556,'1':556,'2':556,'3':556,'4':556,'5':556,'6':556,'7':556,'8':556,'9':556,':':278,';':278,'<':584,'=':584,'>':584,'?':556,'@':1015,'A':667,'B':667,'C':722,'D':722,'E':667,'F':611,'G':778,'H':722,'I':278,'J':500,'K':667,'L':556,'M':833,'N':722,'O':778,'P':667,'Q':778,'R':722,'S':667,'T':611,'U':722,'V':667,'W':944,'X':667,'Y':667,'Z':611,'[':278,'\\':278,']':278,'^':469,'_':556,'`':333,'a':556,'b':556,'c':500,'d':556,'e':556,'f':278,'g':556,'h':556,'i':222,'j':222,'k':500,'l':222,'m':833,'n':556,'o':556,'p':556,'q':556,'r':333,'s':500,'t':278,'u':556,'v':500,'w':722,'x':500,'y':500,'z':500,'{':334,'|':260,'}':334,'~':584};
function textWidth(s,size,bold){let w=0;for(const ch of String(s))w+=(_W[ch]??556);return w*size/1000*(bold?1.04:1);}

/* QR Code generator — byte mode, ECC level M, versions 1..10, no dependencies.
   Written from the QR spec (ISO/IEC 18004): Reed-Solomon over GF(256),
   function patterns, format/version info, all 8 masks with penalty scoring. */
'use strict';
const TOTAL_CW=[26,44,70,100,134,172,196,242,292,346];
const ECC_PER_BLOCK=[10,16,26,18,24,16,18,22,22,26];
const NUM_BLOCKS=[1,1,1,2,2,4,4,4,5,5];
const ALIGN_POS=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
// GF(256) tables, primitive polynomial 0x11D, generator 2
const EXP=new Uint8Array(512), LOG=new Uint8Array(256);
{let x=1;for(let i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&0x100)x^=0x11D;}for(let i=255;i<512;i++)EXP[i]=EXP[i-255];}
function gfMul(a,b){return (a===0||b===0)?0:EXP[LOG[a]+LOG[b]];}
function rsRemainder(data,div){const res=new Uint8Array(data.length+div.length-1);res.set(data);for(let i=0;i<data.length;i++){const c=res[i];if(c!==0){for(let j=0;j<div.length;j++)res[i+j]^=gfMul(div[j],c);}}return res.slice(data.length);}
function reedSolomonComputeDivisor(deg){ // highest-first coeffs of prod (x + 2^i), i=0..deg-1
  let poly=[1];for(let i=0;i<deg;i++){const np=new Array(poly.length+1).fill(0);np[0]=poly[0];for(let j=1;j<poly.length;j++)np[j]=poly[j]^gfMul(poly[j-1],EXP[i]);np[poly.length]=gfMul(poly[poly.length-1],EXP[i]);poly=np;}return poly;}
function getBit(x,i){return ((x>>>i)&1)!==0;}
function qrEncode(text){
  const data=new TextEncoder().encode(text);
  let ver=0;for(let v=1;v<=10;v++){const dcw=TOTAL_CW[v-1]-NUM_BLOCKS[v-1]*ECC_PER_BLOCK[v-1];const maxBytes=Math.floor((dcw*8-(v<=9?12:20)-4)/8);if(data.length<=maxBytes){ver=v;break;}}
  if(!ver)throw new Error('QR_TOO_LONG');
  const size=ver*4+17, eccLen=ECC_PER_BLOCK[ver-1], numBlocks=NUM_BLOCKS[ver-1], totalCw=TOTAL_CW[ver-1];
  const dataCw=totalCw-numBlocks*eccLen;
  // bit stream
  const bb=[];const put=(v,len)=>{for(let i=len-1;i>=0;i--)bb.push((v>>>i)&1);};
  put(0b0100,4);put(data.length,ver<=9?8:16);
  for(const b of data)put(b,8);
  const cap=dataCw*8;put(0,Math.min(4,cap-bb.length));
  while(bb.length%8!==0)bb.push(0);
  for(let pad=0xEC;bb.length<cap;pad^=0xEC^0x11)put(pad,8);
  const dataBytes=[];for(let i=0;i<bb.length;i+=8){let b=0;for(let j=0;j<8;j++)b=(b<<1)|bb[i+j];dataBytes.push(b);}
  // split into blocks (short/long differ by 1)
  const shortLen=Math.floor(dataCw/numBlocks), numLong=dataCw%numBlocks;
  const blocks=[];let off=0; // first (numBlocks-numLong) blocks are short, rest long by 1
  for(let i=0;i<numBlocks;i++){const len=shortLen+(i>=numBlocks-numLong?1:0);blocks.push(dataBytes.slice(off,off+len));off+=len;}
  const div=reedSolomonComputeDivisor(eccLen);
  const eccBlocks=blocks.map(b=>Array.from(rsRemainder(b,div)));
  // interleave
  const inter=[];const maxDataLen=Math.max(...blocks.map(b=>b.length));
  for(let i=0;i<maxDataLen;i++)for(const b of blocks)if(i<b.length)inter.push(b[i]);
  for(let i=0;i<eccLen;i++)for(const e of eccBlocks)inter.push(e[i]);
  const bits=[];for(const b of inter)for(let i=7;i>=0;i--)bits.push((b>>>i)&1);
  // modules
  const modules=Array.from({length:size},()=>new Array(size).fill(null));
  const isFunc=Array.from({length:size},()=>new Array(size).fill(false));
  const set=(x,y,v,f)=>{if(x>=0&&x<size&&y>=0&&y<size){modules[y][x]=v;if(f)isFunc[y][x]=true;}};
  // finder patterns + separators
  function finder(cx,cy){for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy));const xx=cx+dx,yy=cy+dy;if(xx<0||yy<0||xx>=size||yy>=size)continue;set(xx,yy,d!==2&&d!==4,true);}}
  finder(3,3);finder(size-4,3);finder(3,size-4);
  // timing (only where no finder pattern already sits)
  for(let i=0;i<size;i++){if(modules[i][6]===null)set(6,i,i%2===0,true);if(modules[6][i]===null)set(i,6,i%2===0,true);}
  // alignment
  for(const ay of ALIGN_POS[ver-1])for(const ax of ALIGN_POS[ver-1]){
    if((ax===6&&ay===6)||(ax===6&&ay===size-7)||(ax===size-7&&ay===6))continue;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(ax+dx,ay+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1,true);}
  // reserve format info
  for(let i=0;i<9;i++){set(8,i,false,true);set(i,8,false,true);}
  for(let i=0;i<8;i++){set(8,size-1-i,false,true);set(size-8+i,8,false,true);}
  set(8,size-8,true,true); // dark module
  if(ver>=7){for(let i=0;i<18;i++){set(i%3,Math.floor(i/3)+size-11,false,true);set(Math.floor(i/3)+size-11,i%3,false,true);}}
  // data placement (zigzag, skip col 6)
  let bitIdx=0;
  for(let right=size-1;right>=1;right-=2){
    if(right===6)right=5;
    for(let vert=0;vert<size;vert++){
      for(let j=0;j<2;j++){
        const x=right-j, y=((right+1)&2)===0?size-1-vert:vert;
        if(modules[y][x]===null){set(x,y,bitIdx<bits.length?bits[bitIdx]:0,false);bitIdx++;}
      }
    }
  }
  // masks
  const maskFn=[(x,y)=>(x+y)%2===0,(x,y)=>y%2===0,(x,y)=>x%3===0,(x,y)=>(x+y)%3===0,(x,y)=>(Math.floor(x/3)+Math.floor(y/3))%2===0,(x,y)=>(x*y)%2+(x*y)%3===0,(x,y)=>((x*y)%2+(x*y)%3)%2===0,(x,y)=>((x+y)%2+(x*y)%3)%2===0];
  function drawFormat(mask){
    let d=(0<<3)|mask, rem=d;
    for(let i=0;i<10;i++)rem=(rem<<1)^(((rem>>9)&1)*0x537);
    const bits15=((d<<10)|rem)^0x5412;
    for(let i=0;i<=5;i++)set(8,i,getBit(bits15,i),true);
    set(8,7,getBit(bits15,6),true);set(8,8,getBit(bits15,7),true);set(7,8,getBit(bits15,8),true);
    for(let i=9;i<15;i++)set(14-i,8,getBit(bits15,i),true);
    for(let i=0;i<8;i++)set(size-1-i,8,getBit(bits15,i),true);
    for(let i=8;i<15;i++)set(8,size-15+i,getBit(bits15,i),true);
    set(8,size-8,true,true);
  }
  function drawVersion(){
    let rem=ver;for(let i=0;i<12;i++)rem=(rem<<1)^(((rem>>11)&1)*0x1F25);
    const bits18=(ver<<12)|rem;
    for(let i=0;i<18;i++){const b=getBit(bits18,i);set(i%3,Math.floor(i/3)+size-11,b,true);set(Math.floor(i/3)+size-11,i%3,b,true);}
  }
  function penalty(m){
    let s=0;
    for(let y=0;y<size;y++){let run=1,prev=m[y][0];for(let x=1;x<size;x++){if(m[y][x]===prev)run++;else{if(run>=5)s+=3+(run-5);run=1;prev=m[y][x];}}if(run>=5)s+=3+(run-5);}
    for(let x=0;x<size;x++){let run=1,prev=m[0][x];for(let y=1;y<size;y++){if(m[y][x]===prev)run++;else{if(run>=5)s+=3+(run-5);run=1;prev=m[y][x];}}if(run>=5)s+=3+(run-5);}
    for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++){const c=m[y][x];if(c===m[y][x+1]&&c===m[y+1][x]&&c===m[y+1][x+1])s+=3;}
    const pat1=[1,0,1,1,1,0,1,0,0,0,0],pat2=[0,0,0,0,1,0,1,1,1,0,1];
    const match=(arr,pat,off)=>pat.every((v,i)=>arr[off+i]===v);
    for(let y=0;y<size;y++)for(let x=0;x<=size-11;x++){if(match(m[y],pat1,x)||match(m[y],pat2,x))s+=40;}
    for(let x=0;x<size;x++){const col=m.map(r=>r[x]);for(let y=0;y<=size-11;y++){if(match(col,pat1,y)||match(col,pat2,y))s+=40;}}
    let dark=0;for(const r of m)for(const c of r)if(c)dark++;
    const total=size*size;const k=Math.floor((Math.abs(dark*20-total*10)+total-1)/total)-1;s+=k*10;
    return s;
  }
  let best=null,bestScore=Infinity,bestMask=0;
  for(let mask=0;mask<8;mask++){
    const m=modules.map(r=>r.slice());
    for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!isFunc[y][x]&&maskFn[mask](x,y))m[y][x]=!m[y][x];
    const sc=penalty(m);if(sc<bestScore){bestScore=sc;best=m;bestMask=mask;}
  }
  // apply best mask to modules + format/version
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!isFunc[y][x]&&maskFn[bestMask](x,y))modules[y][x]=!modules[y][x];
  drawFormat(bestMask);if(ver>=7)drawVersion();
  return {size,modules,version:ver,mask:bestMask};
}

/* QR untuk struk: bila alamat login hotspot diisi, QR membuka halaman login
   dengan username & password terisi (bila halaman login warung mendukung isi
   otomatis dari URL — bila tidak, pelanggan tetap tinggal ketik kode yang
   tertera besar di struk). Bila alamat kosong, QR berisi kode voucher saja. */
function qrDataFor(code){
  const base=(settings.hotspotUrl||'').trim().replace(/\/$/,'');
  if(!base)return code;
  const sep=base.includes('?')?'&':'?';
  return base+sep+'username='+encodeURIComponent(code)+'&password='+encodeURIComponent(code);
}
function drawQRCanvas(canvas,text){
  try{const {size,modules}=qrEncode(text);const q=4,cell=Math.floor(canvas.width/(size+q*2));const off=Math.floor((canvas.width-cell*size)/2);
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';
    for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(modules[y][x])ctx.fillRect(off+x*cell,off+y*cell,cell,cell);
  }catch(e){/* QR terlalu panjang: biarkan kosong, kode teks tetap tercetak */}
}
/* ---------- Batch 2: WhatsApp + Cek Voucher ---------- */
const PKG_DURATION_MS={'6jam':6*3600*1000,'1hari':24*3600*1000,'7hari':7*24*3600*1000,'30hari':30*24*3600*1000};
function normWa(s){let d=String(s||'').replace(/\D/g,'');if(!d)return '';if(d.startsWith('0'))d='62'+d.slice(1);else if(d.startsWith('8'))d='62'+d;return d;}
function waLinkFor(txn){
  const lines=[`Halo! Ini kode voucher WiFi *${settings.shopName.toUpperCase()}*:`,``,`Kode: *${txn.code}*`,`Paket: ${txn.packageName} (${rp(txn.price)})`,`No. Transaksi: ${txn.number}`];
  if(txn.discount>0)lines.push(`Diskon (${txn.promoCode}): -${rp(txn.discount)}`,`Total bayar: ${rp(txnTotal(txn))}`);
  if(txn.method==='GRATIS')lines.push(`GRATIS — tukar 5 stempel member.`);
  const base=(settings.hotspotUrl||'').trim();
  if(base)lines.push(``,`Cara login: buka ${base} lalu masukkan kode di atas sebagai username dan password. Bisa juga scan QR di struk.`);
  else lines.push(``,`Cara login: buka halaman login WiFi, masukkan kode di atas sebagai username dan password.`);
  const origin=(typeof location!=='undefined'&&location.origin&&location.origin!=='null')?location.origin:'';
  if(origin)lines.push(``,`Cek masa aktif: ${origin}/cek.html`);
  lines.push(``,`Terima kasih sudah membeli di ${settings.shopName}!`);
  const num=normWa(txn.customerWa||'');
  return num?`https://wa.me/${num}?text=${encodeURIComponent(lines.join('\n'))}`:`https://api.whatsapp.com/send?text=${encodeURIComponent(lines.join('\n'))}`;
}
/* Status voucher (murni, bisa dites): expiry = perkiraan dari waktu jual + durasi paket.
   Tanpa integrasi MikroTik, aplikasi tidak tahu pemakaian sebenarnya di router. */
function voucherStatus(v,txn){
  if(!v)return {status:'notfound',label:'Kode tidak ditemukan'};
  if(v.status==='quarantined')return {status:'quarantined',label:'Dibatalkan / dikarantina — tidak bisa dipakai'};
  if(v.status==='available')return {status:'available',label:'Belum terjual — belum aktif'};
  if(v.status==='sold'){
    const soldAt=v.soldAt||(txn&&txn.ts)||null;
    const expiry=soldAt?(soldAt+(PKG_DURATION_MS[v.package]||0)):null;
    return {status:'sold',label:'Aktif',soldAt,expiry,remaining:expiry?expiry-Date.now():null};
  }
  return {status:v.status,label:v.status};
}
function fmtRemaining(ms){if(ms==null)return '—';if(ms<=0)return 'Sudah habis (perkiraan)';const m=Math.floor(ms/60000);if(m<60)return m+' menit lagi';const h=Math.floor(m/60);if(h<48)return h+' jam '+(m%60)+' menit lagi';return Math.floor(h/24)+' hari '+(h%24)+' jam lagi';}
async function checkVoucherUI(code){
  code=(code||'').trim().toUpperCase();const box=$('#checkResult');if(!box)return null;
  if(!code){box.innerHTML='<p class="muted">Masukkan kode voucher dulu.</p>';return null;}
  const {vouchers,transactions}=await loadAll();
  const v=vouchers.find(x=>x.code.toUpperCase()===code);
  const txn=transactions.find(t=>t.code.toUpperCase()===code);
  const st=voucherStatus(v,txn);
  if(st.status==='notfound'){box.innerHTML=`<p><b>Kode tidak ditemukan.</b><br><span class="muted">Periksa lagi huruf/angkanya, atau kode ini belum pernah masuk ke aplikasi ini.</span></p>`;return st;}
  const badge=st.status==='sold'?'<span class="badge b-ok">AKTIF</span>':st.status==='available'?'<span class="badge b-qris">BELUM TERJUAL</span>':'<span class="badge b-cancel">DIBATALKAN</span>';
  box.innerHTML=`<div class="kv"><span>Kode</span><b>${esc(code)}</b></div>
   <div class="kv"><span>Status</span><b>${badge}</b></div>
   ${v?`<div class="kv"><span>Paket</span><b>${esc(pkgById(v.package).name)}</b></div>`:''}
   ${st.soldAt?`<div class="kv"><span>Dibeli</span><b>${fmtDT(st.soldAt)}</b></div>`:''}
   ${st.expiry?`<div class="kv"><span>Perkiraan habis</span><b>${fmtDT(st.expiry)}</b></div><div class="kv"><span>Sisa waktu</span><b>${fmtRemaining(st.remaining)}</b></div>`:''}
   <p class="muted" style="margin-top:8px">Perkiraan berdasarkan waktu beli + durasi paket. Masa aktif sebenarnya mengikuti MikroTik — bila voucher sudah dipakai sebelum waktu beli tercatat di sini, ikuti yang di router.</p>`;
  return st;
}

/* PDF multi-halaman generik (halaman 58mm). pages: [{w,h,content}] */
function makePdf(pages){
  const fontF1=3+pages.length*2, fontF2=fontF1+1;
  const objs=[`<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [${pages.map((_,i)=> (3+i*2)+' 0 R').join(' ')}] /Count ${pages.length} >>`];
  pages.forEach((pg,i)=>{
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pg.w} ${pg.h}] /Resources << /Font << /F1 ${fontF1} 0 R /F2 ${fontF2} 0 R >> >> /Contents ${4+i*2} 0 R >>`);
    objs.push(`<< /Length ${pg.content.length} >>\nstream\n${pg.content}\nendstream`);
  });
  objs.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`);
  let pdf='%PDF-1.4\n', offsets=[0];
  objs.forEach((o,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});
  const xref=pdf.length; pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=objs.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  pdf+=`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf],{type:'application/pdf'});
}
async function shareFile(blob,filename,title){
  const file=new File([blob],filename,{type:'application/pdf'});
  if(navigator.canShare&&navigator.canShare({files:[file]})){
    try{await navigator.share({files:[file],title:title||'Voucher WiFi',text:filename});return 'shared';}catch(e){if(e&&e.name==='AbortError')return 'cancelled';}
  }
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);return 'downloaded';
}
function buildReceiptPDF(txn,opts){
 opts=opts||{};const isCopy=!!opts.copy;
 const W=164, M=8, AVAIL=W-2*M; // 58mm = 164.4pt, margin 8pt kiri-kanan
 const lines=[]; // {t, bold, size, align} atau {qr: code}
 const add=(t,o)=>lines.push(Object.assign({t:String(t??''),bold:false,size:9,align:'center'},o||{}));
 const sep=(ch,size)=>{const n=Math.max(8,Math.floor(AVAIL/textWidth(ch,size||8,false)));return ch.repeat(n);};
 const shop=settings.shopName.toUpperCase();
 add(shop,{bold:true,size:11}); add(settings.wifiName,{size:8});
 add(sep('=',8),{size:8});
 add('BUKTI PEMBELIAN',{bold:true,size:10}); add('VOUCHER WIFI',{bold:true,size:10});
 if(isCopy)add('*** SALINAN ***',{bold:true,size:10});
 add(''); add('No. Transaksi',{size:8}); add(txn.number,{bold:true,size:9});
 add(fmtDT(txn.ts),{size:8}); add('');
 add('Paket: '+txn.packageName,{align:'left',size:9});
 add('Harga: '+rp(txn.price),{align:'left',size:9});
 if(txn.discount>0){add('Diskon ('+(txn.promoCode||'promo')+'): -'+rp(txn.discount),{align:'left',size:9});add('Total: '+rp(txnTotal(txn)),{align:'left',size:9,bold:true});}
 if(txn.method==='GRATIS')add('GRATIS — Tukar 5 Stempel Member',{align:'left',size:9,bold:true});
 add('Pembayaran: '+txn.method,{align:'left',size:9});
 if(txn.method==='TUNAI'){add('Tunai: '+rp(txn.cashReceived||txn.price),{align:'left',size:9});add('Kembalian: '+rp(txn.change||0),{align:'left',size:9});}
 if(txn.customer)add('Pelanggan: '+txn.customer,{align:'left',size:8});
 add(sep('-',8),{size:8}); add('KODE VOUCHER WIFI',{bold:true,size:9});
 add(''); // spasi ekstra: huruf kode 20pt menjulang ke atas, tanpa ini menimpa label di atasnya
 add(txn.code,{bold:true,size:20});
 add(''); lines.push({qr:txn.code}); add('Scan untuk login hotspot',{size:8}); add(sep('-',8),{size:8});
 add('Terima kasih telah membeli'); add('voucher WiFi di '+settings.shopName+'.');
 add('Selamat menikmati internet!'); add(sep('=',8),{size:8});
 add('Kode hanya untuk 1 perangkat sesuai',{size:7}); add('ketentuan paket. Simpan struk ini.',{size:7});
 // Layout: kecilkan font sampai muat, bungkus kata demi kata, tinggi baris
 // mengikuti ukuran font (kode 20pt butuh jarak ~27pt, bukan 11pt).
 const laid=[];
 for(const ln of lines){
   if(ln.qr){laid.push({qr:ln.qr,h:104});continue;}
   if(!ln.t){laid.push({t:'',size:ln.size,bold:ln.bold,align:ln.align,h:6});continue;}
   let size=ln.size||9;
   while(size>6&&textWidth(ln.t,size,ln.bold)>AVAIL)size-=0.5;
   const words=String(ln.t).split(/\s+/); let cur='';
   const flush=()=>{if(cur){laid.push({t:cur,size,bold:ln.bold,align:ln.align,h:Math.max(11,size*1.35)});cur='';}};
   for(const w of words){
     const trial=cur?cur+' '+w:w;
     if(textWidth(trial,size,ln.bold)<=AVAIL)cur=trial;
     else{flush();
       if(textWidth(w,size,ln.bold)>AVAIL){let s=size;while(s>6&&textWidth(w,s,ln.bold)>AVAIL)s-=0.5;laid.push({t:w,size:s,bold:ln.bold,align:ln.align,h:Math.max(11,s*1.35)});}
       else cur=w;}
   }
   flush();
 }
 const top=16, bottom=14, height=top+bottom+laid.reduce((s,l)=>s+l.h,0);
 let content=''; let y=height-top;
 for(const ln of laid){
   if(ln.qr){
     try{const q=qrEncode(qrDataFor(ln.qr));const m=96/q.size,total=m*q.size,x0=(W-total)/2,top=y;
       for(let my=0;my<q.size;my++)for(let mx=0;mx<q.size;mx++)if(q.modules[my][mx])
         content+=`${(x0+mx*m).toFixed(1)} ${(top-(my+1)*m).toFixed(1)} ${m.toFixed(2)} ${m.toFixed(2)} re f\n`;}
     catch(e){/* QR gagal: kode teks tetap tercetak di atas */}
   } else if(ln.t){const w=textWidth(ln.t,ln.size,ln.bold);
     const x=ln.align==='left'?M:(ln.align==='right'?W-M-w:(W-w)/2);
     content+=`BT /${ln.bold?'F2':'F1'} ${ln.size} Tf 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${pdfEscape(ln.t)}) Tj ET\n`;}
   y-=ln.h;
 }
 return makePdf([{w:W,h:height,content}]);
}

/* Cetak massal: satu halaman 58mm per voucher (belum terjual — hanya dicetak).
   Setiap halaman berisi paket, harga, QR + kode besar. */
function buildBulkPDF(items){
  const W=164, M=8, AVAIL=W-2*M;
  const pages=items.map(v=>{
    const pkg=pkgById(v.package);
    const lines=[];const add=(t,o)=>lines.push(Object.assign({t:String(t??''),bold:false,size:9,align:'center'},o||{}));
    const sep=(ch,size)=>{const n=Math.max(8,Math.floor(AVAIL/textWidth(ch,size||8,false)));return ch.repeat(n);};
    add(settings.shopName.toUpperCase(),{bold:true,size:11});add(settings.wifiName,{size:8});add(sep('=',8),{size:8});
    add(pkg.name,{bold:true,size:11});add(rp(pkg.price),{bold:true,size:10});add(sep('-',8),{size:8});
    add('KODE VOUCHER WIFI',{bold:true,size:9});add('');lines.push({qr:v.code});
    add('Scan untuk login hotspot',{size:8});add('');add(v.code,{bold:true,size:20});add(sep('-',8),{size:8});
    add('BAYAR DI KASIR',{bold:true,size:10});add('Kode aktif setelah dibayar.',{size:8});add(sep('=',8),{size:8});
    // layout ulang (sama seperti struk): font mengecil bila perlu, jarak ikut ukuran
    const laid=[];
    for(const ln of lines){
      if(ln.qr){laid.push({qr:ln.qr,h:112});continue;}
      if(!ln.t){laid.push({t:'',size:ln.size,bold:ln.bold,align:ln.align,h:6});continue;}
      let size=ln.size||9;while(size>6&&textWidth(ln.t,size,ln.bold)>AVAIL)size-=0.5;
      const words=String(ln.t).split(/\s+/);let cur='';
      const flush=()=>{if(cur){laid.push({t:cur,size,bold:ln.bold,align:ln.align,h:Math.max(11,size*1.35)});cur='';}};
      for(const w of words){const trial=cur?cur+' '+w:w;
        if(textWidth(trial,size,ln.bold)<=AVAIL)cur=trial;
        else{flush();if(textWidth(w,size,ln.bold)>AVAIL){let s=size;while(s>6&&textWidth(w,s,ln.bold)>AVAIL)s-=0.5;laid.push({t:w,size:s,bold:ln.bold,align:ln.align,h:Math.max(11,s*1.35)});}else cur=w;}}
      flush();
    }
    const top=16,bottom=14,height=top+bottom+laid.reduce((s,l)=>s+l.h,0);
    let content='';let y=height-top;
    for(const ln of laid){
      if(ln.qr){try{const q=qrEncode(qrDataFor(ln.qr));const m=96/q.size,total=m*q.size,x0=(W-total)/2,top2=y;
        for(let my=0;my<q.size;my++)for(let mx=0;mx<q.size;mx++)if(q.modules[my][mx])
          content+=`${(x0+mx*m).toFixed(1)} ${(top2-(my+1)*m).toFixed(1)} ${m.toFixed(2)} ${m.toFixed(2)} re f\n`;}catch(e){}}
      else if(ln.t){const w=textWidth(ln.t,ln.size,ln.bold);const x=ln.align==='left'?M:(W-w)/2;
        content+=`BT /${ln.bold?'F2':'F1'} ${ln.size} Tf 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${pdfEscape(ln.t)}) Tj ET\n`;}
      y-=ln.h;
    }
    return {w:W,h:height,content};
  });
  return makePdf(pages);
}

async function shareReceipt(txn,isCopy){
 const blob=buildReceiptPDF(txn,{copy:isCopy});
 return shareFile(blob,`struk-${txn.number}${isCopy?'-salinan':''}.pdf`,'Struk Voucher WiFi');
}

/* ---------- Modal helpers ---------- */
function openModal(html){$('#sheet').innerHTML=html;$('#modal').classList.add('open');}
function closeModal(){$('#modal').classList.remove('open');}
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal();});
function toast(msg){openModal(`<h3>Info</h3><p style="line-height:1.6">${msg}</p><button class="btn btn-navy" onclick="document.querySelector('#modal').classList.remove('open')">OK</button>`);}
function confirmDlg(title,body,okLabel){return new Promise(res=>{openModal(`<h3>${esc(title)}</h3><p style="line-height:1.6">${body}</p><div style="display:flex;gap:8px"><button class="btn btn-red" id="cfOk" style="flex:1">${esc(okLabel||'Ya, lanjutkan')}</button><button class="btn btn-ghost" id="cfNo" style="flex:1">Batal</button></div>`);
 $('#cfOk').onclick=()=>{closeModal();res(true);};$('#cfNo').onclick=()=>{closeModal();res(false);};});}

/* ---------- Navigation ---------- */
function showPage(name){$$('.page').forEach(p=>p.classList.remove('active'));$('#page-'+name).classList.add('active');
 $$('#bottomNav button').forEach(b=>b.classList.toggle('on',b.dataset.page===name));
 if(name==='dashboard')renderDashboard(); if(name==='kasir')renderKasir(); if(name==='stok')renderStock();
 if(name==='riwayat')renderHistory(); if(name==='laporan')renderReport(); if(name==='pengaturan')renderSettings(); if(name==='member')renderMembers();
 window.scrollTo({top:0});}
$$('#bottomNav button').forEach(b=>b.onclick=()=>{bump();showPage(b.dataset.page);});
function bump(){lastActivity=Date.now();}
['click','input','touchstart'].forEach(ev=>document.addEventListener(ev,bump,{passive:true}));
setInterval(()=>{if(settings.autoLock&&!$('#lock').classList.contains('hidden'))return;
 if(settings.autoLock&&Date.now()-lastActivity>10*60*1000)lockApp();},30000);
function lockApp(){$('#lock').classList.remove('hidden');$('#pinInput').value='';$('#pinErr').textContent='';setTimeout(()=>$('#pinInput').focus(),100);}
$('#btnLock').onclick=()=>lockApp();
$('#btnUnlock').onclick=async()=>{const v=$('#pinInput').value.trim();if(await checkPin(v)){$('#lock').classList.add('hidden');bump();}else $('#pinErr').textContent='PIN salah. Coba lagi.';};
$('#pinInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('#btnUnlock').click();});

/* ---------- Dashboard ---------- */
async function loadAll(){const [v,t,c,m]=await Promise.all([getAll('vouchers'),getAll('transactions'),getAll('closures'),getAll('members')]);return {vouchers:v,transactions:t,closures:c,members:m||[]};}
function isDone(t){return t.status==='completed';}
async function renderDashboard(){
 const {vouchers,transactions}=await loadAll(); const tk=todayKey();
 const today=transactions.filter(t=>isDone(t)&&t.dateKey===tk);
 const sum=a=>a.reduce((s,x)=>s+txnTotal(x),0);
 const cash=today.filter(t=>t.method==='TUNAI'), qris=today.filter(t=>t.method==='QRIS');
 $('#dSales').textContent=rp(sum(today)); $('#dSalesSub').textContent=today.length+' transaksi';
 $('#dSold').textContent=today.length; $('#dCash').textContent=rp(sum(cash));
 $('#dQris').textContent=rp(sum(qris)); $('#dQrisInline').textContent=rp(sum(qris));
 const avail=vouchers.filter(v=>v.status==='available');
 $('#dStock').textContent=avail.length; $('#dStockSub').textContent=settings.packages.map(p=>p.label+': '+avail.filter(v=>v.package===p.id).length).join(' • ');
 const low=settings.packages.filter(p=>avail.filter(v=>v.package===p.id).length<=LOW_STOCK);
 $('#lowStockBox').innerHTML=low.length?`<div class="warn">⚠️ <b>Stok menipis:</b> ${low.map(p=>esc(p.name)+' tersisa '+avail.filter(v=>v.package===p.id).length).join(', ')}. Segera import CSV di menu Stok.</div>`:'';
 // best seller 7 days
 const d7=new Date(); d7.setDate(d7.getDate()-6); const k7=todayKey(d7);
 const recent=transactions.filter(t=>isDone(t)&&t.dateKey>=k7);
 const cnt={}; recent.forEach(t=>cnt[t.package]=(cnt[t.package]||0)+1);
 const best=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];
 $('#dBest').textContent=best?pkgById(best[0]).name:'—'; $('#dBestSub').textContent=best?best[1]+' terjual • 7 hari terakhir':'Belum ada penjualan';
 // chart 7 days
 const cv=$('#chart7'), ctx=cv.getContext('2d'); ctx.clearRect(0,0,cv.width,cv.height);
 const days=[]; for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push({k:todayKey(d),label:d.toLocaleDateString('id-ID',{weekday:'short'}),val:sum(transactions.filter(t=>isDone(t)&&t.dateKey===todayKey(d)))});}
 const max=Math.max(...days.map(d=>d.val),1); const bw=cv.width/7;
 ctx.font='11px sans-serif'; ctx.textAlign='center';
 days.forEach((d,i)=>{const h=(d.val/max)*120; ctx.fillStyle='#d4a017'; ctx.fillRect(i*bw+14,150-h,bw-28,h);
  ctx.fillStyle='#0b2a5b'; ctx.fillText(d.label,i*bw+bw/2,168); ctx.fillStyle='#64748b';
  if(d.val>0)ctx.fillText(d.val>=1000?(d.val/1000).toFixed(0)+'rb':String(d.val),i*bw+bw/2,140-h);});
 $('#recentTx').innerHTML=transactions.filter(isDone).sort((a,b)=>b.ts-a.ts).slice(0,5).map(txRow).join('')||'<p class="muted">Belum ada transaksi.</p>';
}
function txRow(t){return `<div class="txn"><div class="top"><span>${esc(t.number)}</span><span>${rp(txnTotal(t))}${t.discount>0?` <span class="muted" style="font-weight:400">diskon ${rp(t.discount)}</span>`:''}</span></div>
 <div class="muted">${fmtDT(t.ts)} • ${esc(t.packageName)} • ${esc(t.customer||'—')}</div>
 <div style="margin-top:6px"><span class="code">${esc(t.code)}</span> <span class="badge ${t.method==='QRIS'?'b-qris':'b-cash'}">${t.method}</span> ${t.status==='cancelled'?'<span class="badge b-cancel">DIBATALKAN</span>':'<span class="badge b-done">SELESAI</span>'}</div></div>`;}

/* ---------- Kasir ---------- */
async function renderKasir(){
 const {vouchers}=await loadAll(); const avail=vouchers.filter(v=>v.status==='available');
 $('#pkgList').innerHTML=settings.packages.map(p=>{const n=avail.filter(v=>v.package===p.id).length;
  return `<div class="pkg ${selPkg===p.id?'sel':''}" data-pkg="${p.id}"><div class="t"><b>${esc(p.name)}</b><span class="price">${rp(p.price)}</span></div>
  <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center"><span class="muted">Stok tersedia: <b style="color:var(--navy)">${n}</b></span>
  <span class="badge ${n===0?'b-out':n<=LOW_STOCK?'b-low':'b-ok'}">${n===0?'HABIS':n<=LOW_STOCK?'MENIPIS':'TERSEDIA'}</span></div></div>`;}).join('');
 $$('#pkgList .pkg').forEach(el=>el.onclick=()=>{selPkg=el.dataset.pkg;renderKasir();updateSummary();});
 updateSummary(); renderQrisBox();
}
function renderQrisBox(){const img=$('#qrisImg');
 if(settings.qrisImage){img.src=settings.qrisImage;img.style.display='block';$('#qrisEmpty').style.display='none';}
 else{img.style.display='none';$('#qrisEmpty').style.display='block';}
 const pv=$('#qrisPreview'); if(settings.qrisImage){pv.src=settings.qrisImage;pv.style.display='block';}else pv.style.display='none';}
function currentPrice(){return selPkg?pkgById(selPkg).price:0;}
function currentPromo(){const inp=document.getElementById('promoCode');if(!inp||!inp.value.trim())return {promo:null,discount:0,reason:''};const promo=findPromo(inp.value);if(!promo)return {promo:null,discount:0,reason:'Kode promo tidak ditemukan.'};const r=promoDiscount(promo,selPkg,currentPrice());return {promo,discount:r.discount,reason:r.reason};}
function updateSummary(){
 const price=currentPrice(); const cp=currentPromo(); const total=Math.max(0,price-cp.discount);
 $('#cashTotal').textContent=rp(total); $('#qrisTotal').textContent=rp(total);
 const recv=Number($('#cashRecv').value)||0;
 $('#cashChange').textContent=rp(Math.max(0,recv-total));
 $('#cashWarn').textContent=(selMethod==='TUNAI'&&recv>0&&recv<total)?'⚠️ Uang diterima kurang dari total.':'';
 const pm=document.getElementById('promoMsg');
 if(pm)pm.textContent=cp.promo?(cp.discount>0?('✅ Promo '+cp.promo.code+': diskon '+rp(cp.discount)+' → total '+rp(total)):('⚠️ '+cp.reason)):'';}
$('#cashRecv').addEventListener('input',updateSummary);
const _pc=document.getElementById('promoCode'); if(_pc)_pc.addEventListener('input',updateSummary);
function setMethod(m){selMethod=m;$('#mCash').classList.toggle('sel',m==='TUNAI');$('#mQris').classList.toggle('sel',m==='QRIS');
 $('#cashBox').classList.toggle('hidden',m!=='TUNAI');$('#qrisBox').classList.toggle('hidden',m!=='QRIS');}
$('#mCash').onclick=()=>setMethod('TUNAI'); $('#mQris').onclick=()=>setMethod('QRIS');

$('#btnReview').onclick=async()=>{
 if(!selPkg)return toast('Pilih paket voucher dulu.');
 const price=currentPrice(); const {vouchers}=await loadAll();
 const avail=vouchers.filter(v=>v.package===selPkg&&v.status==='available');
 if(!avail.length)return toast('Stok paket ini habis. Import CSV dulu di menu Stok.');
 const cust=$('#custName').value.trim();
 const custWa=normWa($('#custWa').value);
 const specific=($('#specificCode').value||'').trim().toUpperCase();
 const cp=currentPromo();
 if(cp.promo&&cp.discount<=0)return toast(cp.reason||'Kode promo tidak berlaku.');
 if(document.getElementById('promoCode').value.trim()&&!cp.promo)return toast('Kode promo tidak ditemukan. Kosongkan bila tidak memakai promo.');
 const discount=cp.discount, total=Math.max(0,price-discount);
 if(specific){const hit=avail.find(v=>v.code===specific);
   if(!hit)return toast('Kode '+esc(specific)+' tidak tersedia untuk paket ini (sudah terjual / tidak ada). Kosongkan bila ingin kode otomatis.');}
 if(selMethod==='TUNAI'){const recv=Number($('#cashRecv').value)||0; if(recv<total)return toast('Uang diterima kurang dari total ('+rp(total)+'). Periksa lagi nominalnya.');}
 if(selMethod==='QRIS'&&!$('#qrisChecked').checked)return toast('Untuk QRIS: centang dulu pernyataan bahwa kamu sudah memeriksa pembayaran di aplikasi rekening/merchant.');
 const recv=Number($('#cashRecv').value)||0;
 const members=await getAll('members'); const member=memberForSale(members,cust,custWa,total);
 openModal(`<h3>Ringkasan Transaksi</h3>
 <div class="kv"><span>Paket</span><b>${esc(pkgById(selPkg).name)}</b></div>
 <div class="kv"><span>Harga</span><b>${rp(price)}</b></div>
 ${discount>0?`<div class="kv"><span>Diskon (${esc(cp.promo.code)})</span><b>−${rp(discount)}</b></div><div class="kv"><span>Total bayar</span><b>${rp(total)}</b></div>`:''}
 <div class="kv"><span>Pelanggan</span><b>${esc(cust||'—')}</b></div>
 ${custWa?`<div class="kv"><span>No. WA</span><b>${esc(custWa)}</b></div>`:''}
 ${member?`<div class="kv"><span>Member</span><b>${esc(member.name)} — stempel ${member.stamps-1}/5 → ${member.stamps}/5</b></div>`:''}
 <div class="kv"><span>Metode</span><b>${selMethod}</b></div>
 ${specific?`<div class="kv"><span>Kode voucher</span><b>${esc(specific)} (dari struk cetak massal)</b></div>`:`<div class="kv"><span>Kode voucher</span><b>Otomatis (stok terlama)</b></div>`}
 ${selMethod==='TUNAI'?`<div class="kv"><span>Uang diterima</span><b>${rp(recv)}</b></div><div class="kv"><span>Kembalian</span><b>${rp(recv-total)}</b></div>`:''}
 ${selMethod==='QRIS'?`<p class="muted">QRIS manual — pembayaran sudah diperiksa kasir di aplikasi rekening/merchant. Tidak ada verifikasi otomatis.</p>`:''}
 <p class="muted">Stok baru berkurang setelah kamu menekan Konfirmasi. Satu kode voucher hanya terjual sekali.</p>
 <button class="btn btn-gold" id="btnConfirmPay">✅ Konfirmasi Pembayaran</button>
 <div style="height:8px"></div><button class="btn btn-ghost" onclick="document.querySelector('#modal').classList.remove('open')">Kembali</button>`);
 $('#btnConfirmPay').onclick=()=>doSell(cust,recv,specific,custWa,cp.promo,discount);
};

async function doSell(cust,recv,specific,custWa,promo,discount){
 const price=currentPrice(); const pkg=selPkg; discount=discount||0; const total=Math.max(0,price-discount);
 const members=await getAll('members'); const member=memberForSale(members,cust,custWa,total);
 try{
  const db=await openDB();
  const txn=await new Promise((resolve,reject)=>{
   const t=db.transaction(['vouchers','transactions','members'],'readwrite');
   const vs=t.objectStore('vouchers'), ts=t.objectStore('transactions'), ms=t.objectStore('members');
   const finish=(v)=>{
     const now=Date.now();
     const number='TRX-'+todayKey().replaceAll('-','')+'-'+String(now).slice(-6);
     const rec={id:uid(),number,ts:now,dateKey:todayKey(),customer:cust||'',customerWa:custWa||'',package:pkg,packageName:pkgById(pkg).name,price,discount,promoCode:promo?promo.code:'',total,memberId:member?member.id:'',code:v.code,method:selMethod,cashReceived:selMethod==='TUNAI'?recv:total,change:selMethod==='TUNAI'?recv-total:0,status:'completed'};
     v.status='sold'; v.soldAt=now; v.txnId=rec.id;
     vs.put(v); ts.put(rec); if(member)ms.put(member);
     t.oncomplete=()=>resolve(rec); t.onerror=()=>reject(t.error);
   };
   if(specific){
     const gr=vs.get(specific);
     gr.onsuccess=()=>{const v=gr.result;
       if(!v||v.status!=='available'||v.package!==pkg){t.abort();reject(new Error('KODE_TIDAK_TERSEDIA'));return;}
       finish(v);};
     gr.onerror=()=>reject(gr.error);
   } else {
     const idx=vs.index('byPackageStatus'); const req=idx.getAll([pkg,'available']);
     req.onsuccess=()=>{
       const list=(req.result||[]).sort((a,b)=>a.createdAt-b.createdAt);
       if(!list.length){t.abort();reject(new Error('STOK_HABIS'));return;}
       finish(list[0]);};
     req.onerror=()=>reject(req.error);
   }});
  currentTxn=txn; closeModal();
  if(promo){promo.used=(promo.used||0)+1;saveSettings();}
  $('#custName').value=''; $('#cashRecv').value=''; $('#qrisChecked').checked=false; $('#specificCode').value=''; const cw=document.getElementById('custWa'); if(cw)cw.value=''; const pc=document.getElementById('promoCode'); if(pc)pc.value=''; updateSummary();
  showReceipt(txn,false);
 }catch(e){
  closeModal();
  if(e&&e.message==='STOK_HABIS')toast('Stok paket ini baru saja habis. Import CSV dulu.');
  else if(e&&e.message==='KODE_TIDAK_TERSEDIA')toast('Kode yang diminta sudah tidak tersedia. Pilih kode lain atau kosongkan untuk kode otomatis.');
  else toast('Transaksi gagal disimpan. Coba lagi. ('+esc(e.message||e)+')');
 }
}
function receiptHTML(txn,isCopy){
 return `<div class="receipt"><div style="font-weight:900">${esc(settings.shopName.toUpperCase())}</div>
 <div style="font-size:12px">${esc(settings.wifiName)}</div><div>================================</div>
 <b>BUKTI PEMBELIAN VOUCHER WIFI</b>${isCopy?'<div><b>*** SALINAN ***</b></div>':''}
 <div style="font-size:13px;margin-top:8px">No. Transaksi<br><b>${esc(txn.number)}</b><br>${fmtDT(txn.ts)}</div>
 <div style="text-align:left;margin-top:10px;font-size:14px">Paket: ${esc(txn.packageName)}<br>Harga: ${rp(txn.price)}${txn.discount>0?`<br>Diskon (${esc(txn.promoCode||'')}): -${rp(txn.discount)}<br>Total: ${rp(txnTotal(txn))}`:''}${txn.method==='GRATIS'?`<br>GRATIS — Tukar 5 Stempel Member`:''}<br>Metode: ${txn.method}${txn.method==='TUNAI'?`<br>Tunai: ${rp(txn.cashReceived)}<br>Kembalian: ${rp(txn.change)}`:''}${txn.customer?`<br>Pelanggan: ${esc(txn.customer)}`:''}</div>
 <div>--------------------------------</div><div><b>KODE VOUCHER WIFI</b></div>
 <div class="big">${esc(txn.code)}</div>
 <div style="text-align:center;margin:6px 0 2px"><canvas class="qrCanvas" width="132" height="132" style="width:132px;height:132px"></canvas><div style="font-size:12px">Scan untuk login hotspot</div></div>
 <div>--------------------------------</div>
 <div style="font-size:13px">Terima kasih telah membeli<br>voucher WiFi di ${esc(settings.shopName)}.<br>Selamat menikmati internet!</div>
 <div>================================</div></div>`;
}
function showReceipt(txn,isCopy){
 openModal(`<h3>✅ Transaksi Berhasil</h3>${receiptHTML(txn,isCopy)}
 <div style="height:12px"></div>
 <button class="btn btn-gold" id="btnPrint">🖨️ CETAK STRUK (Thermer)</button>
 <div style="height:8px"></div>
 <button class="btn btn-green" id="btnWa">💬 Kirim via WhatsApp</button>
 <div style="height:8px"></div>
 <button class="btn btn-ghost" id="btnDlPdf">⬇ Unduh PDF 58mm</button>
 <div style="height:8px"></div>
 <button class="btn btn-navy" id="btnDone">Selesai — Kasir Baru</button>
 <p class="muted" style="margin-top:10px">QR di struk membuka halaman login hotspot bila alamatnya sudah diisi di Pengaturan; bila belum, QR berisi kode voucher saja. Cetak: tekan CETAK STRUK → pilih <b>Share…</b> di iPhone → pilih <b>Thermer</b> → kirim ke printer VSC MP-58C. Jika menu Share tidak muncul, pakai tombol Unduh PDF lalu buka PDF dan Share ke Thermer.</p>`);
 $$('.qrCanvas').forEach(c=>drawQRCanvas(c,qrDataFor(txn.code)));
 $('#btnWa').onclick=()=>{window.open(waLinkFor(txn),'_blank');};
 $('#btnPrint').onclick=async()=>{const r=await shareReceipt(txn,isCopy); if(r==='downloaded')toast('Menu Share tidak tersedia di browser ini, PDF sudah diunduh. Buka PDF lalu Share ke Thermer.');};
 $('#btnDlPdf').onclick=()=>{const b=buildReceiptPDF(txn,{copy:isCopy});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`struk-${txn.number}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(u),5000);};
 $('#btnDone').onclick=()=>{closeModal();renderKasir();renderDashboard();};
}

/* ---------- Stok ---------- */
function fillPkgSelects(){
 $('#impPkg').innerHTML=settings.packages.map(p=>`<option value="${p.id}">${esc(p.name)} — ${rp(p.price)}</option>`).join('');
 $('#stockFilter').innerHTML='<option value="">Semua paket</option>'+settings.packages.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
 const opts=settings.packages.map(p=>`<option value="${p.id}">${esc(p.name)} — ${rp(p.price)}</option>`).join('');
 ['bulkPkg','genPkg','expPkg'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=opts;});
 const po=document.getElementById('promoPkg'); if(po)po.innerHTML='<option value="all">Semua paket</option>'+opts;
 $('#priceForm').innerHTML=settings.packages.map(p=>`<label>${esc(p.name)} (Rp)</label><input type="number" min="0" step="500" data-price="${p.id}" value="${p.price}">`).join('');
}
async function renderStock(){
 const {vouchers}=await loadAll();
 const counts=id=>({avail:vouchers.filter(v=>v.package===id&&v.status==='available').length,sold:vouchers.filter(v=>v.package===id&&v.status==='sold').length,quar:vouchers.filter(v=>v.package===id&&v.status==='quarantined').length});
 $('#stockSummary').innerHTML='<div class="tblwrap"><table><tr><th>Paket</th><th>Tersedia</th><th>Terjual</th><th>Karantina</th></tr>'+
  settings.packages.map(p=>{const c=counts(p.id);return `<tr><td>${esc(p.name)}</td><td><b>${c.avail}</b></td><td>${c.sold}</td><td>${c.quar}</td></tr>`;}).join('')+'</table></div>';
 const q=($('#stockSearch').value||'').toLowerCase(), f=$('#stockFilter').value;
 const list=vouchers.filter(v=>v.status==='available'&&(!f||v.package===f)&&(!q||v.code.toLowerCase().includes(q))).sort((a,b)=>a.createdAt-b.createdAt).slice(0,200);
 $('#stockList').innerHTML=list.map(v=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)"><span class="code">${esc(v.code)}</span><span class="muted" style="text-align:right">${esc(pkgById(v.package).name)}${v.profile?'<br>'+esc(v.profile):''}</span></div>`).join('')||'<p class="muted">Tidak ada stok tersedia untuk filter ini.</p>';
}
$('#stockSearch').addEventListener('input',renderStock); $('#stockFilter').addEventListener('change',renderStock);
$('#impFile').addEventListener('change',async e=>{
 const file=e.target.files[0]; if(!file)return;
 const {rows,profile,timeLimit}=parseVoucherCSV(await file.text());
 if(!rows.length){$('#impResult').textContent='File tidak terbaca: tidak ada kolom Username / kode.';return;}
 const det=detectPackage(profile,timeLimit);
 if(det){$('#impPkg').value=det;
  $('#impResult').textContent=`File terbaca: ${rows.length} kode • Profile: ${profile||'-'} (${timeLimit||'-'}) • Terdeteksi: ${pkgById(det).name}. Periksa dulu — kalau salah, ganti paket di atas, lalu klik Import CSV.`;}
 else $('#impResult').textContent=`File terbaca: ${rows.length} kode • Profile: ${profile||'-'} (${timeLimit||'-'}) • Paket tidak terdeteksi dari Profile, pilih paket di atas lalu klik Import CSV.`;
});
$('#btnImport').onclick=async()=>{
 const file=$('#impFile').files[0]; if(!file)return toast('Pilih file CSV dulu.');
 const text=await file.text(); const {rows}=parseVoucherCSV(text);
 if(!rows.length)return toast('Tidak ada kode voucher yang terbaca. Pastikan ada kolom Username di CSV.');
 const pkg=$('#impPkg').value; const {vouchers}=await loadAll();
 const existing=new Set(vouchers.map(v=>v.code)); const seen=new Set(); let dup=0; const fresh=[];
 rows.forEach(r=>{if(existing.has(r.code)||seen.has(r.code))dup++;else{seen.add(r.code);fresh.push({code:r.code,package:pkg,profile:r.profile||'',timeLimit:r.timeLimit||'',status:'available',createdAt:Date.now()});}});
 if(fresh.length)await putAll('vouchers',fresh);
 $('#impResult').textContent=`Import selesai — ${fresh.length} berhasil, ${dup} duplikat dilewati, total dibaca ${rows.length} (paket: ${pkgById(pkg).name}). Password tidak disimpan.`;
 $('#impFile').value=''; renderStock(); renderDashboard();
};
$('#btnSampleCsv').onclick=()=>{
 const csv='Username,Password,Profile,Time Limit,Data Limit,Comment\r\nABC1234,ABC1234,voucher-6-jam-2000,6h,,vc-contoh\r\nDEF5678,DEF5678,voucher-6-jam-2000,6h,,vc-contoh\r\nGHI9012,GHI9012,voucher-6-jam-2000,6h,,vc-contoh\r\n';
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='contoh-voucher.csv';a.click();};
$('#btnDemoStock').onclick=async()=>{
 const ok=await confirmDlg('Muat stok contoh?','Akan menambah 5 kode contoh per paket (total 20 kode DEMO-…). Kode contoh hanya untuk latihan, jangan dipakai untuk pelanggan sungguhan.','Ya, muat demo');
 if(!ok)return; const {vouchers}=await loadAll(); const ex=new Set(vouchers.map(v=>v.code)); const items=[];
 settings.packages.forEach(p=>{for(let i=1;i<=5;i++){const c=`DEMO-${p.id.toUpperCase()}-${String(i).padStart(3,'0')}`;if(!ex.has(c))items.push({code:c,package:p.id,status:'available',createdAt:Date.now()});}});
 await putAll('vouchers',items); toast(items.length+' kode contoh ditambahkan.'); renderStock();};

const GEN_PROFILE={'6jam':'voucher-6-jam','1hari':'voucher-1-hari','7hari':'voucher-7-hari','30hari':'voucher-30-hari'};
const GEN_TIMELIMIT={'6jam':'6h','1hari':'24h','7hari':'7d','30hari':'30d'};
/* --- Batch 1: Cetak massal --- */
$('#btnBulkPdf').onclick=async()=>{
 const pkg=$('#bulkPkg').value; const qty=Math.max(1,Math.min(50,Number($('#bulkQty').value)||10));
 const {vouchers}=await loadAll();
 const items=vouchers.filter(v=>v.package===pkg&&v.status==='available').sort((a,b)=>a.createdAt-b.createdAt).slice(0,qty);
 if(!items.length)return toast('Tidak ada stok tersedia untuk paket ini. Import CSV atau buat voucher otomatis dulu.');
 if(items.length<qty)toast(`Stok hanya tersisa ${items.length} — dicetak ${items.length} saja.`);
 const blob=buildBulkPDF(items);
 const r=await shareFile(blob,`cetak-massal-${pkg}-${items.length}-voucher.pdf`,'Cetak Massal Voucher');
 if(r==='downloaded')toast('Menu Share tidak tersedia, PDF cetak massal sudah diunduh.');
 items.forEach(v=>{v.printedAt=Date.now();v.printedCount=(v.printedCount||0)+1;});
 await putAll('vouchers',items); renderStock();
};
/* --- Batch 1: Buat voucher otomatis --- */
$('#btnGenerate').onclick=async()=>{
 const pkg=$('#genPkg').value; const qty=Math.max(1,Math.min(100,Number($('#genQty').value)||20));
 const len=Math.max(5,Math.min(12,Number($('#genLen').value)||7));
 const prefix=($('#genPrefix').value||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);
 const {vouchers}=await loadAll(); const ex=new Set(vouchers.map(v=>v.code));
 const chars='ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // tanpa 0/O/1/I/L agar tidak salah baca saat diketik
 const rnd=n=>{const a=new Uint32Array(n);crypto.getRandomValues(a);return a;};
 const items=[]; let tries=0;
 while(items.length<qty&&tries<qty*20){tries++;
   let code=prefix; const r=rnd(len-prefix.length);
   for(let i=0;i<len-prefix.length;i++)code+=chars[r[i]%chars.length];
   if(ex.has(code))continue; ex.add(code);
   items.push({code,package:pkg,profile:GEN_PROFILE[pkg]||'',timeLimit:GEN_TIMELIMIT[pkg]||'',status:'available',createdAt:Date.now(),generated:true});}
 if(items.length)await putAll('vouchers',items);
 toast(`${items.length} kode ${pkgById(pkg).name} dibuat. PENTING: kode ini belum ada di MikroTik — ekspor CSV di bawah lalu import ke MikroTik/User Manager, baru bisa dipakai pelanggan.`);
 renderStock(); renderDashboard();
};
/* --- Batch 1: Ekspor CSV untuk MikroTik --- */
$('#btnExportMikrotik').onclick=async()=>{
 const pkg=$('#expPkg').value; const {vouchers}=await loadAll();
 const items=vouchers.filter(v=>v.package===pkg&&v.status==='available').sort((a,b)=>a.createdAt-b.createdAt);
 if(!items.length)return toast('Tidak ada stok tersedia untuk paket ini.');
 const head='Username,Password,Profile,Time Limit,Data Limit,Comment';
 const csv=[head].concat(items.map(v=>[v.code,v.code,v.profile||GEN_PROFILE[pkg]||'',v.timeLimit||GEN_TIMELIMIT[pkg]||'','',''].join(','))).join('\r\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`voucher-${pkg}-mikrotik.csv`;a.click();
 toast(`${items.length} kode diekspor. File ini berisi password (= kode) untuk import ke MikroTik — hanya untuk admin, jangan dibagikan ke pelanggan.`);
};

$('#btnCheck').onclick=()=>checkVoucherUI($('#checkCode').value);
$('#checkCode').addEventListener('keydown',e=>{if(e.key==='Enter')checkVoucherUI($('#checkCode').value);});

/* ---------- Member & Tukar Stempel ---------- */
function stampDots(n){let s='';for(let i=0;i<STAMPS_FOR_FREE;i++)s+=i<n?'●':'○';return s;}
async function renderMembers(){
 const {members}=await loadAll();
 const q=($('#memberSearch').value||'').toLowerCase();
 const list=(members||[]).filter(m=>!q||(m.name||'').toLowerCase().includes(q)||(m.wa||'').includes(q)).sort((a,b)=>(b.totalSpent||0)-(a.totalSpent||0));
 const can=list.filter(canRedeem).length;
 $('#memberSummary').innerHTML=`<div class="kv"><span>Total member</span><b>${(members||[]).length}</b></div><div class="kv"><span>Bisa tukar gratis</span><b>${can} member</b></div>`;
 $('#memberList').innerHTML=list.map(m=>`<div class="txn"><div class="top"><span>${esc(m.name||'—')}</span><span>${esc(m.wa||'')}</span></div>
  <div style="font-size:20px;letter-spacing:3px;margin:6px 0">${stampDots(m.stamps||0)} <span class="muted" style="font-size:13px;letter-spacing:0">${m.stamps||0}/5 stempel</span></div>
  <div class="muted">${m.totalTxns||0} transaksi • total belanja ${rp(m.totalSpent||0)}${m.updatedAt?' • terakhir '+fmtDT(m.updatedAt):''}</div>
  <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
  <button class="btn btn-gold btn-sm" data-redeem="${m.id}" ${canRedeem(m)?'':'disabled'}>🎁 Tukar 5 Stempel → Mabar Gratis</button>
  <button class="btn btn-ghost btn-sm" data-sellto="${m.id}">🧾 Jual ke Member</button></div></div>`).join('')||'<p class="muted">Belum ada member. Member tercatat otomatis saat pelanggan membeli dengan nama / nomor WA.</p>';
 $$('#memberList [data-redeem]').forEach(b=>b.onclick=()=>redeemStamps(b.dataset.redeem));
 $$('#memberList [data-sellto]').forEach(b=>b.onclick=async()=>{const {members}=await loadAll();const m=members.find(x=>x.id===b.dataset.sellto);if(!m)return;$('#custName').value=m.name||'';const cw=document.getElementById('custWa');if(cw)cw.value=m.wa||'';showPage('kasir');toast('Kasir diisi untuk member '+esc(m.name||'')+'. Pilih paket lalu lanjut ke ringkasan.');});
}
$('#memberSearch').addEventListener('input',renderMembers);
async function redeemStamps(memberId){
 const {members,vouchers}=await loadAll(); const m=members.find(x=>x.id===memberId);
 if(!m||!canRedeem(m))return toast('Stempel member belum cukup (butuh 5).');
 const avail=vouchers.filter(v=>v.package===FREE_PKG&&v.status==='available').sort((a,b)=>a.createdAt-b.createdAt);
 if(!avail.length)return toast('Stok Paket Mabar habis — tidak bisa tukar sekarang. Import CSV dulu.');
 const ok=await confirmDlg('Tukar 5 stempel?',`${esc(m.name||'')} menukar 5 stempel dengan 1 <b>Paket Mabar (6 Jam) gratis</b> (kode ${esc(avail[0].code)}). Stempel kembali ke ${m.stamps-5}/5.`,'Ya, tukar');
 if(!ok)return;
 const v=avail[0]; const now=Date.now();
 const rec={id:uid(),number:'TRX-'+todayKey().replaceAll('-','')+'-'+String(now).slice(-6),ts:now,dateKey:todayKey(),customer:m.name||'',customerWa:m.wa||'',package:FREE_PKG,packageName:pkgById(FREE_PKG).name,price:0,discount:0,promoCode:'TUKAR-5-STEMPEL',total:0,memberId:m.id,code:v.code,method:'GRATIS',cashReceived:0,change:0,status:'completed'};
 const db=await openDB(); const tr=db.transaction(['vouchers','transactions','members'],'readwrite');
 v.status='sold'; v.soldAt=now; v.txnId=rec.id; tr.objectStore('vouchers').put(v); tr.objectStore('transactions').put(rec);
 m.stamps=(m.stamps||0)-STAMPS_FOR_FREE; m.totalTxns=(m.totalTxns||0)+1; m.updatedAt=now; tr.objectStore('members').put(m);
 await txDone(tr); renderMembers(); renderDashboard(); showReceipt(rec,false);
}

/* ---------- Riwayat & Pembatalan ---------- */
async function renderHistory(){
 const {transactions}=await loadAll();
 const q=($('#txSearch').value||'').toLowerCase(), d=$('#txDate').value, m=$('#txMethod').value;
 const list=transactions.filter(t=>(!q||t.number.toLowerCase().includes(q)||t.code.toLowerCase().includes(q))&&(!d||t.dateKey===d)&&(!m||t.method===m)).sort((a,b)=>b.ts-a.ts);
 $('#txList').innerHTML=list.map(t=>`<div class="txn"><div class="top"><span>${esc(t.number)}</span><span>${rp(txnTotal(t))}${t.discount>0?` <span class="muted" style="font-weight:400">diskon ${rp(t.discount)}</span>`:''}</span></div>
  <div class="muted">${fmtDT(t.ts)} • ${esc(t.packageName)} • ${esc(t.customer||'—')}</div>
  <div style="margin:6px 0"><span class="code">${esc(t.code)}</span> <span class="badge ${t.method==='QRIS'?'b-qris':'b-cash'}">${t.method}</span> ${t.status==='cancelled'?'<span class="badge b-cancel">DIBATALKAN</span>':'<span class="badge b-done">SELESAI</span>'}</div>
  ${t.status==='cancelled'?`<div class="muted">Alasan: ${esc(t.cancelReason||'—')} • ${t.cancelAt?fmtDT(t.cancelAt):''}</div>`:''}
  <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
  <button class="btn btn-ghost btn-sm" data-reprint="${t.id}">🖨️ Cetak Ulang (SALINAN)</button>
  <button class="btn btn-green btn-sm" data-wa="${t.id}">💬 WA</button>
  ${t.status==='completed'?`<button class="btn btn-red btn-sm" data-cancel="${t.id}">Batalkan…</button>`:''}</div></div>`).join('')||'<p class="muted">Tidak ada transaksi untuk filter ini.</p>';
 $$('#txList [data-reprint]').forEach(b=>b.onclick=async()=>{const {transactions}=await loadAll();const t=transactions.find(x=>x.id===b.dataset.reprint);if(t)showReceipt(t,true);});
 $$('#txList [data-wa]').forEach(b=>b.onclick=async()=>{const {transactions}=await loadAll();const t=transactions.find(x=>x.id===b.dataset.wa);if(t)window.open(waLinkFor(t),'_blank');});
 $$('#txList [data-cancel]').forEach(b=>b.onclick=()=>cancelTxn(b.dataset.cancel));
}
$('#txSearch').addEventListener('input',renderHistory); $('#txDate').addEventListener('change',renderHistory); $('#txMethod').addEventListener('change',renderHistory);
$('#btnTxClear').onclick=()=>{$('#txSearch').value='';$('#txDate').value='';$('#txMethod').value='';renderHistory();};
$('#btnTxCsv').onclick=async()=>{const {transactions}=await loadAll();downloadCSV(transactions,'laporan-transaksi.csv');};
function downloadCSV(rows,filename){
 const head=['No Transaksi','Tanggal','Pelanggan','Paket','Kode Voucher','Harga','Diskon','Total Bayar','Metode','Status','Alasan Batal'];
 const escC=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const csv=[head.join(',')].concat(rows.map(t=>[t.number,fmtDT(t.ts),t.customer,t.packageName,t.code,t.price,t.discount||0,txnTotal(t),t.method,t.status,t.cancelReason||''].map(escC).join(','))).join('\r\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=filename;a.click();};
async function cancelTxn(id){
 const {transactions}=await loadAll(); const t=transactions.find(x=>x.id===id); if(!t)return;
 openModal(`<h3>Batalkan Transaksi ${esc(t.number)}?</h3>
 <p style="line-height:1.6">Kode <b>${esc(t.code)}</b> akan masuk <b>KARANTINA</b> dan <b>tidak</b> kembali ke stok tersedia. Transaksi tidak dihapus dari database.</p>
 <label>Alasan pembatalan (wajib)</label><textarea id="cancelReason" rows="3" placeholder="Contoh: pelanggan salah paket"></textarea>
 <div style="height:10px"></div><button class="btn btn-red" id="btnDoCancel">Ya, Batalkan Transaksi</button>
 <div style="height:8px"></div><button class="btn btn-ghost" onclick="document.querySelector('#modal').classList.remove('open')">Kembali</button>`);
 $('#btnDoCancel').onclick=async()=>{
  const reason=$('#cancelReason').value.trim(); if(!reason)return toast('Alasan pembatalan wajib diisi.');
  const db=await openDB(); const tr=db.transaction(['vouchers','transactions'],'readwrite');
  const vs=tr.objectStore('vouchers'), ts=tr.objectStore('transactions');
  const vg=vs.get(t.code); vg.onsuccess=()=>{if(vg.result){vg.result.status='quarantined';vg.result.quarantinedAt=Date.now();vs.put(vg.result);}};
  t.status='cancelled'; t.cancelReason=reason; t.cancelAt=Date.now(); ts.put(t);
  await txDone(tr);
  if(t.memberId){const ms=await getAll('members');const m=ms.find(x=>x.id===t.memberId);
   if(m){if(t.method==='GRATIS'){m.stamps=(m.stamps||0)+STAMPS_FOR_FREE;}else{m.stamps=Math.max(0,(m.stamps||0)-1);m.totalTxns=Math.max(0,(m.totalTxns||0)-1);m.totalSpent=Math.max(0,(m.totalSpent||0)-txnTotal(t));}m.updatedAt=Date.now();await putAll('members',[m]);}}
  if(t.promoCode){const pr=(settings.promos||[]).find(p=>p.code===t.promoCode);if(pr){pr.used=Math.max(0,(pr.used||0)-1);saveSettings();}}
  closeModal(); toast('Transaksi dibatalkan. Kode '+esc(t.code)+' masuk karantina.'); renderHistory(); renderDashboard();};
}

/* ---------- Batch 4: Statistik (logika murni, bisa dites) ---------- */
const WD_LABELS=['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
function computeStats(transactions,members,fromKey){
  const list=(transactions||[]).filter(t=>t.status==='completed'&&t.dateKey>=fromKey);
  const byHour=new Array(24).fill(0), byHourRev=new Array(24).fill(0), byWd=new Array(7).fill(0);
  let total=0, discount=0; const byPkg={}, byMethod={TUNAI:0,QRIS:0,GRATIS:0};
  for(const t of list){
    const d=new Date(t.ts); const h=d.getHours(); byHour[h]++; byHourRev[h]+=txnTotal(t);
    byWd[(d.getDay()+6)%7]++;
    total+=txnTotal(t); discount+=t.discount||0;
    byPkg[t.package]=(byPkg[t.package]||0)+1;
    if(byMethod[t.method]==null)byMethod[t.method]=0; byMethod[t.method]++;
  }
  const topHour=byHour.indexOf(Math.max(...byHour));
  const topDay=byWd.indexOf(Math.max(...byWd));
  const topPkg=Object.entries(byPkg).sort((a,b)=>b[1]-a[1])[0];
  const topMembers=(members||[]).slice().sort((a,b)=>(b.totalSpent||0)-(a.totalSpent||0)).slice(0,5);
  return {n:list.length,total,discount,avgPerDay:total/30,avgTxn:list.length?total/list.length:0,byHour,byHourRev,byWd,byPkg,byMethod,topHour,topDay,topPkg,topMembers};
}
async function renderStats(){
  const {transactions,members}=await loadAll();
  const d=new Date(); d.setDate(d.getDate()-29); const from=todayKey(d);
  const st=computeStats(transactions,members,from);
  $('#statsBody').innerHTML=`
   <div class="kv"><span>Total transaksi (30 hari)</span><b>${st.n}</b></div>
   <div class="kv"><span>Total penjualan</span><b>${rp(st.total)}</b></div>
   <div class="kv"><span>Rata-rata penjualan / hari</span><b>${rp(Math.round(st.avgPerDay))}</b></div>
   <div class="kv"><span>Rata-rata nilai transaksi</span><b>${rp(Math.round(st.avgTxn))}</b></div>
   <div class="kv"><span>Total diskon promo diberikan</span><b>${rp(st.discount)}</b></div>
   <div class="kv"><span>Metode</span><b>Tunai ${st.byMethod.TUNAI||0} • QRIS ${st.byMethod.QRIS||0} • Gratis ${st.byMethod.GRATIS||0}</b></div>
   <div class="kv"><span>Paket terlaris</span><b>${st.topPkg?esc(pkgById(st.topPkg[0]).name)+' ('+st.topPkg[1]+' terjual)':'—'}</b></div>
   <div class="kv"><span>Jam paling ramai</span><b>${st.n?String(st.topHour).padStart(2,'0')+':00–'+String((st.topHour+1)%24).padStart(2,'0')+':00 ('+st.byHour[st.topHour]+' transaksi)':'—'}</b></div>
   <div class="kv"><span>Hari paling ramai</span><b>${st.n?WD_LABELS[st.topDay]+' ('+st.byWd[st.topDay]+' transaksi)':'—'}</b></div>`;
  // grafik jam ramai
  const cv=$('#chartHour'), ctx=cv.getContext('2d'); ctx.clearRect(0,0,cv.width,cv.height);
  const max=Math.max(...st.byHour,1), bw=cv.width/24;
  ctx.font='10px sans-serif'; ctx.textAlign='center';
  st.byHour.forEach((v,i)=>{const h=(v/max)*120;
    ctx.fillStyle=i===st.topHour?'#d4a017':'#1458c4'; ctx.fillRect(i*bw+3,150-h,bw-6,h);
    if(i%3===0){ctx.fillStyle='#0b2a5b';ctx.fillText(String(i).padStart(2,'0'),i*bw+bw/2,168);}
    if(v>0){ctx.fillStyle='#64748b';ctx.fillText(String(v),i*bw+bw/2,140-h);}});
  $('#hourNote').textContent=st.n?`Puncak: ${String(st.topHour).padStart(2,'0')}:00–${String((st.topHour+1)%24).padStart(2,'0')}:00 dengan ${st.byHour[st.topHour]} transaksi dan ${rp(st.byHourRev[st.topHour])} penjualan. Pertimbangkan stok & promo di jam sepi.`:'Belum ada transaksi 30 hari terakhir.';
  // hari ramai (bar horizontal)
  const wmax=Math.max(...st.byWd,1);
  $('#weekdayBars').innerHTML=WD_LABELS.map((l,i)=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="width:64px;font-size:13px">${l}</span><div style="flex:1;background:#eef2f7;border-radius:999px;height:18px;overflow:hidden"><div style="height:100%;width:${Math.round(st.byWd[i]/wmax*100)}%;background:${i===st.topDay?'#d4a017':'#1458c4'}"></div></div><b style="width:34px;text-align:right;font-size:13px">${st.byWd[i]}</b></div>`).join('');
  // member terbaik
  $('#topMembers').innerHTML=st.topMembers.length?st.topMembers.map((m,i)=>`<div class="kv"><span>${i+1}. ${esc(m.name||'—')} (${m.totalTxns||0} transaksi)</span><b>${rp(m.totalSpent||0)}</b></div>`).join(''):'<p class="muted">Belum ada member.</p>';
}

/* ---------- Laporan & Tutup Kas ---------- */
let repPeriod='today';
$$('[data-per]').forEach(b=>b.onclick=()=>{repPeriod=b.dataset.per;renderReport();});
async function renderReport(){
 const {transactions,closures}=await loadAll();
 const now=new Date(); let from, label;
 if(repPeriod==='week'){const d=new Date();d.setDate(d.getDate()-6);from=todayKey(d);label='7 hari terakhir';}
 else if(repPeriod==='month'){from=todayKey().slice(0,7)+'-01';label='Bulan ini';}
 else{from=todayKey();label='Hari ini';}
 const list=transactions.filter(t=>t.status==='completed'&&t.dateKey>=from);
 const sum=a=>a.reduce((s,x)=>s+txnTotal(x),0);
 const cash=sum(list.filter(t=>t.method==='TUNAI')), qris=sum(list.filter(t=>t.method==='QRIS'));
 const byPkg=settings.packages.map(p=>({name:p.name,n:list.filter(t=>t.package===p.id).length,total:sum(list.filter(t=>t.package===p.id))}));
 renderStats();
 $('#repBody').innerHTML=`<p class="muted">Periode: <b>${label}</b> (${from} s.d. ${todayKey()})</p>
 <div class="kv"><span>Total transaksi</span><b>${list.length}</b></div>
 <div class="kv"><span>Voucher terjual</span><b>${list.length}</b></div>
 <div class="kv"><span>Total penjualan</span><b>${rp(sum(list))}</b></div>
 <div class="kv"><span>Tunai</span><b>${rp(cash)}</b></div>
 <div class="kv"><span>QRIS</span><b>${rp(qris)}</b></div>
 <h3 style="margin-top:14px">Per paket</h3>${byPkg.map(p=>`<div class="kv"><span>${esc(p.name)} (${p.n})</span><b>${rp(p.total)}</b></div>`).join('')}`;
 // tutup kas hari ini
 const tk=todayKey(); const today=list.filter(t=>t.dateKey===tk);
 const cCash=sum(today.filter(t=>t.method==='TUNAI')), cQris=sum(today.filter(t=>t.method==='QRIS'));
 $('#closeCash').textContent=rp(cCash); $('#closeQris').textContent=rp(cQris);
 const open=Number($('#closeOpen').value)||0, actual=Number($('#closeActual').value)||0;
 $('#closeExpected').textContent=rp(open+cCash); $('#closeDiff').textContent=rp(actual-(open+cCash));
 $('#closeList').innerHTML=closures.sort((a,b)=>b.ts-a.ts).slice(0,10).map(c=>`<div class="kv"><span>${fmtDT(c.ts)} — ${esc(c.note||'')}</span><b>${rp(c.actual)} (selisih ${rp(c.diff)})</b></div>`).join('')||'<p class="muted">Belum ada tutup kas.</p>';
}
['closeOpen','closeActual'].forEach(id=>$('#'+id).addEventListener('input',renderReport));
$('#btnClose').onclick=async()=>{
 const open=Number($('#closeOpen').value)||0, actual=Number($('#closeActual').value)||0;
 const {transactions}=await loadAll(); const tk=todayKey();
 const today=transactions.filter(t=>t.status==='completed'&&t.dateKey===tk);
 const cash=today.filter(t=>t.method==='TUNAI').reduce((s,x)=>s+txnTotal(x),0);
 const qris=today.filter(t=>t.method==='QRIS').reduce((s,x)=>s+txnTotal(x),0);
 const rec={id:uid(),ts:Date.now(),dateKey:tk,opening:open,cashTotal:cash,qrisTotal:qris,expected:open+cash,actual,diff:actual-(open+cash),note:$('#closeNote').value.trim()};
 await putAll('closures',[rec]); $('#closeMsg').textContent='Tutup kas disimpan. Selisih: '+rp(rec.diff)+'.'; renderReport();};
$('#btnRepCsv').onclick=async()=>{const {transactions}=await loadAll();downloadCSV(transactions.filter(t=>t.status==='completed'),'laporan-penjualan.csv');};

/* ---------- Pengaturan / Backup / Restore ---------- */
function renderPromos(){
 const list=settings.promos||[];
 $('#promoList').innerHTML=list.map((p,i)=>`<div class="kv"><span style="text-align:left"><b>${esc(p.code)}</b> — ${p.type==='pct'?p.value+'%':rp(p.value)} • ${p.packages==='all'?'semua paket':esc(pkgById(p.packages).name)}${p.expires?' • s.d. '+esc(p.expires):''} • dipakai ${p.used||0}${p.maxUses>0?'/'+p.maxUses:''} <span class="badge ${p.active?'b-ok':'b-cancel'}">${p.active?'AKTIF':'NONAKTIF'}</span></span><span style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-promo-toggle="${i}">${p.active?'Matikan':'Aktifkan'}</button> <button class="btn btn-red btn-sm" data-promo-del="${i}">Hapus</button></span></div>`).join('')||'<p class="muted">Belum ada kode promo.</p>';
 $$('#promoList [data-promo-toggle]').forEach(b=>b.onclick=()=>{const p=settings.promos[Number(b.dataset.promoToggle)];p.active=!p.active;saveSettings();renderPromos();});
 $$('#promoList [data-promo-del]').forEach(b=>b.onclick=()=>{settings.promos.splice(Number(b.dataset.promoDel),1);saveSettings();renderPromos();toast('Kode promo dihapus.');});
}
$('#btnPromoAdd').onclick=()=>{
 const code=($('#promoCodeIn').value||'').trim().toUpperCase();
 if(!/^[A-Z0-9]{3,20}$/.test(code))return toast('Kode promo harus 3–20 karakter huruf/angka.');
 if(findPromo(code))return toast('Kode promo sudah ada.');
 const type=$('#promoType').value, value=Number($('#promoValue').value)||0;
 if(type==='pct'&&(value<=0||value>100))return toast('Persen harus 1–100.');
 if(type==='rp'&&value<=0)return toast('Nilai potongan harus lebih dari 0.');
 const promo={code,type,value,packages:$('#promoPkg').value,active:true,expires:$('#promoExp').value||'',maxUses:Math.max(0,Number($('#promoMax').value)||0),used:0};
 settings.promos.push(promo); saveSettings(); renderPromos();
 $('#promoCodeIn').value='';$('#promoValue').value='';$('#promoExp').value='';$('#promoMax').value='';
 toast('Kode promo '+esc(code)+' ditambahkan.');
};
function renderSettings(){
 $('#setShop').value=settings.shopName; renderPromos(); $('#setWifi').value=settings.wifiName; $('#setWa').value=settings.wa||''; const hs=document.getElementById('setHotspot'); if(hs)hs.value=settings.hotspotUrl||'';
 $('#setAutoLock').checked=!!settings.autoLock; fillPkgSelects(); renderQrisBox();
 $('#hdrName').textContent='KASIR WIFI '+settings.shopName.toUpperCase(); $('#hdrWifi').textContent=settings.wifiName+' • Kasir Voucher WiFi';
}
$('#btnSaveShop').onclick=()=>{settings.shopName=$('#setShop').value.trim()||'WARUNG PAK DARUM';settings.wifiName=$('#setWifi').value.trim()||'@WIFI WARUNG PAK DARUM';settings.wa=$('#setWa').value.trim();const hs=document.getElementById('setHotspot');if(hs)settings.hotspotUrl=hs.value.trim();saveSettings();renderSettings();toast('Pengaturan warung disimpan.');};
$('#btnSavePrice').onclick=()=>{$$('[data-price]').forEach(inp=>{const p=settings.packages.find(x=>x.id===inp.dataset.price);if(p)p.price=Math.max(0,Number(inp.value)||0);});saveSettings();renderSettings();toast('Harga paket disimpan.');};
$('#setAutoLock').addEventListener('change',e=>{settings.autoLock=e.target.checked;saveSettings();});
$('#qrisFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;
 const dataUrl=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(f);});
 settings.qrisImage=dataUrl; saveSettings(); renderQrisBox(); toast('Gambar QRIS disimpan di perangkat ini.');});
$('#btnDelQris').onclick=()=>{settings.qrisImage='';saveSettings();renderQrisBox();toast('Gambar QRIS dihapus.');};
$('#btnSavePin').onclick=async()=>{
 const old=$('#pinOld').value.trim(), nw=$('#pinNew').value.trim();
 if(!(await checkPin(old)))return $('#pinMsg').textContent='PIN lama salah.';
 if(!/^\d{4,6}$/.test(nw))return $('#pinMsg').textContent='PIN baru harus 4–6 digit angka.';
 settings.pinHash=await pinHash(nw); saveSettings(); $('#pinOld').value='';$('#pinNew').value='';$('#pinMsg').textContent='PIN berhasil diganti.';};
$('#btnBackup').onclick=async()=>{
 const data={app:'kasir-wifi-pak-darum',version:2,exportedAt:new Date().toISOString(),settings,vouchers:await getAll('vouchers'),transactions:await getAll('transactions'),closures:await getAll('closures'),members:await getAll('members')};
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download='backup-kasir-wifi-'+todayKey()+'.json';a.click();};
$('#btnRestore').onclick=async()=>{
 const file=$('#restoreFile').files[0]; if(!file)return toast('Pilih file backup JSON dulu.');
 const ok=await confirmDlg('Restore data?','Semua data saat ini (transaksi, stok, tutup kas) akan <b>diganti</b> dengan isi file backup. Lanjutkan?','Ya, restore');
 if(!ok)return;
 try{const data=JSON.parse(await file.text());
  if(!Array.isArray(data.transactions)||!Array.isArray(data.vouchers))throw new Error('format');
  const db=await openDB(); for(const s of ['vouchers','transactions','closures','members']){const tr=db.transaction(s,'readwrite');tr.objectStore(s).clear();await txDone(tr);}
  if(data.vouchers.length)await putAll('vouchers',data.vouchers);
  if(data.transactions.length)await putAll('transactions',data.transactions);
  if(data.closures?.length)await putAll('closures',data.closures);
  if(data.members?.length)await putAll('members',data.members);
  if(data.settings){settings=Object.assign(settings,data.settings);saveSettings();}
  $('#restoreMsg').textContent='Restore berhasil: '+data.transactions.length+' transaksi, '+data.vouchers.length+' voucher.'; renderSettings(); renderDashboard();
 }catch(e){$('#restoreMsg').textContent='File backup tidak valid. Restore dibatalkan, data lama tetap aman.';}
};
$('#btnReset').onclick=async()=>{
 const ok=await confirmDlg('Reset semua data?','Ini menghapus <b>semua</b> transaksi, stok, dan tutup kas di perangkat ini. Tidak bisa dibatalkan. Backup dulu kalau masih perlu.','Ya, hapus semua');
 if(!ok)return;
 const db=await openDB(); for(const s of ['vouchers','transactions','closures','members']){const tr=db.transaction(s,'readwrite');tr.objectStore(s).clear();await txDone(tr);}
 toast('Semua data dihapus.'); renderDashboard(); renderStock();};

/* ---------- Init ---------- */
(async function init(){
 if(settings.pricelistVersion!==PRICELIST_VERSION){settings.packages=JSON.parse(JSON.stringify(DEFAULT_PACKAGES));settings.pricelistVersion=PRICELIST_VERSION;saveSettings();}
 if(!Array.isArray(settings.promos)){settings.promos=JSON.parse(JSON.stringify(DEFAULT_PROMOS));saveSettings();}
 fillPkgSelects(); renderSettings(); renderKasir(); renderDashboard();
 if('serviceWorker' in navigator){try{await navigator.serviceWorker.register('sw.js');}catch(e){/* offline cache opsional */}}
})();
