import { mkdir, readFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const assetsPath = path.resolve(root, 'assets');
const input = path.join(assetsPath, 'logo.svg');
const outputDir = path.resolve(assetsPath, 'icons');

const logoSvg = await readFile(input);

const sizes = [16, 48, 128];

console.log('Generating icons...\n');

await mkdir(outputDir, { recursive: true });

await Promise.all(
  sizes.map(async (size) => {
    const outputPath = path.resolve(outputDir, `icon-${size}.png`);
    await sharp(logoSvg, {
      // 提高 SVG 栅格化清晰度
      density: 300,
    })
      .resize(size, size, {
        fit: 'contain',
        // 背景透明
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({
        compressionLevel: 9,
      })
      .toFile(outputPath);

    console.log(`Generated ${path.relative(root, outputPath)}`);
  }),
);

console.log('\nDone!\n');
