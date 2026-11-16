import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

// Local asset packaging only. Never calls a generator, service or deploy tool.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'public/media/materiali');
const artifact = path.join(root, 'artifacts/materiali/asset-manifest.json');
const current = path.resolve(root, '../outputs/campagna-r03');
const reelRoot = path.resolve(root, '../outputs/R17-chatgpt');
const previous = '/Users/filippodegennaro/Documents/ChatGPT/DDC/outputs/campagna-2026-11-r02';
await fs.mkdir(output, { recursive: true });
await fs.mkdir(path.dirname(artifact), { recursive: true });

const definitions = [
  ['post-01-attuale', 'Primo post — ritratto attuale v8', path.join(current, 'K01-inferno-ritratto-naturale-v8.png'), 'attuale'],
  ['post-01-v7', 'Primo post — somiglianza v7', path.join(current, 'K01-inferno-somiglianza-v7.png'), 'archivio'],
  ['post-01-v6', 'Primo post — volto v6', path.join(current, 'K01-inferno-volto-reference-v6.png'), 'archivio'],
  ['post-01-v5', 'Primo post — carcere infernale v5', path.join(current, 'K01-carcere-infernale-fantasy-v5.png'), 'archivio'],
  ['post-01-v4', 'Primo post — segni sul viso v4', path.join(current, 'K01-cella-segni-senza-occhiali-v4.png'), 'archivio'],
  ['post-01-v2', 'Primo post — look aggiornato v2', path.join(current, 'K01-cella-look-aggiornato-senza-occhiali-v2.png'), 'archivio'],
  ['reel-allenamento', 'Reel — piegamento', path.join(reelRoot, 'images/02-allenamento.png'), 'look-precedente'],
  ['reel-rialzarsi', 'Reel — si rialza', path.join(reelRoot, 'images/03-rialzarsi.png'), 'look-precedente'],
  ['reel-pronto', 'Reel — pronto al salto', path.join(reelRoot, 'images/04-pronto-al-salto.png'), 'look-precedente'],
  ['studio-senza-testo', 'Studio del reparto senza testo', path.join(previous, 'posts/P20-reparto-del-rumore/K03-scena-senza-testo-studio-v1.png'), 'archivio'],
];
const existing = [
  ['01-cella', 'Prima bozza della cella', 'K01-cella-bozza-v1.png'],
  ['02-featuring', 'Post featuring', 'K02-carcere-featuring-bozza-v1.png'],
  ['03-trasformazione', 'Post trasformazione', 'K03-trasformazione-bozza-v1.png'],
  ['04-salto', 'Post salto', 'K04-salto-bozza-v1.png'],
  ['05-fuori', 'Post fuori dal carcere', 'K04B-fuori-bozza-v1.png'],
];
const assets = [];
const archiveEntries = [];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function describe(file, url) {
  const bytes = await fs.readFile(file);
  const meta = await sharp(bytes).metadata();
  return { url, width: meta.width, height: meta.height, bytes: bytes.length, sha256: sha256(bytes) };
}
for (const [slug, label, source, status] of definitions) {
  const original = path.join(output, `${slug}.png`);
  const preview = path.join(output, `${slug}.webp`);
  await fs.copyFile(source, original);
  await sharp(source).resize({ width: 1122, withoutEnlargement: true }).webp({ quality: 82 }).toFile(preview);
  assets.push({ slug, label, source, status,
    original: await describe(original, `/media/materiali/${slug}.png`),
    preview: await describe(preview, `/media/materiali/${slug}.webp`) });
  archiveEntries.push({ file: original, name: `immagini/${slug}.png` });
}
for (const [slug, label, basename] of existing) {
  const file = path.join(root, 'public/media/ig', `${slug}.png`);
  const source = path.join(previous, 'images', basename);
  if (sha256(await fs.readFile(file)) !== sha256(await fs.readFile(source))) {
    throw new Error(`Existing public image differs from source: ${slug}`);
  }
  assets.push({ slug, label, source, status: 'look-precedente',
    original: await describe(file, `/media/ig/${slug}.png`),
    preview: await describe(path.join(root, 'public/media/ig', `${slug}.webp`), `/media/ig/${slug}.webp`) });
  archiveEntries.push({ file, name: `immagini/${slug}.png` });
}

const instagramFile = path.join(output, 'post-01-instagram.jpg');
await sharp(path.join(current, 'K01-inferno-ritratto-naturale-v8.png'))
  .resize(1080, 1350, { fit: 'cover', position: 'centre' })
  .jpeg({ quality: 95, mozjpeg: true }).toFile(instagramFile);
