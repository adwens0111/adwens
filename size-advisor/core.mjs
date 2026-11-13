// No legacy H/W/G recommendation grid is consumed by this module.
export const CATEGORIES = ['bottoms', 'tops', 'outerwear', 'footwear', 'accessory'];
export const FIELDS = {
  bottoms: ['waist', 'hip', 'thigh', 'inseam', 'rise', 'outseam'],
  tops: ['chest', 'shoulder', 'length', 'sleeve'],
  outerwear: ['chest', 'shoulder', 'length', 'sleeve'],
  footwear: ['footLength', 'footWidth'],
  accessory: ['length', 'width', 'circumference']
};
export function reviewProduct(p) {
  const issues = [];
  if (!p || !CATEGORIES.includes(p.category)) return ['category'];
  if (p.reviewStatus !== 'verified') issues.push('review');
  if (!p.source?.url || !p.reviewedAt || !p.reviewedBy) issues.push('provenance');
  if (!Array.isArray(p.measurements) || !p.measurements.length) return [...issues, 'measurements'];
  const labels = new Set();
  for (const row of p.measurements) {
    if (!row.size || labels.has(row.size)) issues.push('size');
    labels.add(row.size);
    if (!row.values || !Object.keys(row.values).length) issues.push('empty');
    for (const [key, m] of Object.entries(row.values || {})) {
      if (!FIELDS[p.category].includes(key) || !m || m.unit !== 'cm' ||
          !['flatWidth', 'circumference', 'length'].includes(m.kind) ||
          !Number.isFinite(m.value) || m.value <= 0 || m.value > 300 ||
          !m.method || !m.sourceText || (m.toleranceCm !== null && (!Number.isFinite(m.toleranceCm) || m.toleranceCm < 0))) issues.push('measurement');
    }
  }
  return [...new Set(issues)];
}
export function normalizeProfile(raw, category) {
  if (!raw || typeof raw !== 'object') throw Error('profile');
  const output = { category, preference: raw.preference, features: [], note: '' };
  if (!['tight','regular','loose'].includes(output.preference)) throw Error('preference');
  const bounds = category === 'footwear' ? { usualShoeSize: [15,40] } : category === 'accessory' ? {} : {height:[120,220], weight:[25,200]};
  for (const [key,[min,max]] of Object.entries(bounds)) {
    const value = Number(raw[key]);
    if (raw[key] === '' || raw[key] == null || !Number.isFinite(value) || value < min || value > max) throw Error(key);
    output[key] = value;
  }
  const allowed = category === 'bottoms' ? ['thigh','calf','hip','waist'] : category === 'footwear' ? ['wide','highInstep'] : ['shoulder','chest','waist'];
  if (!Array.isArray(raw.features) || raw.features.some(f=>!allowed.includes(f))) throw Error('features');
  output.features = [...new Set(raw.features)];
  output.layers = category === 'outerwear' && raw.layers === 'thick' ? 'thick' : 'thin';
  output.note = String(raw.note || '').trim().slice(0,300);
  // Brand entries are advisory only until a versioned product-specific reference exists.
  output.brand = String(raw.brand || '').trim().slice(0,40);
  output.usualSize = String(raw.usualSize || '').trim().slice(0,20);
  output.usualPantsSize = String(raw.usualPantsSize || 'unknown').normalize('NFKC').trim().slice(0,30);
  if (!['','often','rare','unknown'].includes(raw.calfHabit || '')) throw Error('calfHabit');
  output.calfHabit = raw.calfHabit || '';
  if (!output.calfHabit && /ふくらはぎ/.test(output.note) && /きつ|張/.test(output.note)) {
    if (/あまり.*ない|ほとんど.*ない/.test(output.note)) output.calfHabit='rare';
    else if (/よく|いつも|毎回/.test(output.note)) output.calfHabit='often';
  }
  output.followup = String(raw.followup || '').trim().slice(0,80);
  output.followupQuestion = String(raw.followupQuestion || '').trim().slice(0,120);
  if (Boolean(output.followup) !== Boolean(output.followupQuestion)) throw Error('followup_context');
  return output;
}
export function compareSizes(product, first, second) {
  if (reviewProduct(product).length) return [];
  const a = product.measurements.find(r=>r.size===first), b = product.measurements.find(r=>r.size===second);
  if (!a || !b) return [];
  return Object.keys(a.values).flatMap(key=>{
    const x=a.values[key], y=b.values[key];
    if (!y || x.unit!==y.unit || x.kind!==y.kind || x.method!==y.method) return [];
    return [{key, from:x.value, to:y.value, difference:Math.round((y.value-x.value)*10)/10, unit:'cm', kind:x.kind}];
  });
}
export function validateAdvice(result, product, profile = {}) {
  const labels=new Set(product.measurements.map(r=>r.size));
  if (!result || !['estimate','question','insufficient'].includes(result.status) ||
      !Array.isArray(result.candidates) || result.candidates.length>2 ||
      new Set(result.candidates).size!==result.candidates.length || result.candidates.some(s=>!labels.has(s)) ||
      typeof result.explanation!=='string' || result.explanation.length>400 ||
      typeof result.question!=='string' || result.question.length>120 ||
      !Array.isArray(result.options) || result.options.length>3 || result.options.some(s=>typeof s!=='string'||s.length>40)) throw Error('invalid_advice');
  if (result.status==='estimate' && !result.candidates.length) throw Error('no_candidates');
  if (result.status==='question' && (!result.question || result.options.length<2)) throw Error('no_question');
  if (result.status!=='estimate' && result.candidates.length) throw Error('unsupported_candidates');
  if (profile.followup && result.status==='question') throw Error('repeated_question');
  if (result.status!=='question' && (result.question || result.options.length)) throw Error('unexpected_question');
  if (result.options.some(s=>s.includes('わからない') && s!=='わからない')) throw Error('mixed_unknown_option');
  if (/絶対|必ず合|ぴったりです|確実に合|保証します/.test([result.explanation,result.question,...result.options].join(' '))) throw Error('guarantee');
  return {status:result.status, candidates:result.candidates, explanation:result.explanation,
    question:result.question, options:result.options,
    caveat:'商品実寸と入力内容に基づく推定です。身体の実測・試着による判定ではありません。',
    comparisons:result.candidates.length===2?compareSizes(product,...result.candidates):[]};
}
export const ADVICE_SCHEMA = {
  type:'object', additionalProperties:false,
  properties:{status:{type:'string',enum:['estimate','question','insufficient']},candidates:{type:'array',items:{type:'string'}},explanation:{type:'string'},question:{type:'string'},options:{type:'array',items:{type:'string'}}},
  required:['status','candidates','explanation','question','options']
};



