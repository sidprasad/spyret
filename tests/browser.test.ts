import { afterEach, describe, expect, it, vi } from 'vitest';
import { load } from 'js-yaml';
import { combineSpytialSpecs, createDiagramView, createPyretModule, registerCpoOutput, type DiagramRuntime } from '../src/browser';

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

describe('spec composition', () => {
  it('retains section order and duplicates across documents, including empty collections', () => {
    const spec = 'constraints: [{orientation: {selector: next, directions: [below]}}]\ndirectives: []';
    expect(load(combineSpytialSpecs([spec, '', 'directives: [{hideField: value}]', spec]))).toEqual({
      constraints: [{ orientation: { selector: 'next', directions: ['below'] } },
        { orientation: { selector: 'next', directions: ['below'] } }],
      directives: [{ hideField: 'value' }],
    });
    expect(load(combineSpytialSpecs([]))).toEqual({ constraints: [], directives: [] });
  });
  it.each(['42', '[]', 'constraints: null', 'directives: nope', 'unexpected: []'])('rejects malformed YAML without dropping sections: %s', text => {
    expect(() => combineSpytialSpecs([text])).toThrow(/Spytial spec 1/);
  });
});

it('installs the CPO adapter once, preserves unrelated values, and renders fresh DOM', () => {
  const previous = vi.fn(value => value.val);
  const runtime = { ReprMethods: { $cpo: { opaque: previous } } } as unknown as DiagramRuntime;
  const renderer = (runtime as any).ReprMethods.$cpo;
  const handle = {};
  registerCpoOutput(runtime, handle, () => document.createElement('div'), node => node);
  const installed = renderer.opaque;
  registerCpoOutput(runtime, {}, () => document.createElement('span'), node => node);
  expect(renderer.opaque).toBe(installed);
  const a = renderer.opaque({ val: handle });
  const b = renderer.opaque({ val: handle });
  expect(a).toBeInstanceOf(HTMLElement);
  expect(a).not.toBe(b);
  const image = {};
  expect(renderer.opaque({ val: image })).toBe(image);
  expect(renderer.opaque({ val: 42 })).toBe(42);
  expect(previous).toHaveBeenCalledTimes(2);
});

it('does not start a detached graph; reconnect creates a fresh graph and reports rendering failures', async () => {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  const prepared = { sourcePreview: 'box(42)', snapshot: {} } as any;
  const view = createDiagramView(prepared, { nodes: [] }, document);
  expect(frames).toHaveLength(0);
  document.body.append(view);
  const first = view.querySelector('webcola-cnd-graph')!;
  const render = vi.fn().mockRejectedValue(new Error('render failed'));
  (first as any).renderLayout = render;
  view.remove();
  frames.shift()!(0);
  expect(render).not.toHaveBeenCalled();
  document.body.append(view);
  const second = view.querySelector('webcola-cnd-graph')!;
  expect(second).not.toBe(first);
  (second as any).renderLayout = render;
  frames.shift()!(0);
  await vi.waitFor(() => expect(view.querySelector('[role=alert]')!.textContent).toContain('render failed'));
});

it('does not collect hooks or resume a stopped thread after Core finishes loading', async () => {
  let resolveCore!: (core: any) => void;
  const pending = new Promise<any>(resolve => { resolveCore = resolve; });
  const originalBreak = vi.fn();
  const restarter = { resume: vi.fn(), error: vi.fn(), handlers: { break: originalBreak } };
  const runtime = { makeFunction: (f: unknown) => f, makeModuleReturn: (values: unknown) => values,
    pauseStack: (f: any) => f(restarter), safeCall: (thunk: any) => thunk() } as unknown as DiagramRuntime;
  const registerOutput = vi.fn();
  const module = createPyretModule(runtime, { document, core: () => pending, registerOutput }) as any;
  module.diagram(42);
  restarter.handlers.break();
  resolveCore({}); // Any attempted capture/layout would fail with this stub.
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(originalBreak).toHaveBeenCalledOnce();
  expect(restarter.handlers.break).toBe(originalBreak);
  expect(restarter.resume).not.toHaveBeenCalled();
  expect(restarter.error).not.toHaveBeenCalled();
  expect(registerOutput).not.toHaveBeenCalled();
});

// Native imports accept either arity, so reject accidental extra/missing inputs
// before loading assets or evaluating hooks.
it.each([[], [42, '', 'extra']])('rejects unsupported diagram arity: %j', (...args) => {
  const core = vi.fn();
  const runtime = { makeFunction: (f: unknown) => f, makeModuleReturn: (values: unknown) => values,
    ffi: { throwMessageException: (message: string) => { throw new Error(message); } }
  } as unknown as DiagramRuntime;
  const module = createPyretModule(runtime, { document, core, registerOutput: vi.fn() }) as any;
  expect(module.show).toBeUndefined();
  expect(() => module.diagram(...args)).toThrow(/expects a value/);
  expect(core).not.toHaveBeenCalled();
});
