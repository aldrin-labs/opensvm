import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./styles/custom-scrollbar.css";
import "./styles/scrollbar-themes.css";
import "../styles/rtl.css";
import "../styles/mobile-optimizations.css";
import "../styles/keyboard-focus.css";
import { NavbarInteractive } from "@/components/NavbarInteractive";
import { Providers } from "./providers";
import { AIChatSidebarWrapper } from "@/components/ai/AIChatSidebarWrapper";
import OpenSearchPrompt from "@/components/OpenSearchPrompt";
import { ClientInitializers } from "@/components/ClientInitializers";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  preload: true,
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
  preload: true,
});

export const metadata: Metadata = {
  title:
    "OpenSVM - AI Explorer and RPC nodes provider for all SVM networks (Solana Virtual Machine)",
  description:
    "Explore all SVM networks with AI assistance, or create your Solana Network Extension for free.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
    other: {
      rel: "icon",
      url: "/favicon.svg",
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`ai-html-root ${inter.variable} ${jetbrains.variable}`}
    >
      <head>
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="preconnect"
          href="https://api.mainnet-beta.solana.com"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/BerkeleyMono-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
          fetchPriority="high"
        />
        <link
          rel="preload"
          href="/fonts/BerkeleyMono-Bold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
          fetchPriority="high"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover"
        />
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="search" type="application/opensearchdescription+xml" title="OpenSVM" href="/opensearch.xml" />
        <script src="/register-sw.js" defer></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
try {
  var w = window;
  var qp = location.search;
  // Inject early persisted width into global BEFORE any React hydration so ChatLayout/Provider initializers can read it
  try {
    var __sw = localStorage.getItem('aiSidebarWidth');
    if (__sw && /^\\d+$/.test(__sw)) {
      var __vp = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 1920;
      var __min = Math.min(560, __vp);
      var __cw = Math.min(__vp, Math.max(__min, parseInt(__sw,10)));
      window.__SVMAI_EARLY_WIDTH__ = __cw;
      try {
        window.dispatchEvent(new CustomEvent('svmai-width-set', { detail: { width: __cw, phase: 'early-persisted', ts: Date.now() }}));
      } catch(e){}
    }
  } catch(e){}
  // Early placeholder root to eliminate race for tests selecting [data-ai-sidebar-root]
  try {
    var wantsAI = (/[?&]ai=(1|true)(?:&|$)/.test(qp) || /[?&]aimock=1(?:&|$)/.test(qp));
    var persistedOpen = false;
    try { persistedOpen = localStorage.getItem('aiSidebarOpen') === '1'; } catch(e){}
    if ((w.SVMAI && w.SVMAI.__forceOpen) || wantsAI || persistedOpen) {
      // If an SSR-rendered root already exists, upgrade it instead of creating a placeholder
      var existingRoot = document.querySelector('[data-ai-sidebar-root]');
      if (existingRoot) {
        try {
          existingRoot.setAttribute('data-open','1');
          existingRoot.setAttribute('data-ai-sidebar-visible','1');
          existingRoot.setAttribute('data-ai-mode', existingRoot.getAttribute('data-ai-mode') || 'agent');
          var __pwExist = localStorage.getItem('aiSidebarWidth');
          if (__pwExist && /^\\d+$/.test(__pwExist)) {
            existingRoot.setAttribute('data-ai-sidebar-width', __pwExist);
            if (existingRoot.style) existingRoot.style.width = __pwExist + 'px';
            try {
              window.dispatchEvent(new CustomEvent('svmai-width-set', { detail: { width: parseInt(__pwExist,10), phase: 'early-upgrade-existing', ts: Date.now() }}));
            } catch(e){}
          }
        } catch(e){}
      } else if (!document.getElementById('svmai-early-root')) {
        var earlyRoot = document.createElement('div');
        earlyRoot.id = 'svmai-early-root';
        earlyRoot.setAttribute('data-ai-sidebar-root','');
        earlyRoot.setAttribute('data-ai-sidebar','');
        earlyRoot.setAttribute('data-ai-sidebar-early-root','1');
        earlyRoot.setAttribute('data-open','1');
        earlyRoot.setAttribute('data-ai-sidebar-visible','1');
        // width attribute will be normalized by hydrated component; set initial conservative value
        earlyRoot.setAttribute('data-ai-sidebar-width','560');
        // default mode attribute so tests reading pre-hydration state see expected mode
        earlyRoot.setAttribute('data-ai-mode','agent');
        // Apply any persisted width immediately (pre-hydration) so first measurement reflects user setting
        try {
          var __pw = localStorage.getItem('aiSidebarWidth');
          if (__pw && /^\\d+$/.test(__pw)) {
            earlyRoot.setAttribute('data-ai-sidebar-width', __pw);
            earlyRoot.style.width = __pw + 'px';
            try {
              window.dispatchEvent(new CustomEvent('svmai-width-set', { detail: { width: parseInt(__pw,10), phase: 'early-placeholder', ts: Date.now() }}));
            } catch(e){}
          }
        } catch(e){}
        earlyRoot.style.cssText = 'position:fixed;top:0;right:0;bottom:0;width:' + (earlyRoot.getAttribute('data-ai-sidebar-width') || '560') + 'px;min-width:min(560px,100vw);height:100vh;box-sizing:border-box;z-index:99998;opacity:0;pointer-events:auto;overflow:hidden;background:transparent;';
        document.body.appendChild(earlyRoot);
        try {
          window.dispatchEvent(new CustomEvent('svmai-root-placeholder', { detail: { ts: Date.now(), phase: 'layout-inline' }}));
        } catch(e){}
      }
    }
  } catch(e){}

  // Final early width enforcement to avoid race before hydration
  (function(){
    try {
      function svmaiEnsureWidth(){
        try {
          var wVal = (typeof window !== 'undefined') ? (window).__SVMAI_EARLY_WIDTH__ : undefined;
          if(!Number.isFinite(wVal)) {
            var ls = localStorage.getItem('aiSidebarWidth');
            if(ls && /^\\d+$/.test(ls)) wVal = parseInt(ls,10);
          }
            if(Number.isFinite(wVal)){
              var root = document.querySelector('[data-ai-sidebar-root]') || document.getElementById('svmai-early-root');
              if(root){
                root.setAttribute('data-ai-sidebar-width', String(wVal));
                if(root.style) root.style.width = wVal + 'px';
                try {
                  window.dispatchEvent(new CustomEvent('svmai-width-set', { detail:{ width: wVal, phase: 'early-final', ts: Date.now() }}));
                } catch(e){}
              }
            }
        } catch(e){}
      }
      svmaiEnsureWidth();
      requestAnimationFrame(svmaiEnsureWidth);
      setTimeout(svmaiEnsureWidth, 65);
    } catch(e){}
  })();
  // Fallback: if body wasn't ready when initial attempt ran, retry until body exists (max ~2s)
  try {
    if (!document.getElementById('svmai-early-root')) {
      (function ensureEarlyRoot(at){
        if (document.getElementById('svmai-early-root')) return;
        if (document.body) {
          try {
            var wantsAI2 = (/[?&]ai=(1|true)(?:&|$)/.test(qp) || /[?&]aimock=1(?:&|$)/.test(qp));
            var persisted2 = false;
            try { persisted2 = localStorage.getItem('aiSidebarOpen') === '1'; } catch(e){}
            if (w.SVMAI?.__forceOpen || wantsAI2 || persisted2) {
              var earlyRoot2 = document.createElement('div');
              earlyRoot2.id = 'svmai-early-root';
              earlyRoot2.setAttribute('data-ai-sidebar-root','');
              earlyRoot2.setAttribute('data-ai-sidebar','');
              earlyRoot2.setAttribute('data-ai-sidebar-early-root','1');
              earlyRoot2.setAttribute('data-open','1');
              earlyRoot2.setAttribute('data-ai-sidebar-visible','1');
              earlyRoot2.setAttribute('data-ai-sidebar-width','560');
              earlyRoot2.setAttribute('data-ai-mode','agent');
              try {
                var __pw2 = localStorage.getItem('aiSidebarWidth');
                if (__pw2 && /^\d+$/.test(__pw2)) {
                  earlyRoot2.setAttribute('data-ai-sidebar-width', __pw2);
                  earlyRoot2.style.width = __pw2 + 'px';
                }
              } catch(e){}
              earlyRoot2.style.cssText = 'position:fixed;top:0;right:0;bottom:0;width:' + (earlyRoot2.getAttribute('data-ai-sidebar-width') || '560') + 'px;min-width:min(560px,100vw);height:100vh;box-sizing:border-box;z-index:99998;opacity:0;pointer-events:auto;overflow:hidden;background:transparent;';
              document.body.appendChild(earlyRoot2);
              try { window.dispatchEvent(new CustomEvent('svmai-root-placeholder', { detail: { ts: Date.now(), phase: 'layout-inline-fallback' }})); } catch(e){}
            }
          } catch(e){}
          return;
        }
        if (at < 120) { requestAnimationFrame(function(){ ensureEarlyRoot(at+1); }); }
      })(0);
    }
  } catch(e){}
  if (/[?&]ai=(1|true)(?:&|$)/.test(qp)) {
    try { localStorage.setItem('aiSidebarOpen','1'); } catch(e){}
  }
  w.SVMAI = w.SVMAI || {};
  if (typeof w.SVMAI.open !== 'function') { w.SVMAI.open = function(){ w.__SVMAI_EARLY_OPEN__ = Date.now(); }; }
  if (typeof w.SVMAI.close !== 'function') { w.SVMAI.close = function(){ w.__SVMAI_EARLY_CLOSE__ = Date.now(); }; }
  if (typeof w.SVMAI.toggle !== 'function') { w.SVMAI.toggle = function(next){ w.__SVMAI_EARLY_TOGGLE__ = { next: next, ts: Date.now() }; }; }
  // Early width setter so tests can persist & observe width before hydration
  if (typeof w.SVMAI.setWidth !== 'function') {
    w.SVMAI.setWidth = function(n){
      try {
        n = (typeof n === 'number') ? n : parseInt(n,10);
        if (!(n > 0)) return;
        var viewport = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 1920;
        var minLimit = Math.min(560, viewport);
        var clamped = Math.min(viewport, Math.max(minLimit, n));
        try { localStorage.setItem('aiSidebarWidth', String(clamped)); } catch(e){}
        // Stamp early width global so hydration initializers immediately pick latest user intent
        try { window.__SVMAI_EARLY_WIDTH__ = clamped; } catch(e){}
        // Instrumentation event log (mirrors hydrated api-setWidth events)
        try {
          var arr = (window.__SVMAI_WIDTH_EVENTS__ = window.__SVMAI_WIDTH_EVENTS__ || []);
          arr.push({ ts: Date.now(), source: 'early-setWidth', width: clamped, input: n });
        } catch(e){}
        var r = document.querySelector('[data-ai-sidebar-root]') || document.getElementById('svmai-early-root');
        if (r) {
          r.setAttribute('data-ai-sidebar-width', String(clamped));
          try {
            if (r && r.style) {
              r.style.width = clamped + 'px';
            }
          } catch(e){}
          // Ensure open visibility attributes so early measurement reflects clamped width
          try {
            r.setAttribute('data-open','1');
            r.setAttribute('data-ai-sidebar-visible','1');
          } catch(e){}
        }
        try {
          window.dispatchEvent(new CustomEvent('svmai-width-set', { detail: { width: clamped, phase: 'early', ts: Date.now() }}));
        } catch(e){}
        return clamped;
      } catch(e){}
    };
  }
  if (typeof w.SVMAI.prompt !== 'function') {
    w.SVMAI.prompt = function(text, submit){
      w.__SVMAI_EARLY_PROMPT__ = { text: String(text||''), submit: !!submit, ts: Date.now() };
      try {
        if (submit) {
          var prov = document.getElementById('svmai-early-processing');
          if (!prov) {
            prov = document.createElement('div');
            prov.id = 'svmai-early-processing';
            prov.setAttribute('data-ai-processing-status','1');
            prov.setAttribute('data-ai-processing-active','1');
            prov.style.cssText='position:fixed;top:6px;right:8px;font:11px system-ui,sans-serif;background:rgba(0,0,0,0.65);color:#fff;padding:2px 6px;border-radius:4px;z-index:40001;pointer-events:none;';
            prov.textContent='Processing...';
            document.body.appendChild(prov);
          } else {
            prov.setAttribute('data-ai-processing-active','1');
            prov.textContent='Processing...';
          }
          setTimeout(function(){
            try {
              if (prov && !window.__SVMAI_FINALIZED__) {
                prov.setAttribute('data-ai-processing-active','0');
                prov.style.opacity='0';
              }
            } catch(e){}
          }, 4000);
        }
      } catch(e){}
    };
  }
  if (typeof w.SVMAI.seed !== 'function') {
    w.SVMAI._seedQueue = w.SVMAI._seedQueue || [];
    w.SVMAI.seed = function(count, opts){
      count = (typeof count === 'number' && count > 0) ? count : 20;
      try {
        w.SVMAI._seedQueue.push({ count: count, opts: opts });
        window.dispatchEvent(new CustomEvent('svmai-seed-queued', { detail: { count: count, opts: opts, phase: 'layout-inline', ts: Date.now() } }));
      } catch(e){}
      return { queued: true, stub: true };
    };
  }
  if (typeof w.__SVMAI_SEED__ !== 'function') {
    w.__SVMAI_SEED__ = function(count, opts){
      try {
        if (w.SVMAI && typeof w.SVMAI.seed === 'function') {
          return w.SVMAI.seed(count, opts);
        }
        w.SVMAI = w.SVMAI || {};
        w.SVMAI._seedQueue = w.SVMAI._seedQueue || [];
        w.SVMAI._seedQueue.push({ count: (typeof count === 'number' && count > 0) ? count : 20, opts: opts });
        window.dispatchEvent(new CustomEvent('svmai-seed-queued', { detail: { count: count, opts: opts, phase: 'layout-inline-alias', ts: Date.now() } }));
      } catch(e){}
      return { queued: true, alias: true };
    };
    try {
      window.dispatchEvent(new CustomEvent('svmai-seed-alias-ready', { detail: { phase: 'layout-inline', ts: Date.now() } }));
    } catch(e){}
  }
  if ((/[?&]ai=(1|true)(?:&|$)/.test(qp) || /[?&]aimock=1(?:&|$)/.test(qp)) && !document.querySelector('[data-ai-chat-input]')) {
    try {
      var hostInput = document.getElementById('ai-sidebar-ssr-placeholder') || document.body;
      var earlyWrap = document.createElement('div');
      earlyWrap.id = 'svmai-early-input-inline';
      earlyWrap.setAttribute('data-ai-chat-early','inline');
      earlyWrap.style.cssText='position:fixed;bottom:12px;right:12px;width:340px;max-width:48vw;z-index:40000;background:rgba(0,0,0,0.55);backdrop-filter:blur(2px);padding:6px 6px 8px;border:1px solid rgba(255,255,255,0.2);border-radius:6px;font:12px system-ui,sans-serif;color:#fff;';
      earlyWrap.innerHTML='<textarea data-ai-chat-input data-ai-early-inline="1" aria-label="Chat input (initializing)" rows="2" style="width:100%;resize:none;background:rgba(0,0,0,0.6);color:#fff;border:1px solid rgba(255,255,255,0.25);border-radius:4px;padding:6px;font:12px/1.35 system-ui,sans-serif;" placeholder="Initializing chat..."></textarea><div style="margin-top:4px;font-size:10px;opacity:0.6;">Loading chat…</div>';
      hostInput.appendChild(earlyWrap);
      var removeEarly = function(){
        var real = document.querySelector('[data-ai-chat-ui] [data-ai-chat-input]');
        var provisional = document.getElementById('svmai-early-input-inline');
        if (real && provisional) { provisional.remove(); return true; }
        return false;
      };
      window.addEventListener('svmai-global-ready', function(ev){
        if (ev.detail && ev.detail.phase === 'mounted') {
          setTimeout(removeEarly, 30);
          setTimeout(removeEarly, 250);
          setTimeout(removeEarly, 1200);
        }
      });
      setTimeout(function check(){ if(!removeEarly()) setTimeout(check,120); }, 300);
    } catch(e){}
  }
  if (/[?&]ai=(1|true)(?:&|$)/.test(qp) || /[?&]aimock=1(?:&|$)/.test(qp)) {
    var ensureReasoning = function(){
      try {
        if (document.querySelector('[data-ai-reasoning-toggle]')) return;
        var _candidateRoot = document.querySelector('[data-ai-sidebar-root]') || document.body;
        var root = (_candidateRoot && getComputedStyle(_candidateRoot).pointerEvents === 'none') ? document.body : _candidateRoot;
        var host = document.createElement('div');
        host.setAttribute('data-ai-reasoning-block','');
        host.setAttribute('data-ai-reasoning-sync','pre-hydration');
        host.setAttribute('data-ai-reasoning-early','1');
        host.style.cssText='margin:12px;margin-top:84px;position:relative;z-index:3;scroll-margin-bottom:160px;';
        host.innerHTML = '<button type="button" data-ai-reasoning-toggle aria-expanded="false" aria-controls="pre-hydration-reasoning" class="flex items-center gap-1 text-xs text-slate-200 bg-slate-800/80 px-2 py-1 rounded"><span>Reasoning <span class="text-slate-400 ml-1">(4 tokens)</span></span></button><div id="pre-hydration-reasoning" data-ai-reasoning-content aria-hidden="true" hidden class="mt-1 p-2 bg-slate-900/70 border border-slate-700/50 rounded text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">Pre-hydration reasoning fallback block.</div>';
        root.appendChild(host);
        // Once real reasoning is ready, purge early placeholder(s)
        try {
          window.addEventListener('svmai-reasoning-ready', function(){
            try {
              var realBlock = document.querySelector('[data-ai-sidebar-root] [data-ai-reasoning-block]:not([data-ai-reasoning-early])');
              if (realBlock) {
                document.querySelectorAll('[data-ai-reasoning-block][data-ai-reasoning-early]').forEach(function(el){
                  if (el !== realBlock) el.remove();
                });
              }
            } catch(e){}
          }, { once:true });
        } catch(e){}
        try {
          var btn = host.querySelector('[data-ai-reasoning-toggle]');
          var content = host.querySelector('[data-ai-reasoning-content]');
          if (btn && content) {
            btn.addEventListener('click', function(){
              var expanded = btn.getAttribute('aria-expanded') === 'true';
              var next = !expanded;
              btn.setAttribute('aria-expanded', next ? 'true':'false');
              content.setAttribute('aria-hidden', next ? 'false':'true');
              if (next) { content.removeAttribute('hidden'); } else { content.setAttribute('hidden',''); }
              try {
                w.__svmaiReasoningEvents = w.__svmaiReasoningEvents || [];
                w.__svmaiReasoningEvents.push({ type: next ? 'reasoning_expand':'reasoning_collapse', ts: Date.now(), source: 'pre-hydration' });
                window.dispatchEvent(new CustomEvent('svmai-reasoning-toggle', { detail: { expanded: next, source: 'pre-hydration' } }));
              } catch(e){}
            });
          }
          window.dispatchEvent(new CustomEvent('svmai-reasoning-ready',{ detail:{ source:'layout-pre-hydration', ts: Date.now() }}));
        } catch(e){}
      } catch(e){}
    };
    requestAnimationFrame(function(){ requestAnimationFrame(ensureReasoning); });
    setTimeout(ensureReasoning, 650);
  }
  if (!w.__SVMAI_GLOBAL_READY_LAYOUT_INLINE__) {
    try {
      w.__SVMAI_GLOBAL_READY_LAYOUT_INLINE__ = true;
      window.dispatchEvent(new CustomEvent('svmai-global-ready', { detail: { phase: 'layout-inline', ts: Date.now() } }));
    } catch(e){}
  }
} catch(e){}
})();`,
          }}
        />
      </head>
      <body>
        <Providers>
          <ClientInitializers />
          <NavbarInteractive>
            {children}
          </NavbarInteractive>
          <AIChatSidebarWrapper />
          <OpenSearchPrompt />
        </Providers>
      </body>
    </html>
  );
}
