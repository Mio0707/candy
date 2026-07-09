import fs from 'node:fs';

const COMPONENT_SAMPLE_LIMIT = 80;
const file = process.argv[2];

if (!file) {
  console.error('Usage: node tools/analyze-glb-geometry.mjs <model.glb>');
  process.exit(1);
}

function readGlb(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.toString('utf8', 0, 4) !== 'glTF') {
    throw new Error('Not a GLB file');
  }

  const length = data.readUInt32LE(8);
  let offset = 12;
  let json = null;
  let bin = null;

  while (offset < length) {
    const chunkLength = data.readUInt32LE(offset);
    const chunkType = data.toString('utf8', offset + 4, offset + 8);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;

    if (chunkType === 'JSON') {
      json = JSON.parse(data.toString('utf8', chunkStart, chunkEnd).trim());
    }

    if (chunkType === 'BIN\0') {
      bin = data.subarray(chunkStart, chunkEnd);
    }

    offset = chunkEnd;
  }

  return { json, bin };
}

const componentReaders = {
  5120: { size: 1, read: (buffer, offset) => buffer.readInt8(offset) },
  5121: { size: 1, read: (buffer, offset) => buffer.readUInt8(offset) },
  5122: { size: 2, read: (buffer, offset) => buffer.readInt16LE(offset) },
  5123: { size: 2, read: (buffer, offset) => buffer.readUInt16LE(offset) },
  5125: { size: 4, read: (buffer, offset) => buffer.readUInt32LE(offset) },
  5126: { size: 4, read: (buffer, offset) => buffer.readFloatLE(offset) },
};

const typeCounts = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

function readAccessor(json, bin, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  const reader = componentReaders[accessor.componentType];
  const components = typeCounts[accessor.type];
  const elementBytes = reader.size * components;
  const stride = view.byteStride ?? elementBytes;
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
  let vertexRefs = 0;

  for (const triIndex of triangleIds) {
    for (let j = 0; j < 3; j += 1) {
      const p = positions[indices[triIndex * 3 + j]];
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], p[axis]);
        max[axis] = Math.max(max[axis], p[axis]);
        center[axis] += p[axis];
      }
      vertexRefs += 1;
    }
  }

  return {
    min,
    max,
    center: center.map((value) => value / Math.max(1, vertexRefs)),
  };
}

function formatVec(vec) {
  return vec.map((n) => Number(n).toFixed(3)).join(', ');
}

const { json, bin } = readGlb(file);
const primitive = json.meshes[0].primitives[0];
const positions = readAccessor(json, bin, primitive.attributes.POSITION);
const indices = primitive.indices !== undefined
  ? readAccessor(json, bin, primitive.indices)
  : Array.from({ length: positions.length }, (_, i) => i);

const allTriangles = Array.from({ length: Math.floor(indices.length / 3) }, (_, i) => i);
const allBounds = boundsForTriangles(positions, indices, allTriangles);
console.log(`Vertices: ${positions.length}`);
console.log(`Triangles: ${allTriangles.length}`);
console.log(`Bounds min: ${formatVec(allBounds.min)}`);
console.log(`Bounds max: ${formatVec(allBounds.max)}`);
console.log(`Center: ${formatVec(allBounds.center)}`);
console.log('');

const vertexToTriangles = new Map();
for (let triIndex = 0; triIndex < allTriangles.length; triIndex += 1) {
  for (let j = 0; j < 3; j += 1) {
    const vertexIndex = indices[triIndex * 3 + j];
    if (!vertexToTriangles.has(vertexIndex)) {
      vertexToTriangles.set(vertexIndex, []);
    }
    vertexToTriangles.get(vertexIndex).push(triIndex);
  }
}

const visited = new Uint8Array(allTriangles.length);
const components = [];
for (let startTri = 0; startTri < allTriangles.length; startTri += 1) {
  if (visited[startTri]) continue;
  const queue = [startTri];
  const tris = [];
  visited[startTri] = 1;

  while (queue.length) {
    const triIndex = queue.pop();
    tris.push(triIndex);

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

  components.push({
    triangles: tris,
    bounds: boundsForTriangles(positions, indices, tris),
  });
}

components.sort((a, b) => b.triangles.length - a.triangles.length);
console.log(`Connected components: ${components.length}`);
for (let i = 0; i < Math.min(components.length, COMPONENT_SAMPLE_LIMIT); i += 1) {
  const component = components[i];
  const size = component.triangles.length;
  const percent = (size / allTriangles.length * 100).toFixed(2);
  console.log(
    `[${i}] triangles=${size} (${percent}%) center=${formatVec(component.bounds.center)} min=${formatVec(component.bounds.min)} max=${formatVec(component.bounds.max)}`
  );
}
