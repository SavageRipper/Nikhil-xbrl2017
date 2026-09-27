/* MCA IND-AS V4 rule engine.
 * Pure browser/Node-compatible module. It parses the supplied business-rule text
 * into executable predicates and evaluates them against filing state.
 */
(function(root, factory){
  const api = factory();
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  root.IndAsRuleEngine = api;
})(typeof self !== 'undefined' ? self : globalThis, function(){
  const norm = s => String(s ?? '').replace(/[“”]/g,'"').replace(/[’]/g,"'").replace(/\s+/g,' ').trim();
  const lower = s => norm(s).toLowerCase();
  const nonblank = v => v !== undefined && v !== null && String(v).trim() !== '';
  const num = v => { const n=Number(String(v).replace(/,/g,'')); return Number.isFinite(n)?n:null; };
  const unique = a => [...new Set(a)];

  function buildNameIndex(data){
    const byName = new Map(), byLabel = new Map();
    for(const e of data.elements||[]){
      byName.set(lower(e.name), e.q);
      if(e.label) byLabel.set(lower(e.label), e.q);
    }
    return {byName,byLabel};
  }

  function editDistance(a,b){
    if(a===b)return 0; if(!a)return b.length; if(!b)return a.length;
    let prev=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){const cur=[i];for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur;}
    return prev[b.length];
  }
  function fuzzyName(raw,index){
    const l=lower(raw); if(index.byName.has(l))return index.byName.get(l); if(index.byLabel.has(l))return index.byLabel.get(l);
    let best=null,bestD=999; if(l.length<14)return null;
    for(const [name,q] of index.byName){if(Math.abs(name.length-l.length)>3)continue;const d=editDistance(l,name);if(d<bestD){bestD=d;best=q;}}
    return bestD<=Math.max(2,Math.floor(l.length*0.08))?best:null;
  }
  function resolveQuotedRefs(text, data, nameIndex){
    const out=[];
    const qre=/["']([^"']+)["']/g; let m;
    while((m=qre.exec(text))){ const hit=fuzzyName(m[1],nameIndex); if(hit) out.push(hit); }
    return unique(out);
  }

  function resolveBareRefs(text, data, nameIndex){
    const out=[];
    const tokenRe=/\b[A-Za-z][A-Za-z0-9_]{8,}\b/g;
    let m;
    while((m=tokenRe.exec(text))){
      const l=lower(m[0]);
      if(nameIndex.byName.has(l)) out.push(nameIndex.byName.get(l));
    }
    return unique(out);
  }

  function conditionFromSentence(sentence, refs){
    const s=norm(sentence), l=lower(s), conditions=[];
    const yes=/\b(?:yes|true)\b/.test(l);
    const no=/\b(?:no|false)\b/.test(l);
    const op = /(?:other than|not equal to|<>|!=)/.test(l)?'!=':
      /(?:greater than or equal to|greater than equal to|at least|>=)/.test(l)?'>=':
      /(?:less than or equal to|less than equal to|at most|<=)/.test(l)?'<=':
      /(?:greater than|more than|>|above)/.test(l)?'>':
      /(?:less than|below|<)/.test(l)?'<':
      /(?:equal to|equals|=)/.test(l)?'=':
      /(?:entered|provided|tagged|populated)/.test(l)?'entered':null;
    let targetValue=null;
    const n=s.match(/(?:greater than|more than|less than|equal to|>=|<=|>|<|=)\s*["']?(-?\d+(?:\.\d+)?)\s*%?["']?/i);
    if(n) targetValue=Number(n[1]);
    for(const r of refs){
      let operator=op||'entered', value=targetValue;
      if((yes||no) && /selected|is\s+(?:yes|no|true|false)/i.test(s)){operator='='; value=yes; if(no)value=false;}
      conditions.push({ref:r,operator,value});
    }
    return conditions;
  }

  function extractConditions(text,data,index){
    const conds=[];
    // Only treat clauses attached to the word MANDATORY as mandatory triggers.
    // This avoids confusing formula-side "if" clauses with applicability.
    const re=/mandatory(?:\s+only)?\s*(?:,\s*)?(?:if|in case(?: of)?|when|provided that)\s+([^.;]+)/ig;
    let m;
    while((m=re.exec(text))){
      const c=norm(m[1]).split(/\b(?:value entered here|value entered|summation of|the reported value)\b/i)[0].trim();
      const rs=unique(resolveQuotedRefs(c,data,index).concat(resolveBareRefs(c,data,index)));
      if(rs.length) conds.push(...conditionFromSentence(c,rs));
    }
    if(/mandatory in case of consolidated/i.test(text)) conds.push({profile:'nature',operator:'=',value:'Consolidated'});
    if(/mandatory in case of standalone/i.test(text)) conds.push({profile:'nature',operator:'=',value:'Standalone'});
    if(/mandatory .* current financial year|mandatory for current year only|mandatory in case of current financial year/i.test(text)) conds.push({profile:'period',operator:'=',value:'current'});
    return unique(conds.map(x=>JSON.stringify(x))).map(x=>JSON.parse(x));
  }

  function parseTargetOps(text){
    const l=lower(text), constraints=[];
    if(/greater than equal to zero|greater than or equal to zero|equal to or greater than zero|should be positive|non-negative/.test(l)) constraints.push({type:'min',value:0});
    if(/less than or equal to zero|non-positive/.test(l)) constraints.push({type:'max',value:0});
    if(/(?:less than or equal to 100%|not be greater than 100%|should not be greater than 100|not be greater than 100%)/.test(l)) constraints.push({type:'max',value:100});
    if(/greater than 100%|greater than 100/.test(l)) constraints.push({type:'max',value:100});
    if(/less than zero/.test(l)) constraints.push({type:'max',value:-0.0000001});
    if(/greater than zero/.test(l) && !/mandatory/.test(l)) constraints.push({type:'min',value:0.0000001});
    if(/valid country|list of countries/.test(l)) constraints.push({type:'country'});
    if(/valid currency code|currency codes/.test(l)) constraints.push({type:'currency'});
    if(/valid (?:4 digit|8 digit) .*code/.test(l)) constraints.push({type:'codeFormat'});
    return constraints;
  }

  function parseRelations(text,data,index,targetQ){
    const l=lower(text), out=[];
    const refs=unique(resolveQuotedRefs(text,data,index).concat(resolveBareRefs(text,data,index))).filter(q=>q!==targetQ);
    // Equality formula: prefer references in the sentence fragment after the final equality operator.
    const eqMatches=[...text.matchAll(/(?:should|shall|must|is)\s+(?:be\s+)?equal\s+to\s+([^.;]+)/ig)];
    for(const m of eqMatches){
      const rs=unique(resolveQuotedRefs(m[1],data,index).concat(resolveBareRefs(m[1],data,index))).filter(q=>q!==targetQ);
      if(rs.length) out.push({type:'equal',refs:rs.slice(0,12)});
    }
    const pctMatch=text.match(/(\d+(?:\.\d+)?)\s*percent\s+of\s+(?:the\s+)?["']([^"']+)["']/i);
    if(pctMatch){
      const rr=fuzzyName(pctMatch[2],index);
      if(rr){
        const after=text.slice((pctMatch.index||0)+pctMatch[0].length);
        const condMatch=after.match(/if\s+["']([^"']+)["']\s+(?:is\s+)?(greater than|more than|less than|equal to|other than)\s+(-?\d+(?:\.\d+)?|zero)/i);
        let when=null;
        if(condMatch){
          const cr=fuzzyName(condMatch[1],index);
          if(cr) when={ref:cr,operator:/other than/i.test(condMatch[2])?'!=':/greater|more/i.test(condMatch[2])?'>':/less/i.test(condMatch[2])?'<':'=',value:condMatch[3].toLowerCase()==='zero'?0:Number(condMatch[3])};
        }
        out.push({type:'ratio',ref:rr,multiplier:Number(pctMatch[1])/100,when});
      }
    }
    if(/and vice-a-versa|and vice versa|corresponding/.test(l) && refs.length) out.push({type:'symmetricMandatory',refs:refs.slice(0,4)});
    return out;
  }

  function classify(r,data,index){
    const text=norm(r.rule), l=lower(text), q=r.q;
    const isTable=/\btable\b/i.test(q) || /\btable\b/i.test(r.name||'');
    const explicitConditional=/(?:mandatory\s*,?\s*(?:if|in case|when)|becomes mandatory|mandatory only if|mandatory in case|shall be mandatory if|should be mandatory if|will be mandatory if|mandatory to enter only if)/i.test(text);
    const unconditionalMandatory=/\bmandatory\b/i.test(text) && !explicitConditional;
    const descriptor={id:'specific:'+r.q, q, label:r.label||r.name||q, role:r.role, text, status:r.status, fta:r.fta,
      isTable, mandatory:{enabled:/\bmandatory\b/i.test(text),conditional:explicitConditional,unconditional:unconditionalMandatory},
      conditions:extractConditions(text,data,index), constraints:parseTargetOps(text), relations:parseRelations(text,data,index,q),
      refs:unique(resolveQuotedRefs(text,data,index).concat(resolveBareRefs(text,data,index))).filter(x=>x!==q),
      applicability:{profileNature:/\bconsolidated\b|\bstandalone\b/i.test(text)?true:false}
    };
    if(/difference between this date and system date should be greater than or equal to 18 years/i.test(l)) descriptor.constraints.push({type:'ageMin',value:18});
    if(/less than or equal to system date|less than system date/.test(l)) descriptor.constraints.push({type:'dateMaxToday'});
    if(/greater than or equal to date of start|same as entered in the form|greater than or equal to date of/i.test(l)) descriptor.constraints.push({type:'dateOrder'});
    if(/should not be provided|cannot be provided against any other member|any other member/.test(l)) descriptor.constraints.push({type:'exclusiveDimensional'});
    if(/name should be based on|valid cin|valid pan|associated with the company/.test(l)) descriptor.constraints.push({type:'identityReference'});
    return descriptor;
  }

  function compile(data){
    const index=buildNameIndex(data);
    const rules=(data.specificRules||[]).map((r,i)=>({...classify(r,data,index),rowIndex:i}));
    const stats={total:rules.length,conditional:0,mandatory:0,unconditionalMandatory:0,constraints:0,relations:0,profileConditions:0,unknown:0};
    for(const d of rules){
      if(d.mandatory.enabled)stats.mandatory++;
      if(d.mandatory.conditional)stats.conditional++;
      if(d.mandatory.unconditional)stats.unconditionalMandatory++;
      if(d.constraints.length)stats.constraints++;
      if(d.relations.length)stats.relations++;
      if(d.conditions.some(c=>c.profile))stats.profileConditions++;
      if(!d.mandatory.enabled&&!d.constraints.length&&!d.relations.length)stats.unknown++;
    }
    return {rules,stats,index};
  }

  function getFact(state,q,period='current'){return state.facts?.[q+'|'+period];}
  function populated(state,q,period='current'){
    if(nonblank(getFact(state,q,period))) return true;
    for(const rows of Object.values(state.dimRows||{})) for(const row of rows||[]) if(row.line===q&&nonblank(row[period])) return true;
    return false;
  }
  function valueList(state,q){
    const out=[];
    for(const period of ['current','prior']) if(nonblank(getFact(state,q,period))) out.push({period,value:getFact(state,q,period),dims:null});
    for(const [role,rows] of Object.entries(state.dimRows||{})) for(const row of rows||[]) if(row.line===q) for(const period of ['current','prior']) if(nonblank(row[period])) out.push({period,value:row[period],dims:row.dims||{},role});
    return out;
  }
  function conditionValue(state,c){
    if(c.profile) return c.value==='period' ? null : state.profile?.[c.profile];
    const vals=valueList(state,c.ref).filter(v=>v.period==='current'); return vals.length?vals[0].value:undefined;
  }
  function matchesCondition(state,c){
    const actual=conditionValue(state,c);
    if(c.profile==='period') return c.value==='current';
    if(c.operator==='entered') return nonblank(actual) || populated(state,c.ref);
    if(actual===undefined) return false;
    if(c.value===true) return /^(yes|true|1)$/i.test(String(actual));
    if(c.value===false) return /^(no|false|0)$/i.test(String(actual));
    const an=num(actual);
    if(c.operator==='>') return an!==null&&an>Number(c.value);
    if(c.operator==='>=') return an!==null&&an>=Number(c.value);
    if(c.operator==='<') return an!==null&&an<Number(c.value);
    if(c.operator==='<=') return an!==null&&an<=Number(c.value);
    if(c.operator==='!=') return an!==null&&an!==Number(c.value);
    if(c.operator==='=') return String(actual).trim().toLowerCase()===String(c.value).trim().toLowerCase() || (an!==null&&an===Number(c.value));
    return false;
  }
  function targetPresent(state,d){return populated(state,d.q,'current');}
  function targetRows(state,d){
    const rows=[];
    for(const [role,rs] of Object.entries(state.dimRows||{})) for(const row of rs||[]) if(row.line===d.q) rows.push({role,row});
    return rows;
  }
  function addIssue(out,level,message,rule,concept,details={}){out.push({level,message,concept,ruleId:rule.id,ruleText:rule.text,details})}

  function evalConstraint(d,c,state,data,out){
    const vals=valueList(state,d.q);
    if(c.type==='min' || c.type==='max'){
      for(const v of vals){const n=num(v.value);if(n===null)continue;if(c.type==='min'&&n<c.value)addIssue(out,'error',`Business rule requires ${d.label} to be at least ${c.value}.`,d,d.q,{period:v.period,value:v.value});if(c.type==='max'&&n>c.value)addIssue(out,'error',`Business rule requires ${d.label} to be at most ${c.value}.`,d,d.q,{period:v.period,value:v.value});}
    } else if(c.type==='dateMaxToday'){
      for(const v of vals) if(/^\d{4}-\d{2}-\d{2}$/.test(String(v.value))){const dt=new Date(v.value+'T00:00:00'),now=new Date();now.setHours(23,59,59,999);if(dt>now)addIssue(out,'error','Business rule requires this date not to be later than the system date.',d,d.q,{value:v.value});}
    } else if(c.type==='ageMin'){
      for(const v of vals) if(/^\d{4}-\d{2}-\d{2}$/.test(String(v.value))){const b=new Date(v.value+'T00:00:00'),now=new Date();let age=now.getFullYear()-b.getFullYear();const md=now.getMonth()-b.getMonth();if(md<0||md===0&&now.getDate()<b.getDate())age--;if(age<c.value)addIssue(out,'error',`Business rule requires an age of at least ${c.value} years.`,d,d.q,{value:v.value});}
    } else if(c.type==='dateOrder'){
      const vals=valueList(state,d.q).filter(v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v.value)));
      const start=getFact(state,'in-ca:DateOfStartOfReportingPeriod','current');
      if(start) for(const v of vals) if(v.value<start)addIssue(out,'error','Date must not be earlier than the reporting-period start date.',d,d.q,{value:v.value,start});
    } else if(c.type==='country'){
      const vals=valueList(state,d.q); const valid=new Set((data.countryCodes||[]).map(String));
      for(const v of vals) if(nonblank(v.value)&&valid.size&&!valid.has(String(v.value).trim())) addIssue(out,'error','Country value is not present in the supplied MCA country-code list.',d,d.q,{value:v.value});
    } else if(c.type==='currency'){
      const vals=valueList(state,d.q); const valid=new Set((data.currencyCodes||[]).map(String));
      for(const v of vals) if(nonblank(v.value)&&valid.size&&!valid.has(String(v.value).trim())) addIssue(out,'error','Currency value is not present in the supplied MCA currency-code list.',d,d.q,{value:v.value});
    } else if(c.type==='codeFormat'){
      const vals=valueList(state,d.q); const is4=/4 digit/i.test(d.text); const rx=new RegExp('^\\d{'+(is4?'4':'8')+'}$');
      for(const v of vals) if(nonblank(v.value)&&!rx.test(String(v.value).trim())) addIssue(out,'error',`Value must be a valid ${is4?'4':'8'}-digit code format.`,d,d.q,{value:v.value});
    }
  }

  function evalRelation(d,rel,state,out){
    if(rel.type==='symmetricMandatory'){
      const target=targetPresent(state,d); for(const ref of rel.refs||[]) {const rp=populated(state,ref,'current'); if(target&&!rp)addIssue(out,'error','This paired field is required because its corresponding field is populated.',d,ref,{related:d.q}); if(rp&&!target)addIssue(out,'error','This field is required because its corresponding field is populated.',d,d.q,{related:ref});}
    }
    if(rel.type==='equal'){
      const tv=num(getFact(state,d.q,'current')); if(tv===null||!targetPresent(state,d))return;
      for(const ref of rel.refs||[]){const rv=num(getFact(state,ref,'current'));if(rv!==null&&Math.abs(tv-rv)>0.01)addIssue(out,'error',`${d.label} should equal the referenced concept under the MCA business rule.`,d,d.q,{reference:ref,actual:tv,expected:rv});}
    }
    if(rel.type==='ratio'){
      if(rel.when && !matchesCondition(state,rel.when)) return;
      const tv=num(getFact(state,d.q,'current')), rv=num(getFact(state,rel.ref,'current'));
      if(tv!==null&&rv!==null){const expected=rv*rel.multiplier;if(Math.abs(tv-expected)>0.01)addIssue(out,'error',`${d.label} does not match the stated percentage relationship.`,d,d.q,{reference:rel.ref,actual:tv,expected});}
    }
  }

  function evaluate(compiled,data,state){
    const out=[];
    for(const d of compiled.rules){
      const applicable = d.conditions.every(c=>c.profile || matchesCondition(state,c));
      if(!applicable) continue;
      if(d.mandatory.enabled){
        if(d.isTable){
          if(d.mandatory.unconditional && !targetPresent(state,d)) addIssue(out,'error','MCA business rule requires this disclosure table to be populated.',d,d.q);
          else if(d.mandatory.conditional && !targetPresent(state,d) && d.conditions.length) addIssue(out,'error','MCA business rule requires this disclosure table when its trigger condition is met.',d,d.q);
        } else {
          if(!targetPresent(state,d)) addIssue(out,'error','MCA business rule requires this concept to be reported for the current filing year.',d,d.q);
        }
      }
      for(const c of d.constraints) evalConstraint(d,c,state,data,out);
      for(const rel of d.relations) evalRelation(d,rel,state,out);
    }
    return out;
  }

  function evaluateNotAll(data,state,add){
    const arcs=(data.definitions||[]).filter(x=>/\/notAll$/.test(x.arcrole||''));
    for(const a of arcs){
      for(const row of (state.dimRows?.[a.role]||[])){
        if(row.line===a.from && ['current','prior'].some(p=>nonblank(row[p]))) add('error','This concept is excluded from the taxonomy dimensional hypercube by a NotAll relationship and cannot be reported in this dimensional table.',a.from,{ruleId:'definition:notAll',ruleText:'Taxonomy NotAll relationship',details:{role:a.role,excluded:a.from}});
      }
    }
    return arcs.length;
  }

  function roleNameByRole(data,role){ return (data.elrs||[]).find(r=>r.role===role)?.name||role||''; }
  function dimensionKey(row){ return JSON.stringify(row?.dims||{}); }
  function evaluateGeneric(data,state){
    const out=[];
    const add=(level,message,concept,details={})=>out.push({level,message,concept,ruleId:details.ruleId||'generic',ruleText:details.ruleText||'',details});
    // Generic rule 2: once any line item exists for a member combination, all mandatory line items for that combination are required.
    for(const [role,rows] of Object.entries(state.dimRows||{})){
      const roleDef=(data.elrs||[]).find(r=>r.role===role); if(!roleDef)continue;
      const tableName=String(roleDef.name||'').replace(/^\[[^\]]+\]\s*/,'');
      const reqRaw=(data.mandatoryLineItems||[]).find(x=>x.table&&tableName.includes(String(x.table).replace(/Table$/i,'')))?.requirements||'';
      const reqQ=[]; for(const e of data.elements||[]) if(reqRaw.includes(e.name)) reqQ.push(e.q);
      if(!reqQ.length)continue;
      const groups=new Map();
      for(const row of rows||[]) if(row.line && ['current','prior'].some(p=>nonblank(row[p]))){ const key=dimensionKey(row); const g=groups.get(key)||{row,periods:new Set()}; for(const p of ['current','prior'])if(nonblank(row[p]))g.periods.add(p); groups.set(key,g); }
      for(const g of groups.values()){
        for(const period of ['current','prior']) if(g.periods.has(period)){
          for(const q of reqQ){ if(!(rows||[]).some(r=>r.line===q&&dimensionKey(r)===dimensionKey(g.row)&&nonblank(r[period]))){ add('error',`Mandatory dimensional line item is missing for the populated member combination (${period}).`,q,{ruleId:'generic:2',ruleText:(data.genericRules||[]).find(x=>x.no===2)?.rule||'',role,period,memberCombination:g.row.dims||{}}); } }
        }
      }
    }
    // Generic rule 3: numbered members must appear sequentially within an axis/family.
    for(const [role,rows] of Object.entries(state.dimRows||{})){
      const roleDef=(data.elrs||[]).find(r=>r.role===role); if(!roleDef)continue;
      for(const axis of roleDef.axes||[]){
        const used=new Set();
        for(const row of rows||[]){const m=String(row.dims?.[axis.q]||''); const hit=m.match(/^(.*?)(\d+)Member$/i); if(hit){used.add(Number(hit[2]));}}
        if(used.size){const max=Math.max(...used);for(let n=1;n<=max;n++)if(!used.has(n)){add('error',`Numbered dimension members must be used sequentially; member ${n} is missing before a later member.`,axis.q,{ruleId:'generic:3',ruleText:(data.genericRules||[]).find(x=>x.no===3)?.rule||'',role,axis:axis.q,missing:n});}}
      }
    }
    // Generic rule 4: no embedded images/charts/graphics in escaped XHTML facts.
    for(const [k,v] of Object.entries(state.facts||{})){if(!nonblank(v))continue; const s=String(v); if(/<\s*(img|svg|canvas|object|embed)\b|data:image\//i.test(s)) add('error','Images, charts or embedded graphics are not allowed in the XBRL instance.',k.split('|')[0],{ruleId:'generic:4',ruleText:(data.genericRules||[]).find(x=>x.no===4)?.rule||''});}
    for(const [role,rows] of Object.entries(state.dimRows||{})) for(const row of rows||[]) for(const period of ['current','prior']) if(nonblank(row[period])&&/<\s*(img|svg|canvas|object|embed)\b|data:image\//i.test(String(row[period]))) add('error','Images, charts or embedded graphics are not allowed in the XBRL instance.',row.line,{ruleId:'generic:4',ruleText:(data.genericRules||[]).find(x=>x.no===4)?.rule||'',role,period});
    return out;
  }

  return {version:'4.0.0',normalize:norm,compile,evaluate,evaluateGeneric,evaluateNotAll,populated,valueList};
});