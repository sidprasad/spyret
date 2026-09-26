/** Optional browser integration. Importing this entry does not access the DOM. */
import { load, dump } from 'js-yaml';
import { prepareDiagram, diagramTypeNames } from './diagram';
import { collectSpytialSpecOnStack, spytialRulesToYaml, type SpytialRuntime } from './spytial/spec';
import type { IDataInstance } from 'spytial-core';

type Layout = { nodes: { mostSpecificType: string }[] };
/** Only the Core operations used by the Pyret integration. Core is supplied separately. */
export interface BrowserCore {
  parseLayoutSpec(yaml: string): any;
  Evaluators: { SGraphQueryEvaluator: new () => { initialize(input: { sourceData: IDataInstance }): unknown } };
  LayoutInstance: new (spec: any, evaluator: any, instance: number, align: boolean) => {
    generateLayout(data: IDataInstance): { layout: Layout };
  };
}
export interface DiagramRuntime extends SpytialRuntime {
  ffi: SpytialRuntime['ffi'] & { makeMessageException(message: string): unknown; throwMessageException(message: string): never };
  makeOpaque(value: unknown): unknown;
  makeFunction(fn: (...args: any[]) => unknown, name?: string): unknown;
  makeModuleReturn(values: Record<string, unknown>, types: Record<string, unknown>): unknown;
  checkString(value: unknown): void;
  pauseStack(callback: (restarter: {
    resume(value: unknown): void; error(error: unknown): void;
    /** Standard Pyret PausePackage thread handlers; used to observe Stop. */
    handlers?: { break(): void };
  }) => void): unknown;
}
export interface BrowserHost {
  core: () => BrowserCore | Promise<BrowserCore>;
  document: Document;
  registerOutput(runtime: DiagramRuntime, handle: object, render: () => HTMLElement): void;
}

/** Append sections in discovery order. Interpretation and conflicts belong to Core. */
export function combineSpytialSpecs(specs: readonly string[]): string {
  const combined: Record<string, unknown[]> = { constraints: [], directives: [] };
  specs.forEach((text, index) => {
    if (!text.trim()) return;
    const document = load(text);
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
      throw new Error(`Spytial spec ${index + 1}: expected a YAML mapping`);
    }
    for (const [key, value] of Object.entries(document)) {
      if (key !== 'constraints' && key !== 'directives') throw new Error(`Spytial spec ${index + 1}: unknown section ${key}`);
      if (!Array.isArray(value)) throw new Error(`Spytial spec ${index + 1}: ${key} must be a list`);
      combined[key].push(...value);
    }
  });
  return dump(combined);
}

type Graph = HTMLElement & { renderLayout(layout: Layout): Promise<unknown> };
type View = HTMLElement & { spyretConnect?: () => void; spytialCapture?: unknown };
/** Construct a fresh view for every display of an opaque diagram value. */
export function createDiagramView(prepared: ReturnType<typeof prepareDiagram>, layout: Layout, document: Document): HTMLElement {
  const window = document.defaultView!;
  const tag = 'spyret-diagram-view';
  if (!window.customElements.get(tag)) {
    window.customElements.define(tag, class extends window.HTMLElement {
      connectedCallback() { (this as View).spyretConnect?.(); }
    });
  }
  const container = document.createElement(tag) as View;
  container.className = 'spyret-diagram';
  container.style.display = 'block';
  container.spytialCapture = prepared.snapshot;
  const preview = document.createElement('pre');
  preview.textContent = prepared.sourcePreview;
  const error = document.createElement('div');
  error.setAttribute('role', 'alert');
  const frame = document.createElement('div');
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = 'Hide diagram';
  toggle.setAttribute('aria-expanded', 'true');
  container.append(preview, error, toggle, frame);
  let generation = 0;
  toggle.onclick = () => {
    frame.hidden = !frame.hidden;
    toggle.textContent = frame.hidden ? 'Show diagram' : 'Hide diagram';
    toggle.setAttribute('aria-expanded', String(!frame.hidden));
    if (frame.hidden) { generation++; frame.replaceChildren(); }
    else container.spyretConnect!();
  };
  container.spyretConnect = () => {
    if (frame.hidden) return;
    const current = ++generation;
    // A reconnect gets a new graph: a removed Core element is disposed.
    const graph = document.createElement('webcola-cnd-graph') as Graph;
    graph.style.cssText = 'display:block;width:100%;height:400px';
    delete container.dataset.rendered;
    delete container.dataset.settled;
    delete container.dataset.error;
    error.textContent = '';
    graph.addEventListener('layout-complete', () => {
      if (current === generation && graph.isConnected) container.dataset.settled = 'true';
    });
    frame.replaceChildren(graph);
    window.requestAnimationFrame(() => {
      if (!container.isConnected || current !== generation) return;
      Promise.resolve().then(() => graph.renderLayout(layout)).then(() => {
        if (current === generation && container.isConnected) container.dataset.rendered = 'true';
      }, reason => {
        if (current !== generation || !container.isConnected) return;
        error.textContent = 'Spytial: ' + String(reason);
        container.dataset.error = String(reason);
      });
    });
  };
  return container;
}

