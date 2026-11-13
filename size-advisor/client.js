(function () {
  'use strict';
  var words={tight:'タイト',regular:'ほどよく',loose:'ゆったり',thigh:'太もも',calf:'ふくらはぎ',hip:'お尻',waist:'お腹まわり',shoulder:'肩',chest:'胸',wide:'幅広',highInstep:'甲高'};
  var fields={waist:'ウエスト',hip:'ヒップ',thigh:'太もも',inseam:'股下',rise:'股上',outseam:'総丈',chest:'胸囲／身幅',shoulder:'肩幅',length:'着丈',sleeve:'袖丈',footLength:'足長',footWidth:'足幅'};
  function el(tag,text,cls){var n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
  function button(text,fn){var b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;}
  window.ADWSizeAdvisor={mount:function(host,product,config){
    if(!host||host.querySelector('[data-adw-advisor]'))return;
    var root=el('section',null,'adw-advisor');root.dataset.adwAdvisor='';root.setAttribute('aria-label','サイズ選び');
    var open=button('体型・好みからサイズを相談する',function(){panel.hidden=!panel.hidden;open.setAttribute('aria-expanded',String(!panel.hidden));});open.setAttribute('aria-expanded','false');
    var panel=el('div');panel.hidden=true;root.append(open,panel);host.append(root);
    panel.append(el('h3','あなたに合うサイズを探す'),el('p',product.name,'adw-product'));
    var form=el('form');form.setAttribute('data-clarity-mask','true');panel.append(form);
    var profile={preference:'regular',features:[],layers:'thin'},inputs={},result=el('div');result.setAttribute('aria-live','polite');
    var requestId=0,controller=null,followup='',followupQuestion='';
    function invalidate(){requestId++;if(controller)controller.abort();result.replaceChildren();followup='';followupQuestion='';}
    function number(key,label,min,max,step){var wrap=el('label',label),input=el('input');input.type='number';input.inputMode='decimal';input.min=min;input.max=max;input.step=step;input.required=true;input.autocomplete='off';wrap.append(input);inputs[key]=input;return wrap;}
    if(product.category==='footwear')form.append(number('usualShoeSize','普段の靴のサイズ（cm）',15,40,.5));
    else if(product.category!=='accessory'){var row=el('div',null,'adw-numbers');row.append(number('height','身長（cm）',120,220,.1),number('weight','体重（kg）',25,200,.1));form.append(row);}
    function choices(title,key,values,multiple){var fs=el('fieldset');fs.append(el('legend',title));var row=el('div',null,'adw-choices');values.forEach(function(v){var l=el('label'),i=el('input');i.type=multiple?'checkbox':'radio';i.name=key;i.value=v;i.checked=!multiple&&profile[key]===v;l.append(i,el('span',words[v]||({thin:'薄手',thick:'スウェット・ニット'}[v])||v));row.append(l);i.addEventListener('change',function(){profile[key]=multiple?Array.from(fs.querySelectorAll('input:checked')).map(function(x){return x.value;}):v;});});fs.append(row);form.append(fs);}
    choices('どう着たい？','preference',['tight','regular','loose']);
    if(product.category!=='accessory')choices('気になるところ（任意）','features',product.category==='bottoms'?['thigh','calf','hip','waist']:product.category==='footwear'?['wide','highInstep']:['shoulder','chest','waist'],true);
    if(product.category==='outerwear')choices('中に着るもの','layers',['thin','thick']);
    if(product.category==='bottoms'){
      var pantsLabel=el('label','普段履くパンツのサイズ'),pants=el('select');
      [['unknown','わからない'],['XS','XS'],['S','S'],['M','M'],['L','L'],['XL','XL'],['2XL','2XL／XXL'],['3XL','3XL／XXXL'],['other','数値サイズ・その他']].forEach(function(v){var o=el('option',v[1]);o.value=v[0];pants.append(o);});inputs.usualPantsSize=pants;pantsLabel.append(pants);form.append(pantsLabel);
      if(product.id==='88671936'){var habitLabel=el('label','細身パンツでふくらはぎがきついことは？（任意）'),habit=el('select');[['','未回答'],['often','よくある'],['rare','あまりない'],['unknown','わからない']].forEach(function(v){var o=el('option',v[1]);o.value=v[0];habit.append(o);});inputs.calfHabit=habit;habitLabel.append(habit);form.append(habitLabel);}
    }
    var detail=el('details');detail.append(el('summary','普段のブランド・サイズ（任意）'));
    ['brand','usualSize'].forEach(function(key){var label=el('label',key==='brand'?'ブランド名':'普段のサイズ'),input=el('input');input.maxLength=key==='brand'?40:20;label.append(input);inputs[key]=input;detail.append(label);});
    detail.append(el('p','参考情報として使用します。ブランドのサイズをそのまま換算しません。','adw-note'));form.append(detail);
    var noteLabel=el('label','ひとこと相談（任意）'),note=el('textarea');note.maxLength=300;note.rows=2;note.placeholder='がっちり体型だけど、細身に着たい';noteLabel.append(note);inputs.note=note;form.append(noteLabel);
    form.append(el('p','お名前・連絡先などは入力しないでください。','adw-note'));
    var consent=el('label',null,'adw-consent'),check=el('input');check.type='checkbox';check.required=true;
    consent.append(check,el('span','診断のため、入力内容をOpenAIへ送信することに同意する'));form.append(consent);
    var submit=el('button','おすすめを確認する','adw-primary');submit.type='submit';form.append(submit);panel.append(result);
    form.addEventListener('input',invalidate);
    function selection(size){
      // Always inspect the live BASE selector; never add to cart automatically.
      var select=document.querySelector('#purchase_form #valiationSelect');if(!select)return;
      function norm(v){return String(v).normalize('NFKC').toUpperCase().replace(/XXXL/g,'3XL').replace(/XXL/g,'2XL').replace(/サイズ/g,'').trim();}
      var variants=Array.from(select.options).filter(function(o){return norm(o.textContent).split(/[\s/／|｜,、:：()（）・]+/).includes(norm(size));});
      var group=el('div',null,'adw-choices');
      variants.forEach(function(o){var b=button(o.textContent,function(){if(!o.isConnected||o.disabled||!(Number(o.getAttribute('data-stock'))>0)){b.disabled=true;return;}select.value=o.value;select.dispatchEvent(new Event('change',{bubbles:true}));select.focus();});b.disabled=o.disabled||!(Number(o.getAttribute('data-stock'))>0);group.append(b);});
      if(!variants.length)group.append(el('p','カラー・サイズ・在庫は購入欄でご確認ください。'));
      result.append(group);
    }
    function compare(rows){if(!rows?.length)return;var box=el('details');box.append(el('summary','サイズごとの実寸差を見る'));var table=el('table');rows.forEach(function(r){var tr=el('tr');tr.append(el('th',fields[r.key]||r.key),el('td',r.from+' → '+r.to+' cm'),el('td',(r.difference>0?'+':'')+r.difference+' cm'));table.append(tr);});box.append(table);box.append(el('p','商品実寸の比較です。身体上の裾位置を示す図ではありません。','adw-note'));result.append(box);}
    async function diagnose(){
      if(!form.reportValidity())return;
      var id=++requestId;if(controller)controller.abort();controller=new AbortController();var current=controller;
      submit.disabled=true;submit.textContent='確認しています…';result.replaceChildren();
      var values=Object.assign({},profile,{followup:followup,followupQuestion:followupQuestion});Object.keys(inputs).forEach(function(k){values[k]=inputs[k].value;});
      var timeout=setTimeout(function(){current.abort();},20000);
      try{
        var response=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},signal:current.signal,body:JSON.stringify({productId:product.id,profile:values,consent:check.checked})});
        var data=await response.json();if(id!==requestId)return;
        if(!response.ok)throw Error(data.message||'現在診断を利用できません。サイズ表をご確認ください。');
        if(!Array.isArray(data.candidates)||!['estimate','question','insufficient'].includes(data.status))throw Error('診断結果を確認できませんでした。');
        if(data.status!=='estimate'&&data.candidates.length)throw Error('診断結果を確認できませんでした。');
        if(data.status==='question'&&followup)throw Error('追加回答だけでは絞り込めません。サイズ表をご確認ください。');
        if(data.status==='estimate')result.append(el('h4',data.candidates.join('・')+'を目安に'));
        result.append(el('p',data.explanation),el('p',data.caveat,'adw-note'));
        if(data.status==='question'&&!followup){result.append(el('h4',data.question));var row=el('div',null,'adw-choices');data.options.forEach(function(answer){row.append(button(answer,function(){followup=answer;followupQuestion=data.question;diagnose();}));});result.append(row);}
        else if(data.status==='question')result.append(el('p','入力内容だけでは絞り込めません。サイズ表またはLINEでご確認ください。'));
        var more=el('details');more.append(el('summary','実寸・着用例など詳しく見る'));
        (data.details||[]).forEach(function(t){more.append(el('p',t,'adw-note'));});
        result.append(more);
        compare(data.comparisons);
        if(data.status==='estimate')data.candidates.forEach(selection);
      }catch(e){if(id===requestId)result.append(el('p',current.signal.aborted?'診断に時間がかかっています。サイズ表をご確認ください。':e.message));}
      finally{clearTimeout(timeout);if(id===requestId){submit.disabled=false;submit.textContent='おすすめを確認する';}}
    }
    // Input edits invalidate old results and cancel stale responses.
    form.addEventListener('input',function(){submit.disabled=false;submit.textContent='おすすめを確認する';});
    form.addEventListener('submit',function(e){e.preventDefault();diagnose();});
  }};
})();


