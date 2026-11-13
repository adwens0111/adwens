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

