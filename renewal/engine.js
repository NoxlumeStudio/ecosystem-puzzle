'use strict';
const RULES={starvation:3,maxAnimals:16,directions:[[-1,0],[0,1],[1,0],[0,-1]]};
const SPECIES={};
function define(type,name,icon,layer,rule,extra={}){SPECIES[type]={name,icon,layer,rule,...extra};}
define('grass','草','🌱','plant','イモムシ・バッタ・アブラムシの共通の餌。食べると植物枠が空きます。');
define('seed','種子','🌰','plant','成長0から2で草。土は毎ターン+1、岸は+2。小鳥の餌。出生先を塞ぎます。');
define('flower','特殊な花','🌷','plant','前回自身・隣接にいたナメクジが0匹になると開花。蜜2回分、補充なし。散布成功は一生に1回。');
define('mushroom','通常キノコ','🍄','plant','以前の死亡痕跡から、植物のない土でターン開始時に発生。ナメクジの餌。');
define('poisonMushroom','毒キノコ','🍄','plant','ナメクジが食べると同ターンの状態更新で毒死。毒は捕食者へ移りません。',{poison:true});
define('water','水辺','💧','terrain','浅い池。カエルだけが入れる。上下左右の土は岸になり種子が+2成長。');
define('rock','岩','🪨','terrain','動かない障害物。移動・跳躍の通過、採食への接近、出生先を塞ぎます。');
const forageRule='現在地→上→右→下→左の餌を1つ食べ、隣の餌には移動。別の動物がいる場所には入りません。餌がなければ4歩以内の餌への最短経路を1マス探索（バッタ以外）。同距離は上→右→下→左。岩・水辺・他の動物を迂回し、探索した日は採食せず空腹が進みます。';
define('caterpillar','イモムシ','🐛','animal',forageRule,{foods:['grass'],predators:['bird']});
define('grasshopper','バッタ','🦗','animal',forageRule+' 1マスに餌がなければ上→右→下→左の2マス先へ跳躍。岩は越えられず、水辺は越えられます。',{foods:['grass'],predators:['bird','frog']});
define('aphid','アブラムシ','🟢','animal',forageRule+' 草2食・当日採食・一生1回の出産。',{foods:['grass'],predators:['bird','ladybird','spider']});
define('slug','ナメクジ','🐌','animal',forageRule+' 通常・毒キノコを同じ優先度で探す。通常2食・当日採食で一生1回の出産。',{foods:['mushroom','poisonMushroom'],predators:['frog']});
define('bee','ハチ','🐝','animal',forageRule+' 蜜のある開花した花を利用。蜜1減少、未散布なら上→右→下→左の空き植物枠へ種子を散布。',{foods:['flower'],predators:['spider']});
define('earthworm','ミミズ','🪱','animal',forageRule+' 前のターンまでの痕跡を利用し、同じ場所の既存種子を+1成長。草を直接作りません。',{foods:['remains'],predators:['bird','frog']});
define('bird','小鳥','🐦','animal','動かず現在地の種子→上→右→下→左を探す。隣の餌は動物を種子より先に食べる。別の動物が乗った種子は食べられません。',{foods:['caterpillar','grasshopper','aphid','spider','earthworm','seed'],prey:['caterpillar','grasshopper','aphid','spider','earthworm']});
define('frog','カエル','🐸','animal','上→右→下→左の獲物を捕食。獲物がなく陸上なら空いた隣の水辺へ1マス移動し再探索。水中では待つ。',{foods:['slug','grasshopper','spider','earthworm'],prey:['slug','grasshopper','spider','earthworm']});
define('ladybird','テントウムシ','🐞','animal','上→右→下→左のアブラムシを捕食し、その場所へ移動。隣にいなければ4歩以内を最短経路で1マス追跡。岩・水辺・他の動物は通過できません。',{foods:['aphid'],prey:['aphid'],predators:['spider']});
define('spider','クモ','🕷','animal','動かず上→右→下→左のアブラムシ・ハチ・テントウムシを捕食。',{foods:['aphid','bee','ladybird'],prey:['aphid','bee','ladybird'],predators:['bird','frog']});
const copy=x=>JSON.parse(JSON.stringify(x));
const pos=(r,c)=>[r-1,c-1];
const seed=(type,r,c,extra={})=>({type,r:r-1,c:c-1,...extra});
const slot=(id,type,coords)=>({id,type,allowed:coords.map(p=>pos(...p))});
const goal=(type,value,label)=>({type,value,label});
const breed={enabled:true,mealsRequired:2,maxAlive:3};
function chapterStage(id,title,size,limit,brief,fixed,slots,goals,extra={}){return {id,title,size,limit,brief,fixed,slots,goals,rocks:[],water:[],traces:[],...extra};}
function cellAt(s,r,c){return r>=0&&c>=0&&r<s.size&&c<s.size?s.cells[r*s.size+c]:null;}
function nearby(s,r,c,self=true){return (self?[[0,0],...RULES.directions]:RULES.directions).map(([dr,dc])=>cellAt(s,r+dr,c+dc)).filter(Boolean);}
function animals(s,type){return s.cells.flatMap(c=>c.animal?[c.animal]:[]).filter(a=>!type||a.type===type);}
function slugNear(s,p){return nearby(s,p.r,p.c).some(c=>c.animal?.type==='slug');}
function isShore(s,c){return c.terrain==='soil'&&nearby(s,c.r,c.c,false).some(n=>n.terrain==='water');}
function createInitial(stage,placements={}){
 const s={stageId:stage.id,size:stage.size,turn:0,status:'running',nextId:1,stats:{births:0},deaths:[],cells:[],logs:[{turn:0,events:['配置を選び、開始して連鎖を観察しよう。'],records:[]}]};
 const includes=(xs,r,c)=>(xs||[]).some(p=>p[0]===r&&p[1]===c);
 for(let r=0;r<s.size;r++)for(let c=0;c<s.size;c++)s.cells.push({r,c,terrain:includes(stage.rocks,r,c)?'rock':includes(stage.water,r,c)?'water':'soil',plant:null,animal:null,trace:includes(stage.traces,r,c)});
 const placed=placementEntries(stage,placements);
 // Terrain is applied before entities; diagnostics share the same placement validation.
 const entities=[...stage.fixed,...placed];
 for(const e of entities.filter(e=>SPECIES[e.type]?.layer==='terrain')){
  const c=cellAt(s,e.r,e.c);if(!c)throw Error('盤外には配置できません');
  if(c.terrain!=='soil')throw Error('地形枠の重複：このマスには'+(c.terrain==='rock'?'岩':'水辺')+'があります');
  const occupants=entities.filter(x=>x.r===e.r&&x.c===e.c&&SPECIES[x.type]?.layer!=='terrain');
  if(e.type==='rock'&&occupants.length)throw Error('岩は植物・動物のあるマスには配置できません（'+occupants.map(x=>SPECIES[x.type].name).join('・')+'）');
  if(e.type==='water'&&occupants.some(x=>x.type!=='frog'))throw Error('生息できない地形：水辺には植物やカエル以外の動物を配置できません');
  c.terrain=e.type;c.terrainSlot=e.slotId||null;
 }
 for(const e of [...stage.fixed.map(e=>({...e,fixed:true})),...placed].filter(e=>SPECIES[e.type]?.layer!=='terrain')){
  const d=SPECIES[e.type],c=cellAt(s,e.r,e.c);
  if(!d||!c)throw Error('盤外、または使用できない種類です');
  if(c.terrain==='rock')throw Error('岩の上には植物・動物を配置できません');
  if(c.terrain==='water'&&(e.type!=='frog'||d.layer!=='animal'))throw Error('生息できない地形：水辺に入れるのはカエルだけです');
  if(c[d.layer])throw Error((d.layer==='plant'?'植物枠':'動物枠')+'の重複：このマスには'+SPECIES[c[d.layer].type].name+'があります');
  c[d.layer]={id:'e'+s.nextId++,fixed:false,...(d.layer==='animal'?{hunger:0,meals:0,reproduced:false}:{}),...(e.type==='seed'?{growth:0}:{}),...(e.type==='flower'?{bloom:false,previousSlug:false,nectar:0,dispersed:false}:{}),...e};
  if(e.type==='flower'&&e.bloom)c.plant.nectar=e.nectar??2;
 }
 if(animals(s).length>RULES.maxAnimals)throw Error('動物は16匹まで');
 for(const c of s.cells)if(c.plant?.type==='flower')c.plant.previousSlug=slugNear(s,c.plant);
 return s;
}
function count(s,type){if(type==='bloom')return s.cells.filter(c=>c.plant?.type==='flower'&&c.plant.bloom).length;if(type==='births'||type.startsWith('stat:'))return s.stats[type==='births'?'births':type.slice(5)]||0;return s.cells.filter(c=>c.plant?.type===type||c.animal?.type===type||c.terrain===type).length;}
function conditions(s,st){return st.goals.map(g=>({...g,current:count(s,g.type),met:g.min?count(s,g.type)>=g.value:count(s,g.type)===g.value}));}
function placementEntries(st,p={}){
 if(!st.pool)return (st.slots||[]).filter(x=>p[x.id]).map(x=>{const q=p[x.id];if(!x.allowed.some(a=>a[0]===q[0]&&a[1]===q[1]))throw Error('許可されていない配置');return {type:x.type,r:q[0],c:q[1],slotId:x.id};});
 const entries=Object.entries(p).map(([id,e])=>({...e,slotId:id})),used={};
 if(entries.length>st.deployment.max)throw Error('全体の配置予算上限：'+st.deployment.max+'/'+st.deployment.max+'個配置済みです。先に移動・撤去してください');
 for(const e of entries){if(!Number.isInteger(e.r)||!Number.isInteger(e.c)||e.r<0||e.c<0||e.r>=st.size||e.c>=st.size)throw Error('盤外には配置できません');if(!st.pool[e.type])throw Error('このステージでは選択できない種類です');if((used[e.type]=(used[e.type]||0)+1)>st.pool[e.type])throw Error(SPECIES[e.type].name+'は'+st.pool[e.type]+'/'+st.pool[e.type]+'個配置済み（種類別の上限です）。移動・撤去してから配置してください');if(st.deployment.region&&!st.deployment.region.some(q=>q[0]===e.r&&q[1]===e.c))throw Error('配置区域の外です');}
 return entries;
}
function deploymentStatus(st,p={}){const entries=placementEntries(st,p),used={};for(const e of entries)used[e.type]=(used[e.type]||0)+1;return {total:entries.length,min:st.deployment?.min||0,max:st.deployment?.max||st.slots.length,used};}
function completePlacement(st,p){try{createInitial(st,p);const d=deploymentStatus(st,p);return st.pool?d.total>=d.min&&d.total<=d.max:st.slots.every(x=>p[x.id]);}catch{return false;}}
// Breadth-first search: ties are resolved by the shared up/right/down/left order.
function foodPath(s,a,predicate,max=4,prey=false){
 const queue=[{cell:cellAt(s,a.r,a.c),path:[]}],seen=new Set([a.r+','+a.c]);
 for(let i=0;i<queue.length;i++){const node=queue[i];if(node.path.length>=max)continue;for(const c of nearby(s,node.cell.r,node.cell.c,false)){const key=c.r+','+c.c;if(seen.has(key)||c.terrain!=='soil')continue;seen.add(key);const found=predicate(c);if(c.animal&&!(prey&&found))continue;const path=[...node.path,c];if(found)return path;queue.push({cell:c,path});}}
 return null;
}
function explore(ctx,a,predicate,prey=false){const path=foodPath(ctx.s,a,predicate,4,prey);if(!path||path[0].animal)return false;ctx.action={...ctx.action,targetPosition:observedPoint(path.at(-1)),path:path.map(observedPoint),movement:'walk',distance:1,reason:'近くに餌なし：4歩以内の餌へ岩・水辺・動物を避けて最短経路を1マス探索（採食は次の行動）'};move(ctx,a,path[0],'explore');stat(ctx,a.type+'Explorations');return true;}

