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
  const FORBIDDEN_SANDBOX_TOKENS = new Set([
    'allow-same-origin',
    'allow-popups-to-escape-sandbox',
    'allow-top-navigation',
    'allow-top-navigation-by-user-activation'
  ]);
  let isMutatingInternal = false;

  function isArtifactFrame(iframe) {
    if (!iframe || iframe.tagName !== 'IFRAME') return false;
    return Boolean(
      iframe.hasAttribute('srcdoc') ||
      iframe.srcdoc ||
      (iframe.closest && iframe.closest('.artifact-container, div[data-artifact], [data-testid*="embed" i], [data-testid*="artifact" i]'))
    );
  }

  function sanitizeSandbox(sandboxVal) {
    if (!sandboxVal || typeof sandboxVal !== 'string') return SAFE_SANDBOX;
    const tokens = sandboxVal.split(/\\s+/).filter(t => {
      const lower = t.toLowerCase();
      return lower && !FORBIDDEN_SANDBOX_TOKENS.has(lower);
    });
    if (!tokens.includes('allow-scripts')) tokens.push('allow-scripts');
    return tokens.join(' ');
  }

  function isSandboxSafe(sandboxVal) {
    if (!sandboxVal || typeof sandboxVal !== 'string') return false;
    const tokens = sandboxVal.trim().toLowerCase().split(/\\s+/);
    if (tokens.some(t => FORBIDDEN_SANDBOX_TOKENS.has(t))) return false;
    return tokens.includes('allow-scripts');
  }

  function rewriteCSP(html) {
    if (html && typeof html === 'object') {
      try { if (typeof html.toString === 'function') html = html.toString(); } catch (_) {}
    }
    if (typeof html !== 'string') return html;
    if (html.includes('data-ag-csp="1"')) return html;
    if (/<meta[^>]*Content-Security-Policy[^>]*>/i.test(html)) {
      return html.replace(/<meta[^>]*Content-Security-Policy[^>]*>/gi, () => ${JSON.stringify(CSP_TAG)});
    }
    if (/<head\\b[^>]*>/i.test(html)) {
      return html.replace(/<head\\b[^>]*>/i, (match) => match + ${JSON.stringify(CSP_TAG)});
    }
    return ${JSON.stringify(CSP_TAG)} + html;
  }

  // Hook srcdoc setter
  try {
    const srcdocDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'srcdoc');
    if (srcdocDesc && srcdocDesc.set) {
      const origSet = srcdocDesc.set;
      Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', {
        set(val) {
          const rewritten = rewriteCSP(val);
          if (!this.hasAttribute('sandbox') || !isSandboxSafe(this.getAttribute('sandbox'))) {
            try { this.setAttribute('sandbox', sanitizeSandbox(this.getAttribute('sandbox'))); } catch (_) {}
          }
          return origSet.call(this, rewritten);
        },
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
        if (lower === 'srcdoc') {
          val = rewriteCSP(val);
          if (!isMutatingInternal && (!this.hasAttribute('sandbox') || !isSandboxSafe(this.getAttribute('sandbox')))) {
            origSetAttribute.call(this, 'sandbox', sanitizeSandbox(this.getAttribute('sandbox')));
          }
        } else if (lower === 'sandbox' && typeof val === 'string') {
          val = sanitizeSandbox(val);
        }
      }
      return origSetAttribute.call(this, name, val);
    };
  } catch (_) {}

  // Hook removeAttribute to preserve sandbox protection on artifact iframes (SEC-12)
  try {
    const origRemoveAttribute = Element.prototype.removeAttribute;
    Element.prototype.removeAttribute = function(name) {
      if (typeof name === 'string' && name.toLowerCase() === 'sandbox' && (this.tagName === 'IFRAME' || this instanceof HTMLIFrameElement)) {
        if (isArtifactFrame(this)) {
          this.setAttribute('sandbox', SAFE_SANDBOX);
          return;
        }
      }
      return origRemoveAttribute.call(this, name);
    };
  } catch (_) {}

  // Hook DOMTokenList.value & .add scoped strictly to sandbox tokens (SEC-13, REDUN-03, CSP-07)
  try {
    const tokenListValDesc = Object.getOwnPropertyDescriptor(DOMTokenList.prototype, 'value');
    if (tokenListValDesc && tokenListValDesc.set) {
      const origTokenValSet = tokenListValDesc.set;
      Object.defineProperty(DOMTokenList.prototype, 'value', {
        set(val) {
          if (typeof val === 'string' && /\\ballow-/i.test(val)) {
            val = sanitizeSandbox(val);
          }
          return origTokenValSet.call(this, val);
        },
        get() { return tokenListValDesc.get ? tokenListValDesc.get.call(this) : ''; },
        configurable: true,
        enumerable: true
      });
    }
  } catch (_) {}

  try {
    const origTokenAdd = DOMTokenList.prototype.add;
    DOMTokenList.prototype.add = function(...tokens) {
      const hasSandboxToken = tokens.some(t => String(t).toLowerCase().startsWith('allow-'));
      if (!hasSandboxToken) {
        return origTokenAdd.apply(this, tokens);
      }
      const filtered = tokens.filter(t => !FORBIDDEN_SANDBOX_TOKENS.has(String(t).toLowerCase()));
      if (filtered.length > 0) {
        return origTokenAdd.apply(this, filtered);
      }
    };
  } catch (_) {}

  // Hook innerHTML and insertAdjacentHTML pre-parser (SEC-16)
  try {
    const innerHTMLDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (innerHTMLDesc && innerHTMLDesc.set) {
      const origInnerHTMLSet = innerHTMLDesc.set;
      Object.defineProperty(Element.prototype, 'innerHTML', {
        set(val) {
          if (typeof val === 'string' && /<iframe\\b/i.test(val) && /content-security-policy/i.test(val)) {
            val = rewriteCSP(val);
          }
          return origInnerHTMLSet.call(this, val);
        },
        get() { return innerHTMLDesc.get.call(this); },
        configurable: true,
        enumerable: true
      });
    }
  } catch (_) {}

  try {
    const origInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;
    Element.prototype.insertAdjacentHTML = function(position, text) {
      if (typeof text === 'string' && /<iframe\\b/i.test(text) && /content-security-policy/i.test(text)) {
        text = rewriteCSP(text);
      }
      return origInsertAdjacentHTML.call(this, position, text);
    };
  } catch (_) {}

  // Clean iframe helper with artifact scoping & TrustedHTML coercion (SEC-12, TRUST-01)
  function cleanIframe(iframe) {
    if (!iframe || iframe.tagName !== 'IFRAME') return;
    try {
      const currentSandbox = iframe.getAttribute('sandbox');
      if (currentSandbox === null) {
        if (isArtifactFrame(iframe)) {
          isMutatingInternal = true;
          iframe.setAttribute('sandbox', SAFE_SANDBOX);
          isMutatingInternal = false;
        }
      } else if (!isSandboxSafe(currentSandbox)) {
        const clean = sanitizeSandbox(currentSandbox);
        if (currentSandbox !== clean) {
          isMutatingInternal = true;
          iframe.setAttribute('sandbox', clean);
          isMutatingInternal = false;
        }
      }
      let currentSrcdoc = iframe.getAttribute('srcdoc') || iframe.srcdoc;
      if (currentSrcdoc && typeof currentSrcdoc === 'object') {
        try { if (typeof currentSrcdoc.toString === 'function') currentSrcdoc = currentSrcdoc.toString(); } catch (_) {}
      }
      if (typeof currentSrcdoc === 'string' && currentSrcdoc.length > 0 && !currentSrcdoc.includes('data-ag-csp="1"')) {
        const rewritten = rewriteCSP(currentSrcdoc);
        if (rewritten !== currentSrcdoc) {
          isMutatingInternal = true;
          iframe.setAttribute('srcdoc', rewritten);
          iframe.srcdoc = rewritten;
          isMutatingInternal = false;
        }
      }
    } catch (_) {
      isMutatingInternal = false;
    }
  }

  // Observe DOM additions with element filtering (PERF-05)
  try {
    const observer = new MutationObserver((mutations) => {
      if (isMutatingInternal) return;
      for (const m of mutations) {
        if (m.type === 'childList') {
          for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.tagName === 'IFRAME') cleanIframe(node);
            else if (node.firstElementChild && node.querySelectorAll) node.querySelectorAll('iframe').forEach(cleanIframe);
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
  window.addEventListener('load', () => document.querySelectorAll('iframe').forEach(cleanIframe));
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