export const CALF_QUESTION = '普段、細身のパンツを履くとふくらはぎがきつく感じますか？';
export function approvedGuidance(product, profile) {
  const rule=product.serviceGuidance;
  if(product.id!=='88671936'||rule?.id!=='skinny-calf-one-up-v1'||rule.status!=='operator_approved')return null;
  const answers={'よくある':'often','あまりない':'rare','わからない':'unknown'};
  const habit=profile.calfHabit||(profile.followupQuestion===CALF_QUESTION?answers[profile.followup]:'');
  const base={candidates:[],question:'',options:[],caveat:'接客上の目安であり、適合を保証するものではありません。',comparisons:[],guidanceBasis:'operator_approved_service_guidance'};
  if(!habit&&profile.features?.includes('calf')&&!profile.followup)return {...base,status:'question',explanation:'ふくらはぎの着用感を1つだけ教えてください。',question:CALF_QUESTION,options:['よくある','あまりない','わからない']};
  if(habit!=='often')return null;
  const labels=['XS','S','M','L','XL','2XL','3XL'];
  const usual=String(profile.usualPantsSize||'').normalize('NFKC').trim().toUpperCase().replace(/^XXXL$/,'3XL').replace(/^XXL$/,'2XL');
  const index=labels.indexOf(usual),sizes=product.measurements.map(r=>r.size),next=labels[index+1];
  if(index<0)return {...base,status:'insufficient',explanation:'普段よりワンサイズ上を目安におすすめします。このパンツは細めのためです。お尻・太ももには少しゆとりが出ます。',caveat:'普段のサイズ表記が確認できないため、具体的なサイズ名は出していません。'};
  if(!next||!sizes.includes(next))return {...base,status:'insufficient',explanation:'この商品の展開サイズでは、ワンサイズ上をご案内できません。このパンツは細めのためです。',caveat:'最大サイズでもふくらはぎに合うとは限りません。'};
  return {...base,status:'estimate',candidates:[next],explanation:`普段${usual}なら、${next}を目安におすすめします。このパンツは細めのためです。お尻・太ももには少しゆとりが出ます。`};
}

export function withAdviceDetails(advice, product) {
  const details=[];
  if(advice.guidanceBasis)details.push('運営者承認の接客上の目安です。実寸から計算した適合判定ではありません。');
  const labels={hip:'ヒップ（一周）',thigh:'太もも（一周）',outseam:'総丈',chest:'身幅（平置き）',shoulder:'肩幅',length:'着丈',sleeve:'袖丈'};
  for(const row of product.measurements||[])details.push(row.size+'：'+Object.entries(row.values).map(([k,m])=>(labels[k]||k)+' '+m.value+'cm').join('／'));
  details.push(...(product.measurementNotes||[]));
  for(const e of product.fitEvidence||[]) {
    if(e.type==='operator_confirmed_wear')details.push('運営者が確認した着用例：'+e.heightCm+'cm・'+e.weightKg+'kg。'+e.trials.map(t=>t.size+'：'+(t.overall||'ふくらはぎ '+t.calf+'、お尻 '+t.hip+'、太もも '+t.thigh)).join('。')+(e.operatorReportedRequiredSize?'。運営者報告では'+e.operatorReportedRequiredSize+'が必要だった。':'')+' 未確認：'+e.unknowns.join('、'));
    else if(e.note)details.push('補助コメント：'+e.note);
  }
  return {...advice,details};
}