const instagram = await describe(instagramFile, '/media/materiali/post-01-instagram.jpg');
archiveEntries.push({ file: instagramFile, name: 'primo-post/post-01-instagram.jpg' });

const videoSource = path.join(reelRoot, 'R17-allenamento-chatgpt-v1.mp4');
const videoFile = path.join(output, 'reel-allenamento-v1.mp4');
await fs.copyFile(videoSource, videoFile);
const probe = spawnSync('/opt/homebrew/bin/ffprobe', [
  '-v', 'error', '-show_streams', '-show_format', '-of', 'json', videoFile,
], { encoding: 'utf8' });
if (probe.status !== 0) throw new Error(probe.stderr);
const media = JSON.parse(probe.stdout);
const videoStream = media.streams.find(stream => stream.codec_type === 'video');
const audioStream = media.streams.find(stream => stream.codec_type === 'audio');
const video = { url: '/media/materiali/reel-allenamento-v1.mp4', source: videoSource,
  label: 'Reel allenamento — bozza con look precedente',
  width: videoStream.width, height: videoStream.height,
  duration: Number(media.format.duration), frameRate: videoStream.avg_frame_rate,
  videoCodec: videoStream.codec_name, audioCodec: audioStream.codec_name,
  bytes: Number(media.format.size), sha256: sha256(await fs.readFile(videoFile)) };
if (video.duration !== 18 || video.width !== 1080 || video.height !== 1920) {
  throw new Error('Unexpected reel dimensions or duration.');
}
const posterFile = path.join(output, 'reel-poster.jpg');
const posterJob = spawnSync('/opt/homebrew/bin/ffmpeg', [
  '-nostdin', '-v', 'error', '-y', '-i', videoFile,
  '-frames:v', '1', '-q:v', '2', posterFile,
], { encoding: 'utf8' });
if (posterJob.status !== 0) throw new Error(posterJob.stderr);
const poster = await describe(posterFile, '/media/materiali/reel-poster.jpg');
archiveEntries.push({ file: videoFile, name: 'video/reel-allenamento-v1.mp4' });

// User-facing copy is authored separately by the page owner. Include it when ready.
const textDir = path.join(output, 'testi');
try {
  for (const name of (await fs.readdir(textDir)).sort()) {
    if (/\.(txt|md|pdf)$/.test(name)) archiveEntries.push({ file: path.join(textDir, name), name: `testi/${name}` });
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const archiveFile = path.join(output, 'campagna-materiali.zip');
const zipper = spawnSync('python3', ['-c', `
import json,sys,zipfile
data=json.load(sys.stdin)
with zipfile.ZipFile(data['destination'],'w',compression=zipfile.ZIP_DEFLATED,compresslevel=1) as archive:
 for item in data['entries']:
  archive.write(item['file'],item['name'])
with zipfile.ZipFile(data['destination']) as archive:
 bad=archive.testzip()
 if bad: raise RuntimeError('Invalid archive member: '+bad)
 print(json.dumps(archive.namelist()))
`], { input: JSON.stringify({ destination: archiveFile, entries: archiveEntries }), encoding: 'utf8' });
if (zipper.status !== 0) throw new Error(zipper.stderr);
const archive = { url: '/media/materiali/campagna-materiali.zip',
  bytes: (await fs.stat(archiveFile)).size, files: JSON.parse(zipper.stdout), verified: true };
if (archive.files.filter(name => name.endsWith('.png')).length !== 15) throw new Error('Expected fifteen unique PNGs.');
const hashes = assets.map(asset => asset.original.sha256);
if (new Set(hashes).size !== 15) throw new Error('Unexpected duplicate original image.');
const manifest = { date: '2026-11-16', assets, instagram, video, poster, archive,
  originalImageCount: assets.length, originalImageBytes: assets.reduce((sum, asset) => sum + asset.original.bytes, 0),
  newWebpBytes: assets.filter(asset => asset.preview.url.startsWith('/media/materiali/')).reduce((sum, asset) => sum + asset.preview.bytes, 0),
  exclusions: ['Personal reference photographs', 'Separate unreleased audio master or WAV', 'Technical prompts', 'Billing data', 'QA and logs'],
  sourceFilesUnmodified: true };
await fs.writeFile(artifact, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ manifest: artifact, images: assets.length, video, instagram, archive }, null, 2));
