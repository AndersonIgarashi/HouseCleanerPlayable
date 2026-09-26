// Shrinks the exported GLBs for the playable: dedup, prune, reorder for meshopt, quantize position (14 bit) and
// normal (8 bit), then meshopt-compress. UVs stay float because quantizing them shifted atlas colors on some faces.
// Embedded base-color textures are dropped (World3D applies the shared atlas material), except on ground.glb.
//
//   npm install --no-save @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer@0.22
//   node tools/optimize-glb.mjs ../Files/GLB assets/models
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { reorder, quantize, prune, dedup } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import fs from 'fs';
import path from 'path';

const [src, out] = process.argv.slice(2);
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
fs.mkdirSync(out, { recursive: true });

let before = 0;
let after = 0;
for (const f of fs.readdirSync(src).filter((f) => f.endsWith('.glb'))) {
  const doc = await io.read(path.join(src, f));
  if (f !== 'ground.glb') for (const m of doc.getRoot().listMaterials()) m.setBaseColorTexture(null);
  await doc.transform(
    dedup(),
    prune({ keepAttributes: true }),
    reorder({ encoder: MeshoptEncoder, target: 'size' }),
    quantize({
      pattern: /^POSITION$/,
      patternTargets: /^(POSITION|NORMAL)$/,
      quantizePosition: 14,
      quantizeNormal: 8,
      quantizationVolume: 'scene'
    })
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  const buf = await io.writeBinary(doc);
  fs.writeFileSync(path.join(out, f), buf);
  before += fs.statSync(path.join(src, f)).size;
  after += buf.length;
}
console.log(`GLB total ${before} -> ${after} bytes`);
