import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { JSDOM } from 'jsdom';

const cspPreloadSource = ts.transpileModule(readFileSync(path.resolve('src/cspPreload.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function createPreloadHarness() {
  let executedScript = '';
  const webFrame = {
    executeJavaScript: vi.fn((script: string) => {
      executedScript = script;
      return Promise.resolve();
    }),
  };
  const fakeConsole = {
    error: vi.fn(),
    log: vi.fn(),
  };

  runInNewContext(cspPreloadSource, {
    exports: {},
    require: (id: string) => {
      if (id !== 'electron') throw new Error(`Unexpected preload dependency: ${id}`);
      return { webFrame };
    },
    console: fakeConsole,
  });

  return { webFrame, fakeConsole, executedScript };
}

describe('cspPreload execution', () => {
  it('calls webFrame.executeJavaScript with the main-world injection script', () => {
    const harness = createPreloadHarness();
    expect(harness.webFrame.executeJavaScript).toHaveBeenCalledOnce();
    expect(harness.executedScript).toContain('__antigravity_csp_relaxed__');
    expect(harness.executedScript).toContain('allow-scripts allow-forms allow-downloads allow-modals');
    expect(harness.executedScript).toContain('data-ag-csp="1"');
  });

  it('handles execution error gracefully when webFrame throws', () => {
    const fakeConsole = { error: vi.fn(), log: vi.fn() };
    runInNewContext(cspPreloadSource, {
      exports: {},
      require: () => ({
        webFrame: {
          executeJavaScript: () => {
            throw new Error('Script execution denied');
          },
        },
      }),
      console: fakeConsole,
    });
    expect(fakeConsole.error).toHaveBeenCalledWith(expect.stringContaining('[CSP Relaxation]'), expect.any(Error));
  });
});

describe('main-world CSP & sandbox interception invariants', () => {
  function createDOMHarness() {
    const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
      runScripts: 'outside-only',
    });
    const { window } = dom;
    const { document, HTMLIFrameElement, Element, DOMTokenList, MutationObserver } = window;

    const { executedScript } = createPreloadHarness();
    runInNewContext(executedScript, {
      window,
      document,
      HTMLIFrameElement,
      Element,
      DOMTokenList,
      MutationObserver,
      WeakSet,
      Set,
      console,
    });

    return { dom, window, document };
  }

  it('sets the relaxation flag and is idempotent', () => {
    const { window, document } = createDOMHarness();
    expect((window as unknown as Record<string, unknown>).__antigravity_csp_relaxed__).toBe(true);

    const { executedScript } = createPreloadHarness();
    expect(() => {
      runInNewContext(executedScript, {
        window,
        document,
        HTMLIFrameElement: window.HTMLIFrameElement,
        Element: window.Element,
        DOMTokenList: window.DOMTokenList,
        MutationObserver: window.MutationObserver,
        WeakSet,
        Set,
      });
    }).not.toThrow();
  });

  it('CSP-01 & CSP-02: sanitizes sandbox on setAttribute to guarantee scripts and strip forbidden tokens', () => {
    const { document } = createDOMHarness();
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);

    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(iframe.getAttribute('sandbox')).toContain('allow-scripts');

    iframe.setAttribute('sandbox', 'allow-popups-to-escape-sandbox allow-top-navigation allow-forms');
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-popups-to-escape-sandbox');
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-top-navigation');
    expect(iframe.getAttribute('sandbox')).toContain('allow-scripts');
    expect(iframe.getAttribute('sandbox')).toContain('allow-forms');
  });

  it('CSP-01 & CSP-07: prevents removal of sandbox attribute on artifact iframes while leaving non-artifact iframes untouched', () => {
    const { document } = createDOMHarness();
    const artifactIframe = document.createElement('iframe');
    artifactIframe.setAttribute('srcdoc', '<div>Artifact</div>');
    document.body.appendChild(artifactIframe);

    artifactIframe.removeAttribute('sandbox');
    expect(artifactIframe.getAttribute('sandbox')).toBe('allow-scripts allow-forms allow-downloads allow-modals');

    const internalIframe = document.createElement('iframe');
    internalIframe.setAttribute('src', 'https://example.com');
    document.body.appendChild(internalIframe);
    expect(internalIframe.getAttribute('sandbox')).toBeNull();
  });

  it('CSP-07: does not pollute element.classList.value or classList.add on regular DOM elements', () => {
    const { document } = createDOMHarness();
    const div = document.createElement('div');
    div.classList.value = 'agy-row agy-primary';
    expect(div.className).toBe('agy-row agy-primary');
    div.classList.add('active');
    expect(div.className).toBe('agy-row agy-primary active');
  });

  it('REDUN-03: filters forbidden sandbox tokens from DOMTokenList.prototype.add', () => {
    const { document } = createDOMHarness();
    const div = document.createElement('div');
    div.classList.add('allow-scripts', 'allow-same-origin', 'allow-popups-to-escape-sandbox', 'allow-top-navigation');
    expect(div.classList.contains('allow-scripts')).toBe(true);
    expect(div.classList.contains('allow-same-origin')).toBe(false);
    expect(div.classList.contains('allow-popups-to-escape-sandbox')).toBe(false);
    expect(div.classList.contains('allow-top-navigation')).toBe(false);
  });

  it('SEC-16: rewrites CSP inside iframe strings assigned via innerHTML and insertAdjacentHTML', () => {
    const { document } = createDOMHarness();
    const container = document.createElement('div');
    container.innerHTML =
      '<iframe srcdoc="<meta http-equiv=&quot;Content-Security-Policy&quot; content=&quot;default-src \'none\'&quot;>"></iframe>';
    expect(container.innerHTML).toContain('data-ag-csp=');
  });

  it('CSP-03: rewrites restrictive Content-Security-Policy meta tag in srcdoc', () => {
    const { document } = createDOMHarness();
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);

    const restrictiveHtml =
      '<html><head><meta http-equiv="Content-Security-Policy" content="script-src \'self\'"></head><body><h1>Test</h1></body></html>';
    iframe.srcdoc = restrictiveHtml;

    expect(iframe.srcdoc).toContain('data-ag-csp="1"');
    expect(iframe.srcdoc).toContain("default-src * 'unsafe-inline' 'unsafe-eval' data: blob:");
    expect(iframe.srcdoc).not.toContain("script-src 'self'");
  });

  it('CSP-03: rewrites srcdoc set via setAttribute', () => {
    const { document } = createDOMHarness();
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);

    iframe.setAttribute(
      'srcdoc',
      '<html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head></html>',
    );
    const val = iframe.getAttribute('srcdoc') || '';
    expect(val).toContain('data-ag-csp="1"');
    expect(val).not.toContain("default-src 'none'");
  });

  it('CSP-03: injects unrestricted CSP into head if no meta CSP present', () => {
    const { document } = createDOMHarness();
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);

    iframe.srcdoc = '<html><head><title>Visual Artifact</title></head><body><div id="chart"></div></body></html>';
    expect(iframe.srcdoc).toContain('data-ag-csp="1"');
    expect(iframe.srcdoc).toContain('<meta http-equiv="Content-Security-Policy"');
  });

  it('CSP-03: does not duplicate CSP if data-ag-csp="1" is already present', () => {
    const { document } = createDOMHarness();
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);

    iframe.srcdoc = '<meta http-equiv="Content-Security-Policy" data-ag-csp="1" content="test"><div>Artifact</div>';
    const matches = iframe.srcdoc.match(/data-ag-csp="1"/g);
    expect(matches).toHaveLength(1);
  });

  it('CSP-05 & CSP-06: MutationObserver automatically cleans newly appended iframes', async () => {
    const { document } = createDOMHarness();
    const container = document.createElement('div');
    document.body.appendChild(container);

    const dynamicIframe = document.createElement('iframe');
    dynamicIframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    container.appendChild(dynamicIframe);

    // Wait for mutation observer tick
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(dynamicIframe.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(dynamicIframe.getAttribute('sandbox')).toContain('allow-scripts');
  });
});