const ACTION_PHASES=['decomposition','growth','herbivores','bee','predators','slug','status','reproduction','flower','germination','goal'];
const PHASE_LABELS={decomposition:'① ミミズ・痕跡',growth:'② キノコ発生',herbivores:'③ 草の競争',bee:'④ 訪花・散布',predators:'⑤ 捕食者',slug:'⑥ ナメクジ',status:'⑦ 空腹・毒・死亡',reproduction:'⑧ 繁殖',flower:'⑨ 開花',germination:'⑩ 種子の成長',goal:'⑪ 目標判定'};
function reproductionRules(st){return {enabled:false,mealsRequired:2,maxAlive:3,...st.reproduction};}
function phaseAnimals(s,types){return animals(s).filter(a=>!types||(Array.isArray(types)?types.includes(a.type):a.type===types)).sort((a,b)=>a.r-b.r||a.c-b.c);}
function isAlive(s,a){return cellAt(s,a.r,a.c)?.animal?.id===a.id;}
function point(a){return `${a.r+1}行${a.c+1}列`;}
function stat(ctx,key){ctx.s.stats[key]=(ctx.s.stats[key]||0)+1;}
// Observation metadata is read-only: it never enters targeting or goal evaluation.
function observedPoint(e){return e?{r:e.r,c:e.c}:null;}
function observedCell(c){return {r:c.r,c:c.c,terrain:c.terrain,plant:c.plant?{id:c.plant.id,type:c.plant.type}:null,animal:c.animal?{id:c.animal.id,type:c.animal.type}:null,trace:c.trace};}
function observedRecords(ctx){return [...ctx.s.logs.flatMap(l=>(l.records||[]).map(r=>({...r,turn:l.turn}))),...ctx.records.map(r=>({...r,turn:ctx.s.turn}))];}
function recordObservation(ctx,kind,actors,position,extra){
 const a=actors[0],all=observedRecords(ctx),same=(p,q)=>p&&q&&p.r===q.r&&p.c===q.c;
 const actorTypes=Object.fromEntries(actors.map(e=>[e.id,e.type]));
 const o={actorTypes,actorPosition:observedPoint(a),targetPosition:observedPoint(position),links:[],...(['move','meal','visit','decompose','predation','idle','poison'].includes(kind)?copy(ctx.action||{}):{}),...(extra.observation||{})};
 const link=(r,why)=>{if(r?.eventId&&!o.links.some(x=>x.eventId===r.eventId))o.links.push({eventId:r.eventId,turn:r.turn,why});};
 for(const c of o.competition||[])link(all.find(r=>r.eventId===c.eventId),'先にこの餌を食べた行動');
 if(['meal','visit','decompose','poison'].includes(kind))link(all.findLast(r=>r.kind==='move'&&r.actors[0]===a?.id&&r.turn===ctx.s.turn),'同じ行動の移動');
 if(['meal','predation'].includes(kind))link(all.findLast(r=>['disperse','growth','birth'].includes(r.kind)&&r.actors.includes(actors[1]?.id)||r.resourceId&&r.resourceId===extra.resourceId&&['growth'].includes(r.kind)),'利用した対象の発生');
 if(['growth','decompose'].includes(kind)){link(all.findLast(r=>r.kind==='death'&&same(r.position,position)),'同じ場所の死亡痕跡');if(kind==='decompose')o.reason='痕跡を先に利用・消費。キノコになる痕跡は残らない';else o.reason='残った痕跡＋空いた土 → キノコ';}
 if(kind==='death'){o.reason=extra.reason;o.tracePosition=observedPoint(position);link(all.findLast(r=>r.actors[0]===a.id&&r.turn===ctx.s.turn&&r.kind===(extra.reason?.includes('毒')?'poison':'hunger')),'死亡直前の状態更新');}
 if(kind==='predation')link(all.findLast(r=>r.kind==='death'&&r.actors[0]===actors[1]?.id&&r.turn===ctx.s.turn),'獲物の死亡・痕跡');
 if(kind==='seed-growth'){
  const seed=actors.at(-1);o.reason=extra.cause==='shore'?'水辺の岸なので成長＋2':extra.cause==='earthworm'?'ミミズが同じマスの痕跡を利用：成長＋1':'土で成長＋1';
  o.water=extra.cause==='shore'?nearby(ctx.s,position.r,position.c,false).filter(c=>c.terrain==='water').map(observedPoint):[];
  if(extra.cause==='earthworm')link(all.findLast(r=>r.kind==='decompose'&&r.actors[0]===a.id&&same(r.position,position)),'ミミズの分解作用');
  link(all.findLast(r=>r.kind==='disperse'&&r.actors.includes(seed.id)),'この種子を散布した花');
 }
 if(kind==='germinate'){o.reason='成長2以上。ターン末に草へ';link(all.findLast(r=>r.kind==='seed-growth'&&r.actors.includes(a.id)),'直前の種子の成長');}
 if(kind==='visit'){o.reason='開花した花の蜜を1回分利用';o.flowerPosition=observedPoint(position);}
 if(kind==='disperse'){o.reason='蜜を利用し、上→右→下→左の空いた土へ散布';link(all.findLast(r=>r.kind==='visit'&&r.flowerId===extra.flowerId),'この花への訪花');}
 if(kind==='birth'||kind==='birth-blocked'){
  o.actorPosition=observedPoint(a);o.reason=kind==='birth'?'上→右→下→左で最初の空いた土へ出生':extra.reason;
  link(all.findLast(r=>r.kind==='meal'&&r.actors[0]===a.id&&r.turn===ctx.s.turn),'親の今回の食事');
  for(const b of o.blockedBefore||[])if(b.plant?.type==='seed')link(all.findLast(r=>['seed-held','disperse'].includes(r.kind)&&r.actors.includes(b.plant.id)),'出生先に残っていた種子');
  if(kind==='birth'){const prior=all.findLast(r=>same(r.position,position)&&['meal','growth','germinate','disperse'].includes(r.kind));if(prior?.kind==='meal'&&prior.food==='seed')link(prior,'この出生先で種子を食べた記録');}
 }
 if(kind==='bloom'||kind==='flower-wait'){
  o.reason=kind==='bloom'?'周囲のナメクジが0匹になり開花':o.slugs?.length?'周囲にナメクジが残り、つぼみのまま':'前回もナメクジが不在：開花のきっかけなし';
  for(const slug of [...(o.previousSlugs||[]),...(o.slugs||[])])link(all.findLast(r=>r.kind==='birth'?r.childId===slug.id:['move','death'].includes(r.kind)&&r.actors[0]===slug.id),'開花判定に関わるナメクジ');
 }
 return o;
}
function logEvent(ctx,kind,text,actors=[],position=null,extra={}){
 ctx.events.push(text);const observation=recordObservation(ctx,kind,actors,position,extra);
 if(['growth','disperse'].includes(kind)&&!extra.resourceId)extra={...extra,resourceId:cellAt(ctx.s,position.r,position.c)?.plant?.id};
 const record={phase:ctx.phase,kind,text,actors:actors.map(a=>a.id),position:observedPoint(position),...extra,eventId:`t${ctx.s.turn}.e${ctx.records.length}`,observation};ctx.records.push(record);
 if(ctx.observe){const state=copy(ctx.s);state.logs.push({turn:state.turn,events:copy(ctx.events),records:copy(ctx.records)});ctx.observe({record:copy(record),state});}
}
function move(ctx,a,c,cause){const from={r:a.r,c:a.c};cellAt(ctx.s,a.r,a.c).animal=null;a.r=c.r;a.c=c.c;c.animal=a;logEvent(ctx,'move',`${SPECIES[a.type].name}：${point(from)}から${point(a)}へ${cause==='jump'?'跳躍':cause==='water'?'水辺へ移動':'移動'}。`,[a],a,{from,cause});if(cause==='water')stat(ctx,'waterMoves');if(cause==='jump'){stat(ctx,'jumps');if(Math.abs(from.r-a.r)+Math.abs(from.c-a.c)===2&&cellAt(ctx.s,(from.r+a.r)/2,(from.c+a.c)/2)?.terrain==='water')stat(ctx,'waterJumps');}}
function killAnimal(ctx,a,reason){if(!isAlive(ctx.s,a))return;const c=cellAt(ctx.s,a.r,a.c);c.animal=null;c.trace=true;ctx.s.deaths.push({entity:copy(a),turn:ctx.s.turn,phase:ctx.phase,reason});if(reason.includes('毒'))stat(ctx,'poisonDeaths');if(reason.includes('空腹'))stat(ctx,'starvations');logEvent(ctx,'death',`${point(a)}：${SPECIES[a.type].name}が${reason}。痕跡が残った。`,[a],a,{reason});}
function feed(ctx,a,food){ctx.fed.add(a.id);stat(ctx,a.type+'Meals');stat(ctx,'food:'+food);if((a.type==='slug'&&food==='mushroom')||(a.type==='aphid'&&food==='grass')){a.meals++;ctx.normalFed.add(a.id);}}
function forage(ctx,a){const s=ctx.s,foods=SPECIES[a.type].foods;let candidates=nearby(s,a.r,a.c);if(a.type==='grasshopper')for(const [dr,dc] of RULES.directions){const mid=cellAt(s,a.r+dr,a.c+dc),end=cellAt(s,a.r+2*dr,a.c+2*dc);if(mid&&mid.terrain!=='rock'&&end)candidates.push(end);}
 const target=candidates.find(c=>c.terrain==='soil'&&(!c.animal||c.animal.id===a.id)&&(a.type==='earthworm'?c.trace:foods.includes(c.plant?.type)&&(a.type!=='bee'||c.plant.bloom&&c.plant.nectar>0)));
 const origin={r:a.r,c:a.c},distance=target?Math.abs(a.r-target.r)+Math.abs(a.c-target.c):null;
 const competition=ctx.records.filter(r=>r.kind==='meal'&&foods.includes(r.food)&&candidates.some(c=>c.r===r.position.r&&c.c===r.position.c)&&!cellAt(s,r.position.r,r.position.c)?.plant).map(r=>({eventId:r.eventId,turn:s.turn,position:observedPoint(r.position),actorId:r.actors[0],food:r.food}));
 ctx.action={actorId:a.id,actorType:a.type,actorPosition:origin,from:origin,targetPosition:observedPoint(target),resourceId:target?.plant?.id,search:candidates.map(observedCell),competition,movement:distance===2?'jump':distance===1?'walk':'stay',distance,reason:a.type==='grasshopper'?(distance===0?'現在地の草を優先':distance===1?'近くの草を優先（1マスの餌が先）':distance===2?'近くに食べられる草がなく、2マス先へ跳躍':'近くにも跳躍先にも食べられる草がない'):target?(distance===0?'現在地の餌を優先':'上→右→下→左で先に使える餌'):'範囲内に利用できる餌がない'};
 ctx.action.foodBlockers=candidates.slice(0,target?candidates.indexOf(target):candidates.length).filter(c=>c.terrain==='soil'&&c.animal&&c.animal.id!==a.id&&(a.type==='earthworm'?c.trace:foods.includes(c.plant?.type))).map(observedCell);
 if(!target&&ctx.action.foodBlockers.length)ctx.action.reason='餌のマスに別の動物がいて入れない';
 if(distance===2){const mid=cellAt(s,(origin.r+target.r)/2,(origin.c+target.c)/2);ctx.action.crossedWater=mid.terrain==='water';ctx.action.crossing=observedPoint(mid);if(ctx.action.crossedWater)ctx.action.reason+='・水辺を越える';}
 if(!target&&a.type!=='grasshopper'&&explore(ctx,a,c=>a.type==='earthworm'?c.trace:foods.includes(c.plant?.type)&&(a.type!=='bee'||c.plant.bloom&&c.plant.nectar>0)))return;
 if(!target){logEvent(ctx,'idle',`${point(a)}：${SPECIES[a.type].name}は移動せず（${ctx.action.reason}）。`,[a],a);return;}if(target.r!==a.r||target.c!==a.c)move(ctx,a,target,Math.abs(origin.r-target.r)+Math.abs(origin.c-target.c)>1?'jump':'forage');
 if(a.type==='earthworm'){target.trace=false;feed(ctx,a,'remains');stat(ctx,'decompositions');logEvent(ctx,'decompose',`${point(a)}：ミミズが痕跡を利用した。`,[a],a);if(target.plant?.type==='seed'){const p=target.plant,before=p.growth;p.growth++;logEvent(ctx,'seed-growth',`${point(p)}：ミミズの作用で種子 ${before}→${p.growth}/2（発芽はターン末）。`,[a,p],p,{cause:'earthworm',before,after:p.growth});stat(ctx,'wormBoosts');}return;}
 if(a.type==='bee'){const flower=target.plant;flower.nectar--;feed(ctx,a,'nectar');logEvent(ctx,'visit',`${point(a)}：ハチが採蜜。蜜は残り${flower.nectar}回。`,[a,flower],flower,{nectar:flower.nectar,flowerId:flower.id});if(!flower.dispersed){const dest=nearby(s,a.r,a.c,false).find(c=>c.terrain==='soil'&&!c.plant);if(dest){const p={id:'e'+s.nextId++,type:'seed',r:dest.r,c:dest.c,growth:0,sourceFlower:flower.id};dest.plant=p;flower.dispersed=true;stat(ctx,'dispersals');logEvent(ctx,'disperse',`${point(flower)}の花から${point(p)}へ種子を散布。`,[a,flower,p],p,{source:{r:flower.r,c:flower.c},flowerId:flower.id});}else logEvent(ctx,'dispersal-blocked',`${point(flower)}：周囲の植物枠が塞がり散布できない。`,[a,flower],flower);}return;}
 const p=target.plant;target.plant=null;feed(ctx,a,p.type);logEvent(ctx,'meal',`${point(a)}：${SPECIES[a.type].name}が${SPECIES[p.type].name}を食べた。`,[a,p],a,{from:origin,food:p.type,resourceId:p.id});if(p.type==='poisonMushroom'){a.poisoned=true;logEvent(ctx,'poison',`${point(a)}：毒を食べた。状態更新で死亡する。`,[a],a);}}
