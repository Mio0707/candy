import fs from 'node:fs';
import path from 'node:path';

const input = process.argv[2];
const output = process.argv[3] ?? '模型/葫芦狮-自动拆件.glb';
const reportPath = process.argv[4] ?? '模型/葫芦狮-自动拆件报告.md';

if (!input) {
  console.error('Usage: node tools/split-glb-for-demo.mjs <input.glb> [output.glb] [report.md]');
  process.exit(1);
}

function readGlb(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.toString('utf8', 0, 4) !== 'glTF') {
    throw new Error('Not a GLB file');
  }

  const version = data.readUInt32LE(4);
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

  return { version, json, bin };
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

function align4(value) {
  return (value + 3) & ~3;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function partForComponent(component) {
  const [x, y, z] = component.bounds.center;
  const [minX, minY, minZ] = component.bounds.min;
  const [maxX, maxY, maxZ] = component.bounds.max;
  const height = maxY - minY;
  const width = maxX - minX;
  const depth = maxZ - minZ;

  if (maxY < -0.43 || (y < -0.42 && width < 0.30 && depth < 0.22)) {
    return 'ball';
  }

  if (y < -0.34 || minY < -0.47) {
    return 'base';
  }

  if (y < -0.14 && z < 0.02) {
    return 'front_legs';
  }

  if (y < -0.14) {
    return 'back_legs';
  }

  if (y > 0.30) {
    return 'head';
  }

  if (Math.abs(x) > 0.30 || (y > 0.18 && Math.abs(x) > 0.18)) {
    return 'tail_ears';
  }

  if (z > 0.13 && y > -0.04) {
    return 'back_mustache';
  }

  if ((height < 0.075 || width < 0.075 || depth < 0.075) && y > -0.08) {
    return 'head_lines';
  }

  return 'body_core';
}

function buildComponents(positions, indices) {
  const triangleCount = Math.floor(indices.length / 3);
  const vertexToTriangles = new Map();

  for (let triIndex = 0; triIndex < triangleCount; triIndex += 1) {
    for (let j = 0; j < 3; j += 1) {
      const vertexIndex = indices[triIndex * 3 + j];
      if (!vertexToTriangles.has(vertexIndex)) {
        vertexToTriangles.set(vertexIndex, []);
      }
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

    components.push({
      triangles,
      bounds: boundsForTriangles(positions, indices, triangles),
    });
  }

  components.sort((a, b) => b.triangles.length - a.triangles.length);
  components.forEach((component, index) => {
    component.id = index;
    component.part = partForComponent(component);
  });

  return components;
}

function formatVec(vec) {
  return vec.map((n) => Number(n).toFixed(3)).join(', ');
}

function writeGlb(json, bin, outFile) {
  const jsonText = JSON.stringify(json);
  const jsonBytesRaw = Buffer.from(jsonText, 'utf8');
  const jsonLength = align4(jsonBytesRaw.length);
  const jsonBytes = Buffer.alloc(jsonLength, 0x20);
  jsonBytesRaw.copy(jsonBytes);

  const binLength = align4(bin.length);
  const binBytes = Buffer.alloc(binLength);
  bin.copy(binBytes);

  const totalLength = 12 + 8 + jsonBytes.length + 8 + binBytes.length;
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 4, 'utf8');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBytes.length, 0);
  jsonHeader.write('JSON', 4, 4, 'utf8');

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binBytes.length, 0);
  binHeader.write('BIN\0', 4, 4, 'utf8');

  fs.writeFileSync(outFile, Buffer.concat([header, jsonHeader, jsonBytes, binHeader, binBytes]));
}

const { json, bin } = readGlb(input);
const sourceJson = cloneJson(json);
const sourcePrimitive = sourceJson.meshes[0].primitives[0];
const positions = readAccessor(sourceJson, bin, sourcePrimitive.attributes.POSITION);
const sourceIndices = sourcePrimitive.indices !== undefined
  ? readAccessor(sourceJson, bin, sourcePrimitive.indices)
  : Array.from({ length: positions.length }, (_, i) => i);
const components = buildComponents(positions, sourceIndices);

const partOrder = [
  'base',
  'body_core',
  'front_legs',
  'back_legs',
  'head',
  'tail_ears',
  'back_mustache',
  'head_lines',
  'ball',
];

const grouped = new Map(partOrder.map((part) => [part, []]));
for (const component of components) {
  grouped.get(component.part).push(...component.triangles);
}

for (const part of partOrder) {
  if (!grouped.get(part).length) {
    throw new Error(`Auto split produced an empty part: ${part}`);
  }
}

