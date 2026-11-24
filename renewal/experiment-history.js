// Read-only projections of existing event records and turn snapshots.
function experimentFinished(s,st){return ['renewal-14','renewal-15'].includes(st.id)&&['won','lost'].includes(s.status);}
function recordedType(r,id){return r.observation?.actorTypes?.[id];}
function experimentGoalEvidence(s,st,index){
 const g=conditions(s,st)[index];if(!g)return null;
 const rows=allObserved(s),selected=new Map(),direct=new Set();
 const add=(r,primary=true)=>{if(!r)return;if(primary)direct.add(r.eventId);selected.set(r.eventId,{...r,supporting:!direct.has(r.eventId)});};
 const ofType=type=>new Set([...s.cells.flatMap(c=>[c.animal,c.plant].filter(a=>a?.type===type).map(a=>a.id)),...s.deaths.filter(d=>d.entity.type===type).map(d=>d.entity.id)]);
 const owned=(r,ids)=>r.actors.some(id=>ids.has(id));
 const key=g.type,life=['bird','frog','slug'].includes(key),ids=ofType(key==='bloom'?'flower':key);
 if(life){for(const r of rows)if(owned(r,ids)&&['move','meal','predation','hunger','death','birth','poison','idle'].includes(r.kind))add(r);}
 else if(key==='bloom'){
  for(const r of rows)if(owned(r,ids)&&['bloom','flower-wait'].includes(r.kind)){
   add(r);for(const slug of [...(r.observation?.slugs||[]),...(r.observation?.previousSlugs||[])]){
    const birth=rows.find(b=>b.kind==='birth'&&b.childId===slug.id&&b.turn<=r.turn);if(birth)add(birth,false);
   }
  }
 }
 else if(key==='stat:slugBirths'){
  for(const r of rows)if(recordedType(r,r.actors[0])==='slug'&&['meal','birth','birth-blocked','death'].includes(r.kind))add(r);
 }
 else if(key==='stat:decompositions'){
  const events=rows.filter(r=>r.kind==='decompose');events.forEach(r=>add(r));
  for(const r of rows)if(r.kind==='seed-growth'&&r.cause==='earthworm'&&events.some(e=>e.actors[0]===r.actors[0]&&e.turn===r.turn))add(r,false);
  if(!events.length)for(const r of rows)if(recordedType(r,r.actors[0])==='earthworm'&&['move','idle','death'].includes(r.kind))add(r,false);
 }
 else if(key==='stat:dispersals'){
  const visits=rows.filter(r=>['visit','disperse','dispersal-blocked'].includes(r.kind));visits.forEach(r=>add(r));
  const flowers=new Set(visits.map(r=>r.flowerId).filter(Boolean));
  for(const r of rows)if(r.kind==='bloom'&&(!flowers.size||flowers.has(r.actors[0])))add(r,false);
  for(const r of rows)if(recordedType(r,r.actors[0])==='bee'&&['death','move'].includes(r.kind))add(r,false);
  if(!visits.some(r=>r.kind==='disperse'))for(const id of ofType('flower'))add(rows.findLast(r=>r.actors.includes(id)&&r.kind==='flower-wait'),false);
 }
 else if(key==='stat:shoreGerminations'){
  const growth=rows.filter(r=>r.kind==='seed-growth'&&r.cause==='shore');growth.forEach(r=>add(r));
  const seeds=new Set(growth.flatMap(r=>r.actors));
  for(const r of rows)if(r.kind==='germinate'&&owned(r,seeds))add(r);
  if(!growth.length){const latest=new Map();for(const r of rows)if(r.kind==='seed-growth')latest.set(r.actors.at(-1),r);latest.forEach(r=>add(r,false));}
 }
 else if(key==='stat:waterMoves'){
  const moves=rows.filter(r=>r.kind==='move'&&r.cause==='water');moves.forEach(r=>add(r));
  if(!moves.length)for(const r of rows)if(recordedType(r,r.actors[0])==='frog'&&['predation','idle','death'].includes(r.kind))add(r,false);
 }
 else return null;
 // Follow only recorded links; never infer a rescue or a failed action from diet alone.
 const byId=new Map(rows.map(r=>[r.eventId,r]));
 function parents(r){for(const link of r.observation?.links||[]){const p=byId.get(link.eventId);if(p&&!selected.has(p.eventId)){add(p,false);parents(p);}}}
 [...selected.values()].forEach(parents);
 const records=rows.filter(r=>selected.has(r.eventId)).map(r=>({...r,...selected.get(r.eventId),supporting:!direct.has(r.eventId)}));
 const current=s.cells.flatMap(c=>[c.animal,c.plant].filter(a=>a?.type===(key==='bloom'?'flower':key)));
 return {goal:g,records,directCount:direct.size,cells:current.map(a=>({r:a.r,c:a.c})),ids:[...ids],deaths:s.deaths.filter(d=>ids.has(d.entity.id)),experimental:true};
}
function flowerOutcomeFacts(s){return s.cells.filter(c=>c.plant?.type==='flower').map(c=>{const p=c.plant,rs=allObserved(s).filter(r=>r.actors.includes(p.id)),bloom=rs.find(r=>r.kind==='bloom'),wait=rs.findLast(r=>r.kind==='flower-wait');return `${p.id} ${point(p)}：${bloom?'T'+bloom.turn+'に開花':p.bloom?'開花済み（開花イベント記録なし）':'未開花'}${!p.bloom&&wait?'／最終判定T'+wait.turn+' '+causalSummary(wait):''}`;});}
function goalOutcomeFacts(s,st,index){
 const g=conditions(s,st)[index],rs=allObserved(s);if(!g)return [];
 if(['bird','frog','slug'].includes(g.type)){
  return [...animals(s,g.type).map(a=>`${SPECIES[a.type].name} ${a.id}：T${s.turn}終了時に生存・${point(a)}・空腹${a.hunger}/3`),...s.deaths.filter(d=>d.entity.type===g.type).map(d=>`${SPECIES[d.entity.type].name} ${d.entity.id}：T${d.turn} ${point(d.entity)}で${d.reason}`)];
 }
 if(g.type==='bloom')return flowerOutcomeFacts(s);
 if(g.type==='stat:slugBirths'){const births=rs.filter(r=>r.kind==='birth'&&recordedType(r,r.parentId)==='slug');return births.length?births.map(r=>`T${r.turn} 親${r.parentId} → 子${r.childId}、出生先 ${point(r.position)}`):['ナメクジの出生記録はありません。採食と出生待ち・死亡の記録を以下で確認できます。'];}
 if(g.type==='stat:dispersals'){const events=rs.filter(r=>r.kind==='disperse');return events.length?events.map(r=>`T${r.turn} ハチ${r.actors[0]}、花${r.flowerId}から${point(r.position)}へ散布`):['散布記録はありません。採蜜'+rs.filter(r=>r.kind==='visit').length+'回。',...rs.filter(r=>r.kind==='death'&&recordedType(r,r.actors[0])==='bee').map(r=>`T${r.turn} ハチ${r.actors[0]}：${r.reason}`),...flowerOutcomeFacts(s)];}
 if(g.type==='stat:waterMoves')return rs.filter(r=>r.kind==='move'&&r.cause==='water').map(r=>`T${r.turn} カエル${r.actors[0]}：${point(r.from)}から${point(r.position)}の水辺へ移動`).concat((s.stats.waterMoves||0)?[]:['水辺へ入った記録はありません。以下に実際の捕食・待機・死亡の記録を示します。']);
 if(g.type==='stat:decompositions')return rs.filter(r=>r.kind==='decompose').map(r=>`T${r.turn} ミミズ${r.actors[0]}が${point(r.position)}の痕跡を利用`).concat((s.stats.decompositions||0)?[]:['痕跡を利用した記録はありません。']);
 if(g.type==='stat:shoreGerminations')return [`岸での発芽の実績：${s.stats.shoreGerminations||0}回。以下は記録された成長・発芽と参照元です。`];
 return [];
}
// These notes read recorded judgements; they do not predict a solution.
function flowerTrialNote(s,id){
 const flower=s.cells.find(c=>c.plant?.id===id&&c.plant.type==='flower')?.plant;
 if(!flower)return null;
 const records=allObserved(s).filter(r=>r.actors.includes(id)&&['bloom','flower-wait'].includes(r.kind));
 const bloom=records.find(r=>r.kind==='bloom'),last=records.at(-1),o=last?.observation;
 if(flower.bloom)return {state:'bloomed',fact:bloom?`T${bloom.turn}に開花しました。`:'開花済みです。',next:''};
 if(!o)return {state:'unknown',fact:'開花判定の記録がなく、未開花の理由は特定できません。',next:'開花判定の周囲の記録を確認してください。'};
 if(o.slugs?.length)return {state:'present',fact:`最終判定T${last.turn}では、周囲に${o.slugs.map(a=>slugRole(s,a.id)).join('・')}が残っています。`,next:'親だけでなく子も開花判定に含まれます。キノコへの採食・移動やカエルの捕食で周囲から離れる流れを考えられます。出生位置が関わる場合は、岩で塞がれた実際の候補も確認しましょう。'};
 const approached=records.some(r=>r.observation?.previousPresent||r.observation?.slugs?.length||r.observation?.previousSlugs?.length);
 return approached?{state:'transition',fact:`接近の記録はありますが、T${last.turn}までに開花につながる「前の判定ではいる・次の判定ではいない」という変化は記録されていません。`,next:'周期途中の接近と、開花判定で周囲にいることは別です。キノコへの経路や出生先を、判定の前後で比べましょう。'}:{state:'not-approached',fact:`T${last.turn}までの開花判定には、ナメクジが周囲に近づいた記録がありません。`,next:'周囲が空いているだけでは開きません。まずナメクジが周囲にいる判定を作り、その次以降の判定で離れる流れが必要です。キノコへの経路や、岩による出生先の変化を手掛かりにできます。'};
}
function renderFlowerTrial(s,st,index){
 if(st.id!=='renewal-14'||conditions(s,st)[index]?.type!=='bloom')return '';
 const flowers=s.cells.filter(c=>c.plant?.type==='flower'&&!c.plant.bloom).map(c=>c.plant);
 if(!flowers.length)return '';
 const selected=flowers.find(p=>p.id===ui.reviewFlowerId),note=selected&&flowerTrialNote(s,selected.id);
 return `<div class="trial-note"><p>未開花の花を選んで、判定の変化を確認</p><div class="flower-choices">${flowers.map(p=>`<button data-flower-review="${p.id}" aria-pressed="${selected?.id===p.id}">${point(p)}の花 ${p.id}</button>`).join('')}</div>${note?`<p><b>${signalEscape(note.fact)}</b></p><p>${signalEscape(note.next)}</p>`:''}</div>`;
}
function goalTrialNote(s,st,index){
 const goal=conditions(s,st)[index];if(st.id!=='renewal-15'||!goal||goal.met)return '';
 const rs=allObserved(s),by=(type,kinds)=>rs.filter(r=>recordedType(r,r.actors[0])===type&&kinds.includes(r.kind));
 const frogMeals=by('frog',['predation']),slugLoss=frogMeals.filter(r=>r.preyType==='slug'),births=by('slug',['birth']);
 const last=rs.filter(r=>r.kind==='hunger'&&recordedType(r,r.actors[0])===goal.type).at(-1);
 const slugFirstLoss=slugLoss.find(r=>!births.some(b=>b.parentId===r.actors[1]&&b.turn<=r.turn));
 if(goal.type==='stat:slugBirths')return (slugFirstLoss?`この実験ではT${slugFirstLoss.turn}にナメクジ${slugFirstLoss.actors[1]}が、出産記録のないままカエルに捕食されています。`:'この実験ではナメクジの出生目標に届いていません。')+'カエルの食事と、ナメクジが通常キノコを2回食べて出生先を確保する時間を両方考えましょう。捕食に使う個体と繁殖する個体を分ける考え方もあります。子も花の周囲に残れば開花に影響します。';
 if(goal.type==='bird'){
  const death=by('bird',['death']).at(-1),meal=by('bird',['meal','predation']).at(-1);
  return (death?`小鳥${death.actors[0]}はT${death.turn}に${death.reason}。`:'小鳥の最終生存数が目標に届いていません。')+(meal?`最後の食事記録はT${meal.turn}です。`:'小鳥の食事記録はありません。')+'五周期を通じた餌の残り方を確認しましょう。捕食はほかの生物を減らし、種子を食べると発芽に回る資源も減ります。食事の成立と残す役割の両方に注意できます。';
 }
 if(goal.type==='frog'){
  const death=by('frog',['death']).at(-1),move=rs.find(r=>r.kind==='move'&&r.cause==='water');
  return (death?`カエル${death.actors[0]}はT${death.turn}に${death.reason}。`:last?`T${last.turn}のカエルの空腹記録を確認できます。`:'カエルの最終生存数が目標に届いていません。')+(move?`水辺移動はT${move.turn}に記録されています。`:'水辺移動の記録はありません。')+'水辺へ入る前だけでなく、移動先から届く食事も必要です。ナメクジの捕食は開花を助ける場合がありますが、繁殖に使う個体・時間との競合にも注意しましょう。';
 }
 if(goal.type==='stat:waterMoves')return (frogMeals.length?`カエルの捕食が${frogMeals.length}回記録されていますが、水辺へ入った記録はありません。`:'カエルが水辺へ入った記録はありません。')+'陸上で隣に獲物がいると、捕食を優先して水辺へ入りません。空いた隣接水辺へ入る日と、移動後に食べられる獲物の位置を分けて考えましょう。捕食されるナメクジの繁殖や花との接近・離脱も関連します。';
 if(goal.type==='bloom'){
  const waits=rs.filter(r=>r.kind==='flower-wait'),held=new Set(waits.flatMap(r=>(r.observation?.slugs||[]).map(a=>a.id)));
  return `${held.size?'未開花判定の周囲にいた個体は '+[...held].join('・')+' です。':'開花判定の接近・離脱の記録を花ごとに確認しましょう。'}子も含めて「前の判定ではいる・次にはいない」が開花の条件です。キノコへの移動・出生先・カエルの捕食が同じ周囲の状態を変えます。開いた花でハチが採蜜できるのは次の周期以降です。`;
 }
 if(goal.type==='stat:dispersals'){
  const blooms=rs.filter(r=>r.kind==='bloom'),visits=rs.filter(r=>r.kind==='visit'),dead=by('bee',['death']);
  return `この実験では開花記録${blooms.length}件、採蜜${visits.length}回、ハチの死亡${dead.length}件です。`+(blooms.length&&blooms.every(r=>r.turn===st.limit)?'開花記録はすべて最終周期で、その後の採蜜周期はありません。':'開花時刻と、ハチが生きて蜜に届く時刻を比べましょう。')+'ハチの行動は開花判定より先なので、咲いた当日にはその花を使えません。三輪すべてを散布に使う必要はありません。散布先の空きも必要です。';
 }
 if(goal.type==='stat:decompositions')return 'この実験では痕跡の利用が目標に届いていません。ミミズは周期の最初に現在地か隣の痕跡を利用し、その後、植物のない土に残った痕跡からキノコが生えます。分解に回した痕跡はナメクジのキノコにはならないため、繁殖の食事との役割分担も考えられます。死亡でできた痕跡は次の周期の対象です。';
 return '';
}
// A small, tab-local comparison; IDs and insertion order are not part of a layout.
const lastExperimentLayouts=new Map();
function layoutSignature(st,placements){
 function ordered(v){if(Array.isArray(v))return v.map(ordered);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])]));return v;}
 const pieces=Object.values(placements).map(p=>{const {id,...rest}=p;return ordered(rest);}).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 const {examples,...initial}=st;
 return JSON.stringify(ordered({initial,pieces}));
}
function sameExperimentLayout(st,placements){return lastExperimentLayouts.get(st.id)===layoutSignature(st,placements);}

