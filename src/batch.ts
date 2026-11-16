import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Draw-call batching for scenery that never moves. Once its children have mounted, every opaque mesh
// inside is baked into one merged mesh per look (material settings + shadow flags). The originals stay
// in the scene for clicks and hover (raycasting) but no longer draw or cast shadows.
//
// Only wrap things that stay put: a mesh that later moves, changes colour or fades would keep drawing
// its old self. Mark such a mesh with `userData={{ dynamic: true }}` to leave it out. Transparent
// meshes and materials shared between meshes (they're usually animated, like the night glow) are
// always left as they are.
const hidden = new THREE.MeshBasicMaterial({ visible: false });
const noRaycast = () => {};

function lookKey(m: THREE.Material, mesh: THREE.Mesh, uv: boolean) {
  const s = m as THREE.MeshStandardMaterial;
  return [
    m.type,
    s.color?.getHexString(),
    s.emissive?.getHexString(),
    s.emissiveIntensity,
    s.roughness,
    s.metalness,
    s.flatShading,
    s.map?.uuid,
    m.side,
    m.vertexColors,
    mesh.castShadow,
    mesh.receiveShadow,
    uv,
  ].join('|');
}

export function batchStatic(root: THREE.Object3D) {
  root.updateWorldMatrix(true, true);
  const toRoot = root.matrixWorld.clone().invert();
  const meshes: THREE.Mesh[] = [];
  const uses = new Map<THREE.Material, number>();
  root.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || o.userData.batched) return;
    meshes.push(mesh);
    if (!Array.isArray(mesh.material)) uses.set(mesh.material, (uses.get(mesh.material) ?? 0) + 1);
  });
  const groups = new Map<string, { material: THREE.Material; parts: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }>();
  for (const mesh of meshes) {
    const material = mesh.material;
    if (Array.isArray(material) || !material.visible || material.transparent || uses.get(material)! > 1) continue;
    let skip = false;
    for (let o: THREE.Object3D | null = mesh; o && o !== root; o = o.parent)
      if (o.userData.dynamic || !o.visible) skip = true;
    if (skip || !mesh.geometry.attributes.normal) continue;
    let part = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    for (const name of Object.keys(part.attributes))
      if (!['position', 'normal', 'uv'].includes(name)) part.deleteAttribute(name);
    part.morphAttributes = {};
    part.clearGroups();
    part = part.applyMatrix4(toRoot.clone().multiply(mesh.matrixWorld));
    const key = lookKey(material, mesh, !!part.attributes.uv);
    if (!groups.has(key)) groups.set(key, { material, parts: [], meshes: [] });
    groups.get(key)!.parts.push(part);
    groups.get(key)!.meshes.push(mesh);
  }
  const merged: THREE.Mesh[] = [];
  for (const { material, parts, meshes } of groups.values()) {
    const geometry = mergeGeometries(parts);
    parts.forEach(p => p.dispose());
    if (!geometry) continue;
    const mesh = new THREE.Mesh(geometry, material.clone());
    mesh.castShadow = meshes[0].castShadow;
    mesh.receiveShadow = meshes[0].receiveShadow;
    mesh.raycast = noRaycast;
    mesh.userData.batched = true;
    merged.push(mesh);
    for (const original of meshes) {
      // Still clickable (raycasting ignores the material), but skipped when drawing and for shadows.
      original.userData.batchedMaterial = original.material;
      original.material = hidden;
      original.frustumCulled = false;
    }
  }
  merged.forEach(m => root.add(m));
  return { merged, before: meshes.length };
}
