import { expect, it } from 'vitest';
import { diagramTypeNames, toDataInstance } from '../src/diagram';
import type { PyretCaptureRuntime } from '../src/pyret-capture';
import { isDataInstance, LayoutInstance, parseLayoutSpec } from 'spytial-core';
import type { IDataInstance } from 'spytial-core';
import { SGraphQueryEvaluator } from 'spytial-core/evaluator';
import { constructorTypeId } from '../src/data-instance/pyret/identity';

it('formats constructor captions without changing semantic IDs or input layout', () => {
  const id = constructorTypeId('scope', 0, 'leaf');
  const node = { id: 'n', mostSpecificType: id };
  const layout = { nodes: [node], edges: [] };
  const display = diagramTypeNames(layout);
  expect(display.nodes[0]).toEqual({ id: 'n', mostSpecificType: 'leaf' });
  expect(layout.nodes[0]).toBe(node);
  expect(node.mostSpecificType).toBe(id);
  expect(display.edges).toBe(layout.edges);
});

// Minimal owning-runtime predicates; actual upstream runtime coverage lives in
// check-pyret-capture.mjs. This checks the released Core consumer boundary.
const runtime: PyretCaptureRuntime = {
  Any: undefined,
  isNumber: v => typeof v === 'number',
  isNothing: () => false, isDataValue: () => false, isTuple: () => false,
  isRef: () => false, isFunction: () => false, isMethod: () => false,
  isOpaque: () => false, isObject: () => false,
};

it('hands a Spyret IDataInstance directly to Core 6.3.1 for queries and layout', () => {
  const instance: IDataInstance = toDataInstance(['PVD', 'ORD'], runtime);
  expect(isDataInstance(instance)).toBe(true);
  const evaluator = new SGraphQueryEvaluator();
  evaluator.initialize({ sourceData: instance });
  const spec = parseLayoutSpec('directives:\n  - inferredEdge:\n      name: item\n      selector: RawArray.element');
  const layout = new LayoutInstance(spec, evaluator, 0, true).generateLayout(instance).layout;
  expect(layout.nodes.length).toBeGreaterThan(0);
  const graph = instance.generateGraph(false, false);
  const labels = new Map(instance.getAtoms().map(a => [a.id, a.label]));
  expect(graph.edges().map(edge => [graph.edge(edge), labels.get(edge.w)]).sort()).toEqual([
    ['element[0]', 'PVD'], ['element[1]', 'ORD'],
  ]);
  // Index atoms are label positions, not endpoints in the graph projection.
  const hidden = instance.generateGraph(true, false);
  expect(hidden.nodeCount()).toBe(graph.nodeCount() - 2);
  for (const atom of instance.getAtoms()) expect(instance.getAtomType(atom.id).id).toBe(atom.type);
});
