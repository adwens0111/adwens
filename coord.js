(function(){
  if(!/^\/items\/\d+/.test(location.pathname)) return;
  var RE=/\[COORD:([\d,\s]+)(?:\|([^\]]*))?\]/;
  var GOLD='#c9a227';
  var HEAD_DEFAULT='\u25A0 \u3053\u306E\u30A2\u30A4\u30C6\u30E0\u306B\u5408\u308F\u305B\u308B\u306A\u3089';
  var FALLBACK_NAME='\u5546\u54C1\u30DA\u30FC\u30B8\u3092\u898B\u308B';
  var YEN='\u00A5';

  function findMarkers(){
    var out=[], w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null,false), n;
    while((n=w.nextNode())){
      if(n.parentNode&&/^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName)) continue;
      if(RE.test(n.nodeValue)) out.push(n);
    }
    return out;
  }

  function fetchItem(id){
    var key='adwens_coord_'+id, c=null;
    try{ c=JSON.parse(sessionStorage.getItem(key)||'null'); }catch(e){}
    if(c) return Promise.resolve(c);
    return fetch('/items/'+id,{credentials:'same-origin'}).then(function(r){return r.text();}).then(function(html){
      var d=new DOMParser().parseFromString(html,'text/html');
      var m=function(p){var e=d.querySelector('meta[property="'+p+'"]');return e?e.getAttribute('content')||'':'';};
      var title=(m('og:title')||'').split(' | ')[0].trim();
      var img=(m('og:image')||'').replace(/&amp;/g,'&');
      var price=parseInt(m('product:price:amount')||'0',10)||0;
      var it={id:id,n:title,g:img,p:price};
      try{ sessionStorage.setItem(key,JSON.stringify(it)); }catch(e){}
      return it;
    });
  }

  function yen(n){ return n?(YEN+String(n).replace(/\B(?=(\d{3})+(?!\d))/g,',')):''; }
  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

  function card(it){
    return '<a href="/items/'+it.id+'" style="width:48%;text-decoration:none;color:inherit;display:block;">'
      +(it.g?'<img src="'+esc(it.g)+'" alt="'+esc(it.n)+'" loading="lazy" style="width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:2px;display:block;background:#111;">':'')
      +'<p style="font-size:11px;margin:6px 0 0;color:#ccc;line-height:1.3;">'+esc(it.n)+'</p>'
      +'<p style="font-size:12px;font-weight:bold;color:'+GOLD+';margin:2px 0 0;">'+yen(it.p)+'</p></a>';
  }

  function render(node){
    var mt=node.nodeValue.match(RE); if(!mt) return;
    var ids=mt[1].split(',').map(function(s){return s.trim();}).filter(Boolean).slice(0,2);
    var head=(mt[2]||'').trim()||HEAD_DEFAULT;
    var box=document.createElement('div');
    box.setAttribute('data-adwens-coord','');
    box.style.cssText='margin:24px 0;padding-top:16px;border-top:1px solid #333;';
    box.innerHTML='<p style="font-weight:bold;font-size:14px;margin:0 0 12px;letter-spacing:1px;">'+esc(head)+'</p><div style="display:flex;gap:10px;justify-content:space-between;"></div>';
    var after=node.splitText(mt.index); after.nodeValue=after.nodeValue.slice(mt[0].length);
    node.parentNode.insertBefore(box,after);
    var row=box.lastChild;
    Promise.all(ids.map(function(id){return fetchItem(id).catch(function(){return {id:id,n:FALLBACK_NAME,g:'',p:0};});}))
      .then(function(items){ row.innerHTML=items.map(card).join(''); });
  }

  var busy=false;
  function run(){ if(busy||!document.body) return; busy=true; try{ findMarkers().forEach(render); }finally{ busy=false; } }
  function start(){
    run();
    var mo=new MutationObserver(function(){ run(); });
    mo.observe(document.body,{childList:true,subtree:true,characterData:true});
    var tries=0, t=setInterval(function(){ run(); if(++tries>=10) clearInterval(t); },1000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
