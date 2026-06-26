/* local-pdf-toolkit — app logic (loaded after pdf-lib & pdf.js by index.html bootstrap) */
const { PDFDocument, degrees, rgb } = PDFLib;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
function toast(msg, ms=2200){ const t=$('#toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),ms); }
function uid(){ return Math.random().toString(36).slice(2,9); }
function download(bytes, name){
  const blob = new Blob([bytes],{type:'application/pdf'});
  const url = URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),4000);
}

/* engine ready flag */
(function(){ const n=$('#net'); if(!n) return;
  if(window.PDFLib && window.pdfjsLib) n.innerHTML='엔진 <b>준비됨</b>';
  else n.textContent='엔진 로드 실패 — README의 lib 다운로드 확인'; })();

/* tabs */
$$('nav button').forEach(b=>b.addEventListener('click',()=>{
  $$('nav button').forEach(x=>x.setAttribute('aria-selected', x===b));
  $$('.panel').forEach(p=>p.toggleAttribute('data-active', p.id===b.dataset.tab));
}));

/* shared: wire a drop zone to a hidden file input */
function wireDrop(zoneSel, inputSel, onFiles, multi=true){
  const zone=$(zoneSel), input=$(inputSel);
  zone.addEventListener('click',()=>input.click());
  input.addEventListener('change',e=>{ if(e.target.files.length) onFiles([...e.target.files]); input.value=''; });
  ['dragenter','dragover'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add('over');}));
  ['dragleave','drop'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove('over');}));
  zone.addEventListener('drop',e=>{ const f=[...e.dataTransfer.files]; if(f.length) onFiles(multi?f:[f[0]]); });
}

/* generic HTML5 drag-sort over a container of .card elements */
function makeSortable(container, onReorder){
  let dragEl=null;
  container.addEventListener('dragstart',e=>{
    const c=e.target.closest('.card'); if(!c)return; dragEl=c; c.classList.add('dragging');
    e.dataTransfer.effectAllowed='move';
  });
  container.addEventListener('dragend',e=>{
    if(dragEl)dragEl.classList.remove('dragging'); dragEl=null;
    $$('.card.over',container).forEach(c=>c.classList.remove('over'));
  });
  container.addEventListener('dragover',e=>{
    e.preventDefault(); const c=e.target.closest('.card');
    $$('.card.over',container).forEach(x=>x.classList.remove('over'));
    if(c&&c!==dragEl)c.classList.add('over');
  });
  container.addEventListener('drop',e=>{
    e.preventDefault(); const c=e.target.closest('.card');
    if(c&&dragEl&&c!==dragEl){
      const cards=[...container.children];
      const from=cards.indexOf(dragEl), to=cards.indexOf(c);
      if(from<to)c.after(dragEl); else c.before(dragEl);
      onReorder([...container.children].map(x=>x.dataset.id));
    }
    $$('.card.over',container).forEach(x=>x.classList.remove('over'));
  });
}

/* =================================================================
   TAB 1 — IMAGES -> PDF
================================================================= */
const IMG = { items:[] }; // {id, file, url, type, name, w, h}

wireDrop('#img-drop','#img-input', addImages);
function readAsDataURL(file){ return new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(file);}); }
function loadDims(url){ return new Promise(r=>{const i=new Image();i.onload=()=>r({w:i.naturalWidth,h:i.naturalHeight});i.src=url;}); }

async function addImages(files){
  for(const f of files){
    if(!f.type.startsWith('image/')) continue;
    const url=await readAsDataURL(f); const d=await loadDims(url);
    IMG.items.push({id:uid(),file:f,url,type:f.type,name:f.name,w:d.w,h:d.h});
  }
  renderImg();
}
function renderImg(){
  const grid=$('#img-grid'); grid.innerHTML='';
  $('#img-controls').classList.toggle('hidden', IMG.items.length===0);
  $('#img-count').textContent=IMG.items.length+'장';
  $('#img-build').disabled = IMG.items.length===0;
  IMG.items.forEach((it,i)=>{
    const c=document.createElement('div'); c.className='card'; c.draggable=true; c.dataset.id=it.id;
    c.innerHTML=`<span class="idx">${i+1}</span>
      <img class="thumb" src="${it.url}" alt="">
      <div class="name" title="${it.name}">${it.name}</div>
      <div class="row"><button class="del">제거</button></div>`;
    c.querySelector('.del').addEventListener('click',e=>{e.stopPropagation();
      IMG.items=IMG.items.filter(x=>x.id!==it.id); renderImg();});
    grid.appendChild(c);
  });
}
makeSortable($('#img-grid'), ids=>{ IMG.items.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id)); renderImg(); });
$('#img-clear').addEventListener('click',()=>{IMG.items=[];renderImg();});
$('#img-size').addEventListener('change',e=>{
  $('#img-margin-field').style.display = e.target.value==='fit' ? 'none':'flex';
});

