import type { IDataInstance, IAtom, IRelation, IType } from 'spytial-core';
import { Graph } from 'graphlib';

/** Spyret's data view of a validated capture, implementing Core's public contract. */
export class CapturedDataInstance implements IDataInstance {
  private atoms: Map<string, IAtom>;
  private types: Map<string, IType>;
  constructor(private datum: { atoms: IAtom[]; relations: IRelation[]; types: IType[] }) {
    this.atoms = new Map(datum.atoms.map(atom => [atom.id, atom]));
    this.types = new Map(datum.types.map(type => [type.id, type]));
  }
  getAtoms(): readonly IAtom[] { return this.datum.atoms; }
  getRelations(): readonly IRelation[] { return this.datum.relations; }
  getTypes(): readonly IType[] { return this.datum.types; }
  getAtomType(id: string): IType {
    const atom = this.atoms.get(id);
    if (!atom) throw new Error(`Unknown captured atom ${id}`);
    const type = this.types.get(atom.type);
    if (!type) throw new Error(`Unknown captured type ${atom.type}`);
    return type;
  }
  generateGraph(hideDisconnected = false, hideDisconnectedBuiltIns = false): Graph {
    const graph = new Graph({ directed: true, multigraph: true });
    for (const atom of this.datum.atoms) graph.setNode(atom.id, { label: atom.label });
    for (const relation of this.datum.relations) {
      for (const tuple of relation.tuples) {
        if (tuple.atoms.length < 2) continue;
        const first = tuple.atoms[0], last = tuple.atoms[tuple.atoms.length - 1];
        const middle = tuple.atoms.slice(1, -1).map(id => this.atoms.get(id)!.label);
        const label = relation.name + (middle.length ? `[${middle.join(', ')}]` : '');
        graph.setEdge(first, last, label, JSON.stringify([relation.id, tuple.atoms]));
      }
    }
    if (hideDisconnected || hideDisconnectedBuiltIns) {
      for (const id of graph.nodes()) {
        if (!(graph.nodeEdges(id) || []).length && (hideDisconnected || this.getAtomType(id).isBuiltin)) graph.removeNode(id);
      }
    }
    return graph;
  }
}