function hunt(ctx,a){const s=ctx.s,d=SPECIES[a.type];const choose=()=>nearby(s,a.r,a.c,a.type==='bird').find(c=>c.r===a.r&&c.c===a.c?c.plant?.type==='seed'&&a.type==='bird':d.prey.includes(c.animal?.type)||(a.type==='bird'&&!c.animal&&c.plant?.type==='seed'));
 ctx.action={actorId:a.id,actorType:a.type,actorPosition:observedPoint(a),from:observedPoint(a),search:nearby(s,a.r,a.c,a.type==='bird').map(observedCell),reason:'上→右→下→左で先に食べられる対象',movement:'stay'};
 let c=choose();if(!c&&a.type==='frog'&&cellAt(s,a.r,a.c).terrain==='soil'){const water=nearby(s,a.r,a.c,false).find(c=>c.terrain==='water'&&!c.animal);if(water){ctx.action.reason='隣接する獲物なし → 空いた水辺へ移動';ctx.action.targetPosition=observedPoint(water);ctx.action.movement='water';move(ctx,a,water,'water');c=choose();}}
 if(!c&&a.type==='ladybird'&&explore(ctx,a,c=>c.animal?.type==='aphid',true))return;
 if(!c){ctx.action.reason=a.type==='frog'?(cellAt(s,a.r,a.c).terrain==='water'?'水辺で待機：隣接する獲物がいない':'隣接する獲物も、入れる隣の水辺もない'):'隣接する食べられる対象がない';ctx.action.heldSeeds=a.type==='bird'?nearby(s,a.r,a.c).filter(c=>c.plant?.type==='seed').map(observedCell):[];logEvent(ctx,'idle',`${point(a)}：${d.name}は待機（${ctx.action.reason}）。`,[a],a);return;}
 ctx.action.targetPosition=observedPoint(c);ctx.action.preyId=c.animal?.id;ctx.action.resourceId=c.plant?.id;ctx.action.resourcePosition=observedPoint(c);ctx.action.actorPosition=observedPoint(a);
 if(a.type==='bird')ctx.action.reason=c.r===a.r&&c.c===a.c?'現在地の種子を優先':c.animal&&c.plant?.type==='seed'?'同じマスの種子より獲物を優先':'上→右→下→左で先に食べられる対象';
 if(a.type==='ladybird')ctx.action.reason='隣のアブラムシを捕食し、そのマスへ移動';
 if(c.animal?.id===a.id||!c.animal){const p=c.plant;c.plant=null;feed(ctx,a,'seed');stat(ctx,'seedMeals');logEvent(ctx,'meal',`${point(c)}：小鳥が種子を食べた。発芽する草はなくなった。`,[a,p],c,{actorPosition:{r:a.r,c:a.c},food:'seed',resourceId:p.id});return;}
 ctx.action.preyFoods=copy(SPECIES[c.animal?.type]?.prey||[]);ctx.action.nearbyPrey=nearby(s,c.r,c.c,false).filter(n=>SPECIES[c.animal?.type]?.prey?.includes(n.animal?.type)).map(n=>({id:n.animal.id,type:n.animal.type,...observedPoint(n)}));
 const prey=c.animal,preyPosition={r:prey.r,c:prey.c};killAnimal(ctx,prey,`${d.name}に捕食された`);if(a.type==='ladybird')move(ctx,a,c,'predation');feed(ctx,a,prey.type);stat(ctx,'predations');stat(ctx,a.type+'Predations');if(prey.bornTurn)stat(ctx,'newbornPredations');logEvent(ctx,'predation',`${point(preyPosition)}：${d.name}が${SPECIES[prey.type].name}を捕食。`,[a,prey],preyPosition,{actorPosition:{r:a.r,c:a.c},preyType:prey.type,newborn:!!prey.bornTurn});}