const PAGE_SIZES={a4p:[595.28,841.89],a4l:[841.89,595.28],letterp:[612,792]};
async function embedImage(pdf, it){
  if(it.type==='image/png') return pdf.embedPng(await it.file.arrayBuffer());
  if(it.type==='image/jpeg') return pdf.embedJpg(await it.file.arrayBuffer());
  // webp/gif/etc -> repaint to PNG via canvas
  const img=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=it.url;});
  const cv=document.createElement('canvas'); cv.width=img.naturalWidth; cv.height=img.naturalHeight;
  cv.getContext('2d').drawImage(img,0,0);
  const b64=cv.toDataURL('image/png').split(',')[1];
  return pdf.embedPng(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)));
}
$('#img-build').addEventListener('click',async()=>{
  const btn=$('#img-build'); btn.disabled=true; btn.textContent='만드는 중…';
  try{
    const pdf=await PDFDocument.create();
    const mode=$('#img-size').value;
    const margin=Math.max(0,+$('#img-margin').value||0);
    for(const it of IMG.items){
      const emb=await embedImage(pdf,it);
      let pw,ph;
      if(mode==='fit'){ pw=emb.width; ph=emb.height; }
      else { [pw,ph]=PAGE_SIZES[mode]; }
      const page=pdf.addPage([pw,ph]);
      if(mode==='fit'){ page.drawImage(emb,{x:0,y:0,width:pw,height:ph}); }
      else{
        const aw=pw-margin*2, ah=ph-margin*2;
        const s=Math.min(aw/emb.width, ah/emb.height);
        const w=emb.width*s, h=emb.height*s;
        page.drawImage(emb,{x:(pw-w)/2,y:(ph-h)/2,width:w,height:h});
      }
    }
    download(await pdf.save(),'images.pdf');
    toast('PDF 생성 완료 · '+IMG.items.length+'페이지');
  }catch(err){ console.error(err); toast('실패: '+err.message,3500); }
  btn.textContent='PDF 만들기'; btn.disabled=false;
});

/* =================================================================
   TAB 2 — SIGNATURE OVERLAY
================================================================= */
const SIGN = { pdfBytes:null, pdfDoc:null, sigs:[], activeSig:null, pages:[], stamps:[] };
// pages[i] = {scale, viewW, viewH, rotate, box(el)}
// stamps[] = {id, pageIndex, sigId, left, top, w, h, aspect, el}

wireDrop('#sign-drop','#sign-pdf-input', f=>loadSignPdf(f[0]), false);
$('#sig-add').addEventListener('click',()=>$('#sig-input').click());
$('#sig-input').addEventListener('change',async e=>{
  for(const f of [...e.target.files]){
    const origUrl=await readAsDataURL(f); const d=await loadDims(origUrl);
    const s={id:uid(),origUrl,type:f.type,name:f.name,aspect:d.w/d.h,
             hasAlpha:false,knockout:false,thresh:45,procUrl:null};
    s.hasAlpha=await imageHasAlpha(origUrl);
    s.knockout=!s.hasAlpha;                 // 흰 배경(불투명) 이미지는 기본 ON
    await processSig(s);
    SIGN.sigs.push(s);
  }
  e.target.value='';
  if(!SIGN.activeSig && SIGN.sigs.length) SIGN.activeSig=SIGN.sigs[0].id;
  renderSigList(); showSigOpts();
});
function activeSig(){ return SIGN.sigs.find(s=>s.id===SIGN.activeSig); }
function sigDisplayUrl(s){ return (s.knockout && s.procUrl) ? s.procUrl : s.origUrl; }

