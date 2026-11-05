"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const UNRESTRICTED_CSP = "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
    "script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
    "style-src * 'unsafe-inline' data: blob:; " +
    'img-src * data: blob:; font-src * data: blob:; ' +
    'connect-src * data: blob: ws: wss:; media-src * data: blob:; ' +
    "frame-src * data: blob:; object-src 'none'; base-uri 'none';";
const CSP_TAG = `<meta http-equiv="Content-Security-Policy" data-ag-csp="1" content="${UNRESTRICTED_CSP}">`;
const mainWorldScript = `(() => {
  if (window.__antigravity_csp_relaxed__) return;
  window.__antigravity_csp_relaxed__ = true;

  const SAFE_SANDBOX = "allow-scripts allow-forms allow-downloads allow-modals";
  let isMutatingInternal = false;

  function sanitizeSandbox(sandboxVal) {
    if (!sandboxVal || typeof sandboxVal !== 'string') return SAFE_SANDBOX;
    const tokens = sandboxVal.split(/\\s+/).filter(t => {
      const lower = t.toLowerCase();
      return lower && lower !== 'allow-same-origin' && lower !== 'allow-popups-to-escape-sandbox';
    });
    if (!tokens.includes('allow-scripts')) tokens.push('allow-scripts');
    return tokens.join(' ');
  }

  function isSandboxSafe(sandboxVal) {
    if (!sandboxVal || typeof sandboxVal !== 'string') return false;
    const lower = sandboxVal.toLowerCase();
    if (lower.includes('allow-same-origin') || lower.includes('allow-popups-to-escape-sandbox')) return false;
    return lower.includes('allow-scripts');
  }

  function rewriteCSP(html) {
    if (html && typeof html === 'object') {
      try { if (typeof html.toString === 'function') html = html.toString(); } catch (_) {}
    }
    if (typeof html !== 'string') return html;
    if (html.includes('data-ag-csp="1"')) return html;
    if (/<meta[^>]*Content-Security-Policy[^>]*>/i.test(html)) {
      return html.replace(/<meta[^>]*Content-Security-Policy[^>]*>/gi, ${JSON.stringify(CSP_TAG)});
    }
    if (/<head\\b[^>]*>/i.test(html)) {
      return html.replace(/<head\\b[^>]*>/i, "$&" + ${JSON.stringify(CSP_TAG)});
    }
    return ${JSON.stringify(CSP_TAG)} + html;
  }

  // Hook srcdoc setter
  try {
    const srcdocDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'srcdoc');
    if (srcdocDesc && srcdocDesc.set) {
      const origSet = srcdocDesc.set;
      Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', {
        set(val) { return origSet.call(this, rewriteCSP(val)); },
        get() { return srcdocDesc.get.call(this); },
        configurable: true,
        enumerable: true
      });
    }
  } catch (_) {}

  // Hook setAttribute
  try {
    const origSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, val) {
      if (typeof name === 'string' && (this.tagName === 'IFRAME' || this instanceof HTMLIFrameElement)) {
        const lower = name.toLowerCase();
        if (lower === 'srcdoc' && typeof val === 'string') val = rewriteCSP(val);
        else if (lower === 'sandbox' && typeof val === 'string') val = sanitizeSandbox(val);
      }
      return origSetAttribute.call(this, name, val);
    };
  } catch (_) {}

  // Hook removeAttribute to preserve sandbox protection
  try {
    const origRemoveAttribute = Element.prototype.removeAttribute;
    Element.prototype.removeAttribute = function(name) {
      if (typeof name === 'string' && name.toLowerCase() === 'sandbox' && (this.tagName === 'IFRAME' || this instanceof HTMLIFrameElement)) {
        this.setAttribute('sandbox', SAFE_SANDBOX);
        return;
      }
      return origRemoveAttribute.call(this, name);
    };
  } catch (_) {}

  // Hook DOMTokenList
  try {
    const tokenListValDesc = Object.getOwnPropertyDescriptor(DOMTokenList.prototype, 'value');
    if (tokenListValDesc && tokenListValDesc.set) {
      const origTokenValSet = tokenListValDesc.set;
      Object.defineProperty(DOMTokenList.prototype, 'value', {
        set(val) { return origTokenValSet.call(this, typeof val === 'string' ? sanitizeSandbox(val) : val); },
        get() { return tokenListValDesc.get ? tokenListValDesc.get.call(this) : ''; },
        configurable: true,
        enumerable: true
      });
    }
  } catch (_) {}

  // Clean iframe helper
  function cleanIframe(iframe) {
    if (!iframe || iframe.tagName !== 'IFRAME') return;
    try {
      const currentSandbox = iframe.getAttribute('sandbox');
      if (currentSandbox === null) {
        isMutatingInternal = true;
        iframe.setAttribute('sandbox', SAFE_SANDBOX);
        isMutatingInternal = false;
      } else if (!isSandboxSafe(currentSandbox)) {
        const clean = sanitizeSandbox(currentSandbox);
        if (currentSandbox !== clean) {
          isMutatingInternal = true;
          iframe.setAttribute('sandbox', clean);
          isMutatingInternal = false;
        }
      }
      let currentSrcdoc = iframe.getAttribute('srcdoc') || iframe.srcdoc;
      if (typeof currentSrcdoc === 'string' && !currentSrcdoc.includes('data-ag-csp="1"') && /<meta[^>]*Content-Security-Policy[^>]*>/i.test(currentSrcdoc)) {
        const rewritten = rewriteCSP(currentSrcdoc);
        isMutatingInternal = true;
        iframe.setAttribute('srcdoc', rewritten);
        iframe.srcdoc = rewritten;
        isMutatingInternal = false;
      }
    } catch (_) {
      isMutatingInternal = false;
    }
  }

  // Observe DOM additions
  try {
    const observer = new MutationObserver((mutations) => {
      if (isMutatingInternal) return;
      for (const m of mutations) {
        if (m.type === 'childList') {
          for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.tagName === 'IFRAME') cleanIframe(node);
            else if (node.querySelectorAll) node.querySelectorAll('iframe').forEach(cleanIframe);
          }
        } else if (m.type === 'attributes' && m.target && m.target.tagName === 'IFRAME') {
          cleanIframe(m.target);
        }
      }
    });
    observer.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['srcdoc', 'sandbox']
    });
  } catch (_) {}

  document.querySelectorAll('iframe').forEach(cleanIframe);
  window.addEventListener('DOMContentLoaded', () => document.querySelectorAll('iframe').forEach(cleanIframe));
})();`;
try {
    if (electron_1.webFrame && electron_1.webFrame.executeJavaScript) {
        electron_1.webFrame.executeJavaScript(mainWorldScript);
    }
}
catch (e) {
    console.error('[CSP Relaxation] Failed to inject main-world hook:', e);
}
//# sourceMappingURL=cspPreload.js.map