function birthCandidateFacts(r){
 const cs=r.observation?.candidates;
 if(!cs)return '';
 return `<details class="birth-candidates"><summary>出生候補と実際の選択結果</summary><p>${r.kind==='birth'?'親 '+r.parentId+' → 子 '+r.childId+'／出生先 '+point(r.position):'親 '+r.actors[0]+'：'+signalEscape(r.reason||'出生待ち')}</p><ol>${cs.map(c=>`<li>${point(c)}：${c.chosen?'出生先に選択':!c.checked?'未選択（'+(r.reason&&r.reason!=='隣接する土が塞がっている'?'上限により候補選択なし':'先の候補で出生先が決定')+'）':'候補から除外'}／${c.terrain==='rock'?'岩':c.terrain==='water'?'水辺':c.plant?'植物 '+SPECIES[c.plant.type].name+' '+c.plant.id:c.animal?'動物 '+SPECIES[c.animal.type].name+' '+c.animal.id:'空いた土'}</li>`).join('')}</ol></details>`;
}
function experimentRecordRow(r,s){return `<div class="evidence-row"><small>${r.supporting?'記録の参照元':'この目標に直接関係する記録'}</small><p>T${r.turn} ${signalEscape(r.text)}</p>${r.actors.filter(id=>findIdentity(s,id)).map(actorButton).join('')}${observationDetail(r,s)}${eventReviewButton(r,r.turn)}</div>`;}
// ST15 drill-down replaces the existing goal history; it never predicts a route.
function st15FlowerSlugs(s,flowerId,snapshots=[]){
 const flower=s.cells.find(c=>c.plant?.id===flowerId&&c.plant.type==='flower')?.plant;
 if(!flower)return null;
 const rows=allObserved(s),ids=new Set();
 for(const state of [s,...snapshots]){
  for(const a of animals(state,'slug'))ids.add(a.id);
  for(const d of state.deaths||[])if(d.entity.type==='slug')ids.add(d.entity.id);
 }
 for(const row of rows){for(const [id,type] of Object.entries(row.observation?.actorTypes||{}))if(type==='slug')ids.add(id);if(row.kind==='birth'&&recordedType(row,row.parentId)==='slug')ids.add(row.childId);}
 const near=p=>p&&Number.isFinite(p.r)&&Number.isFinite(p.c)&&Math.abs(p.r-flower.r)+Math.abs(p.c-flower.c)<=1;
 const judgements=rows.filter(row=>row.actors.includes(flowerId)&&['bloom','flower-wait'].includes(row.kind));
 const slugs=[...ids].map(id=>{
  const identity=findIdentity(s,id),history=individualHistory(s,id,snapshots),events=rows.filter(row=>row.actors.includes(id)),contacts=[];
  const add=(turn,position)=>{if(near(position)&&!contacts.some(p=>p.turn===turn&&p.r===position.r&&p.c===position.c))contacts.push({turn,r:position.r,c:position.c});};
  // Every position is from an actual snapshot/event, including movement origins and child birth positions.
  for(const cycle of history?.cycles||[])add(cycle.turn,cycle.position);
  for(const row of events){add(row.turn,individualEventPosition(row,id));if(row.kind==='move'&&row.actors[0]===id)add(row.turn,row.from);}
  for(const row of judgements)for(const a of [...(row.observation?.slugs||[]),...(row.observation?.previousSlugs||[])])if(a.id===id)add(row.turn,a);
  const birth=rows.find(row=>row.kind==='birth'&&row.childId===id),death=events.find(row=>row.kind==='death')||identity?.death;
  return {id,history,contacts:contacts.sort((a,b)=>a.turn-b.turn),birth,death,entity:identity?.entity};
 });
 return {flower,judgements,slugs};
}
function st15FlowerFacts(data){
 const last=data.judgements.at(-1),slugs=last?.observation?.slugs;
 if(!last)return '開花判定：記録なし。';
 if(slugs?.length)return `T${last.turn}の判定では、周囲に${slugs.map(a=>a.id).join('・')}が残っています。`;
 if(data.slugs.some(a=>a.contacts.length))return '周囲で確認された個体は下の一覧から追えます。接近の時刻と開花判定の時刻は分けて確認してください。';
 return '周囲への接近記録なし。接近しなかった原因は、この記録だけでは断定しません。';
}
function st15FlowerNavigation(individual=false){return `${individual?'<button data-st15-back="flower">花の記録へ戻る</button>':'<button data-st15-back="goal">三輪開花の履歴へ戻る</button>'}<button data-st15-back="goals">目標一覧へ</button><button data-return-all>全履歴へ戻る</button>`;}
function renderSt15FlowerHistory(s){
 const data=st15FlowerSlugs(s,ui.st15Flower,ui.history);if(!data)return '';
 const selected=data.slugs.find(a=>a.id===ui.st15Slug);
 if(selected){
  // Reuse the existing individual timeline, including dead IDs and recorded birth candidates.
  if(!selected.history)return `<section class="evidence experiment-history">${st15FlowerNavigation(true)}<p>${signalEscape(selected.id)}：個体別履歴の記録なし。</p></section>`;
  return renderIndividualHistory(s,selected.id,ui.history).replace('<button data-return-all>全履歴へ戻る</button>',st15FlowerNavigation(true));
 }
 return `<section class="evidence experiment-history flower-history">${st15FlowerNavigation()}<h3>${point(data.flower)}の花 ${data.flower.id}：未開花</h3><p>開花には、前の判定で周囲にナメクジがいて、次の判定でいなくなる変化が必要です。</p><p>${signalEscape(st15FlowerFacts(data))}</p>${data.slugs.length?'<ul>'+data.slugs.map(a=>`<li><button class="actor-link" data-st15-slug="${a.id}">${signalEscape(a.id)}</button> ${a.birth?'子／親 '+a.birth.parentId+'／T'+a.birth.turn+'出生':a.entity?.parentId?'子／親 '+a.entity.parentId+'／出生イベントは記録なし':a.entity?'初期個体':'出自の記録なし'} ／ ${a.contacts.length?'T'+a.contacts[0].turn+'に周囲で確認':'接近記録なし'} ／ ${a.death?'T'+a.death.turn+' '+signalEscape(a.death.reason):a.entity?'T'+s.turn+'終了時に生存':'生死の記録なし'}</li>`).join('')+'</ul>':'<p>ナメクジの個体記録なし。</p>'}</section>`;
}
function st15FlowerOutcome(s,facts){
 const flowers=s.cells.filter(c=>c.plant?.type==='flower').map(c=>c.plant);
 return facts.map((text,i)=>flowers[i]&&!flowers[i].bloom?`<p><button class="actor-link" data-st15-flower="${flowers[i].id}" title="この花とナメクジの記録を見る">${signalEscape(text)}</button></p>`:`<p>${signalEscape(text)}</p>`).join('');
}
function selectSt15Flower(id){
 if(story.active||playback.active||stage().id!=='renewal-15'||!experimentFinished(ui.state,stage()))return;
 const flower=ui.state.cells.find(c=>c.plant?.id===id&&c.plant.type==='flower'&&!c.plant.bloom);if(!flower)return;
 eventReview=null;ui.st15Flower=id;ui.st15Slug=null;ui.relatedGoal=stage().goals.findIndex(g=>g.type==='bloom');ui.trackedId=null;ui.inspect=null;ui.infoTab='inspect';render();
}
function selectSt15Slug(id){
 if(story.active||playback.active||stage().id!=='renewal-15'||!experimentFinished(ui.state,stage()))return;
 if(!st15FlowerSlugs(ui.state,ui.st15Flower,ui.history)?.slugs.some(a=>a.id===id))return;
 ui.st15Slug=id;render();
}
function returnSt15History(target){
 if(story.active||playback.active||stage().id!=='renewal-15')return;
 if(target==='flower')ui.st15Slug=null;
 else {ui.st15Flower=null;ui.st15Slug=null;if(target==='goals'){ui.relatedGoal=undefined;ui.infoTab='goals';}}
 render();
}
function renderExperimentGoal(s,st,index,evidence){
 const g=evidence.goal,facts=goalOutcomeFacts(s,st,index),trial=goalTrialNote(s,st,index);
 const flowerGoal=st.id==='renewal-15'&&g.type==='bloom'&&experimentFinished(s,st);
 if(flowerGoal&&ui.st15Flower&&s.cells.some(c=>c.plant?.id===ui.st15Flower&&!c.plant.bloom))return renderSt15FlowerHistory(s);
 return `<section class="evidence experiment-history"><button data-return-all>全履歴へ戻る</button><h3>${g.label}</h3><p><b>${g.met?'達成':'未達成'}</b>／条件：${g.value}${g.min?'以上':''}／実績：${g.current}（T${s.turn}終了時）</p><div class="outcome-facts">${flowerGoal?st15FlowerOutcome(s,facts):facts.map(x=>`<p>${signalEscape(x)}</p>`).join('')}</div>${renderFlowerTrial(s,st,index)}${trial?`<aside class="trial-note"><b>ほかの目標との関係を考える</b><p>${signalEscape(trial)}</p></aside>`:''}${renderGoalGuide(st,index).replace('class="goal-guide" open','class="goal-guide"')}<p class="subtle">この実験の関連記録だけを周期順に表示しています。記録から原因を一つに特定できない場合は断定しません。</p>${evidence.records.length?evidence.records.map(r=>experimentRecordRow(r,s)).join(''):'<p>関連イベントの記録はありません。</p>'}</section>`;
}
function individualEventPosition(r,id){
 if(r.kind==='birth')return r.childId===id?r.position:r.parentId===id?r.observation?.actorPosition:null;
 if(r.actors[0]===id){if(r.kind==='disperse')return r.source;if(r.kind==='predation'||r.kind==='meal'&&r.actorPosition)return r.actorPosition||r.observation?.actorPosition;return r.position;}
 if(r.kind==='predation'&&r.actors[1]===id)return r.position;
 return null;
}
function individualHistory(s,id,snapshots=[]){
 const found=findIdentity(s,id);if(!found)return null;
 const events=allObserved(s).filter(r=>r.actors.includes(id)),entity=found.entity;
 const start=entity.bornTurn||0,last=found.dead?found.death.turn:s.turn,cycles=[];
 for(let turn=start;turn<=last;turn++){
  const records=events.filter(r=>r.turn===turn),snapshot=snapshots.find(h=>h.turn===turn),at=snapshot?findIdentity(snapshot,id):null;
  let position=at?{r:at.entity.r,c:at.entity.c}:null;
  if(!position)for(const r of records){const p=individualEventPosition(r,id);if(p)position=p;}
  // Missing initial snapshots are reported as missing; positions are never backfilled from the final board.
  cycles.push({turn,position,records});
 }
 return {id,entity,dead:found.dead,death:found.death,cycles};
}
function renderIndividualHistory(s,id,snapshots=[]){
 const h=individualHistory(s,id,snapshots);if(!h)return '<p>この個体の記録がありません。</p>';
 return `<section class="individual-history"><button data-return-all>全履歴へ戻る</button><h3>${SPECIES[h.entity.type].name} ${id} の個体別履歴</h3><p>${h.entity.parentId?'子／親 '+h.entity.parentId+'／T'+h.entity.bornTurn+'出生':'開始前からいた個体'}／${h.dead?'T'+h.death.turn+' '+signalEscape(h.death.reason):'T'+s.turn+'終了時に生存'}${h.entity.hunger!==undefined?'／空腹'+h.entity.hunger+'/3':''}</p>${h.cycles.map(c=>`<details class="individual-cycle" ${c.turn===s.turn||c.turn===h.death?.turn?'open':''}><summary>${c.turn?'T'+c.turn+(c.turn===h.death?.turn?'死亡時':'終了時'):'開始前'}：${c.position?point(c.position):'位置の記録なし'}</summary>${c.records.length?c.records.map(r=>`<p>T${r.turn} ${signalEscape(r.text)}</p>${['birth','birth-blocked'].includes(r.kind)?birthCandidateFacts(r):stage().id==='renewal-15'&&ui.relatedGoal!==undefined&&ui.st15Flower&&ui.st15Slug===id&&['move','meal','idle'].includes(r.kind)?`<details><summary>この行動の観察記録</summary><p>${signalEscape(r.observation?.reason||'記録なし')}</p></details>`:''}`).join(''):'<p>この周期のイベント記録はありません。</p>'}</details>`).join('')}<details><summary>この個体の行動ルール</summary><p>${signalEscape(SPECIES[h.entity.type].rule)}</p></details></section>`;
}
function showAllExperimentHistory(){
 if(story.active||playback.active)return;
 if(stage().id==='renewal-15'){ui.st15Flower=null;ui.st15Slug=null;}
 eventReview=null;ui.relatedGoal=undefined;ui.trackedId=null;ui.inspect=null;ui.logFilter='all';ui.infoTab='history';ui.openLogs=ui.state.logs.map(l=>l.turn);$('infoDrawer').open=true;render();
}
