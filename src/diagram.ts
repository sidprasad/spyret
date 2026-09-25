import { capturePyret, importPyretCapture } from './data-instance/pyret/capture';
import { createPyretRuntimeAdapter } from './data-instance/pyret/runtime-adapter';
import { replit } from './data-instance/pyret/replit';
import { constructorDisplayName } from './data-instance/pyret/identity';

/** The Pyret-specific part of diagramming. Rendering is supplied by the host. */
export function prepareDiagram(value: unknown, runtime: Parameters<typeof createPyretRuntimeAdapter>[0]) {
  const snapshot = capturePyret([{ name: 'value', value }], createPyretRuntimeAdapter(runtime));
  const { instance } = importPyretCapture(snapshot);
  let sourcePreview: string;
  try { sourcePreview = replit(instance, snapshot.roots[0].atomId); }
  catch (error) { sourcePreview = 'Source preview unavailable: ' + (error instanceof Error ? error.message : String(error)); }
  return { snapshot, instance, sourcePreview };
}

/** Format a presentation copy only, after selector and layout evaluation. */
export function diagramTypeNames<N extends { mostSpecificType: string }, L extends { nodes: N[] }>(layout: L): L {
  return { ...layout, nodes: layout.nodes.map(node => ({ ...node,
    mostSpecificType: constructorDisplayName(node.mostSpecificType),
  })) };
}
