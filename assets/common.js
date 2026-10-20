// Shared: top nav, fun names, leaderboard.
(function(){
  const here=location.pathname.split('/').pop()||'index.html';
  const links=[['index.html','🏠 Home'],['games.html','🎮 Games'],['facts.html','🦤 Dodo Facts']];
  const nav=document.createElement('nav');nav.className='topnav';
  nav.innerHTML=links.map(([h,t])=>`<a href="${h}" class="${here===h||(h==='games.html'&&here.startsWith('game-'))?'on':''}">${t}</a>`).join('');
  document.body.prepend(nav);
})();
const ADJ=["Brave","Happy","Sleepy","Silly","Speedy","Lucky","Fluffy","Clever","Jolly","Mighty","Sunny","Bouncy","Giggly","Super","Wobbly","Zippy"];
const NOUN=["Dodo","Feather","Mango","Coconut","Pebble","Island","Wave","Seed","Beak","Nest","Palm","Breeze"];
function randomName(){const r=a=>a[Math.floor(Math.random()*a.length)];let n;do{n=`${r(ADJ)}${r(NOUN)}${10+Math.floor(Math.random()*90)}`}while(n.length>12);return n}
// ---- Player names: free text (max 12, letters/numbers/spaces) + kid-safe filter ----
const NAME_MAX=12, NAME_OK=/^[A-Za-z0-9 ]{1,12}$/;
let BAD=null;const badReady=fetch('assets/badwords.json').then(r=>r.json()).then(d=>BAD=d).catch(()=>BAD={roots:[],words:[],failed:true});
function cleanName(s){return String(s||'').replace(/\s+/g,' ').trim()}
function nameVariants(s){
  const low=s.toLowerCase(),out=new Set();
  for(const one of ['i','l']){
    const m={'0':'o','1':one,'3':'e','4':'a','5':'s','7':'t','8':'b','9':'g','2':'z','6':'g'};
    const t=low.replace(/[0-9]/g,c=>m[c]);out.add(t);
  }
  return [...out];
}
function isBadName(name){
  if(!BAD||BAD.failed) return !BAD; // list not loaded yet -> block; failed load -> server still checks
  for(const v of nameVariants(name)){
    const tokens=v.split(' ').filter(Boolean),joined=tokens.join(''),coll=joined.replace(/(.)\1+/g,'$1');
    for(const r of BAD.roots){const rc=r.replace(/(.)\1+/g,'$1');if(joined.includes(r)||(rc.length>=3&&coll.includes(rc)))return true}
    for(const w of BAD.words){const wc=w.replace(/(.)\1+/g,'$1');
      if(joined===w||tokens.includes(w)||(wc.length>=3&&(coll===wc||tokens.some(t=>t.replace(/(.)\1+/g,'$1')===wc)))||(w.length>=6&&joined.includes(w)))return true}
  }
  return false;
}
function checkName(raw){const n=cleanName(raw);
  if(!n) return {ok:false,msg:'Type a name first!'};
  if(n.length>NAME_MAX) return {ok:false,msg:'Names can be up to 12 letters.'};
  if(!NAME_OK.test(n)) return {ok:false,msg:'Use only letters, numbers, and spaces.'};
  if(isBadName(n)) return {ok:false,msg:'Try another name'};
  return {ok:true,name:n};
}
const API=(window.DODO_API_BASE||"").replace(/\/$/,"");
async function apiFetch(path,opts={}){
  if(!API) throw new Error('no api');
  const c=new AbortController();const t=setTimeout(()=>c.abort(),4000);
  try{const r=await fetch(API+path,{...opts,signal:c.signal});if(!r.ok)throw new Error(r.status);return await r.json()}finally{clearTimeout(t)}
}
// Leaderboard widget. el = container (hidden until API answers).
function Leaderboard(el,game,opts={}){
  let name=localStorage.getItem('dodoName'),setSaveEnabled=()=>{};
  async function refresh(){
    try{
      const data=await apiFetch('/scores?game='+encodeURIComponent(game));
      const rows=(data.scores||[]).slice(0,10);
      el.querySelector('ol').innerHTML=rows.length?rows.map(r=>`<li><b>${esc(r.name)}</b> — ${Number(r.score)}</li>`).join(''):'<li>No scores yet. Be the first!</li>';
      el.style.display='block';opts.onShow&&opts.onShow(true);
    }catch(e){el.style.display='none';opts.onShow&&opts.onShow(false)}
  }
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  el.classList.add('board','card');
  el.innerHTML=`<h2>🏆 Top Dodos</h2><label for="nm-${game}" style="font-weight:bold;display:block;margin-bottom:6px">Your name:</label>
   <div class="namerow"><input id="nm-${game}" maxlength="12" autocomplete="off">
   <button class="big save" type="button">💾 ${opts.saveLabel||'Save my score'}</button>
   <button class="big rnd" type="button">🎲 Random name</button></div>
   <div class="nmsg" style="min-height:1.4em;font-weight:bold;color:var(--red);margin-top:6px"></div><ol></ol>`;
  const saveBtn=el.querySelector('.save');
  saveBtn.onclick=()=>opts.onSave&&opts.onSave();
  setSaveEnabled=(on)=>{saveBtn.disabled=!on};
  const inp=el.querySelector('input'),msg=el.querySelector('.nmsg');msg.style.color='var(--red)';
  inp.value=name||randomName();badReady.then(()=>{if(name&&!checkName(name).ok){name=null;inp.value=randomName()}});
  inp.addEventListener('input',()=>{inp.value=inp.value.replace(/[^A-Za-z0-9 ]/g,'').slice(0,12);msg.textContent=''});
  inp.addEventListener('change',()=>{badReady.then(()=>{const c=checkName(inp.value);if(c.ok){name=c.name;localStorage.setItem('dodoName',name);msg.textContent=''}else msg.textContent=c.msg})});
  el.querySelector('.rnd').onclick=()=>{const n=randomName();inp.value=n;name=n;localStorage.setItem('dodoName',n);msg.textContent=''};
  refresh();
  const say=(t,ok)=>{msg.style.color=ok?'#2f8a3a':'var(--red)';msg.textContent=t};
  return {setSaveEnabled:on=>setSaveEnabled(on),async submit(score){
    if(!score){say('Score some points first!');return false}
    await badReady;const c=checkName(inp.value);if(!c.ok){say(c.msg+' (score not saved)');return false}
    name=c.name;localStorage.setItem('dodoName',name);
    try{await apiFetch('/scores',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({game,name,score})});say('Saved! ✅',true);refresh();return true}
    catch(e){say('Could not save right now. Try again later.');return false}}};
}
