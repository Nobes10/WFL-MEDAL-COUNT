import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = join(root, 'build');
const srcPng = join(buildDir, 'icon.png');
const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const edgeCandidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

function renderLogoPng() {
  const svgPath = join(buildDir, 'wfl-logo.svg');
  if (!existsSync(svgPath)) return;
  const edge = edgeCandidates.find((file) => existsSync(file));
  if (!edge) throw new Error('Microsoft Edge is required to rasterize build/wfl-logo.svg');
  const htmlPath = join(buildDir, 'icon-src.html');
  const svg = readFileSync(svgPath, 'utf8').replace(/<\?xml[^>]*>/, '');
  writeFileSync(
    htmlPath,
    `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;width:1024px;height:1024px;overflow:hidden;background:#0d1117}
      body{display:grid;place-items:center}
      svg{width:86%;height:auto;display:block}
    </style></head><body>${svg}</body></html>`
  );
  const userData = join(tmpdir(), 'wfl-medal-count-icon');
  execFileSync(
    edge,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--user-data-dir=${userData}`,
      '--window-size=1024,1024',
      `--screenshot=${srcPng}`,
      pathToFileURL(htmlPath).href,
    ],
    { stdio: 'inherit' }
  );
  try {
    unlinkSync(htmlPath);
  } catch {
    /* keep going */
  }
}

renderLogoPng();

const ps = `
Add-Type -AssemblyName System.Drawing
$srcPath = ${JSON.stringify(srcPng)}
$outDir = ${JSON.stringify(buildDir)}
$src = [System.Drawing.Image]::FromFile($srcPath)
$sizes = @(${sizes.join(',')})
foreach ($s in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(255, 13, 17, 23))
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $inset = 0
  $g.DrawImage($src, $inset, $inset, $s - ($inset * 2), $s - ($inset * 2))
  $g.Dispose()
  $out = Join-Path $outDir ("icon-$s.png")
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
$src.Dispose()
`;

mkdirSync(buildDir, { recursive: true });
execFileSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' });

function pngToIco(images) {
  const headerSize = 6 + 16 * images.length;
  let offset = headerSize;
  const total = images.reduce((sum, image) => sum + image.png.length, headerSize);
  const buf = Buffer.alloc(total);
  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(images.length, 4);
  for (const [index, image] of images.entries()) {
    const entry = 6 + index * 16;
    buf.writeUInt8(image.width >= 256 ? 0 : image.width, entry);
    buf.writeUInt8(image.height >= 256 ? 0 : image.height, entry + 1);
    buf.writeUInt8(0, entry + 2);
    buf.writeUInt8(0, entry + 3);
    buf.writeUInt16LE(1, entry + 4);
    buf.writeUInt16LE(32, entry + 6);
    buf.writeUInt32LE(image.png.length, entry + 8);
    buf.writeUInt32LE(offset, entry + 12);
    image.png.copy(buf, offset);
    offset += image.png.length;
  }
  return buf;
}

const images = sizes.map((size) => ({
  width: size,
  height: size,
  png: readFileSync(join(buildDir, `icon-${size}.png`)),
}));
writeFileSync(join(buildDir, 'icon.ico'), pngToIco(images));
for (const size of sizes) {
  try {
    unlinkSync(join(buildDir, `icon-${size}.png`));
  } catch {
    /* keep going */
  }
}
console.log(`Wrote build/icon.ico with sizes ${sizes.join(', ')}`);
