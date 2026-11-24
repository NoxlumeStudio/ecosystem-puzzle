// Narrative data, read receipts, scheduling and presentation never enter advance().
const STORY_CHARACTERS={doctor:{name:'博士（ドクター・ボルボル）',role:'銀河最高の天才科学者（自称）'},pipi:{name:'ピピ',role:'研究船管理AI'},narration:{name:'研究記録',role:''}};
const STORY_KIND_LABELS={intro:'章導入',before:'実験開始',clear:'クリア',failure:'失敗',ending:'エンディング'};
const STORY_STORAGE_KEY='ecosystem.story.v2.2.read';
const PROGRESS_STORAGE_KEY='ecosystem.progress.v1';
// This is the sole clear history. It never belongs to a rewindable board snapshot.
function createProgressStore({stages=STAGES,storage=null,schedule=typeof setTimeout==='function'?setTimeout:null,unschedule=typeof clearTimeout==='function'?clearTimeout:null,onPersistenceError=()=>{}}={}){
 const ids=new Set(stages.map(s=>s.id));let cleared=new Set(),session=null,endingReached=false,operationGuideSeen=false,introducedSpecies=new Set(),persistent=!!storage,pending=null,dirty=false;
 function validatedSession(raw){
  const st=stages.find(s=>s.id===raw?.stageId);if(!st||!raw.placements||typeof raw.placements!=='object'||Array.isArray(raw.placements))return null;
  try{
   const entries=Object.entries(raw.placements);if(entries.length>(st.deployment?.max||0))return null;
   const placements=Object.fromEntries(entries.map(([id,e])=>{if(!/^p[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id.slice(1)))||!e||!Number.isInteger(e.r)||!Number.isInteger(e.c)||typeof e.type!=='string')throw Error('invalid placement');return [id,{type:e.type,r:e.r,c:e.c}];}));
   createInitial(st,placements);return {stageId:st.id,placements,experimentStarted:raw.experimentStarted===true};
  }catch{return null;}
 }
 let saved=null;try{const value=storage?.getItem(PROGRESS_STORAGE_KEY);try{saved=JSON.parse(value||'null');}catch{/* Corrupt data is ignored and can be replaced on the next save. */}}catch{persistent=false;}
 if([1,2].includes(saved?.schema)&&Array.isArray(saved.cleared)){
  cleared=new Set(saved.cleared.filter(id=>ids.has(id)));
  if(saved.schema===2){introducedSpecies=new Set((Array.isArray(saved.introducedSpecies)?saved.introducedSpecies:[]).filter(t=>typeof t==='string'&&Object.hasOwn(SPECIES,t.startsWith('fixed:')?t.slice(6):t)));operationGuideSeen=saved.operationGuideSeen===true;session=validatedSession(saved.current);endingReached=saved.endingReached===true&&cleared.size===ids.size;}
 }
 // Unlocks derive from actual clear records, never from the old all-open list.
 function unlockedIds(){return stages.filter((st,i)=>i===0||cleared.has(st.id)||cleared.has(stages[i-1].id)).map(st=>st.id);}
 if(session&&!unlockedIds().includes(session.stageId))session=null;
 function cancelPending(){if(pending!==null){unschedule?.(pending);pending=null;}}
 function flush(){cancelPending();if(!persistent)return false;if(!dirty)return true;try{storage.setItem(PROGRESS_STORAGE_KEY,JSON.stringify({schema:2,cleared:[...cleared],unlocked:unlockedIds(),current:session,endingReached,operationGuideSeen,introducedSpecies:[...introducedSpecies]}));dirty=false;return true;}catch{persistent=false;onPersistenceError();return false;}}
 function persist(defer=false){dirty=true;if(defer&&schedule){cancelPending();pending=schedule(flush,150);}else flush();}
 return {
  get clearedIds(){return [...cleared];},get unlockedIds(){return unlockedIds();},
  get total(){return ids.size;},get complete(){return ids.size>0&&[...ids].every(id=>cleared.has(id));},
  get introducedSpecies(){return [...introducedSpecies];},
  markSpeciesIntroduced(type){if(!Object.hasOwn(SPECIES,type.startsWith('fixed:')?type.slice(6):type)||introducedSpecies.has(type))return;introducedSpecies.add(type);persist();},
  get operationGuideSeen(){return operationGuideSeen;},
  markOperationGuideSeen(){if(operationGuideSeen)return;operationGuideSeen=true;persist();},
  get persistent(){return persistent;},get session(){return session&&copy(session);},get endingReached(){return endingReached;},flush,
  saveSession(stageId,placements,{defer=false,experimentStarted=false}={}){
   const next=validatedSession({stageId,placements,experimentStarted});if(!next||!unlockedIds().includes(stageId))return false;
   if(JSON.stringify(next)===JSON.stringify(session))return true;
   session=next;persist(defer);return true;
  },
  recordClear(id){if(!ids.has(id)||cleared.has(id))return false;cleared.add(id);persist();return true;},
  markEndingReached({save=true}={}){if(cleared.size!==ids.size||endingReached)return;endingReached=true;dirty=true;if(save)persist();},
  resetAll(extraKeys=[]){
   cancelPending();try{if(storage)for(const key of [PROGRESS_STORAGE_KEY,...extraKeys])storage.removeItem(key);}catch{persistent=false;onPersistenceError();return false;}
   cleared=new Set();session=null;endingReached=false;operationGuideSeen=false;introducedSpecies=new Set();dirty=false;persistent=!!storage;return true;
  }
 };
}
function createStoryController({data=STORY_DATA,stages=STAGES,storage=null,onChange=()=>{}}={}){
 const byId=new Map(data.events.map(e=>[e.id,e]));
 const progress=createProgressStore({stages,storage,onPersistenceError:()=>notify()});
 let read=new Set(),queue=[],lineIndex=0,storageAvailable=!!storage;
 let savedStory=null;
 try{const value=storage?.getItem(STORY_STORAGE_KEY);try{savedStory=JSON.parse(value||'null');}catch{}}catch{storageAvailable=false;}
 if(savedStory?.schema===1&&savedStory.scenarioVersion===data.scenarioVersion&&Array.isArray(savedStory.read)){
  read=new Set(savedStory.read.filter(id=>byId.has(id)));
  const stage=stages.find(s=>s.id===progress.session?.stageId);
  if(stage&&Array.isArray(savedStory.pending)){
   queue=[...new Set(savedStory.pending)].filter(id=>{const e=byId.get(id);return e&&!read.has(id)&&(e.stageId===stage.id||e.kind==='intro'&&e.chapterId===`chapter-${stage.chapter}`||e.kind==='ending'&&progress.complete);});
   if(queue.length&&Number.isInteger(savedStory.lineIndex)&&savedStory.lineIndex>=0&&savedStory.lineIndex<byId.get(queue[0]).lines.length)lineIndex=savedStory.lineIndex;
  }
 }
 function persist(){if(data.events.some(e=>e.kind==='ending'&&read.has(e.id)))progress.markEndingReached();if(!storageAvailable)return;try{storage.setItem(STORY_STORAGE_KEY,JSON.stringify({schema:1,scenarioVersion:data.scenarioVersion,read:[...read],pending:queue,lineIndex}));}catch{storageAvailable=false;}}
 function notify(){if(controller.current?.kind==='ending')progress.markEndingReached();onChange();}
 function endingIds(){return progress.complete?data.events.filter(e=>e.kind==='ending').map(e=>e.id):[];}
 function idsForStage(stage,kind){return data.events.filter(e=>e.stageId===stage.id&&e.kind===kind).map(e=>e.id);}
 const controller={
  get active(){return queue.length>0;},
  get current(){return queue.length?byId.get(queue[0]):null;},
  get lineIndex(){return lineIndex;},
  get line(){return controller.current?.lines[lineIndex]||null;},
  get queuedIds(){return [...queue];},
  get readIds(){return [...read];},
  get persistent(){return storageAvailable;},
  get progress(){return progress;},
  isRead(id){return read.has(id);},
  resume(){if(!controller.active&&progress.complete)return controller.enqueue(endingIds().filter(id=>!read.has(id)));return false;},
  flush(){if(data.events.some(e=>e.kind==='ending'&&read.has(e.id)))progress.markEndingReached();progress.flush();},
  resetProgress(){if(!progress.resetAll([STORY_STORAGE_KEY]))return false;read=new Set();queue=[];lineIndex=0;storageAvailable=!!storage;notify();return true;},
  enqueue(ids,{replay=false}={}){
   if(controller.active&&replay)return false;
   const fresh=ids.filter(id=>byId.has(id)&&!queue.includes(id)&&(replay||!read.has(id)));
   if(!fresh.length)return false;
   queue.push(...fresh);persist();notify();return true;
  },
  enterStage(stage){
   const firstInChapter=stages.find(s=>s.chapter===stage.chapter)?.id===stage.id;
   const intro=data.events.filter(e=>e.kind==='intro'&&e.chapterId===`chapter-${stage.chapter}`&&(!read.has(e.id)||firstInChapter)).map(e=>e.id);
   return controller.enqueue([...intro,...idsForStage(stage,'before'),...endingIds().filter(id=>!read.has(id))],{replay:true});
  },
  outcome(stage,status){
   if(!['won','lost'].includes(status))return false;
   if(status==='won')progress.recordClear(stage.id);
   const endings=status==='won'?endingIds().filter(id=>!read.has(id)||stage.id===stages.at(-1)?.id):[];
   const queued=controller.enqueue([...idsForStage(stage,status==='won'?'clear':'failure'),...endings],{replay:true});
   if(!queued)notify();
   return queued;
  },
  next(){
   if(!controller.active)return;
   if(lineIndex+1<controller.current.lines.length)lineIndex++;
   else{read.add(queue.shift());lineIndex=0;}
   persist();notify();
  },
  skipAll(){if(!controller.active)return;for(const id of queue)read.add(id);queue=[];lineIndex=0;persist();notify();},
  replay(id){return read.has(id)&&controller.enqueue([id],{replay:true});},
  recordsFor(stage,{all=false}={}){return data.events.filter(e=>read.has(e.id)&&(all||e.kind==='ending'||e.stageId===stage.id||(e.kind==='intro'&&e.chapterId===`chapter-${stage.chapter}`)));}
 };
 if(data.events.some(e=>e.kind==='ending'&&read.has(e.id)))progress.markEndingReached({save:false});
 return controller;
}
function browserStoryStorage(){try{return typeof window==='undefined'?null:window.localStorage;}catch{return null;}}
