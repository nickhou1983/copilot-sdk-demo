const sharp = require('sharp');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const { FaRobot, FaCode, FaTools, FaShieldAlt, FaStar, FaStream, FaLayerGroup, FaCogs, FaArrowRight, FaLock, FaServer, FaDesktop, FaPuzzlePiece, FaBolt, FaCloudUploadAlt, FaComments, FaBrain, FaExchangeAlt } = require('react-icons/fa');

async function createGradient(filename, color1, color2, angle = '135') {
  const x1 = angle === '135' ? '0%' : '0%';
  const y1 = angle === '135' ? '0%' : '0%';
  const x2 = angle === '135' ? '100%' : '100%';
  const y2 = angle === '135' ? '100%' : '0%';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">
    <defs>
      <linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
        <stop offset="0%" style="stop-color:${color1}"/>
        <stop offset="100%" style="stop-color:${color2}"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(filename);
}

async function createAccentBar(filename, color, w, h) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="100%" height="100%" fill="${color}" rx="4" ry="4"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(filename);
}

async function rasterizeIcon(IconComponent, color, size, filename) {
  const svgString = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color: `#${color}`, size: size })
  );
  await sharp(Buffer.from(svgString)).png().toFile(filename);
}

async function main() {
  const dir = '/Users/qifenghou/Codes/copilot-sdk-demo/workspace/slides';

  // Gradient backgrounds
  await createGradient(`${dir}/bg-dark.png`, '#0A1628', '#1B3A5C');
  await createGradient(`${dir}/bg-blue.png`, '#1B3A5C', '#2563EB');
  await createGradient(`${dir}/bg-light.png`, '#0F1D32', '#162A4A');
  await createGradient(`${dir}/bg-accent.png`, '#0A1628', '#0F2847');

  // Accent bar
  await createAccentBar(`${dir}/accent-bar.png`, '#3B82F6', 80, 6);
  await createAccentBar(`${dir}/accent-bar-long.png`, '#3B82F6', 200, 4);
  await createAccentBar(`${dir}/divider.png`, '#1E40AF', 600, 2);

  // Icons for slides
  const icons = [
    [FaRobot, 'robot'], [FaCode, 'code'], [FaTools, 'tools'],
    [FaShieldAlt, 'shield'], [FaStar, 'star'], [FaStream, 'stream'],
    [FaLayerGroup, 'layers'], [FaCogs, 'cogs'], [FaArrowRight, 'arrow'],
    [FaLock, 'lock'], [FaServer, 'server'], [FaDesktop, 'desktop'],
    [FaPuzzlePiece, 'puzzle'], [FaBolt, 'bolt'], [FaCloudUploadAlt, 'cloud'],
    [FaComments, 'comments'], [FaBrain, 'brain'], [FaExchangeAlt, 'exchange'],
  ];

  for (const [Icon, name] of icons) {
    await rasterizeIcon(Icon, '3B82F6', '128', `${dir}/icon-${name}-blue.png`);
    await rasterizeIcon(Icon, 'FFFFFF', '128', `${dir}/icon-${name}-white.png`);
    await rasterizeIcon(Icon, '60A5FA', '64', `${dir}/icon-${name}-light.png`);
  }

  console.log('Assets created successfully!');
}

main().catch(console.error);
