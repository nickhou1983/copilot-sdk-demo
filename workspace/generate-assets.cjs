const sharp = require('sharp');
const path = require('path');
const dir = path.join(__dirname, 'assets');

async function createGradient(filename, color1, color2, angle = '135') {
  const x2 = angle === '135' ? '100%' : '0%';
  const y2 = '100%';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="${x2}" y2="${y2}">
      <stop offset="0%" style="stop-color:${color1}"/>
      <stop offset="100%" style="stop-color:${color2}"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(dir, filename));
}

async function createAccentBar(filename, color, w = 12, h = 540) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="${color}"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(dir, filename));
}

async function createCircle(filename, color, size = 120, opacity = 0.15) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${color}" opacity="${opacity}"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(dir, filename));
}

async function createTitleBg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">
    <defs>
      <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#181B24"/>
        <stop offset="100%" style="stop-color:#2A1F4E"/>
      </linearGradient>
    </defs>
    <rect width="960" height="540" fill="url(#g1)"/>
    <rect x="0" y="0" width="8" height="540" fill="#B165FB"/>
    <circle cx="850" cy="100" r="200" fill="#B165FB" opacity="0.07"/>
    <circle cx="750" cy="450" r="150" fill="#40695B" opacity="0.08"/>
    <rect x="0" y="480" width="960" height="4" fill="#B165FB" opacity="0.3"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(dir, 'title-bg.png'));
}

async function createSlideBg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">
    <rect width="960" height="540" fill="#181B24"/>
    <rect x="0" y="0" width="6" height="540" fill="#B165FB"/>
    <rect x="0" y="0" width="960" height="56" fill="#1E2130"/>
    <rect x="0" y="56" width="960" height="2" fill="#B165FB" opacity="0.4"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(dir, 'slide-bg.png'));
}

async function createEndBg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">
    <defs>
      <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#2A1F4E"/>
        <stop offset="100%" style="stop-color:#181B24"/>
      </linearGradient>
    </defs>
    <rect width="960" height="540" fill="url(#g1)"/>
    <circle cx="480" cy="270" r="300" fill="#B165FB" opacity="0.05"/>
    <rect x="0" y="0" width="6" height="540" fill="#B165FB"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(dir, 'end-bg.png'));
}

(async () => {
  await Promise.all([createTitleBg(), createSlideBg(), createEndBg()]);
  console.log('Assets generated.');
})();