async function imageHasAlpha(url){
  const img=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=url;});
  const m=256, sc=Math.min(1,m/Math.max(img.naturalWidth,img.naturalHeight));
  const w=Math.max(1,img.naturalWidth*sc|0), h=Math.max(1,img.naturalHeight*sc|0);
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
  const ctx=cv.getContext('2d'); ctx.drawImage(img,0,0,w,h);
  const d=ctx.getImageData(0,0,w,h).data;
  for(let i=3;i<d.length;i+=4){ if(d[i]<245) return true; }
  return false;
}
async function processSig(s){
  const img=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=s.origUrl;});
  const W=img.naturalWidth, H=img.naturalHeight;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const ctx=cv.getContext('2d'); ctx.drawImage(img,0,0);
  const id=ctx.getImageData(0,0,W,H), p=id.data;

  // 1) 배경색 B : 네 모서리 패치에서 불투명 픽셀 평균
  let br=0,bg=0,bb=0,cnt=0;
  const patch=Math.max(2,Math.floor(Math.min(W,H)*0.06));
  for(const [cx,cy] of [[0,0],[W-1,0],[0,H-1],[W-1,H-1]]){
    for(let dy=0;dy<patch;dy++) for(let dx=0;dx<patch;dx++){
      const x=cx===0?dx:cx-dx, y=cy===0?dy:cy-dy;
      const i=(y*W+x)*4; if(p[i+3]<200) continue;
      br+=p[i];bg+=p[i+1];bb+=p[i+2];cnt++;
    }
  }
  if(cnt===0){ br=bg=bb=255; } else { br/=cnt;bg/=cnt;bb/=cnt; }

  // 2) 잉크색 F : 휘도 하위 3% 픽셀 평균 (가장 진한 잉크)
  const hist=new Uint32Array(256); let opaque=0;
  for(let i=0;i<p.length;i+=4){ if(p[i+3]<200) continue;
    const L=(p[i]*0.299+p[i+1]*0.587+p[i+2]*0.114)|0; hist[L]++; opaque++; }
  let target=Math.max(1,Math.floor(opaque*0.03)), acc=0, cut=0;
  for(let l=0;l<256;l++){ acc+=hist[l]; if(acc>=target){cut=l;break;} }
  let fr=0,fg=0,fb=0,cf=0;
  for(let i=0;i<p.length;i+=4){ if(p[i+3]<200) continue;
    const L=(p[i]*0.299+p[i+1]*0.587+p[i+2]*0.114)|0;
    if(L<=cut){ fr+=p[i];fg+=p[i+1];fb+=p[i+2];cf++; } }
  if(cf){ fr/=cf;fg/=cf;fb/=cf; } else { fr=fg=fb=30; }

  // 3) 매팅: 픽셀을 B→F 직선에 투영해 혼합비 α 역산, 색은 순수 F로
  const dx=fr-br, dy=fg-bg, db=fb-bb;
  let len2=dx*dx+dy*dy+db*db; if(len2<1) len2=1;
  const floor=(s.thresh/120)*0.45;            // 민감도: 옅은 배경 제거 강도
  const Fr=Math.round(fr), Fg=Math.round(fg), Fb=Math.round(fb);
  for(let i=0;i<p.length;i+=4){
    if(p[i+3]===0) continue;
    let t=((p[i]-br)*dx+(p[i+1]-bg)*dy+(p[i+2]-bb)*db)/len2; // 0=배경 ~ 1=잉크
    t=t<0?0:t>1?1:t;
    let a=(t-floor)/(1-floor); a=a<0?0:a>1?1:a;
    a=a*a*(3-2*a);                              // smoothstep → 가장자리 또렷
    p[i]=Fr; p[i+1]=Fg; p[i+2]=Fb;             // 순수 잉크색 (회색 테두리 제거)
    const A=Math.round(a*255); if(A<p[i+3]) p[i+3]=A;
  }
  ctx.putImageData(id,0,0);
  s.procUrl=cv.toDataURL('image/png');
}
function refreshSig(s){
  renderSigList();
  SIGN.stamps.filter(st=>st.sigId===s.id).forEach(st=>{
    st.el.style.backgroundImage=`url(${sigDisplayUrl(s)})`;
  });
}
function showSigOpts(){
  const s=activeSig(); const box=$('#sig-opts');
  if(!s){ box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  $('#sig-knockout').checked=s.knockout;
  $('#sig-thresh').value=s.thresh;
  $('#sig-thresh-row').style.opacity=s.knockout?1:.4;
  $('#sig-ko-img').src=sigDisplayUrl(s);
}
$('#sig-knockout').addEventListener('change',async e=>{
  const s=activeSig(); if(!s) return;
  s.knockout=e.target.checked;
  if(s.knockout && !s.procUrl) await processSig(s);
  refreshSig(s); showSigOpts();
});
let _threshTimer=null;
$('#sig-thresh').addEventListener('input',e=>{
  const s=activeSig(); if(!s) return; s.thresh=+e.target.value;
  if(!s.knockout) return;
  clearTimeout(_threshTimer);
  _threshTimer=setTimeout(async()=>{ await processSig(s); refreshSig(s);
    $('#sig-ko-img').src=sigDisplayUrl(s); },70);
});
function renderSigList(){
  const L=$('#sig-list'); L.innerHTML='';
  if(SIGN.sigs.length===0){ L.innerHTML='<div class="tip">아직 서명 이미지 없음</div>';
    $('#sig-opts').classList.add('hidden'); return; }
  SIGN.sigs.forEach(s=>{
    const d=document.createElement('div'); d.className='sig-item'+(SIGN.activeSig===s.id?' active':'');
    d.innerHTML=`<img src="${sigDisplayUrl(s)}"><span class="nm" title="${s.name}">${s.name}</span>`;
    d.addEventListener('click',()=>{ SIGN.activeSig=s.id; renderSigList(); showSigOpts();
      toast('"'+s.name+'" 선택됨 · 페이지를 클릭하세요'); });
    L.appendChild(d);
  });
}
async function loadSignPdf(file){
  try{
    SIGN.pdfBytes=await file.arrayBuffer();
    const data=SIGN.pdfBytes.slice(0);
    const doc=await pdfjsLib.getDocument({data}).promise;
    SIGN.pages=[]; SIGN.stamps=[];
    const host=$('#sign-pages'); host.innerHTML='';
    const W=Math.min(820,(document.querySelector('main').clientWidth)-260);
    let rotatedAny=false;
    for(let p=1;p<=doc.numPages;p++){
      const page=await doc.getPage(p);
      const v1=page.getViewport({scale:1});
      const scale=Math.min(1.6, W/v1.width);
      const vp=page.getViewport({scale});
      const cv=document.createElement('canvas'); cv.width=vp.width; cv.height=vp.height;
      cv.style.width=vp.width+'px'; cv.style.height=vp.height+'px';
      await page.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;
      const box=document.createElement('div'); box.className='pagebox';
      box.style.width=vp.width+'px'; box.style.height=vp.height+'px';
      box.appendChild(cv);
      const no=document.createElement('div'); no.className='pageno'; no.textContent='p'+p; box.appendChild(no);
      const rot=(page.rotate||0)%360;
      if(rot!==0){ rotatedAny=true; const f=document.createElement('div');
        f.className='rot-flag'; f.textContent='회전 '+rot+'°'; box.appendChild(f); }
      const idx=p-1;
      SIGN.pages[idx]={scale, vp, viewW:vp.width, viewH:vp.height, rotate:rot, box};
      box.addEventListener('pointerdown',e=>{
        if(e.target!==box && e.target!==cv) return;     // ignore clicks on existing stamps
        if(!SIGN.activeSig){ toast('먼저 왼쪽에서 서명을 선택하세요'); return; }
        const r=box.getBoundingClientRect();
        addStamp(idx, e.clientX-r.left, e.clientY-r.top);
      });
      host.appendChild(box);
    }
    $('#sign-wrap').classList.remove('hidden');
    $('#sign-controls').classList.remove('hidden');
    $('#sign-build').disabled=false;
    $('#sign-stat').textContent=doc.numPages+'페이지';
    if(rotatedAny) toast('회전된 페이지 감지 — 그 페이지는 서명 위치가 어긋날 수 있음',4000);
    renderSigList();
  }catch(err){ console.error(err); toast('PDF 로드 실패: '+err.message,3500); }
}
function addStamp(pageIndex, cx, cy){
  const sig=SIGN.sigs.find(s=>s.id===SIGN.activeSig); if(!sig) return;
  const pg=SIGN.pages[pageIndex];
  const w=Math.min(pg.viewW*0.28, 180); const h=w/sig.aspect;
  const st={id:uid(),pageIndex,sigId:sig.id,
    left:Math.max(0,Math.min(cx-w/2,pg.viewW-w)),
    top:Math.max(0,Math.min(cy-h/2,pg.viewH-h)), w, h, aspect:sig.aspect};
  const el=document.createElement('div'); el.className='stamp';
  el.style.backgroundImage=`url(${sigDisplayUrl(sig)})`;
  el.innerHTML='<div class="x">×</div><div class="h"></div>';
  st.el=el; SIGN.stamps.push(st); pg.box.appendChild(el); layoutStamp(st);
  wireStamp(st);
  updateSignStat();
}
function layoutStamp(st){
  st.el.style.left=st.left+'px'; st.el.style.top=st.top+'px';
  st.el.style.width=st.w+'px'; st.el.style.height=st.h+'px';
}
function wireStamp(st){
  const pg=SIGN.pages[st.pageIndex];
  st.el.querySelector('.x').addEventListener('pointerdown',e=>{
    e.stopPropagation(); st.el.remove(); SIGN.stamps=SIGN.stamps.filter(x=>x.id!==st.id); updateSignStat();
  });
  // drag move
  st.el.addEventListener('pointerdown',e=>{
    if(e.target.classList.contains('h')||e.target.classList.contains('x')) return;
    e.stopPropagation(); st.el.setPointerCapture(e.pointerId);
    const sx=e.clientX, sy=e.clientY, ol=st.left, ot=st.top;
    const mv=ev=>{ st.left=Math.max(0,Math.min(ol+ev.clientX-sx,pg.viewW-st.w));
      st.top=Math.max(0,Math.min(ot+ev.clientY-sy,pg.viewH-st.h)); layoutStamp(st); };
    const up=()=>{st.el.removeEventListener('pointermove',mv);st.el.removeEventListener('pointerup',up);};
    st.el.addEventListener('pointermove',mv); st.el.addEventListener('pointerup',up);
  });
  // resize (keep aspect)
  st.el.querySelector('.h').addEventListener('pointerdown',e=>{
    e.stopPropagation(); st.el.querySelector('.h').setPointerCapture(e.pointerId);
    const sx=e.clientX, ow=st.w;
    const mv=ev=>{ let w=Math.max(24,ow+ev.clientX-sx);
      w=Math.min(w,pg.viewW-st.left); let h=w/st.aspect;
      if(st.top+h>pg.viewH){ h=pg.viewH-st.top; w=h*st.aspect; }
      st.w=w; st.h=h; layoutStamp(st); };
    const up=()=>{st.el.querySelector('.h').removeEventListener('pointermove',mv);
      st.el.querySelector('.h').removeEventListener('pointerup',up);};
    st.el.querySelector('.h').addEventListener('pointermove',mv);
    st.el.querySelector('.h').addEventListener('pointerup',up);
  });
}
function updateSignStat(){
  $('#sign-stat').textContent=(SIGN.pages.length)+'페이지 · 서명 '+SIGN.stamps.length+'개';
}
$('#sign-reset').addEventListener('click',()=>{
  SIGN.pdfBytes=null;SIGN.pages=[];SIGN.stamps=[];
  $('#sign-pages').innerHTML='';$('#sign-wrap').classList.add('hidden');
  $('#sign-controls').classList.add('hidden');$('#sign-build').disabled=true;
});
$('#sign-build').addEventListener('click',async()=>{
  if(SIGN.stamps.length===0){ toast('찍은 서명이 없음'); return; }
  const btn=$('#sign-build'); btn.disabled=true; btn.textContent='내보내는 중…';
  try{
    const pdf=await PDFDocument.load(SIGN.pdfBytes);
    const embCache={};
    for(const sig of SIGN.sigs){
      if(!SIGN.stamps.some(s=>s.sigId===sig.id)) continue;
      const url=sigDisplayUrl(sig);
      const b64=url.split(',')[1]; const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
      // 배경제거 결과(procUrl)는 항상 PNG, 그 외엔 원본 타입
      const isPng = (sig.knockout && sig.procUrl) || sig.type==='image/png';
      embCache[sig.id]= isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    }
    const pages=pdf.getPages();
    for(const st of SIGN.stamps){
      const pg=SIGN.pages[st.pageIndex]; const page=pages[st.pageIndex];
      // view (canvas px) -> PDF user-space via pdf.js inverse transform
      const tl=pg.vp.convertToPdfPoint(st.left, st.top);
      const br=pg.vp.convertToPdfPoint(st.left+st.w, st.top+st.h);
      const x=Math.min(tl[0],br[0]), y=Math.min(tl[1],br[1]);
      const w=Math.abs(br[0]-tl[0]), h=Math.abs(br[1]-tl[1]);
      page.drawImage(embCache[st.sigId],{x,y,width:w,height:h});
    }
    download(await pdf.save(),'signed.pdf');
    toast('서명 적용 완료 · '+SIGN.stamps.length+'개');
  }catch(err){ console.error(err); toast('실패: '+err.message,3500); }
  btn.textContent='서명 적용해 내보내기'; btn.disabled=false;
});

/* shared: 소스 색상 팔레트 */
const SRC_COLORS=['#1f4fff','#0f7a4d','#c2410c','#7c3aed','#0891b2','#be185d','#4338ca','#a16207'];

/* =================================================================
   TAB 3 — EDIT & SORT (list-based, on-demand preview, rotate/erase)
================================================================= */
const BIG = { sources:[], pages:[], sel:null };
// sources[]={id,name,bytes,doc,color}  pages[]={id,docId,src,removed}
let bigPrevToken=0;

wireDrop('#big-drop','#big-input', addBigPdfs, true);
async function addBigPdfs(files){
  for(const file of files){
    if(file.type!=='application/pdf') continue;
    try{
      const bytes=await file.arrayBuffer();
      const doc=await pdfjsLib.getDocument({data:bytes.slice(0)}).promise; // 구조만 파싱, 렌더 X
      const src={id:uid(),name:file.name,bytes,doc,color:SRC_COLORS[BIG.sources.length%SRC_COLORS.length]};
      BIG.sources.push(src);
      for(let p=0;p<doc.numPages;p++) BIG.pages.push({id:uid(),docId:src.id,src:p,removed:false,rot:0,erase:[]});
    }catch(err){ console.error(err); toast(file.name+' 로드 실패: '+err.message,3500); }
  }
  $('#big-sources').classList.remove('hidden');
  $('#big-controls').classList.remove('hidden');
  $('#big-wrap').classList.remove('hidden');
  renderBigSources(); renderBig();
  if(!BIG.sel && BIG.pages.length) showBigPreview(BIG.pages[0].id);
}
function bigSrcOf(pg){ return BIG.sources.find(s=>s.id===pg.docId); }
function renderBigSources(){
  const host=$('#big-sources'); host.innerHTML='';
  BIG.sources.forEach(s=>{
    const n=BIG.pages.filter(p=>p.docId===s.id).length;
    const chip=document.createElement('div'); chip.className='src-chip';
    chip.innerHTML=`<span class="dot" style="background:${s.color}"></span>
      <span class="nm" title="${s.name}">${s.name}</span>
      <span style="color:var(--muted)">${n}p</span>
      <button class="rm" title="이 문서 제거">×</button>`;
    chip.querySelector('.rm').addEventListener('click',()=>{
      BIG.pages=BIG.pages.filter(p=>p.docId!==s.id);
      BIG.sources=BIG.sources.filter(x=>x.id!==s.id);
      if(BIG.sources.length===0){ resetBig(); return; }
      renderBigSources(); renderBig();
      if(BIG.sel && !BIG.pages.some(p=>p.id===BIG.sel)) clearBigPreview();
    });
    host.appendChild(chip);
  });
}
function renderBig(){
  const L=$('#big-list'); const frag=document.createDocumentFragment(); let live=0;
  BIG.pages.forEach(pg=>{
    const s=bigSrcOf(pg); if(!pg.removed) live++;
    const r=document.createElement('div');
    r.className='prow'+(pg.removed?' removed':'')+(pg.id===BIG.sel?' sel':'');
    r.draggable=true; r.dataset.id=pg.id;
    const edited = (pg.rot||0)!==0 || (pg.erase&&pg.erase.length>0);
    r.innerHTML=`<span class="gh">⋮⋮</span>
      <span class="pidx">${pg.removed?'—':live}</span>
      <span class="pdot" style="background:${s.color}"></span>
      <span class="psrc" title="${s.name}">${s.name.replace(/\.pdf$/i,'')}</span>
      <span class="porig">원본 p${pg.src+1}${edited?' <span style="color:var(--accent)">✎</span>':''}</span>
      <button class="pdel">${pg.removed?'복원':'삭제'}</button>`;
    r.querySelector('.pdel').addEventListener('click',e=>{e.stopPropagation();pg.removed=!pg.removed;renderBig();});
    r.addEventListener('click',()=>showBigPreview(pg.id));
    frag.appendChild(r);
  });
  L.innerHTML=''; L.appendChild(frag);
  $('#big-count').textContent=live+' / '+BIG.pages.length+'페이지 · 문서 '+BIG.sources.length+'개';
  $('#big-build').disabled = live===0;
}
/* sortable with edge auto-scroll for long lists */
(function(){
  const container=$('#big-list'); let dragEl=null, sTimer=null;
  container.addEventListener('dragstart',e=>{const r=e.target.closest('.prow');if(!r)return;
    dragEl=r;r.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
  container.addEventListener('dragend',()=>{if(dragEl)dragEl.classList.remove('dragging');dragEl=null;
    clearInterval(sTimer);sTimer=null;$$('.prow.over',container).forEach(x=>x.classList.remove('over'));});
  container.addEventListener('dragover',e=>{
    e.preventDefault(); const r=e.target.closest('.prow');
    $$('.prow.over',container).forEach(x=>x.classList.remove('over'));
    if(r&&r!==dragEl)r.classList.add('over');
    const rect=container.getBoundingClientRect(), edge=50; let dir=0;
    if(e.clientY<rect.top+edge)dir=-1; else if(e.clientY>rect.bottom-edge)dir=1;
    if(dir){ if(!sTimer)sTimer=setInterval(()=>{container.scrollTop+=dir*20;},16); }
    else { clearInterval(sTimer); sTimer=null; }
  });
  container.addEventListener('drop',e=>{
    e.preventDefault(); clearInterval(sTimer); sTimer=null;
    const r=e.target.closest('.prow');
    if(r&&dragEl&&r!==dragEl){
      const rows=[...container.children]; const from=rows.indexOf(dragEl),to=rows.indexOf(r);
      if(from<to)r.after(dragEl); else r.before(dragEl);
      const ids=[...container.children].map(x=>x.dataset.id);
      BIG.pages.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id)); renderBig();
    }
    $$('.prow.over',container).forEach(x=>x.classList.remove('over'));
  });
})();
async function showBigPreview(pgId){
  const pg=BIG.pages.find(p=>p.id===pgId); if(!pg) return;
  BIG.sel=pgId; renderBig();
  const myTok=++bigPrevToken;
  const s=bigSrcOf(pg); const page=await s.doc.getPage(pg.src+1);
  if(myTok!==bigPrevToken) return;
  const base=(page.rotate||0);
  const rotation=((base+(pg.rot||0))%360+360)%360;     // 사용자 회전 합산
  const v1=page.getViewport({scale:1,rotation});
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const scale=Math.min(3,(360/v1.width)*dpr);
  const vp=page.getViewport({scale,rotation});
  const cv=$('#big-prev-canvas'); cv.width=vp.width; cv.height=vp.height;
  cv.style.width=(vp.width/dpr)+'px';
  const ctx=cv.getContext('2d');
  await page.render({canvasContext:ctx,viewport:vp}).promise;
  if(myTok!==bigPrevToken) return;
  // 가리기 사각형(흰색) 미리보기에 반영
  ctx.save(); ctx.fillStyle='#fff';
  for(const e of (pg.erase||[])){
    const a=vp.convertToViewportPoint(e.x, e.y);
    const b=vp.convertToViewportPoint(e.x+e.w, e.y+e.h);
    ctx.fillRect(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));
  }
  ctx.restore();
  cv.classList.remove('hidden'); $('#big-prev-empty').classList.add('hidden');
  $('#big-tools').classList.remove('hidden');
  $('#big-prev-cap').textContent=`${s.name} · 원본 p${pg.src+1}`
    +(pg.rot?` · 회전 ${pg.rot}°`:'')+((pg.erase&&pg.erase.length)?` · 가리기 ${pg.erase.length}`:'')
    +(pg.removed?' · (삭제됨)':'');
  BIG._prevVp=vp; BIG._prevPgId=pg.id;             // 지우개 좌표 변환용
}
function clearBigPreview(){
  BIG.sel=null; bigPrevToken++; BIG._prevVp=null; BIG._prevPgId=null;
  $('#big-prev-canvas').classList.add('hidden');
  $('#big-prev-empty').classList.remove('hidden');
  $('#big-tools').classList.add('hidden');
  $('#big-prev-cap').textContent=''; renderBig();
}
function curPrevPage(){ return BIG.pages.find(p=>p.id===BIG._prevPgId); }
$('#big-rot-l').addEventListener('click',()=>{ const p=curPrevPage(); if(!p)return;
  p.rot=((p.rot||0)+270)%360; showBigPreview(p.id); });
