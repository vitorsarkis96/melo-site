(function(){
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const pad2=n=>String(n).padStart(2,'0');
  const M=window.MELO||{};
  const lang=M.lang||'pt';

  /* MENU */
  $$('.dd').forEach(li=>{
    const b=li.querySelector('button');if(!b)return;
    b.onclick=e=>{e.stopPropagation();b.setAttribute('aria-expanded',li.classList.toggle('open'))};
    li.onmouseenter=()=>{if(matchMedia('(hover:hover)').matches)li.classList.add('open')};
    li.onmouseleave=()=>li.classList.remove('open');
  });
  document.addEventListener('click',()=>$$('.dd.open').forEach(l=>l.classList.remove('open')));
  const burger=$('.burger');
  if(burger)burger.onclick=()=>burger.setAttribute('aria-expanded',document.body.classList.toggle('menu-open'));
  $$('.mpanel a').forEach(a=>a.addEventListener('click',()=>document.body.classList.remove('menu-open')));

  /* HEADER */
  const header=$('header.site'),heroEl=$('.hero');
  if(header){
    const tone=()=>header.classList.toggle('light',heroEl?heroEl.getBoundingClientRect().bottom<70:true);
    tone();addEventListener('scroll',tone,{passive:true});
    const heroCta=$('.hero .hero-ctas');
    if(heroCta&&'IntersectionObserver' in window){new IntersectionObserver(([en])=>header.classList.toggle('cta-on',!en.isIntersecting),{rootMargin:'-70px 0px 0px 0px'}).observe(heroCta)}
    else header.classList.add('cta-on');
  }
  const spyLinks=$$('#menu > li > a[href^="#"]');
  if(spyLinks.length){
    const spy=()=>{let cur=null;spyLinks.forEach(a=>{const t=document.querySelector(a.getAttribute('href'));if(t&&t.getBoundingClientRect().top<innerHeight*.35)cur=a});spyLinks.forEach(a=>a.classList.toggle('cur',a===cur))};
    addEventListener('scroll',()=>requestAnimationFrame(spy),{passive:true});spy();
  }

  /* HERO slideshow */
  const stage=$('#figStage');
  if(stage&&stage.children.length>1){
    const imgs=[...stage.children];let fi=0,timer;
    const show=i=>{fi=(i+imgs.length)%imgs.length;imgs.forEach((im,k)=>im.classList.toggle('on',k===fi))};
    const auto=()=>{clearInterval(timer);if(!reduce)timer=setInterval(()=>show(fi+1),5500)};
    show(0);auto();
  }

  /* SERVIÇOS: abas */
  const tabs=$('#tabs');
  if(tabs){
    const btns=[...tabs.querySelectorAll('button')],panels=$$('.folder[data-panel]');
    const open=i=>{btns.forEach((b,k)=>{b.classList.toggle('on',k===i);b.setAttribute('aria-selected',k===i)});panels.forEach((p,k)=>{p.hidden=k!==i})};
    btns.forEach(b=>b.addEventListener('click',()=>open(+b.dataset.i)));
    $$('[data-tab]').forEach(a=>a.addEventListener('click',()=>{open(+a.dataset.tab);try{sessionStorage.setItem('meloTab',a.dataset.tab)}catch(e){}}));
    try{const t=sessionStorage.getItem('meloTab');if(t!==null&&location.hash==='#servicos'){open(+t);sessionStorage.removeItem('meloTab')}}catch(e){}
  }

  /* CASES: índice com preview */
  const list=$('#idxList'),prev=$('#preview'),pImg=$('#previewImg');
  if(list&&prev&&matchMedia('(hover:hover) and (min-width:901px)').matches){
    let x=0,y=0,cx=0,cy=0,raf=null;
    const loop=()=>{cx+=(x-cx)*.18;cy+=(y-cy)*.18;prev.style.left=cx+'px';prev.style.top=cy+'px';raf=requestAnimationFrame(loop)};
    $$('.idx-row').forEach(r=>{
      r.addEventListener('mouseenter',e=>{pImg.src=r.dataset.img;pImg.style.objectPosition=r.dataset.pos||'';x=cx=e.clientX+180;y=cy=e.clientY;prev.classList.add('on');if(!raf)loop()});
      r.addEventListener('mousemove',e=>{x=e.clientX+180;y=e.clientY});
      r.addEventListener('mouseleave',()=>prev.classList.remove('on'));
    });
    list.addEventListener('mouseleave',()=>{prev.classList.remove('on');cancelAnimationFrame(raf);raf=null});
  }

  /* CASES: filtros */
  const filters=$('#filters');
  if(filters){
    const cards=$$('.ccard'),empty=$('#emptyState');
    filters.addEventListener('click',e=>{
      const b=e.target.closest('button[data-f]');if(!b)return;
      $$('#filters button').forEach(x=>x.classList.toggle('on',x===b));
      const f=b.dataset.f;let n=0;
      cards.forEach(c=>{const ok=f==='all'||(c.dataset.svc||'').split(' ').includes(f);c.hidden=!ok;if(ok)n++});
      if(empty)empty.hidden=n>0;
    });
  }

  /* Skintec: abas do spotlight */
  $$('[data-spot]').forEach(sp=>{
    const tb=[...sp.querySelectorAll('[data-spot-tab]')],pn=[...sp.querySelectorAll('[data-spot-panel]')];
    const set=i=>{tb.forEach((b,k)=>b.classList.toggle('on',k===i));pn.forEach((p,k)=>p.classList.toggle('on',k===i))};
    tb.forEach((b,k)=>b.addEventListener('click',()=>set(k)));
    const d=tb.findIndex(b=>b.classList.contains('on'));set(d>=0?d:0);
  });

  /* MÉTODO */
  const pRows=$$('.proto-row');
  if(pRows.length){const lit=()=>{const lim=innerHeight*.62;pRows.forEach(r=>r.classList.toggle('lit',r.getBoundingClientRect().top<lim))};addEventListener('scroll',()=>requestAnimationFrame(lit),{passive:true});lit()}

  /* FORMULÁRIO */
  const form=$('#briefForm');
  if(form){
    const note=$('#fNote'),msg=M.msg||{};
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const nome=form.nome.value.trim(),cont=form.contato.value.trim();
      const ok=/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cont)||cont.replace(/\D/g,'').length>=10;
      form.nome.setAttribute('aria-invalid',!nome);form.contato.setAttribute('aria-invalid',!!nome&&!ok);
      if(!nome||!ok){note.textContent=!nome?msg.errName:msg.errContact;note.style.color='var(--orange)';(nome?form.contato:form.nome).focus();return}
      const btn=form.querySelector('button[type=submit]');
      if(form._gotcha&&form._gotcha.value)return;
      note.style.color='';note.textContent=msg.sending||'';if(btn)btn.disabled=true;
      try{
        const r=await fetch(form.action,{method:'POST',body:new FormData(form),headers:{Accept:'application/json'}});
        if(!r.ok)throw 0;
        form.reset();note.textContent=msg.ok||'';
      }catch(_){note.textContent=msg.err||'';note.style.color='var(--orange)'}
      if(btn)btn.disabled=false;
    });
    $$('#briefForm input,#briefForm textarea').forEach(i=>i.addEventListener('input',()=>i.removeAttribute('aria-invalid')));
  }

  /* SHOWREEL */
  const modal=$('#reelModal'),frame=$('#reelFrame');
  if(modal){
    const REEL=M.reel;let last=null;
    const yt=`<iframe src="https://www.youtube-nocookie.com/embed/${REEL}?rel=0&modestbranding=1&playsinline=1&autoplay=1" title="Showreel Melo" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    const open=()=>{last=document.activeElement;frame.innerHTML=yt;modal.classList.add('on');document.body.style.overflow='hidden';$('#reelClose').focus()};
    const close=()=>{modal.classList.remove('on');frame.innerHTML='';document.body.style.overflow='';last&&last.focus()};
    $$('[data-reel]').forEach(b=>b.addEventListener('click',ev=>{ev.preventDefault();document.body.classList.remove('menu-open');open()}));
    $('#reelClose').onclick=close;
    modal.addEventListener('click',ev=>{if(ev.target===modal)close()});
    addEventListener('keydown',ev=>{if(ev.key==='Escape'&&modal.classList.contains('on'))close()});
  }

  /* AVALIAÇÕES */
  (function(){
    const g=$('.revs-grid');if(!g)return;
    const cards=[...g.children],pv=$('#revPrev'),nx=$('#revNext'),cnt=$('#revCount');
    const step=()=>cards[1]?cards[1].offsetLeft-cards[0].offsetLeft:g.clientWidth;
    const upd=()=>{const i=Math.round(g.scrollLeft/step());const vis=Math.max(1,Math.round(g.clientWidth/step()));
      const last=Math.min(cards.length,i+vis);cnt.textContent=(vis>1?pad2(i+1)+'–'+pad2(last):pad2(i+1))+' / '+pad2(cards.length);
      pv.disabled=g.scrollLeft<4;nx.disabled=g.scrollLeft+g.clientWidth>=g.scrollWidth-4};
    pv.onclick=()=>g.scrollBy({left:-step(),behavior:'smooth'});
    nx.onclick=()=>g.scrollBy({left:step(),behavior:'smooth'});
    g.addEventListener('scroll',()=>requestAnimationFrame(upd),{passive:true});addEventListener('resize',upd);upd();
  })();

  /* REVEAL + CONTADORES */
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12,rootMargin:'0px 0px -40px 0px'});
    $$('.rv').forEach(el=>io.observe(el));
    const fmt=n=>n.toLocaleString(lang==='en'?'en-US':'pt-BR');
    const co=new IntersectionObserver(es=>es.forEach(e=>{
      if(!e.isIntersecting)return;co.unobserve(e.target);const el=e.target,to=+el.dataset.to;
      if(reduce){el.textContent=fmt(to);return}
      const t0=performance.now(),d=1600;const st=t=>{const p=Math.min(1,(t-t0)/d);el.textContent=fmt(Math.round(to*(1-Math.pow(1-p,4))));if(p<1)requestAnimationFrame(st)};requestAnimationFrame(st);
    }),{threshold:.6});
    $$('.cnt').forEach(el=>co.observe(el));
  }else{$$('.rv').forEach(el=>el.classList.add('in'))}
})();