function reproduce(ctx){const rules=reproductionRules(ctx.stage);if(!rules.enabled)return;for(const a of phaseAnimals(ctx.s,['slug','aphid'])){if(!ctx.normalFed.has(a.id)||a.reproduced||a.meals<rules.mealsRequired)continue;const options=nearby(ctx.s,a.r,a.c,false),blocked=options.filter(c=>c.terrain!=='soil'||c.plant||c.animal).map(c=>({r:c.r,c:c.c,reason:c.terrain!=='soil'?c.terrain:c.plant?.type||c.animal?.type}));const target=options.find(c=>c.terrain==='soil'&&!c.plant&&!c.animal);const reason=animals(ctx.s).length>=RULES.maxAnimals?'全体16匹上限':animals(ctx.s,a.type).length>=rules.maxAlive?'同種3匹上限':!target?'隣接する土が塞がっている':null;
 const blockedBefore=(reason&&reason!=='隣接する土が塞がっている'?[]:options).slice(0,reason?options.length:options.indexOf(target)).filter(c=>c.terrain!=='soil'||c.plant||c.animal).map(observedCell);const birthObservation={blockedBefore,candidates:options.map((c,i)=>({...observedCell(c),chosen:!reason&&c===target,checked:!(reason&&reason!=='隣接する土が塞がっている')&&(target?i<=options.indexOf(target):true)}))};
 if(reason){logEvent(ctx,'birth-blocked',`${point(a)}：出生待ち（${reason}）。${blockedBefore.length?'塞がった場所：'+blockedBefore.map(b=>point(b)+' '+(SPECIES[b.plant?.type||b.animal?.type]?.name||b.terrain)).join('、')+'。':''}次の採食で再試行。`,[a],a,{blocked,reason,observation:birthObservation});continue;}
 const child={id:'e'+ctx.s.nextId++,type:a.type,r:target.r,c:target.c,hunger:0,meals:0,reproduced:false,bornTurn:ctx.s.turn,parentId:a.id};if(observedRecords(ctx).some(r=>r.kind==='meal'&&r.food==='seed'&&r.position.r===target.r&&r.position.c===target.c))stat(ctx,'seedClearedBirths');if(blockedBefore.some(c=>cellAt(ctx.s,c.r,c.c).animal?.bornTurn===ctx.s.turn))stat(ctx,'birthCompetition');target.animal=child;a.reproduced=true;stat(ctx,'births');stat(ctx,a.type+'Births');logEvent(ctx,'birth',`${point(child)}：${SPECIES[a.type].name}の子が誕生。次ターンから行動。${blockedBefore.length?' 避けた場所：'+blockedBefore.map(b=>point(b)+' '+(SPECIES[b.plant?.type||b.animal?.type]?.name||b.terrain)).join('、'):''}`,[a,child],child,{parentId:a.id,childId:child.id,birthCompetition:blockedBefore.some(c=>cellAt(ctx.s,c.r,c.c).animal?.bornTurn===ctx.s.turn),blocked,observation:birthObservation});}}