$('#big-rot-r').addEventListener('click',()=>{ const p=curPrevPage(); if(!p)return;
  p.rot=((p.rot||0)+90)%360; showBigPreview(p.id); });
$('#big-undo').addEventListener('click',()=>{ const p=curPrevPage(); if(!p||!p.erase.length)return;
  p.erase.pop(); showBigPreview(p.id); });
$('#big-clear-edit').addEventListener('click',()=>{ const p=curPrevPage(); if(!p)return;
  p.rot=0; p.erase=[]; showBigPreview(p.id); });
$('#big-erase').addEventListener('click',e=>{
  BIG.eraseMode=!BIG.eraseMode;
  e.target.classList.toggle('on',BIG.eraseMode);
  $('#big-stage').classList.toggle('erasing',BIG.eraseMode);
});
/* 러버밴드 드래그 → 흰색 가리기 사각형(페이지 user-space 좌표로 저장) */
(function(){
  const stage=$('#big-stage'), rub=$('#big-rubber'); let on=false, sx=0, sy=0;
  stage.addEventListener('pointerdown',e=>{
    if(!BIG.eraseMode) return; const cv=$('#big-prev-canvas'); if(cv.classList.contains('hidden')) return;
    on=true; stage.setPointerCapture(e.pointerId);
    const r=cv.getBoundingClientRect(); sx=e.clientX-r.left; sy=e.clientY-r.top;
    rub.style.left=sx+'px'; rub.style.top=sy+'px'; rub.style.width='0px'; rub.style.height='0px';
    rub.classList.remove('hidden');
  });
  stage.addEventListener('pointermove',e=>{
    if(!on) return; const cv=$('#big-prev-canvas'); const r=cv.getBoundingClientRect();
    const x=e.clientX-r.left, y=e.clientY-r.top;
    rub.style.left=Math.min(sx,x)+'px'; rub.style.top=Math.min(sy,y)+'px';
    rub.style.width=Math.abs(x-sx)+'px'; rub.style.height=Math.abs(y-sy)+'px';
  });
  stage.addEventListener('pointerup',e=>{
    if(!on) return; on=false; rub.classList.add('hidden');
    const pg=curPrevPage(), vp=BIG._prevVp, cv=$('#big-prev-canvas');
    if(!pg||!vp) return;
    const r=cv.getBoundingClientRect(); const f=cv.width/r.width;     // CSS→canvas px
    const ex=e.clientX-r.left, ey=e.clientY-r.top;
    const p1=vp.convertToPdfPoint(sx*f, sy*f);                        // canvas px → user-space
    const p2=vp.convertToPdfPoint(ex*f, ey*f);
    const ux=Math.min(p1[0],p2[0]), uy=Math.min(p1[1],p2[1]);
    const uw=Math.abs(p2[0]-p1[0]), uh=Math.abs(p2[1]-p1[1]);
    if(uw>1 && uh>1){ pg.erase.push({x:ux,y:uy,w:uw,h:uh}); showBigPreview(pg.id); }
  });
})();
$('#big-flip').addEventListener('click',()=>$('#big-wrap').classList.toggle('left'));
$('#big-restore').addEventListener('click',()=>{
  const order=BIG.sources.map(s=>s.id);
  BIG.pages.sort((a,b)=>order.indexOf(a.docId)-order.indexOf(b.docId) || a.src-b.src);
  BIG.pages.forEach(p=>p.removed=false); renderBig();
});
function resetBig(){
  BIG.sources=[];BIG.pages=[];BIG.sel=null;
  $('#big-sources').classList.add('hidden');$('#big-controls').classList.add('hidden');
  $('#big-wrap').classList.add('hidden');$('#big-list').innerHTML='';
  $('#big-build').disabled=true; clearBigPreview();
}
$('#big-build').addEventListener('click',async()=>{
  const btn=$('#big-build'); btn.disabled=true; btn.textContent='내보내는 중…';
  try{
    const keep=BIG.pages.filter(p=>!p.removed);
    const out=await PDFDocument.create();
    const need={}; keep.forEach(p=>{ (need[p.docId]=need[p.docId]||new Set()).add(p.src); });
    const map={};
    for(const docId of Object.keys(need)){
      const s=BIG.sources.find(x=>x.id===docId);
      const lib=await PDFDocument.load(s.bytes);
      const idxs=[...need[docId]];
      const copied=await out.copyPages(lib, idxs);
      map[docId]={}; idxs.forEach((si,k)=>map[docId][si]=copied[k]);
    }
    for(const p of keep){
      const page=map[p.docId][p.src];
      for(const e of (p.erase||[]))
        page.drawRectangle({x:e.x,y:e.y,width:e.w,height:e.h,color:rgb(1,1,1)});
      if(p.rot){ const b=page.getRotation().angle||0; page.setRotation(degrees((b+p.rot)%360)); }
      out.addPage(page);
    }
    download(await out.save(),'edited.pdf');
    toast('내보내기 완료 · '+keep.length+'페이지');
  }catch(err){ console.error(err); toast('실패: '+err.message,3500); }
  btn.textContent='PDF 내보내기'; btn.disabled=false;
});
