import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];

if (!file) {
  console.error('Usage: node tools/inspect-glb.mjs <model.glb>');
  process.exit(1);
}

const data = fs.readFileSync(file);
const magic = data.toString('utf8', 0, 4);

if (magic !== 'glTF') {
  throw new Error('Not a GLB file');
}

const version = data.readUInt32LE(4);
const length = data.readUInt32LE(8);
let offset = 12;
let json = null;
let binLength = 0;

while (offset < length) {
  const chunkLength = data.readUInt32LE(offset);
  const chunkType = data.toString('utf8', offset + 4, offset + 8);
  const chunkStart = offset + 8;
  const chunkEnd = chunkStart + chunkLength;

  if (chunkType === 'JSON') {
    json = JSON.parse(data.toString('utf8', chunkStart, chunkEnd).trim());
  }

  if (chunkType === 'BIN\0') {
    binLength = chunkLength;
  }

  offset = chunkEnd;
}

if (!json) {
  throw new Error('GLB JSON chunk not found');
}

const rel = path.relative(process.cwd(), file);
console.log(`File: ${rel}`);
console.log(`GLB version: ${version}`);
console.log(`Total size: ${data.length} bytes`);
console.log(`Binary chunk: ${binLength} bytes`);
console.log('');

const materials = json.materials ?? [];
console.log(`Materials (${materials.length})`);
materials.forEach((material, index) => {
  const color = material.pbrMetallicRoughness?.baseColorFactor;
  const colorText = color ? ` color=${color.map((n) => Number(n).toFixed(3)).join(',')}` : '';
  const texture = material.pbrMetallicRoughness?.baseColorTexture?.index;
  const textureText = texture !== undefined ? ` baseColorTexture=${texture}` : '';
  console.log(`  [${index}] ${material.name ?? '(unnamed)'}${colorText}${textureText}`);
});
console.log('');

const textures = json.textures ?? [];
console.log(`Textures (${textures.length})`);
textures.forEach((texture, index) => {
  console.log(`  [${index}] source=${texture.source ?? '(none)'} sampler=${texture.sampler ?? '(none)'}`);
});
console.log('');

const images = json.images ?? [];
console.log(`Images (${images.length})`);
images.forEach((image, index) => {
  const view = image.bufferView !== undefined ? json.bufferViews?.[image.bufferView] : null;
  const sizeText = view ? ` bytes=${view.byteLength}` : '';
  console.log(`  [${index}] ${image.name ?? '(unnamed)'} mime=${image.mimeType ?? '(unknown)'}${sizeText}`);
});
console.log('');

const meshes = json.meshes ?? [];
console.log(`Meshes (${meshes.length})`);
meshes.forEach((mesh, index) => {
  const prims = mesh.primitives ?? [];
  const materialIds = [...new Set(prims.map((primitive) => primitive.material).filter((id) => id !== undefined))];
  const materialNames = materialIds.map((id) => materials[id]?.name ?? `material_${id}`).join(', ');
  const primText = `${prims.length} primitive${prims.length === 1 ? '' : 's'}`;
  console.log(`  [${index}] ${mesh.name ?? '(unnamed)'} - ${primText}${materialNames ? ` - ${materialNames}` : ''}`);
});
console.log('');

const nodes = json.nodes ?? [];
console.log(`Nodes (${nodes.length})`);
nodes.forEach((node, index) => {
  const meshName = node.mesh !== undefined ? meshes[node.mesh]?.name ?? `mesh_${node.mesh}` : '';
  const meshText = node.mesh !== undefined ? ` mesh=[${node.mesh}] ${meshName}` : '';
  const childText = node.children?.length ? ` children=${node.children.join(',')}` : '';
  console.log(`  [${index}] ${node.name ?? '(unnamed)'}${meshText}${childText}`);
});