let newBin = bin;
const newJson = sourceJson;
const newMeshes = [];
const newNodes = [];
const sourceNode = sourceJson.nodes?.find((node) => node.mesh === 0) ?? {};
const baseNodeTransform = {};
for (const key of ['matrix', 'translation', 'rotation', 'scale']) {
  if (sourceNode[key] !== undefined) baseNodeTransform[key] = sourceNode[key];
}

for (const part of partOrder) {
  const triangleIds = grouped.get(part);
  const indexValues = new Uint32Array(triangleIds.length * 3);
  let minIndex = Infinity;
  let maxIndex = -Infinity;

  triangleIds.forEach((triIndex, outTriIndex) => {
    for (let j = 0; j < 3; j += 1) {
      const vertexIndex = sourceIndices[triIndex * 3 + j];
      indexValues[outTriIndex * 3 + j] = vertexIndex;
      minIndex = Math.min(minIndex, vertexIndex);
      maxIndex = Math.max(maxIndex, vertexIndex);
    }
  });

  const byteOffset = align4(newBin.length);
  const padding = Buffer.alloc(byteOffset - newBin.length);
  const indexBuffer = Buffer.from(indexValues.buffer);
  newBin = Buffer.concat([newBin, padding, indexBuffer]);

  const bufferViewIndex = newJson.bufferViews.length;
  newJson.bufferViews.push({
    buffer: 0,
    byteOffset,
    byteLength: indexBuffer.length,
    target: 34963,
  });

  const accessorIndex = newJson.accessors.length;
  newJson.accessors.push({
    bufferView: bufferViewIndex,
    componentType: 5125,
    count: indexValues.length,
    type: 'SCALAR',
    min: [minIndex],
    max: [maxIndex],
  });

  const meshIndex = newMeshes.length;
  newMeshes.push({
    name: part,
    primitives: [{
      attributes: cloneJson(sourcePrimitive.attributes),
      indices: accessorIndex,
      material: sourcePrimitive.material,
      mode: sourcePrimitive.mode ?? 4,
    }],
  });

  newNodes.push({
    ...cloneJson(baseNodeTransform),
    name: part,
    mesh: meshIndex,
  });
}

newJson.meshes = newMeshes;
newJson.nodes = newNodes;
newJson.scenes = [{ name: '拆件后的葫芦狮', nodes: partOrder.map((_, index) => index) }];
newJson.scene = 0;
newJson.buffers[0].byteLength = align4(newBin.length);

fs.mkdirSync(path.dirname(output), { recursive: true });
writeGlb(newJson, newBin, output);

const partStats = partOrder.map((part) => {
  const triangleCount = grouped.get(part).length;
  const partComponents = components.filter((component) => component.part === part);
  return { part, triangleCount, partComponents };
});

let report = `# 葫芦狮自动拆件报告\n\n`;
report += `原始文件：\`${input}\`\n\n`;
report += `输出文件：\`${output}\`\n\n`;
report += `说明：原始模型是 1 个节点、1 个网格、1 个材质。当前版本按几何连通块和空间位置自动拆成 9 个网页可控对象，外观贴图保持原样。\n\n`;
report += `## 拆件对象\n\n`;
report += `| 对象名 | 三角面数量 | 包含连通块数量 |\n|---|---:|---:|\n`;
for (const stat of partStats) {
  report += `| \`${stat.part}\` | ${stat.triangleCount} | ${stat.partComponents.length} |\n`;
}
report += `\n## 注意\n\n`;
report += `- 这是自动拆件版本，适合先接入网页 Demo 验证显示、隐藏和动画流程。\n`;
report += `- 因为原模型只有一个贴图材质，无法按真实颜色材质精确拆分；如果某块归类不准，后续可以在 Blender 里手动调整。\n`;
report += `- 所有对象都保留在最终位置，网页加载后可按步骤隐藏或显示。\n`;
report += `\n## 前 80 个连通块归类\n\n`;
report += `| ID | 归入对象 | 三角面 | 中心点 | 最小点 | 最大点 |\n|---:|---|---:|---|---|---|\n`;
for (const component of components.slice(0, 80)) {
  report += `| ${component.id} | \`${component.part}\` | ${component.triangles.length} | ${formatVec(component.bounds.center)} | ${formatVec(component.bounds.min)} | ${formatVec(component.bounds.max)} |\n`;
}

fs.writeFileSync(reportPath, report, 'utf8');
console.log(`Wrote ${output}`);
console.log(`Wrote ${reportPath}`);