/** All Pyret-facing behavior lives here; hosts supply Core and output registration. */
export function createPyretModule(runtime: DiagramRuntime, host: BrowserHost): unknown {
  function diagram(value: unknown, mode: 'yaml' | 'hooks' | 'rules' | 'dom', spec?: unknown) {
    if (mode === 'yaml' || mode === 'dom') runtime.checkString(spec);
    return runtime.safeCall(() => runtime.pauseStack(restarter => {
      // Observe Stop only while waiting for browser assets. Hooks themselves
      // run on the caller's stack, so normal Pyret cancellation handles them.
      const handlers = restarter.handlers;
      const previousBreak = handlers?.break;
      let cancelled = false;
      const onBreak = () => { cancelled = true; cleanup(); previousBreak!.call(handlers); };
      const cleanup = () => { if (handlers?.break === onBreak) handlers.break = previousBreak!; };
      if (handlers) handlers.break = onBreak;
      Promise.resolve().then(() => host.core()).then(core => {
        cleanup();
        if (!cancelled) restarter.resume(core);
      }, error => {
        cleanup();
        if (!cancelled) restarter.error(error instanceof Error ? runtime.ffi.makeMessageException('Spyret: ' + error.message) : error);
      });
    }), loaded => {
      const core = loaded as BrowserCore;
      const finish = (specs?: string[]) => {
        try {
          const yaml = specs ? combineSpytialSpecs(specs)
            : mode === 'rules' ? spytialRulesToYaml(spec, runtime)
            : String(spec).trim() || 'constraints: []\ndirectives: []';
          const prepared = prepareDiagram(value, runtime);
          const evaluator = new core.Evaluators.SGraphQueryEvaluator();
          evaluator.initialize({ sourceData: prepared.instance });
          const result = new core.LayoutInstance(core.parseLayoutSpec(yaml), evaluator, 0, true).generateLayout(prepared.instance);
          const layout = diagramTypeNames(result.layout);
          const makeView = () => {
            const view = createDiagramView(prepared, layout, host.document);
            view.dataset.specCount = String(specs?.length ?? 1);
            return view;
          };
          if (mode === 'dom') return makeView(); // Legacy genlayout return contract.
          const handle = Object.freeze({});
          host.registerOutput(runtime, handle, makeView);
          return runtime.makeOpaque(handle);
        } catch (error) {
          if (error instanceof Error) runtime.ffi.throwMessageException('Spyret: ' + error.message);
          throw error;
        }
      };
      if (mode !== 'hooks') return finish();
      try {
        return collectSpytialSpecOnStack(value, runtime, finish,
          error => runtime.ffi.throwMessageException('Spyret: ' + error.message));
      } catch (error) {
        if (error instanceof Error) runtime.ffi.throwMessageException('Spyret: ' + error.message);
        throw error; // Preserve Pyret continuations and user exceptions.
      }
    }, 'Spyret.diagram');
  }
  return runtime.makeModuleReturn({
    diagram: runtime.makeFunction((...args: unknown[]) => {
      if (args.length === 1) return diagram(args[0], 'hooks');
      if (args.length === 2) return diagram(args[0], 'yaml', args[1]);
      return runtime.ffi.throwMessageException('Spyret.diagram expects a value and optionally a YAML string');
    }, 'diagram'),
    'diagram-with-rules': runtime.makeFunction((value, rules) => diagram(value, 'rules', rules), 'diagram-with-rules'),
    genlayout: runtime.makeFunction((value, spec) => diagram(value, 'dom', spec), 'genlayout'),
  }, {});
}

const rendererKey = Symbol.for('spyret.cpo-renderer.v1');
/** Compatibility adapter for stock CPO. Private APIs are isolated to this function. */
export function registerCpoOutput(runtime: DiagramRuntime, handle: object, render: () => HTMLElement, jquery: (node: HTMLElement) => unknown): void {
  const renderer = (runtime as any).ReprMethods?.$cpo;
  if (!renderer || typeof renderer.opaque !== 'function') throw new Error('Spyret requires the CPO output renderer or an explicit browser host');
  if (!renderer[rendererKey]) {
    const outputs = new WeakMap<object, () => HTMLElement>();
    const previous = renderer.opaque;
    renderer.opaque = function(value: { val: unknown }) {
      const view = value.val && typeof value.val === 'object' ? outputs.get(value.val) : undefined;
      if (view) return jquery(view());
      return previous.call(this, value);
    };
    renderer[rendererKey] = outputs;
  }
  renderer[rendererKey].set(handle, render);
}

const coreLoads = new WeakMap<Document, Promise<BrowserCore>>();
/** Load only when used. The IDE may already supply a compatible Core bundle. */
export function loadBrowserCore(document: Document, url: string): Promise<BrowserCore> {
  const window = document.defaultView as any;
  if (window.spytialcore) return Promise.resolve(window.spytialcore);
  let promise = coreLoads.get(document);
  if (!promise) {
    promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => {
        if (window.spytialcore) resolve(window.spytialcore);
        else { coreLoads.delete(document); script.remove(); reject(new Error('Spytial Core did not initialize')); }
      };
      script.onerror = () => { coreLoads.delete(document); script.remove(); reject(new Error('Cannot load Spytial Core: ' + url)); };
      document.head.appendChild(script);
    });
    coreLoads.set(document, promise);
  }
  return promise;
}

/** Used by the packaged native Pyret module (js-file or gdrive-js). */
export function createCpoModule(runtime: DiagramRuntime, document: Document, coreUrl: string): unknown {
  return createPyretModule(runtime, {
    document, core: () => loadBrowserCore(document, coreUrl),
    registerOutput: (runtime, handle, render) => registerCpoOutput(runtime, handle, render, (document.defaultView as any).jQuery),
  });
}
