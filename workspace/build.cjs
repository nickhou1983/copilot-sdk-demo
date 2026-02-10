const pptxgen = require('pptxgenjs');
const html2pptx = require('/Users/qifenghou/.claude/skills/pptx/scripts/html2pptx.js');
const path = require('path');

async function build() {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Copilot SDK Demo';
  pptx.title = 'Copilot SDK Demo 项目介绍';

  const slidesDir = path.join(__dirname, 'slides');
  const slideFiles = [
    'slide01.html', 'slide02.html', 'slide03.html', 'slide04.html',
    'slide05.html', 'slide06.html', 'slide07.html', 'slide08.html',
    'slide09.html', 'slide10.html', 'slide11.html'
  ];

  for (const file of slideFiles) {
    console.log(`Processing ${file}...`);
    await html2pptx(path.join(slidesDir, file), pptx);
  }

  const outPath = path.join(__dirname, '..', 'Copilot_SDK_Demo_项目介绍.pptx');
  await pptx.writeFile({ fileName: outPath });
  console.log(`Presentation saved to: ${outPath}`);
}

build().catch(err => { console.error(err); process.exit(1); });