function advance(input,stage,observe=null){const s=copy(input);if(s.status!=='running'||s.turn>=stage.limit)return s;s.turn++;const ctx={s,stage,observe,events:[],records:[],fed:new Set(),normalFed:new Set(),phase:'decomposition',action:null,startCells:copy(input.cells)};
 for(const a of phaseAnimals(s,'earthworm'))if(isAlive(s,a))forage(ctx,a);
 ctx.phase='growth';for(const c of s.cells)if(c.trace&&!c.plant&&c.terrain==='soil'){c.trace=false;c.plant={id:'e'+s.nextId++,type:'mushroom',r:c.r,c:c.c};stat(ctx,'fungi');logEvent(ctx,'growth',`${point(c)}：痕跡から通常キノコが発生。`,[],c);}
 for(const [phase,types] of [['herbivores',['caterpillar','grasshopper','aphid']],['bee',['bee']],['predators',['bird','frog','ladybird','spider']],['slug',['slug']]]){ctx.phase=phase;for(const a of phaseAnimals(s,types))if(isAlive(s,a))(phase==='predators'?hunt:forage)(ctx,a);
 if(phase==='predators')for(const cell of s.cells)if(cell.plant?.type==='seed'&&(animals(s,'bird').length||reproductionRules(stage).enabled&&animals(s).some(a=>['slug','aphid'].includes(a.type)&&Math.abs(a.r-cell.r)+Math.abs(a.c-cell.c)<=2)))logEvent(ctx,'seed-held',`${point(cell)}：小鳥に食べられず、種子が残った。${reproductionRules(stage).enabled?'ここは出生先に使えない。':'成長判定はターン末。'}`,[cell.plant],cell,{observation:{reason:reproductionRules(stage).enabled?'種子が残るマスには出生できない':'種子が残った。成長判定はターン末'}});
 }
 ctx.phase='status';for(const a of phaseAnimals(s)){if(a.poisoned){killAnimal(ctx,a,'毒で死亡した');continue;}a.hunger=ctx.fed.has(a.id)?0:a.hunger+1;logEvent(ctx,'hunger',`${point(a)}：${SPECIES[a.type].name} 空腹${a.hunger}/3。`,[a],a,{hunger:a.hunger});if(a.hunger>=3)killAnimal(ctx,a,'空腹で死亡した');}
 ctx.phase='reproduction';reproduce(ctx);
 ctx.phase='flower';for(const c of s.cells)if(c.plant?.type==='flower'){const p=c.plant,now=slugNear(s,p);const slugs=nearby(s,p.r,p.c).filter(c=>c.animal?.type==='slug').map(c=>({id:c.animal.id,...observedPoint(c)})),previousSlugs=ctx.startCells.filter(c=>c.animal?.type==='slug'&&Math.abs(c.r-p.r)+Math.abs(c.c-p.c)<=1).map(c=>({id:c.animal.id,...observedPoint(c)}));const observation={slugs,previousSlugs,previousPresent:p.previousSlug};if(!p.bloom&&p.previousSlug&&!now){p.bloom=true;p.nectar=2;stat(ctx,'blooms');logEvent(ctx,'bloom',`${point(p)}：ナメクジが周囲を離れて開花。蜜2回分。`,[p],p,{observation});}else if(!p.bloom)logEvent(ctx,'flower-wait',`${point(p)}：${now?'周囲にナメクジがいるため、つぼみのまま。':'前回もナメクジ不在。開花のきっかけはまだない。'}`,[p],p,{observation});p.previousSlug=now;}
 ctx.phase='germination';for(const c of s.cells)if(c.plant?.type==='seed'){const p=c.plant,before=p.growth,shore=isShore(s,c);p.growth+=shore?2:1;logEvent(ctx,'seed-growth',`${point(p)}：${shore?'岸':'土'}で種子 ${before}→${p.growth}/2。`,[p],p,{cause:shore?'shore':'soil',before,after:p.growth});if(p.growth>=2){p.type='grass';stat(ctx,'germinations');if(p.sourceFlower)stat(ctx,'dispersedGerminations');if(shore)stat(ctx,'shoreGerminations');logEvent(ctx,'germinate',`${point(p)}：種子が発芽して草になった。`,[p],p,{dispersed:!!p.sourceFlower});}}
 if(s.turn===stage.limit){s.status=conditions(s,stage).every(g=>g.met)?'won':'lost';ctx.phase='goal';logEvent(ctx,'goal',s.status==='won'?'すべての目標を達成！':'未達成の条件を確認しよう。');}s.logs.push({turn:s.turn,events:ctx.events,records:ctx.records});return s;}
function solveStage(stage){let success=0,example=null;const examples=stage.examples||[];for(const p of examples){if(!completePlacement(stage,p))continue;let s=createInitial(stage,p);while(s.turn<stage.limit)s=advance(s,stage);if(s.status==='won'){success++;example??=copy(p);}}return {stage:stage.id,tested:examples.length,success,failed:examples.length-success,rejected:0,hasSolution:success>0,example,exhaustive:false};}
