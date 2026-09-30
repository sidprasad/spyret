import type { IDataInstance } from 'spytial-core';
import { capturePyret, importPyretCapture } from './data-instance/pyret/capture';
import { createPyretRuntimeAdapter } from './data-instance/pyret/runtime-adapter';
import { constructorDisplayName } from './data-instance/pyret/identity';

/** Convert a value owned by this runtime into Core's IDataInstance contract. */
export function toDataInstance(value: unknown, runtime: Parameters<typeof createPyretRuntimeAdapter>[0]): IDataInstance {
  return importPyretCapture(capturePyret([{ name: 'value', value }], createPyretRuntimeAdapter(runtime))).instance;
}

/** The Pyret-specific part of diagramming. Rendering is supplied by the host. */
export function prepareDiagram(value: unknown, runtime: Parameters<typeof createPyretRuntimeAdapter>[0]) {
  const snapshot = capturePyret([{ name: 'value', value }], createPyretRuntimeAdapter(runtime));
  const { instance } = importPyretCapture(snapshot);
  return { snapshot, instance };
}

/** Format a presentation copy only, after selector and layout evaluation. */
export function diagramTypeNames<N extends { mostSpecificType: string }, L extends { nodes: N[] }>(layout: L): L {
  return { ...layout, nodes: layout.nodes.map(node => ({ ...node,
    mostSpecificType: constructorDisplayName(node.mostSpecificType),
  })) };
}
