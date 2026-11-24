// Hand-built starting points for verification; not an exhaustive solution list.
const EXAMPLE_PIECES=[
[['grasshopper',4,1],['grass',3,1],['grass',2,1],['bird',1,3]],
[['bird',1,2],['bee',4,3],['seed',5,5],['grass',5,1]],
[['mushroom',5,3],['bee',3,4],['seed',1,1],['grass',1,5],['mushroom',5,4]],
[['water',2,3],['mushroom',5,5],['seed',1,5],['rock',4,4],['grass',5,1]],
[['water',2,3],['mushroom',3,1],['mushroom',2,1],['grass',5,5],['seed',1,3],['rock',5,4]],
[['ladybird',1,2],['grass',2,3],['grass',3,4],['grass',3,5],['seed',5,5],['rock',1,5]],
[['slug',3,2],['bee',3,4],['seed',6,6],['grass',6,1],['rock',1,1],['mushroom',6,4]],
[['earthworm',4,3],['bird',2,3],['seed',1,6],['grass',6,1],['mushroom',6,4],['rock',1,1]],
[['bee',4,3],['bird',2,4],['earthworm',5,4],['grass',1,1],['seed',6,1],['grass',2,3],['rock',1,6]],
[['mushroom',2,3],['seed',1,3],['bird',1,2],['seed',6,6],['grass',6,1],['rock',3,2],['seed',2,2]],
[['aphid',2,2],['grass',2,3],['slug',5,3],['mushroom',5,3],['mushroom',4,3],['seed',2,4],['rock',1,3],['mushroom',4,6]],
[['slug',4,3],['mushroom',4,3],['mushroom',3,3],['mushroom',3,1],['seed',2,3],['frog',2,4],['earthworm',6,4],['seed',1,6],['rock',6,1]],
[['bee',4,3],['bird',2,4],['ladybird',6,3],['caterpillar',5,6],['grass',4,6],['grass',3,6],['grass',2,6],['seed',5,5],['seed',6,6],['rock',1,1]],
[['mushroom',4,3],['mushroom',3,3],['mushroom',3,1],['seed',2,3],['frog',2,4],['bee',7,4],['seed',1,2],['grass',1,6],['rock',7,1],['rock',1,7],['water',7,7]],
[['mushroom',4,2],['mushroom',3,2],['mushroom',1,2],['frog',2,1],['poisonMushroom',6,6],['bee',7,4],['earthworm',6,2],['bird',2,6],['caterpillar',2,5],['grass',1,5],['grasshopper',5,6],['grass',4,6],['grass',3,6],['seed',1,6]]
];
for(let i=0;i<STAGES.length;i++)STAGES[i].examples=[Object.fromEntries(EXAMPLE_PIECES[i].map(([type,r,c],j)=>['p'+(j+1),{type,r:r-1,c:c-1}]))];
