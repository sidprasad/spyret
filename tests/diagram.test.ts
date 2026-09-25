import { expect, it } from 'vitest';
import { diagramTypeNames } from '../src/diagram';
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
