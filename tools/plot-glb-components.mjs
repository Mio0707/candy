import fs from 'node:fs';

const file = process.argv[2];
const output = process.argv[3] ?? '模型/component-map.svg';

if (!file) {
  console.error('Usage: node tools/plot-glb-components.mjs <model.glb> [output.svg]');
  process.exit(1);
}

function readGlb(filePath) {
  const data = fs.readFileSync(filePath);
  const length = data.readUInt32LE(8);
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < length) {
    const chunkLength = data.readUInt32LE(offset);
    const chunkType = data.toString('utf8', offset + 4, offset + 8);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkType === 'JSON') json = JSON.parse(data.toString('utf8', chunkStart, chunkEnd).trim());
    if (chunkType === 'BIN\0') bin = data.subarray(chunkStart, chunkEnd);
    offset = chunkEnd;
  }
  return { json, bin };
}

const componentReaders = {
  5121: { size: 1, read: (buffer, offset) => buffer.readUInt8(offset) },
  5123: { size: 2, read: (buffer, offset) => buffer.readUInt16LE(offset) },
  5125: { size: 4, read: (buffer, offset) => buffer.readUInt32LE(offset) },
  5126: { size: 4, read: (buffer, offset) => buffer.readFloatLE(offset) },
};
const typeCounts = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function readAccessor(json, bin, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  const reader = componentReaders[accessor.componentType];
  const components = typeCounts[accessor.type];
  const stride = view.byteStride ?? reader.size * components;
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const values = [];
  for (let i = 0; i < accessor.count; i += 1) {
    const base = start + i * stride;
    const item = [];
    for (let c = 0; c < components; c += 1) {
      item.push(reader.read(bin, base + c * reader.size));
    }
    values.push(components === 1 ? item[0] : item);
  }
  return values;
}

function boundsForTriangles(positions, indices, triangleIds) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const center = [0, 0, 0];
  let count = 0;
  for (const triIndex of triangleIds) {
    for (let j = 0; j < 3; j += 1) {
      const p = positions[indices[triIndex * 3 + j]];
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], p[axis]);
        max[axis] = Math.max(max[axis], p[axis]);
        center[axis] += p[axis];
      }
      count += 1;
    }
  }
  return { min, max, center: center.map((value) => value / count) };
}

const { json, bin } = readGlb(file);
const primitive = json.meshes[0].primitives[0];
const positions = readAccessor(json, bin, primitive.attributes.POSITION);
const indices = primitive.indices !== undefined
  ? readAccessor(json, bin, primitive.indices)
  : Array.from({ length: positions.length }, (_, i) => i);
const triangleCount = Math.floor(indices.length / 3);

const vertexToTriangles = new Map();
for (let triIndex = 0; triIndex < triangleCount; triIndex += 1) {
  for (let j = 0; j < 3; j += 1) {
    const vertexIndex = indices[triIndex * 3 + j];
    if (!vertexToTriangles.has(vertexIndex)) vertexToTriangles.set(vertexIndex, []);
    vertexToTriangles.get(vertexIndex).push(triIndex);
  }
}

const visited = new Uint8Array(triangleCount);
const components = [];
for (let startTri = 0; startTri < triangleCount; startTri += 1) {
  if (visited[startTri]) continue;
  const queue = [startTri];
  const triangles = [];
  visited[startTri] = 1;
  while (queue.length) {
    const triIndex = queue.pop();
    triangles.push(triIndex);
    for (let j = 0; j < 3; j += 1) {
      const vertexIndex = indices[triIndex * 3 + j];
      for (const neighbor of vertexToTriangles.get(vertexIndex) ?? []) {
        if (!visited[neighbor]) {
          visited[neighbor] = 1;
          queue.push(neighbor);
        }
      }
    }
  }
  components.push({ triangles, bounds: boundsForTriangles(positions, indices, triangles) });
}
components.sort((a, b) => b.triangles.length - a.triangles.length);
components.forEach((component, index) => {
  component.id = index;
});

const allBounds = boundsForTriangles(positions, indices, Array.from({ length: triangleCount }, (_, i) => i));
const panels = [
  { title: 'Front: X / Y', axes: [0, 1], origin: [20, 45] },
  { title: 'Top: X / Z', axes: [0, 2], origin: [440, 45] },
  { title: 'Side: Z / Y', axes: [2, 1], origin: [860, 45] },
];
const panelSize = 360;
const margin = 18;

function hueFor(id) {
  return (id * 47) % 360;
}

function project(value, axis, origin, flipY = false) {
  const min = allBounds.min[axis];
  const max = allBounds.max[axis];
  const t = (value - min) / (max - min || 1);
  return origin + margin + (flipY ? 1 - t : t) * (panelSize - margin * 2);
}

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="470" viewBox="0 0 1240 470">\n`;
svg += `<rect width="1240" height="470" fill="#faf7ef"/>\n`;
svg += `<style>text{font-family:Arial,sans-serif;font-size:11px}.title{font-size:16px;font-weight:700}.small{font-size:10px;fill:#555}</style>\n`;

for (const panel of panels) {
  const [axisA, axisB] = panel.axes;
  const [ox, oy] = panel.origin;
  svg += `<text class="title" x="${ox}" y="${oy - 16}">${panel.title}</text>\n`;
  svg += `<rect x="${ox}" y="${oy}" width="${panelSize}" height="${panelSize}" fill="#fff" stroke="#c9bea8"/>\n`;

  for (const component of components.slice(0, 90)) {
    const x1 = project(component.bounds.min[axisA], axisA, ox);
    const x2 = project(component.bounds.max[axisA], axisA, ox);
    const y1 = project(component.bounds.max[axisB], axisB, oy, true);
    const y2 = project(component.bounds.min[axisB], axisB, oy, true);
    const cx = project(component.bounds.center[axisA], axisA, ox);
    const cy = project(component.bounds.center[axisB], axisB, oy, true);
    const hue = hueFor(component.id);
    const opacity = Math.max(0.2, Math.min(0.72, component.triangles.length / components[0].triangles.length));
    svg += `<rect x="${x1.toFixed(1)}" y="${y1.toFixed(1)}" width="${Math.max(2, x2 - x1).toFixed(1)}" height="${Math.max(2, y2 - y1).toFixed(1)}" fill="hsla(${hue},75%,58%,${opacity})" stroke="hsl(${hue},70%,38%)" stroke-width="0.5"/>\n`;
    if (component.id < 45) {
      svg += `<text x="${(cx + 3).toFixed(1)}" y="${(cy - 3).toFixed(1)}">${component.id}</text>\n`;
    }
  }
}

svg += `<text class="small" x="20" y="438">Numbers are connected components sorted by triangle count. This is a diagnostic map, not final art.</text>\n`;
svg += `</svg>\n`;

fs.writeFileSync(output, svg, 'utf8');
console.log(`Wrote ${output}`);
