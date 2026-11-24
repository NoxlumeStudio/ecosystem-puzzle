// Observation UI: only recorded decisions and their captured snapshots are shown.
let eventReview=null;
function allObserved(s){return s.logs.flatMap(l=>(l.records||[]).map(r=>({...r,turn:l.turn})));}
function observedMetric(r,key){
 const a=r.observation?.actorTypes?.[r.actors[0]],meal=['meal','predation','visit','decompose'].includes(r.kind);
 if(key==='newbornPredations')return r.kind==='predation'&&r.newborn;
 if(key.endsWith('Predations'))return r.kind==='predation'&&a===key.slice(0,-10);
 if(key==='dispersedGerminations')return r.kind==='germinate'&&r.dispersed;
 if(key==='seedClearedBirths')return r.kind==='birth'&&r.observation?.links?.some(l=>l.why==='この出生先で種子を食べた記録');
 if(key==='birthCompetition')return r.kind==='birth'&&r.birthCompetition;
 if(key.endsWith('Meals'))return meal&&a===key.slice(0,-5);
 if(key.endsWith('Births'))return r.kind==='birth'&&a===key.slice(0,-6);
 return ({births:r.kind==='birth',seedMeals:r.kind==='meal'&&r.food==='seed',dispersals:r.kind==='disperse',germinations:r.kind==='germinate',shoreGerminations:r.kind==='germinate'&&r.observation?.links?.some(l=>l.why==='直前の種子の成長'),waterMoves:r.kind==='move'&&r.cause==='water',waterJumps:r.kind==='move'&&r.observation?.crossedWater,poisonDeaths:r.kind==='death'&&r.reason?.includes('毒'),wormBoosts:r.kind==='seed-growth'&&r.cause==='earthworm',decompositions:r.kind==='decompose'})[key]||false;
}
function goalEvidence(s,st,index){
 if(experimentFinished(s,st))return experimentGoalEvidence(s,st,index);
 const g=conditions(s,st)[index];if(!g)return null;
 const rows=allObserved(s),type=g.type==='bloom'?'flower':g.type==='births'?'slug':g.type;
 const current=s.cells.flatMap(c=>[c.animal,c.plant].filter(e=>e?.type===type));
 const deaths=s.deaths.filter(d=>d.entity.type===type),ids=new Set([...current.map(e=>e.id),...deaths.map(d=>d.entity.id)]);
 let direct=rows.filter(r=>{
  if(g.type.startsWith('stat:')){
   const key=g.type.slice(5);if(key==='seedMeals')return r.kind==='meal'&&r.food==='seed';
   if(key==='shoreGerminations')return r.kind==='germinate'&&rows.some(p=>r.observation?.links?.some(l=>l.eventId===p.eventId)&&p.kind==='seed-growth'&&p.cause==='shore');
   return observedMetric(r,key);
  }
  if(g.type==='births')return r.kind==='birth';
  return r.actors.some(id=>ids.has(id))||(type==='grass'&&r.kind==='germinate')||(type==='mushroom'&&(r.kind==='growth'||r.food==='mushroom'));
 });
 // Nearby prey is a witnessed spatial relation, never a claimed counterfactual rescue.
 const context=rows.filter(r=>r.kind==='predation'&&(r.observation?.nearbyPrey?.some(p=>ids.has(p.id))||r.observation?.preyFoods?.includes(type))&&!direct.includes(r)).map(r=>({...r,contextOnly:true}));
 const selected=new Map(direct.map(r=>[r.eventId,r]));
 function addParents(r){for(const l of r.observation?.links||[]){const p=rows.find(x=>x.eventId===l.eventId);if(p&&!selected.has(p.eventId)){selected.set(p.eventId,{...p,supporting:true});addParents(p);}}}
 direct.forEach(addParents);
 const records=rows.filter(r=>selected.has(r.eventId)).map(r=>({...r,...selected.get(r.eventId)}));
 records.push(...context);
 const order=new Map(rows.map((r,i)=>[r.eventId,i]));records.sort((a,b)=>order.get(a.eventId)-order.get(b.eventId));
 return {goal:g,cells:current.filter(e=>type!=='flower'||!e.bloom||g.met).map(e=>({r:e.r,c:e.c})),deaths:copy(deaths),records,ids:[...ids],directCount:direct.length};
}
function causalSummary(r){
 const o=r.observation||{};
 if(r.kind==='birth')return (o.blockedBefore?.length?'塞がった候補を避けて出生':'最初の空いた土へ出生');
 if(r.kind==='seed-held')return o.reason||'種子が残った';
 if(r.kind==='meal'&&r.food==='seed')return '小鳥が種子を採食：この種子は発芽しない';
 if(r.kind==='predation')return `${SPECIES[o.actorTypes?.[r.actors[0]]]?.name||'捕食者'}が${SPECIES[r.preyType]?.name||'獲物'}を捕食`;
 if(r.kind==='disperse')return '訪花した花から種子を散布';
 return o.reason||r.text;
}
function causalFocus(r){
 const o=r?.observation||{},marks=[];
 const add=(p,role,label)=>{if(p&&Number.isInteger(p.r)&&Number.isInteger(p.c)&&!marks.some(x=>x.r===p.r&&x.c===p.c&&x.role===role))marks.push({...p,role,label});};
 add(r?.kind==='disperse'?r.source:o.actorPosition||r?.actorPosition||r?.from,'origin','行動した位置');
 add(r?.position,'target',r?.kind==='death'?'死亡・痕跡の位置':r?.kind==='birth'?'子の出生位置':'対象の位置');
 for(const p of o.blockedBefore||[])add(p,'blocker',p.plant?.type==='seed'?'種子が出生先を塞いだ':'先に調べた出生先が塞がっていた');
 for(const p of (o.foodBlockers||[]).slice(0,1))add(p,'blocker','餌のマスに別の動物がいた');
 for(const p of o.slugs||[])add(p,'blocker','開花判定時に周囲にいたナメクジ');
 for(const p of o.water||[])add(p,'environment','岸の成長を早めた水辺');
 if(o.crossedWater)add(o.crossing,'environment','跳び越えた水辺');
 for(const p of (o.competition||[]).slice(0,1))add(p.position,'blocker','先に別の個体が食べた餌');
 return marks;
}
function observationDetail(r,s){
 const o=r.observation||{},parts=[];
 if(o.actorPosition)parts.push(`行動元 ${point(o.actorPosition)}`);
 if(r.position)parts.push(`対象 ${point(r.position)}`);
 if(o.distance!==undefined&&o.distance!==null)parts.push(o.distance===2?`2マス跳躍${o.crossedWater?'・水越え':'・陸上'}`:o.distance===1?'1マス移動':'現在地の餌');
 if(o.blockedBefore?.length)parts.push('先に調べた候補：'+o.blockedBefore.map(p=>`${point(p)}＝${SPECIES[p.plant?.type||p.animal?.type]?.name||({water:'水辺',rock:'岩'})[p.terrain]||'占有'}`).join('、'));
 if(o.foodBlockers?.length)parts.push('先に調べた餌のマスに別の動物：'+o.foodBlockers.map(p=>`${point(p)} ${SPECIES[p.animal.type].name} ${p.animal.id}`).join('、'));
 if(o.slugs?.length)parts.push('開花判定時の花の周囲（親も出生した子も含む）：'+o.slugs.map(p=>`${slugRole(s,p.id)} ${point(p)}`).join('、'));
 if(r.kind==='birth'&&o.actorTypes?.[r.actors[0]]==='slug')parts.push('親 '+slugRole(s,r.parentId)+' → 子 '+slugRole(s,r.childId)+'。子は次周期から行動し、今周期の開花判定ではすでに数えられます。');
 if(o.previousSlugs?.length)parts.push('ターン開始時のナメクジ：'+o.previousSlugs.map(p=>`${p.id} ${point(p)}`).join('、'));
 if(r.kind==='disperse')parts.push(`散布元 ${r.flowerId} ${point(r.source)}`);
 if(o.competition?.length)parts.push('先に食べた個体：'+o.competition.map(c=>`${c.actorId} ${point(c.position)}`).join('、'));
 if(r.kind==='predation'&&o.preyFoods?.length)parts.push('捕食された動物の食性：'+o.preyFoods.map(t=>SPECIES[t].name).join('・')+'（食性だけで他の個体の生存原因は断定しません）');
 if(o.nearbyPrey?.length)parts.push('この獲物の隣にいた動物：'+o.nearbyPrey.map(p=>`${SPECIES[p.type].name} ${p.id} ${point(p)}`).join('、')+'（この位置関係だけで生存の原因は断定しません）');
 const rows=allObserved(s),links=(o.links||[]).filter(l=>rows.some(p=>p.eventId===l.eventId));
 return `<details class="causal-detail" ${eventReview?.record.eventId===r.eventId?'open':''}><summary>${signalEscape(causalSummary(r))}</summary>${['birth','birth-blocked'].includes(r.kind)?birthCandidateFacts(r):''}${parts.length?`<p>${parts.map(signalEscape).join(' ／ ')}</p>`:''}${links.length?`<div class="causal-relations">${links.map(l=>`<button data-event-view="${l.turn}|${l.eventId}">T${l.turn} ${signalEscape(l.why)}</button>`).join('')}</div>`:''}</details>`;
}
function eventReviewButton(r,turn){return r.eventId?`<button class="event-review-button" data-event-view="${turn}|${r.eventId}">盤面で確認</button>`:'';}
function showObservedEvent(turn,id){
 if(story.active||playback.active)return;
 const trace=ui.traces?.[turn],frame=trace?.frames.find(f=>f.record?.eventId===id),record=allObserved(ui.state).find(r=>r.eventId===id&&r.turn===turn);
 if(!record)return;
 if(!frame){jumpHistory(turn);return;} // Never reconstruct historical boards from the final state.
 cancelPresentation();eventReview={state:copy(frame.state),record:copy(record),turn};ui.infoTab='history';ui.logFilter=String(turn);ui.openLogs=[turn];$('infoDrawer').open=true;render();$('board').scrollIntoView?.({block:'nearest',behavior:'smooth'});
}
function closeObservedEvent(){eventReview=null;render();}
function renderCausalFocus(r){
 if(!r)return;
 const board=$('board');
 for(const m of causalFocus(r)){const cell=board.querySelector?.(`[data-r="${m.r}"][data-c="${m.c}"]`);if(cell){cell.classList.add('causal-'+m.role);cell.title+=' ／ '+m.label;cell.setAttribute('aria-label',(cell.getAttribute('aria-label')||'')+'、'+m.label);}}
 const o=r.observation||{},from=r.kind==='disperse'?r.source:o.actorPosition,to=r.position;
 if(!['move','predation','meal','visit','disperse','birth'].includes(r.kind)||!from||!to||from.r===to.r&&from.c===to.c||!board.getBoundingClientRect)return;
 const first=board.querySelector?.(`[data-r="${from.r}"][data-c="${from.c}"]`),last=board.querySelector?.(`[data-r="${to.r}"][data-c="${to.c}"]`);
 if(!first||!last)return;const a=first.getBoundingClientRect(),b=last.getBoundingClientRect(),root=board.getBoundingClientRect();
 const x=a.x+a.width/2-root.x-(board.clientLeft||0),y=a.y+a.height/2-root.y-(board.clientTop||0),dx=b.x-a.x+(b.width-a.width)/2,dy=b.y-a.y+(b.height-a.height)/2;
 const line=document.createElement('span');line.className='causal-path '+(o.movement==='jump'?'causal-jump':'');line.setAttribute('aria-hidden','true');line.style.cssText=`left:${x}px;top:${y-(o.movement==='jump'?9:0)}px;width:${Math.hypot(dx,dy)}px;transform:rotate(${Math.atan2(dy,dx)}rad)`;board.append(line);
}
function renderCausalUI(){
 $('inspector').hidden=ui.relatedGoal!==undefined;$('populationDetails').hidden=ui.relatedGoal!==undefined;const r=presentationRecord||eventReview?.record;$('board').dataset.causalActive=String(!!r);
 if(r){
  const prefix=eventReview?`記録T${eventReview.turn}／現在T${ui.state.turn}　`:'';
  $('eventCaption').textContent=prefix+causalSummary(r);
  if(eventReview){const button=document.createElement?.('button');if(button){button.textContent='現在に戻る';button.className='close-observation';button.onclick=closeObservedEvent;$('eventCaption').append(button);}}
  renderCausalFocus(r);
 }
 for(const [attribute,handler] of [['st15-flower',selectSt15Flower],['st15-slug',selectSt15Slug],['st15-back',returnSt15History]])$('relatedPanel').querySelectorAll(`[data-${attribute}]`).forEach(b=>{b.disabled=playback.active||story.active;b.onclick=()=>handler(b.getAttribute('data-'+attribute));});
 $('relatedPanel').querySelectorAll('[data-flower-review]').forEach(b=>{b.disabled=playback.active||story.active;b.onclick=()=>{if(story.active||playback.active)return;ui.reviewFlowerId=b.dataset.flowerReview;render();};});
 for(const root of ['log','relatedPanel','inspector'])$(root).querySelectorAll('[data-return-all]').forEach(b=>{b.disabled=playback.active||story.active;b.onclick=showAllExperimentHistory;});
 for(const root of ['log','relatedPanel','inspector'])$(root).querySelectorAll('[data-event-view]').forEach(b=>{b.disabled=playback.active||story.active;b.onclick=()=>{const [turn,id]=b.dataset.eventView.split('|');showObservedEvent(+turn,id);};});
}
