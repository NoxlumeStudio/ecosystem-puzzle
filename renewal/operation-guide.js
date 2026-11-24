// ST1 presentation only: progress follows successful UI actions, never a timer.
const OPERATION_GUIDE_TEXTS=Object.freeze([
 '', '① まずはここから生き物や植物を選ぼう！',
 '② 置ける場所を選んで配置しよう！', '③ 準備ができたら実験開始！'
]);
function createOperationGuide({eligible=false,onComplete=()=>{}}={}){
 let pending=eligible,step=0,visible=false;
 function finish(){pending=false;step=0;visible=false;onComplete();}
 return {
  get step(){return step;},get visible(){return visible;},
  get text(){return OPERATION_GUIDE_TEXTS[step];},
  sync({stageId,mode,conversation=false,ready=true}){
   if(stageId!=='renewal-1'){pending=false;step=0;}
   if(mode!=='placement')step=0;
   if(pending&&ready&&stageId==='renewal-1'&&mode==='placement'&&!conversation){pending=false;step=1;}
   visible=step>0&&ready&&stageId==='renewal-1'&&mode==='placement'&&!conversation;
   return visible;
  },
  action(kind){
   if(!visible)return;
   if(kind==='selected'&&step===1)step=2;
   else if(kind==='placed')step=3;
   else if(kind==='started')finish();
  },
  skip(){if(step>0)finish();},
  replay(){pending=false;step=1;},
  reset(){pending=true;step=0;visible=false;}
 };
}

// ST1 is a worked experiment, not a new rule or an automatic placement.
// The player can skip it or use any other legal composition at any time.
const ST1_TRIAL_PIECES=Object.freeze([
 {type:'grasshopper',r:3,c:0,choose:'① バッタは草、小鳥は虫を食べるよ。まずバッタを選ぼう！',place:'② 光るマスへバッタを置こう。ここから草を食べに進むよ。'},
 {type:'grass',r:2,c:0,choose:'② 次は草を選ぼう。バッタのすぐ上に食事を用意しよう！',place:'② 光るマスへ草を置こう。バッタの最初の食事になるよ。'},
 {type:'grass',r:1,c:0,choose:'② もう一つ草を選ぼう。次の食事も用意すると生き残りやすいよ。',place:'② もう一つの光るマスへ草を置こう。次の食事を用意しよう！'},
 {type:'bird',r:0,c:2,choose:'② 小鳥を選ぼう。イモムシを食べる役だよ！',place:'② 光るマスへ小鳥を置こう。草を食べたイモムシが近づく場所だよ。'}
]);
function st1GuidePlan(st,placements,selected,step=2){
 if(st.id!=='renewal-1')return null;
 if(completePlacement(st,placements))return {focus:'start',text:'③ 準備できた！「開始」、続いて「1ターン」で食事を見てみよう！'};
 const placed=Object.values(placements),piece=ST1_TRIAL_PIECES.find(p=>!placed.some(e=>e.type===p.type&&e.r===p.r&&e.c===p.c));
 if(!piece)return {focus:'start',text:'③ 準備できた！「開始」で食事を試してみよう！'};
 try{createInitial(st,{...placements,'trial-example':{type:piece.type,r:piece.r,c:piece.c}});}catch{return {focus:null,text:'自由な配置でも実験できるよ。案内の配置例を試すなら「リセット」で置き直そう。'};}
 return selected===piece.type&&step!==1?{focus:'board',target:{r:piece.r,c:piece.c},type:piece.type,text:piece.place}:{focus:'inventory',type:piece.type,text:piece.choose};
}
function st1TrialObservation(s){
 if(s.turn===0)return '「1ターン」を押そう。バッタの草と、小鳥のイモムシに注目！';
 const grass=s.stats.grasshopperMeals||0,bird=s.stats.birdPredations||0,alive=count(s,'grasshopper');
 if(s.status==='won')return '両立できた！バッタが草を食べ、小鳥も虫を食べて、バッタが最後まで残ったよ。';
 if(s.status==='lost')return `今回はバッタの食事${grass}回、小鳥の捕食${bird}回、バッタ生存${alive}匹。足りなかった条件を確かめよう。`;
 if(s.turn===1&&grass&&bird){const rows=s.logs.find(l=>l.turn===1)?.records||[];const fed=rows.findIndex(r=>r.kind==='meal'&&r.food==='grass'&&r.observation?.actorTypes?.[r.actors[0]]==='caterpillar'),caught=rows.findIndex(r=>r.kind==='predation'&&r.preyType==='caterpillar');return fed>=0&&caught>fed?'バッタも小鳥も食事できた！草を食べて動いたイモムシを、小鳥が食べたよ。':'バッタも小鳥も食事できた！次はバッタがもう一つの草へ進む様子を見よう。';}
 if(s.turn===2&&grass>=2&&bird&&alive)return 'バッタは次の草も食べたよ。小鳥の餌は虫。食事を分けて両立できたね。最後まで生き残れるか確かめよう！';
 return `バッタの食事${grass}回、小鳥の捕食${bird}回、バッタ生存${alive}匹。最後まで残れるか次のターンを見よう。`;
}
