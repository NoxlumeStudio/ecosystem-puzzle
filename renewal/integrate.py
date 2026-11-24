from pathlib import Path
import json,re
root=Path(__file__).resolve().parent.parent
p=root/'ecosystem-puzzle.html';s=p.read_text()
start=s.index('// ── Rules and species') if '// ── Rules and species' in s else s.index("'use strict';\nconst RULES=")
end=s.index('const STORY_DATA =',start)
core='// RENEWAL CORE START\n'+(root/'renewal/engine.js').read_text()+'\n'+(root/'renewal/stages.js').read_text()+'\n'+(root/'renewal/examples.js').read_text()+'\n'+(root/'renewal/guidance.js').read_text()+'\n'+(root/'renewal/experiment-history.js').read_text()+'\n'+(root/'renewal/missions.js').read_text()+'\n'+(root/'renewal/operation-guide.js').read_text()+'\n'+(root/'renewal/placement-guidance.js').read_text()+'\n\n'
s=s[:start]+core+s[end:]
if (root/'story/renewal.json').exists():
 end=s.index('// Narrative data,',s.index('const STORY_DATA ='))
 s=s[:s.index('const STORY_DATA =')]+'const STORY_DATA = '+(root/'story/renewal.json').read_text()+';\n\n'+s[end:]
a=s.index('// Narrative data, read receipts, scheduling and presentation never enter advance().');b=s.index('function browserStoryStorage()',a);b=s.index('\n',b)+1
s=s[:a]+(root/'story/controller.js').read_text()+'\n'+s[b:]
ui='// CAUSALITY UI START\n'+(root/'renewal/causality-ui.js').read_text()+'\n// CAUSALITY UI END\n'
if '// CAUSALITY UI START' in s:
 a=s.index('// CAUSALITY UI START');b=s.index('// CAUSALITY UI END',a)+len('// CAUSALITY UI END\n');s=s[:a]+ui+s[b:]
else:s=s.replace('// Committed puzzle state',ui+'\n// Committed puzzle state',1)
css='/* CAUSALITY CSS START */\n'+(root/'renewal/causality.css').read_text()+'\n/* CAUSALITY CSS END */\n'
if '/* CAUSALITY CSS START */' in s:
 a=s.index('/* CAUSALITY CSS START */');b=s.index('/* CAUSALITY CSS END */',a)+len('/* CAUSALITY CSS END */\n');s=s[:a]+css+s[b:]
else:s=s.replace('</style>',css+'</style>',1)
p.write_text(s)
(root/'dist/game.html').write_text(s)
