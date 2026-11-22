/* Leónida Hoy — interacción (sin dependencias) */
(function () {
  "use strict";
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} },
  };

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Cuenta atrás (hora local del visitante: GTA VI se desbloquea a las 00:00 locales)
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var boxes = document.querySelectorAll("[data-countdown]");
  var minis = document.querySelectorAll("[data-countdown-mini]");
  function tick() {
    var now = Date.now();
    boxes.forEach(function (el) {
      var diff = new Date(el.getAttribute("data-countdown")).getTime() - now;
      if (diff <= 0) {
        el.querySelector(".countdown__grid").hidden = true;
        el.querySelector(".countdown__label").hidden = true;
        el.querySelector(".countdown__done").hidden = false;
        return;
      }
      var s = Math.floor(diff / 1000);
      var v = { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
      Object.keys(v).forEach(function (k) {
        var b = el.querySelector('[data-unit="' + k + '"]');
        var txt = String(k === "d" ? v[k] : pad(v[k]));
        if (b && b.textContent !== txt) {
          var first = b.textContent === "–";
          b.textContent = txt;
          if (!first && !reduced) { b.classList.remove("tick"); void b.offsetWidth; b.classList.add("tick"); }
        }
      });
    });
    minis.forEach(function (el) {
      var diff = new Date(el.getAttribute("data-countdown-mini")).getTime() - now;
      var t = el.querySelector("[data-mini]");
      var pre = el.querySelector("[data-mini-pre]");
      if (diff <= 0) { if (pre) pre.textContent = "GTA VI ·"; t.textContent = el.getAttribute("data-done") || "✓"; return; }
      var s = Math.floor(diff / 1000);
      t.textContent = Math.floor(s / 86400) + "d " + pad(Math.floor((s % 86400) / 3600)) + "h " + pad(Math.floor((s % 3600) / 60)) + "m";
    });
  }
  // Tras el lanzamiento no hace falta seguir contando: se deja el estado final y se para (menos trabajo en cada segundo)
  var launchAt = Math.max.apply(null, Array.prototype.map.call(boxes, function (el) { return new Date(el.getAttribute("data-countdown")).getTime() || 0; }).concat(Array.prototype.map.call(minis, function (el) { return new Date(el.getAttribute("data-countdown-mini")).getTime() || 0; })));
  if (boxes.length || minis.length) {
    tick();
    if (Date.now() < launchAt) { var cdTimer = setInterval(function () { tick(); if (Date.now() >= launchAt) clearInterval(cdTimer); }, 1000); }
  }

  // Animación suave solo cuando el contenido cambia por un toque (no al cargar cada página)
  var swapT = 0;
  function swapAnim() {
    if (reduced) return;
    document.documentElement.classList.add("swap");
    clearTimeout(swapT); swapT = setTimeout(function () { document.documentElement.classList.remove("swap"); }, 500);
  }

  // Modo claro / oscuro: por defecto, el del sistema (móvil u ordenador).
  // El botón lo cambia; si eliges el mismo que tiene el sistema, o el sistema cambia
  // (p. ej. modo oscuro automático al anochecer), la web vuelve a seguir al sistema.
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
  var themeBtns = document.querySelectorAll("[data-theme-toggle]");
  var themeMeta = document.querySelector("[data-theme-color]");
  function systemTheme() { return mq && mq.matches ? "light" : "dark"; }
  function effectiveTheme() {
    var t = root.getAttribute("data-theme");
    return t === "light" || t === "dark" ? t : (mq && mq.matches ? "light" : "dark");
  }
  function syncTheme() {
    var now = effectiveTheme();
    root.setAttribute("data-theme-now", now);
    if (themeMeta) themeMeta.setAttribute("content", now === "light" ? "#fff6fb" : "#0b0618");
    themeBtns.forEach(function (b) { var l = b.getAttribute(now === "dark" ? "data-to-light" : "data-to-dark"); if (l) b.setAttribute("aria-label", l); });
  }
  themeBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      var next = effectiveTheme() === "dark" ? "light" : "dark";
      var apply = function () {
        if (next === systemTheme()) { root.removeAttribute("data-theme"); store.del("lh-tema"); }
        else { root.setAttribute("data-theme", next); store.set("lh-tema", next); }
        syncTheme();
      };
      if (document.startViewTransition && !reduced) {
        var r = b.getBoundingClientRect();
        root.style.setProperty("--tx", r.left + r.width / 2 + "px");
        root.style.setProperty("--ty", r.top + r.height / 2 + "px");
        root.classList.add("theme-vt");
        var done = function () { root.classList.remove("theme-vt"); };
        try { document.startViewTransition(apply).finished.then(done, done); } catch (e) { done(); apply(); }
      } else apply();
    });
  });
  if (mq) {
    var onSys = function () { root.removeAttribute("data-theme"); store.del("lh-tema"); syncTheme(); };
    if (mq.addEventListener) mq.addEventListener("change", onSys); else if (mq.addListener) mq.addListener(onSys);
  }
  syncTheme();
  // Al volver a la app (iPhone/Android) el sistema puede haber cambiado de modo mientras tanto
  document.addEventListener("visibilitychange", function () { if (!document.hidden) syncTheme(); });
  window.addEventListener("pageshow", syncTheme);
  // Otra pestaña cambió el tema
  window.addEventListener("storage", function (e) {
    if (e.key !== "lh-tema") return;
    if (e.newValue === "light" || e.newValue === "dark") root.setAttribute("data-theme", e.newValue); else root.removeAttribute("data-theme");
    syncTheme();
  });

  // Selector de audiencia
  var btns = document.querySelectorAll("[data-aud-btn]");
  function setAud(a) {
    document.documentElement.setAttribute("data-reader", a);
    btns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-aud-btn") === a)); });
  }
  setAud(store.get("lh-aud") === "nuevos" ? "nuevos" : "fans");
  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      var a = b.getAttribute("data-aud-btn");
      // primero se marca el botón (respuesta inmediata) y en el siguiente fotograma cambia el texto de toda la página
      btns.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      store.set("lh-aud", a);
      requestAnimationFrame(function () { setTimeout(function () { swapAnim(); setAud(a); }, 0); });
    });
  });

  // Copiar publicaciones
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var src = document.querySelector(btn.getAttribute("data-copy"));
      if (!src) return;
      var text = src.textContent.trim();
      var label = btn.querySelector("span");
      var original = label ? label.textContent : "";
      var done = function () {
        btn.classList.add("is-done"); if (label) label.textContent = btn.getAttribute("data-copied") || "✓";
        setTimeout(function () { btn.classList.remove("is-done"); if (label) label.textContent = original; }, 1800);
      };
      var settled = false;
      var finish = function (okFn) { if (!settled) { settled = true; okFn(); } };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { finish(done); }, function () { finish(fallback); });
        setTimeout(function () { finish(fallback); }, 1500); // por si el navegador no responde
      } else finish(fallback);
      function fallback() {
        var ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); done(); } catch (e) {}
        document.body.removeChild(ta);
      }
    });
  });

  // Compartir nativo (móvil)
  document.querySelectorAll("[data-native-share]").forEach(function (btn) {
    if (!navigator.share) { btn.hidden = true; return; }
    btn.addEventListener("click", function () {
      navigator.share({ title: btn.getAttribute("data-title"), url: btn.getAttribute("data-url") }).catch(function () {});
    });
  });

  // Idioma: recordar la elección y sugerir el otro idioma si el navegador lo prefiere
  document.querySelectorAll("a[data-lang]").forEach(function (a) {
    a.addEventListener("click", function () { store.set("lh-lang", a.getAttribute("data-lang")); });
  });
  var hint = document.querySelector("[data-lang-hint]");
  if (hint) {
    var target = hint.getAttribute("data-lang-hint");
    var pageLang = document.documentElement.lang;
    var pref = store.get("lh-lang");
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || "";
    var wants = pref ? pref === target : nav.slice(0, 2).toLowerCase() === target;
    if (wants && pref !== pageLang && store.get("lh-hint-off") !== "1") hint.hidden = false;
    var close = hint.querySelector("[data-lang-hint-close]");
    if (close) close.addEventListener("click", function () { hint.hidden = true; store.set("lh-hint-off", "1"); });
  }

  // Descubrimientos: filtrar por categoría
  var fBtns = document.querySelectorAll("[data-fcat]");
  if (fBtns.length) {
    var fCards = document.querySelectorAll("[data-finds] [data-cat]");
    var fNone = document.querySelector("[data-finds-none]");
    fBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        var want = b.getAttribute("data-fcat"), shown = 0;
        swapAnim();
        fBtns.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        fCards.forEach(function (c) { var ok = want === "all" || c.getAttribute("data-cat") === want; c.hidden = !ok; if (ok) shown++; });
        if (fNone) fNone.hidden = shown > 0;
      });
    });
  }

  // ================= Clips de la comunidad =================
  // Nada de YouTube/TikTok/X se carga hasta que la persona pulsa reproducir (privacidad y velocidad).
  (function () {
    var players = document.querySelectorAll("[data-clip-player]");
    if (!players.length) return;
    var playing = null, tw = null;
    var thumbBtns = document.querySelectorAll("[data-thumbs-toggle]");
    function setThumbs(on) {
      players.forEach(function (p) {
        if (p.getAttribute("data-platform") !== "youtube" || p.classList.contains("is-playing")) return;
        var t = p.querySelector(".clip__thumb");
        if (!t) return;
        if (on) { t.style.backgroundImage = 'url("https://i.ytimg.com/vi/' + p.getAttribute("data-vid") + '/hqdefault.jpg")'; p.classList.add("has-thumb"); }
        else { t.style.backgroundImage = ""; p.classList.remove("has-thumb"); }
      });
      thumbBtns.forEach(function (b) { b.textContent = b.getAttribute(on ? "data-off" : "data-on"); b.setAttribute("aria-pressed", String(on)); });
    }
    if (store.get("lh-embeds") === "1") setThumbs(true);
    thumbBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        var on = store.get("lh-embeds") !== "1";
        if (on) store.set("lh-embeds", "1"); else store.del("lh-embeds");
        setThumbs(on);
      });
    });
    function restore(p) {
      if (!p || !p._face) return;
      p.innerHTML = "";
      p.appendChild(p._face);
      p.classList.remove("is-playing");
    }
    function loadTw(cb) {
      if (window.twttr && window.twttr.widgets) return cb();
      if (!tw) {
        tw = [];
        var sc = document.createElement("script");
        sc.src = "https://platform.twitter.com/widgets.js"; sc.async = true; sc.charset = "utf-8";
        sc.onload = function () { var w = window.twttr; var go = function () { tw.forEach(function (f) { f(); }); tw = []; }; if (w && w.ready) w.ready(go); else go(); };
        document.head.appendChild(sc);
      }
      tw.push(cb);
    }
    // Ceder el turno al navegador: primero se pinta la respuesta al toque y luego se crea el reproductor
    var afterPaint = function (fn) { requestAnimationFrame(function () { setTimeout(fn, 0); }); };
    // Abrir la conexión con la plataforma en cuanto el dedo toca el botón (el vídeo llega antes)
    var warmed = {};
    function preconnect(pf) {
      var host = { youtube: "https://www.youtube-nocookie.com", tiktok: "https://www.tiktok.com", x: "https://platform.twitter.com" }[pf];
      if (!host || warmed[host]) return;
      warmed[host] = 1;
      var l = document.createElement("link"); l.rel = "preconnect"; l.href = host; l.crossOrigin = "";
      document.head.appendChild(l);
    }
    document.addEventListener("pointerdown", function (e) {
      var b = e.target.closest && e.target.closest("[data-play]");
      var p = b && b.closest("[data-clip-player]");
      if (p) preconnect(p.getAttribute("data-platform"));
    }, { passive: true });
    function play(p) {
      if (p.classList.contains("is-loading")) return;
      p.classList.add("is-loading");
      afterPaint(function () { p.classList.remove("is-loading"); start(p); });
    }
    function start(p) {
      if (playing && playing !== p) restore(playing);
      var pf = p.getAttribute("data-platform"), id = p.getAttribute("data-vid"), title = p.getAttribute("data-title") || "";
      if (!p._face) p._face = p.querySelector(".clip__face");
      p.classList.add("is-playing");
      playing = p;
      if (pf === "x") {
        var box = document.createElement("div");
        box.className = "clip__tweet";
        p.innerHTML = "";
        p.appendChild(box);
        loadTw(function () {
          try { window.twttr.widgets.createTweet(id, box, { dnt: true, align: "center", theme: root.getAttribute("data-theme-now") === "light" ? "light" : "dark", conversation: "none" }); } catch (e) {}
        });
        return;
      }
      var src = pf === "youtube"
        ? "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&playsinline=1&rel=0&modestbranding=1"
        : "https://www.tiktok.com/player/v1/" + id + "?autoplay=1&music_info=1&description=1&rel=0";
      var f = document.createElement("iframe");
      f.src = src;
      f.title = title;
      f.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write");
      f.setAttribute("allowfullscreen", "");
      f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      p.innerHTML = "";
      p.appendChild(f);
    }
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-play]");
      if (!b) return;
      var p = b.closest("[data-clip-player]");
      if (!p) return;
      e.preventDefault();
      buzz();
      play(p);
    });
    // Filtro por idioma
    var cBtns = document.querySelectorAll("[data-cl]");
    var none = document.querySelector("[data-clips-none]");
    cBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        var want = b.getAttribute("data-cl"), shown = 0;
        swapAnim();
        cBtns.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        document.querySelectorAll("[data-clips] [data-clang]").forEach(function (c) {
          var ok = want === "all" || c.getAttribute("data-clang") === want;
          if (!ok && c.contains(playing)) { restore(playing); playing = null; }
          c.hidden = !ok; if (ok) shown++;
        });
        if (none) none.hidden = shown > 0;
      });
    });
  })();

  // Trucos: botones de PS5 o de Xbox (se recuerda; en el navegador de la consola se detecta sola)
  var platBtns = document.querySelectorAll("[data-plat]");
  if (platBtns.length) {
    var uaP = navigator.userAgent || "";
    var plat = store.get("lh-plat") || (/Xbox/i.test(uaP) ? "xb" : "ps");
    var setPlat = function (v) {
      plat = v === "xb" ? "xb" : "ps";
      document.documentElement.setAttribute("data-plat", plat);
      platBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-plat") === plat)); });
    };
    setPlat(plat);
    platBtns.forEach(function (b) { b.addEventListener("click", function () { setPlat(b.getAttribute("data-plat")); store.set("lh-plat", plat); }); });
  }

  // Rumores: filtrar por fiabilidad
  var relBtns = document.querySelectorAll("[data-rel-filter]");
  relBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      var want = b.getAttribute("data-rel-filter");
      swapAnim();
      relBtns.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      document.querySelectorAll("[data-day]").forEach(function (day) {
        var shown = 0;
        day.querySelectorAll("[data-rel]").forEach(function (card) {
          var ok = want === "all" || card.getAttribute("data-rel") === want;
          card.hidden = !ok; if (ok) shown++;
        });
        day.hidden = shown === 0;
      });
    });
  });

  // Aparición suave al hacer scroll
  if ("IntersectionObserver" in window && !reduced) {
    var targets = document.querySelectorAll(".story, .mini-story, .post, .col-side .card, .block__head, .ctx, .faq details, .archive li, .fact-grid li, .legend, .plainbox, .rumor-banner, .day__title");
    var vh = window.innerHeight;
    var io = new IntersectionObserver(function (entries) {
      var n = 0;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target; io.unobserve(el);
        el.style.setProperty("--d", Math.min(n++, 6) * 70 + "ms");
        el.classList.add("in");
        setTimeout(function () { el.classList.remove("rv", "in"); el.style.removeProperty("--d"); }, 1300);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    targets.forEach(function (el) {
      if (el.getBoundingClientRect().top < vh * 0.9) return; // lo que ya se ve no se oculta
      el.classList.add("rv"); io.observe(el);
    });
  }

  // Brillo que sigue al cursor en las tarjetas
  if (window.matchMedia && window.matchMedia("(hover: hover)").matches) {
    var raf = 0, last = null;
    document.addEventListener("pointermove", function (ev) {
      last = ev;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        var card = last.target && last.target.closest ? last.target.closest(".item") : null;
        if (!card) return;
        var r = card.getBoundingClientRect();
        card.style.setProperty("--mx", last.clientX - r.left + "px");
        card.style.setProperty("--my", last.clientY - r.top + "px");
      });
    }, { passive: true });
  }

  // Botón «volver arriba» + progreso de lectura (una sola lectura de scroll por fotograma)
  var top = document.querySelector("[data-to-top]");
  var bar = document.querySelector("[data-progress]");
  var barWrap = bar ? bar.parentNode : null;
  var ring = document.querySelector("[data-progress-ring]");
  var maxScroll = 1, ticking = false;
  function measure() { maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight); }
  function paint() {
    ticking = false;
    var y = window.scrollY || window.pageYOffset || 0;
    var p = Math.min(1, Math.max(0, y / maxScroll));
    var long = maxScroll > window.innerHeight * 0.6; // solo en páginas con recorrido
    if (bar) { bar.style.transform = "scaleX(" + p.toFixed(4) + ")"; barWrap.classList.toggle("on", long && y > 8); }
    if (ring) ring.style.strokeDashoffset = (100 - p * 100).toFixed(2);
    if (top) top.classList.toggle("is-visible", y > 600);
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }
  measure(); paint();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { measure(); onScroll(); }, { passive: true });
  window.addEventListener("load", function () { measure(); onScroll(); });
  if ("ResizeObserver" in window) new ResizeObserver(function () { measure(); onScroll(); }).observe(document.body);
  document.querySelectorAll("details").forEach(function (d) { d.addEventListener("toggle", function () { measure(); onScroll(); }); });
  if (top) top.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }); });

  // Barra de lanzamiento: antes del día, «¿a qué hora?»; desde el día, «ya disponible»; se oculta 10 días después
  document.querySelectorAll("[data-launch-bar]").forEach(function (bar) {
    var t = new Date(bar.getAttribute("data-launch")).getTime();
    if (isNaN(t)) return;
    var now = Date.now();
    var out = now >= t;
    if (now > t + 10 * 864e5) { bar.hidden = true; return; }
    bar.querySelector('[data-lb="pre"]').hidden = out;
    bar.querySelector('[data-lb="out"]').hidden = !out;
  });

  // Página «¿A qué hora sale?»: mostrar la zona horaria del visitante
  document.querySelectorAll("[data-your-tz]").forEach(function (el) {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) el.textContent = el.getAttribute("data-your-tz").replace("{tz}", tz.replace(/_/g, " "));
    } catch (e) {}
  });

  // Anuncio anclado inferior de AdSense: subir el botón «volver arriba» para que no lo tape
  (function () {
    var rootEl = document.documentElement, pending = false;
    function fit() {
      pending = false;
      var h = 0;
      document.querySelectorAll('ins.adsbygoogle[data-anchor-status="displayed"], ins.adsbygoogle[data-anchor-shown="true"]').forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.height > 0 && r.bottom >= window.innerHeight - 2) h = Math.max(h, r.height);
      });
      rootEl.style.setProperty("--anchor-h", h ? Math.round(h) + "px" : "0px");
    }
    function schedule() { if (!pending) { pending = true; requestAnimationFrame(fit); } }
    if ("MutationObserver" in window) new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-anchor-status", "data-anchor-shown", "style"] });
    window.addEventListener("resize", schedule, { passive: true });
  })();

  // ================= Modo app (pantalla de inicio en iPhone y Android) =================
  var body = document.body;
  var T = {};
  try { T = JSON.parse(body.getAttribute("data-app") || "{}"); } catch (e) {}
  var BASE = body.getAttribute("data-base") || "";
  var standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  if (standalone) root.classList.add("standalone");

  // Al abrir la app en «/», respetar el idioma elegido
  var langGo = false;
  try { langGo = !sessionStorage.getItem("lh-langgo"); sessionStorage.setItem("lh-langgo", "1"); } catch (e) {}
  if (standalone && langGo && location.pathname === BASE + "/" && store.get("lh-lang") === "en") location.replace(BASE + "/en/");

  // Aviso flotante reutilizable
  var toastEl = null;
  function toast(text, actionLabel, action, sticky) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "app-toast";
      toastEl.setAttribute("role", "status");
      body.appendChild(toastEl);
    }
    toastEl.innerHTML = "";
    var span = document.createElement("span"); span.textContent = text; toastEl.appendChild(span);
    if (actionLabel) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = actionLabel;
      b.addEventListener("click", action); toastEl.appendChild(b);
    }
    var x = document.createElement("button"); x.type = "button"; x.className = "app-toast__x"; x.setAttribute("aria-label", T.close || "×"); x.textContent = "×";
    x.addEventListener("click", function () { toastEl.classList.remove("is-on"); }); toastEl.appendChild(x);
    requestAnimationFrame(function () { toastEl.classList.add("is-on"); });
    clearTimeout(toastEl._t);
    if (!sticky) toastEl._t = setTimeout(function () { toastEl.classList.remove("is-on"); }, 6000);
  }
  function hardRefresh() { location.reload(); }

  // Service worker: lectura sin conexión y cargas instantáneas
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register(BASE + "/sw.js").catch(function () {});
    });
  }

  // ¿Hay una versión más nueva publicada? (al volver a la app, y cada 10 min si está abierta)
  var myBuild = (document.querySelector('meta[name="build-id"]') || {}).content;
  var checking = false, lastCheck = Date.now(), hiddenAt = 0;
  function checkFresh() {
    if (checking || !myBuild || !navigator.onLine) return;
    checking = true; lastCheck = Date.now();
    fetch(BASE + "/version.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) { if (v && v.build && v.build !== myBuild) toast(T.fresh || "", T.update || "↻", hardRefresh, true); })
      .catch(function () {})
      .then(function () { checking = false; });
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > 60 * 1000) checkFresh();
  });
  setInterval(function () { if (!document.hidden && Date.now() - lastCheck > 10 * 60 * 1000) checkFresh(); }, 60 * 1000);
  window.addEventListener("offline", function () { toast(T.offline || "", null, null, false); });
  window.addEventListener("online", function () { checkFresh(); });

  // Deslizar hacia abajo para actualizar (solo en modo app: el navegador ya trae el suyo)
  if (standalone && "ontouchstart" in window) {
    var ptr = document.createElement("div");
    ptr.className = "ptr"; ptr.setAttribute("aria-hidden", "true");
    ptr.innerHTML = '<span class="ptr__icon"><svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"/></svg></span><span class="ptr__label"></span>';
    body.appendChild(ptr);
    var label = ptr.querySelector(".ptr__label");
    var startY = 0, startX = 0, pulling = false, dist = 0, busy = false;
    var LIMIT = 72;
    var setPull = function (d) {
      dist = d;
      var p = Math.min(1, d / LIMIT);
      ptr.style.transform = "translate(-50%," + Math.round(Math.min(d, 110) - 70) + "px)";
      ptr.style.opacity = String(Math.min(1, d / 30));
      ptr.querySelector(".ptr__icon").style.transform = "rotate(" + Math.round(p * 270) + "deg)";
      ptr.classList.toggle("is-ready", d >= LIMIT);
      label.textContent = d >= LIMIT ? (T.ptrRelease || "") : (T.ptrPull || "");
    };
    window.addEventListener("touchstart", function (e) {
      if (busy || e.touches.length !== 1 || (window.scrollY || document.documentElement.scrollTop) > 0) { pulling = false; return; }
      startY = e.touches[0].clientY; startX = e.touches[0].clientX; pulling = true; dist = 0;
    }, { passive: true });
    window.addEventListener("touchmove", function (e) {
      if (!pulling) return;
      var dy = e.touches[0].clientY - startY, dx = Math.abs(e.touches[0].clientX - startX);
      if (dy <= 0 || dx > dy) { if (dist) setPull(0); return; }
      if ((window.scrollY || document.documentElement.scrollTop) > 0) { pulling = false; setPull(0); return; }
      setPull(dy * 0.55);
    }, { passive: true });
    window.addEventListener("touchend", function () {
      if (!pulling) return;
      pulling = false;
      if (dist >= LIMIT) {
        busy = true;
        ptr.classList.add("is-busy");
        label.textContent = T.ptrLoading || "";
        ptr.style.transform = "translate(-50%,12px)";
        setTimeout(hardRefresh, 350);
      } else {
        ptr.style.transition = "transform .25s, opacity .25s"; setPull(0);
        setTimeout(function () { ptr.style.transition = ""; }, 260);
      }
    }, { passive: true });
  }

  // ================= Experiencia de app nativa en el móvil =================
  var ua = navigator.userAgent || "";
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var inApp = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|musical_ly|Bytedance|TikTok|\bLine\/|Snapchat|LinkedInApp|Pinterest|Twitter for/i.test(ua);
  var touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  var mqm = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
  var isPhone = function () { return touch && (mqm("(pointer: coarse)") || isIOS || isAndroid) && window.innerWidth < 900; };
  // ¿Qué instrucciones le sirven a este dispositivo?
  var device = inApp ? "inapp" : isIOS ? (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? "iosChrome" : "ios") : isAndroid ? "android" : "desktop";
  var buzz = function () { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} };
  var path = location.pathname.replace(/index\.html$/, "");

  // --- Hoja «Instala la app» ---
  var sheet = document.querySelector("[data-install-sheet]");
  var installBtns = document.querySelectorAll("[data-install]");
  var deferred = null, sheetOpen = false;
  var isAppPage = !!document.querySelector("[data-app-guides]");
  var installed = function () { return standalone || store.get("lh-installed") === "1"; };
  function showVariant(v) {
    if (!sheet) return;
    sheet.querySelectorAll("[data-variant]").forEach(function (el) {
      el.hidden = !(el.getAttribute("data-variant") === v || (v === "inapp-ios" && el.getAttribute("data-variant") === "inapp"));
    });
  }
  function variantNow() {
    if (device === "inapp") return "inapp";
    if (deferred) return "prompt";
    if (device === "desktop") return isAndroid ? "android" : null;
    return device;
  }
  var lastFocus = null;
  function openSheet(manual) {
    if (!sheet || sheetOpen || standalone) return false;
    var v = variantNow();
    if (!v) return false;
    showVariant(v);
    sheetOpen = true;
    if (toastEl) toastEl.classList.remove("is-on");
    lastFocus = document.activeElement;
    sheet.hidden = false;
    root.classList.add("sheet-lock");
    requestAnimationFrame(function () { requestAnimationFrame(function () { sheet.classList.add("is-open"); }); });
    setTimeout(function () { try { sheet.querySelector(".sheet__panel").focus({ preventScroll: true }); } catch (e) {} }, 60);
    if (!manual) store.set("lh-inst-seen", String(Date.now()));
    return true;
  }
  function closeSheet(snooze) {
    if (!sheet || !sheetOpen) return;
    sheetOpen = false;
    sheet.classList.remove("is-open");
    root.classList.remove("sheet-lock");
    var panel = sheet.querySelector(".sheet__panel"); if (panel) panel.style.transform = "";
    if (snooze) store.set("lh-inst-until", String(Date.now() + 14 * 864e5));
    setTimeout(function () { if (!sheetOpen) sheet.hidden = true; }, 420);
    try { if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }
  function promptInstall() {
    if (!deferred) return openSheet(true);
    var d = deferred;
    d.prompt();
    d.userChoice.then(function (c) {
      deferred = null;
      if (c && c.outcome === "accepted") { store.set("lh-installed", "1"); closeSheet(false); }
      else { closeSheet(true); }
      syncInstallBtns();
    }).catch(function () {});
  }
  function syncInstallBtns() {
    // En móvil siempre se ofrece (abre la guía adecuada); en ordenador, solo si el navegador lo permite
    var show = !installed() && (!!deferred || (isPhone() && device !== "desktop"));
    installBtns.forEach(function (b) { b.hidden = !show; });
  }
  if (sheet) {
    sheet.addEventListener("click", function (e) {
      var t = e.target;
      if (t.closest("[data-install-go]")) { buzz(); promptInstall(); }
      else if (t.closest("[data-sheet-later]") || t.closest("[data-sheet-close]")) closeSheet(true);
    });
    document.addEventListener("keydown", function (e) {
      if (!sheetOpen) return;
      if (e.key === "Escape") closeSheet(true);
      if (e.key === "Tab") { // el foco no se escapa del panel
        var f = Array.prototype.filter.call(sheet.querySelectorAll("a[href],button"), function (x) { return x.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    // Arrastrar el panel hacia abajo para cerrarlo, como en una app
    var panel = sheet.querySelector(".sheet__panel"), sy = 0, sdy = 0, sdrag = false;
    panel.addEventListener("touchstart", function (e) { if (panel.scrollTop > 0 || e.touches.length !== 1) return; sdrag = true; sy = e.touches[0].clientY; sdy = 0; panel.style.transition = "none"; }, { passive: true });
    panel.addEventListener("touchmove", function (e) { if (!sdrag) return; sdy = Math.max(0, e.touches[0].clientY - sy); panel.style.transform = "translateY(" + sdy + "px)"; }, { passive: true });
    var sEnd = function () { if (!sdrag) return; sdrag = false; panel.style.transition = ""; if (sdy > 90) closeSheet(true); else panel.style.transform = ""; };
    panel.addEventListener("touchend", sEnd, { passive: true });
    panel.addEventListener("touchcancel", sEnd, { passive: true });
  }
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); deferred = e;
    syncInstallBtns();
    if (sheetOpen) showVariant("prompt");
  });
  installBtns.forEach(function (b) { b.addEventListener("click", function () { buzz(); promptInstall(); }); });
  window.addEventListener("appinstalled", function () { store.set("lh-installed", "1"); deferred = null; syncInstallBtns(); closeSheet(false); });
  syncInstallBtns();

  // Páginas preparadas de antemano (precarga): los avisos esperan a que se vean de verdad
  var whenShown = function (fn) {
    if (document.prerendering) document.addEventListener("prerenderingchange", fn, { once: true }); else fn();
  };

  // Ofrecerla sola al entrar desde el móvil (una vez cada 14 días como mucho, nunca dentro de la app)
  var pv = 0;
  var snoozed = +(store.get("lh-inst-until") || 0) > Date.now();
  var autoSheet = sheet && !installed() && !snoozed && !isAppPage && isPhone() && device !== "desktop" && !document.querySelector(".offline-page");
  if (autoSheet) whenShown(function () {
    try { pv = (+sessionStorage.getItem("lh-pv") || 0) + 1; sessionStorage.setItem("lh-pv", String(pv)); } catch (e) {}
    var tries = 0;
    var tryOpen = function () {
      // no interrumpir mientras se lee un aviso o se está escribiendo
      var a = document.activeElement;
      if ((a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) || document.hidden) { if (++tries < 6) setTimeout(tryOpen, 4000); return; }
      openSheet(false);
    };
    setTimeout(tryOpen, pv >= 2 ? 2500 : 7000);
  });

  // --- Página /app/: destacar la guía de tu dispositivo ---
  if (isAppPage) {
    var gid = { ios: "iphone", iosChrome: "iphone-chrome", android: "android", desktop: "desktop" }[device] || (isIOS ? "iphone" : isAndroid ? "android" : "desktop");
    var mine = document.querySelector('[data-guide="' + gid + '"]');
    if (mine) {
      mine.classList.add("is-yours");
      var h = mine.querySelector("h2"), badge = document.createElement("span");
      badge.className = "yours-badge"; badge.textContent = mine.getAttribute("data-yours") || "";
      if (h) h.appendChild(badge);
      mine.parentNode.insertBefore(mine, mine.parentNode.firstChild);
    }
    if (device === "inapp" && sheet) { var note = sheet.querySelector('[data-variant="inapp"]'); if (note) { var c = note.cloneNode(true); c.hidden = false; c.removeAttribute("data-variant"); document.querySelector("[data-app-guides]").before(c); } }
  }

  // --- Barra de pestañas y deslizar entre secciones ---
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tabbar a[data-tab]"));
  var cur = -1;
  tabs.forEach(function (a, i) { if (a.getAttribute("aria-current") === "page") cur = i; });
  var samePath = function (a) { try { return new URL(a.href, location.href).pathname.replace(/index\.html$/, "") === path; } catch (e) { return false; } };
  // Secciones principales (y Rumores, que va dentro de Noticias): se puede deslizar entre pestañas
  var onSection = cur >= 0 && (samePath(tabs[cur]) || body.hasAttribute("data-root"));
  function goTab(i, dir) {
    var a = tabs[i];
    if (!a) return;
    try { sessionStorage.setItem("lh-vt", dir); } catch (e) {}
    root.classList.remove("vt-next", "vt-prev");
    root.classList.add("vt-" + dir);
    location.href = a.href;
  }
  tabs.forEach(function (a, i) {
    a.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
      buzz();
      if (i === cur && samePath(a)) { // tocar la pestaña activa = volver arriba
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: mqm("(prefers-reduced-motion: reduce)") ? "auto" : "smooth" });
        return;
      }
      if (cur >= 0 && i !== cur) { e.preventDefault(); goTab(i, i > cur ? "next" : "prev"); }
    });
  });
  // La clase de dirección solo sirve para la transición de entrada; luego se quita
  // (la quita el evento «pagereveal» al acabar; esto es la red de seguridad)
  if (!("onpagereveal" in window)) setTimeout(function () { root.classList.remove("vt-next", "vt-prev"); }, 1500);

  // --- Navegación instantánea: precargar la página antes de que el dedo se levante ---
  // Chrome/Edge/Android lo hacen con «speculationrules»; esto cubre Safari (iPhone), Firefox y el modo app.
  var specOK = !!(window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports("speculationrules"));
  var conn = navigator.connection || {};
  var saveData = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "");
  var warmed = {};
  function warm(href) {
    // Chrome no aprovecha su precarga en páginas servidas por el service worker: ahí también precargamos nosotros
    var swOn = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
    if ((specOK && !swOn) || saveData || !href || warmed[href]) return;
    var url;
    try { url = new URL(href, location.href); } catch (e) { return; }
    if (url.origin !== location.origin || url.pathname === location.pathname || /\.(xml|json|png|jpe?g|svg|webmanifest|txt)$/.test(url.pathname)) return;
    url.hash = "";
    warmed[href] = 1;
    try { fetch(url.href, { credentials: "same-origin", headers: { "x-lh-warm": "1" } }).catch(function () {}); } catch (e) {}
  }
  var warmFrom = function (e) { var a = e.target.closest && e.target.closest("a[href]"); if (a && !a.target && !a.hasAttribute("download")) warm(a.href); };
  document.addEventListener("touchstart", warmFrom, { passive: true, capture: true });
  document.addEventListener("mouseover", warmFrom, { passive: true });
  document.addEventListener("focusin", warmFrom, { passive: true });
  // En las secciones, dejar listas las pestañas vecinas para que deslizar sea instantáneo
  if (onSection) {
    var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 1200); };
    window.addEventListener("load", function () { idle(function () { [cur - 1, cur + 1].forEach(function (i) { if (tabs[i]) warm(tabs[i].href); }); }); });
  }

  var main = document.querySelector("main");
  if (onSection && main && touch) {
    // Indicador que asoma por el borde y sigue al dedo (la página no se mueve: así va fluido y nada se corta)
    var peek = document.createElement("div");
    peek.className = "swipe-peek"; peek.setAttribute("aria-hidden", "true");
    peek.innerHTML = '<span class="swipe-peek__ic"></span><span class="swipe-peek__t"></span>';
    body.appendChild(peek);
    var pIc = peek.firstChild, pT = peek.lastChild;
    var sx = 0, sy2 = 0, st = 0, dx = 0, lock = 0, active = false, swTo = -1, side = 0, ready = false, pRaf = 0;
    var EDGE = 24, TRIGGER = 72, PEEK_W = 96;
    var scrollsX = function (el) {
      for (; el && el !== body && el !== document.documentElement; el = el.parentElement) {
        if (el.matches && el.matches("input,textarea,select,[contenteditable],.table-wrap,.filter,.aud-toggle,.sheet,.search,[data-no-swipe]")) return true;
        if (el.scrollWidth > el.clientWidth + 2) { var ox = getComputedStyle(el).overflowX; if (ox === "auto" || ox === "scroll") return true; }
      }
      return false;
    };
    var peekPaint = function () {
      pRaf = 0;
      var p = Math.min(1, Math.abs(dx) / TRIGGER);
      // de escondido (fuera de la pantalla) a pegado al borde; al pasar el umbral, solo un pequeño tirón elástico
      var x = (p - 1) * PEEK_W; // nunca se despega del borde
      peek.style.transform = "translate3d(" + (side > 0 ? Math.round(x) : -Math.round(x)) + "px,-50%,0)";
      peek.style.opacity = String(Math.min(1, p * 1.6));
      var nowReady = p >= 1;
      if (nowReady !== ready) { ready = nowReady; peek.classList.toggle("is-ready", ready); if (ready) buzz(); }
    };
    var hidePeek = function (animate) {
      peek.classList.toggle("is-back", !!animate && !reduced);
      peek.style.transform = "translate3d(" + (side >= 0 ? -PEEK_W - 20 : PEEK_W + 20) + "px,-50%,0)";
      peek.style.opacity = "0";
      ready = false; peek.classList.remove("is-ready");
      setTimeout(function () { peek.classList.remove("is-back", "is-left", "is-right"); }, 260);
    };
    window.addEventListener("touchstart", function (e) {
      active = false; lock = 0; dx = 0; side = 0; swTo = -1; // cada gesto empieza de cero (forma y flecha del indicador)
      if (e.touches.length !== 1 || sheetOpen || window.innerWidth >= 860) return;
      var t = e.touches[0];
      if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return; // bordes: gesto «atrás» del sistema
      if (scrollsX(e.target)) return;
      var sel = window.getSelection && window.getSelection();
      if (sel && String(sel).length) return;
      sx = t.clientX; sy2 = t.clientY; st = Date.now(); active = true;
    }, { passive: true });
    window.addEventListener("touchmove", function (e) {
      if (!active) return;
      var t = e.touches[0], mx = t.clientX - sx, my = t.clientY - sy2;
      if (!lock) {
        if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
        lock = Math.abs(mx) > Math.abs(my) * 1.5 ? 1 : -1;
      }
      if (lock !== 1) { active = false; return; }
      if (e.cancelable) e.preventDefault(); // gesto horizontal: que la página no se mueva en vertical
      dx = mx;
      var to = cur + (dx < 0 ? 1 : -1);
      if (to < 0 || to >= tabs.length) { swTo = -1; if (side) hidePeek(true); side = 0; return; } // no hay pestaña a ese lado
      var s = dx > 0 ? 1 : -1; // 1: entra por la izquierda (pestaña anterior); -1: por la derecha (siguiente)
      if (s !== side || to !== swTo) {
        side = s; swTo = to;
        var a = tabs[to], ic = a.querySelector("svg");
        pIc.innerHTML = ic ? ic.outerHTML : "";
        pT.textContent = (a.textContent || "").trim();
        peek.classList.toggle("is-left", s > 0); peek.classList.toggle("is-right", s < 0);
        peek.classList.remove("is-back");
        PEEK_W = peek.offsetWidth || PEEK_W; // ancho real (depende del nombre de la sección)
      }
      if (!pRaf) pRaf = requestAnimationFrame(peekPaint);
    }, { passive: false });
    var end = function () {
      if (!active || lock !== 1) { active = false; return; }
      active = false;
      if (pRaf) { cancelAnimationFrame(pRaf); pRaf = 0; }
      var v = Math.abs(dx) / Math.max(1, Date.now() - st);
      if (swTo >= 0 && (Math.abs(dx) > TRIGGER || (Math.abs(dx) > 35 && v > 0.45))) {
        if (!ready) buzz();
        store.set("lh-swiped", "1");
        peek.classList.add("is-ready", "is-go");
        goTab(swTo, dx < 0 ? "next" : "prev");
      } else hidePeek(true);
    };
    window.addEventListener("touchend", end, { passive: true });
    window.addEventListener("touchcancel", function () { active = false; hidePeek(true); }, { passive: true });
    var reset = function () { peek.classList.remove("is-go"); hidePeek(false); };
    // Volver con «atrás» (caché del navegador): dejar la página en su sitio
    window.addEventListener("pageshow", function (e) { if (e.persisted) { reset(); root.classList.remove("vt-next", "vt-prev"); } });

    // Un consejo, una sola vez, para descubrir el gesto
    if (!store.get("lh-swiped") && !store.get("lh-swipe-tip") && isPhone()) whenShown(function () {
      setTimeout(function () {
        if (sheetOpen || store.get("lh-swiped") || document.hidden) return;
        store.set("lh-swipe-tip", "1");
        toast(T.swipe || "", null, null, false);
      }, autoSheet ? 2600 : 3000);
    });
  }

  // ================= Guardados (en el dispositivo) =================
  var SAVED_KEY = "lh-saved";
  var getSaved = function () { try { return JSON.parse(store.get(SAVED_KEY) || "[]") || []; } catch (e) { return []; } };
  var setSaved = function (list) { store.set(SAVED_KEY, JSON.stringify(list.slice(0, 150))); };
  var isSaved = function (url) { return getSaved().some(function (x) { return x.u === url; }); };
  function syncSaveBtns() {
    document.querySelectorAll("[data-save]").forEach(function (b) {
      var d; try { d = JSON.parse(b.getAttribute("data-save")); } catch (e) { return; }
      var on = isSaved(d.u);
      b.setAttribute("aria-pressed", String(on));
      var lab = b.querySelector("[data-save-label]");
      if (lab) lab.textContent = lab.getAttribute(on ? "data-on" : "data-off");
    });
  }
  syncSaveBtns();
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-save]");
    if (!b) return;
    e.preventDefault();
    var d; try { d = JSON.parse(b.getAttribute("data-save")); } catch (err) { return; }
    var list = getSaved().filter(function (x) { return x.u !== d.u; });
    var adding = list.length === getSaved().length;
    if (adding) list.unshift({ u: d.u, t: d.t, k: d.k, at: Date.now() });
    setSaved(list);
    buzz();
    b.classList.remove("is-pop"); void b.offsetWidth; if (adding) b.classList.add("is-pop");
    syncSaveBtns();
    toast(adding ? (T.saveAdd || "") : (T.saveRemove || ""), null, null, false);
  });
  // Otra pestaña cambió los guardados
  window.addEventListener("storage", function (e) { if (e.key === SAVED_KEY) { syncSaveBtns(); renderSavedPage(); } });
  window.addEventListener("pageshow", function (e) { if (e.persisted) syncSaveBtns(); });
  var savedPage = document.querySelector("[data-saved-page]");
  function renderSavedPage() {
    if (!savedPage) return;
    var list = getSaved(), ul = savedPage.querySelector("[data-saved-list]"), kinds = {};
    try { kinds = JSON.parse(savedPage.getAttribute("data-kinds")) || {}; } catch (e) {}
    savedPage.querySelector("[data-saved-empty]").hidden = list.length > 0;
    savedPage.querySelector("[data-saved-clear]").hidden = list.length === 0;
    ul.innerHTML = "";
    list.forEach(function (x) {
      var li = document.createElement("li");
      var a = document.createElement("a"); a.href = x.u; a.className = "saved-item";
      var k = document.createElement("span"); k.className = "saved-item__k search__item--" + x.k; k.textContent = kinds[x.k] || x.k;
      var t = document.createElement("b"); t.textContent = x.t;
      a.appendChild(k); a.appendChild(t);
      var del = document.createElement("button"); del.type = "button"; del.className = "saved-item__x"; del.setAttribute("aria-label", "×"); del.textContent = "×";
      del.addEventListener("click", function () { setSaved(getSaved().filter(function (y) { return y.u !== x.u; })); renderSavedPage(); syncSaveBtns(); });
      li.appendChild(a); li.appendChild(del); ul.appendChild(li);
    });
  }
  if (savedPage) {
    renderSavedPage();
    savedPage.querySelector("[data-saved-clear]").addEventListener("click", function () {
      if (window.confirm(savedPage.getAttribute("data-ask") || "?")) { setSaved([]); renderSavedPage(); syncSaveBtns(); }
    });
  }

  // ================= Novedades: punto en la pestaña si cambió desde tu última visita =================
  (function () {
    var links = document.querySelectorAll("[data-sig]");
    if (!links.length) return;
    var seen = {}; try { seen = JSON.parse(store.get("lh-seen") || "{}") || {}; } catch (e) {}
    var first = !store.get("lh-seen");
    var changed = false;
    links.forEach(function (a) {
      var p = a.getAttribute("data-sig").split(":"), key = p[0], sg = p[1];
      var here = a.getAttribute("aria-current") === "page";
      if (first || here || !seen[key]) { if (seen[key] !== sg) { seen[key] = sg; changed = true; } return; }
      if (seen[key] !== sg) { a.classList.add("has-new"); a.setAttribute("title", T.newDot || ""); }
    });
    if (changed || first) store.set("lh-seen", JSON.stringify(seen));
  })();

  // ================= Test: ¿cuánto sabes de GTA 6? =================
  (function () {
    var box = document.querySelector("[data-quiz]"), dataEl = document.getElementById("quiz-data");
    if (!box || !dataEl) return;
    var D; try { D = JSON.parse(dataEl.textContent); } catch (e) { return; }
    var Q = D.t, N = D.n, url = box.getAttribute("data-url");
    var fmt = function (tpl, o) { return String(tpl).replace(/\{(\w+)\}/g, function (m, k) { return o[k] !== undefined ? o[k] : m; }); };
    var el = function (tag, cls, txt) { var x = document.createElement(tag); if (cls) x.className = cls; if (txt !== undefined) x.textContent = txt; return x; };
    var best = +(store.get("lh-quiz-best") || 0);
    var bestEl = box.querySelector("[data-quiz-best]");
    if (best && bestEl) { bestEl.textContent = fmt(Q.best, { n: best, t: N }); bestEl.hidden = false; }
    var qs = [], i = 0, ok = 0;
    function shuffle(a) { for (var j = a.length - 1; j > 0; j--) { var k = Math.floor(Math.random() * (j + 1)); var t = a[j]; a[j] = a[k]; a[k] = t; } return a; }
    function start() {
      qs = shuffle(D.bank.slice()).slice(0, N).map(function (q) {
        var order = shuffle(q.o.map(function (_, j) { return j; }));
        return { q: q.q, o: order.map(function (j) { return q.o[j]; }), a: order.indexOf(q.a), x: q.x, l: q.l };
      });
      i = 0; ok = 0; show();
    }
    function show() {
      var q = qs[i];
      box.innerHTML = "";
      var head = el("div", "quiz__head");
      head.appendChild(el("span", "quiz__count", fmt(Q.q, { i: i + 1, n: qs.length })));
      var bar = el("div", "quiz__bar"); var fill = el("span"); fill.style.width = (i / qs.length * 100) + "%"; bar.appendChild(fill); head.appendChild(bar);
      box.appendChild(head);
      var h = el("h2", "quiz__q", q.q); h.tabIndex = -1; box.appendChild(h);
      var opts = el("div", "quiz__opts"); opts.setAttribute("role", "group");
      q.o.forEach(function (txt, j) {
        var b = el("button", "quiz__opt"); b.type = "button";
        b.appendChild(el("span", "quiz__letter", "ABCD".charAt(j))); b.appendChild(el("span", "", txt));
        b.addEventListener("click", function () { answer(j); });
        opts.appendChild(b);
      });
      box.appendChild(opts);
      try { h.focus({ preventScroll: true }); } catch (e) {}
      if (i > 0) box.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    }
    function answer(j) {
      var q = qs[i], right = j === q.a;
      if (right) ok++;
      buzz();
      var btns = box.querySelectorAll(".quiz__opt");
      btns.forEach(function (b, k) { b.disabled = true; if (k === q.a) b.classList.add("is-right"); else if (k === j) b.classList.add("is-wrong"); });
      var fb = el("div", "quiz__fb " + (right ? "is-right" : "is-wrong")); fb.setAttribute("role", "status");
      fb.appendChild(el("b", "", right ? Q.right : Q.wrong));
      fb.appendChild(el("p", "", q.x));
      var more = el("a", "quiz__more", Q.more); more.href = q.l; fb.appendChild(more);
      var nx = el("button", "btn btn--primary quiz__next", i + 1 < qs.length ? Q.next : Q.finish); nx.type = "button";
      nx.addEventListener("click", function () { i++; if (i < qs.length) show(); else end(); });
      fb.appendChild(nx);
      box.appendChild(fb);
      try { nx.focus({ preventScroll: true }); } catch (e) {}
      fb.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    }
    function end() {
      if (ok > best) { best = ok; store.set("lh-quiz-best", String(best)); }
      var tier = (Q.tiers || []).find(function (t) { return ok >= t[0]; }) || ["", ""];
      box.innerHTML = "";
      var res = el("div", "quiz__end");
      var ring = el("div", "score-ring quiz__ring"); ring.style.setProperty("--p", Math.round(ok / qs.length * 100));
      ring.appendChild(el("b", "", String(ok))); ring.appendChild(el("small", "", "/" + qs.length));
      res.appendChild(ring);
      res.appendChild(el("h2", "", fmt(Q.score, { n: ok, t: qs.length })));
      res.appendChild(el("p", "quiz__tier", tier[1]));
      if (best) res.appendChild(el("p", "muted small", fmt(Q.best, { n: best, t: qs.length })));
      var text = fmt(Q.share, { n: ok, t: qs.length });
      var row = el("div", "quiz__share");
      var sh = el("button", "btn btn--primary", Q.shareBtn); sh.type = "button";
      sh.addEventListener("click", function () {
        if (navigator.share) navigator.share({ title: document.title, text: text, url: url }).catch(function () {});
        else window.open("https://x.com/intent/post?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(url), "_blank", "noopener");
      });
      row.appendChild(sh);
      [["X", "https://x.com/intent/post?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(url)], ["WhatsApp", "https://wa.me/?text=" + encodeURIComponent(text + " " + url)], ["Telegram", "https://t.me/share/url?url=" + encodeURIComponent(url) + "&text=" + encodeURIComponent(text)]].forEach(function (x) {
        var a = el("a", "btn btn--ghost", x[0]); a.href = x[1]; a.target = "_blank"; a.rel = "noopener"; row.appendChild(a);
      });
      res.appendChild(row);
      var again = el("button", "btn btn--ghost quiz__again", Q.again); again.type = "button"; again.addEventListener("click", start);
      res.appendChild(again);
      box.appendChild(res);
      box.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
    }
    var st = box.querySelector("[data-quiz-start]");
    if (st) st.addEventListener("click", start);
  })();

  // ================= Buscador =================
  (function () {
    var openers = document.querySelectorAll("[data-search-open]");
    var url = body.getAttribute("data-search");
    var S = T.search || {};
    if (!openers.length || !url) return;
    var box = null, input = null, list = null, data = null, loading = null, sel = -1, results = [], lastFocus = null;
    var norm = function (x) { return String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); };
    var escH = function (x) { return String(x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
    var weight = { page: 4, guide: 4, cheat: 3, find: 3, patch: 3, news: 1, rumor: 0 };
    function load() {
      if (data || loading) return loading;
      loading = fetch(url).then(function (r) { return r.json(); }).then(function (j) {
        data = j;
        data.items.forEach(function (it) { it._t = norm(it.t); it._h = norm(it.t + " " + it.d + " " + (it.x || "")); });
        return data;
      }).catch(function () { loading = null; });
      return loading;
    }
    function mark(text, terms) {
      var out = escH(text);
      terms.forEach(function (t) {
        if (t.length < 2) return;
        // marca la coincidencia aunque el texto lleve tildes
        var src = text, n = norm(src), i = n.indexOf(t);
        if (i < 0) return;
        var frag = escH(src.slice(i, i + t.length));
        out = out.replace(frag, "<mark>" + frag + "</mark>");
      });
      return out;
    }
    function render(q) {
      if (!list) return;
      var terms = norm(q).split(/\s+/).filter(Boolean);
      sel = -1;
      if (!data) { list.innerHTML = '<p class="search__msg">' + escH(S.loading || "…") + "</p>"; return; }
      if (!terms.length) {
        results = data.items.filter(function (it) { return it.k === "page"; }).slice(0, 7);
        var sv = getSaved().slice(0, 4);
        var savedHtml = sv.length ? '<p class="search__count">' + escH(S.savedTitle || "") + ' · <a href="' + escH(S.savedUrl || "#") + '">' + escH(S.savedAll || "") + "</a></p>" + items(sv.map(function (x) { return { k: x.k, t: x.t, d: "", u: x.u }; }), []) : "";
        list.innerHTML = savedHtml + '<p class="search__msg">' + escH(S.try || "") + " " + (S.tryWords || []).map(function (w) { return '<button type="button" class="search__try">' + escH(w) + "</button>"; }).join(" ") + "</p>" + items(results, []);
        return;
      }
      results = data.items.map(function (it) {
        var sc = 0;
        for (var i = 0; i < terms.length; i++) {
          var t = terms[i];
          if (it._h.indexOf(t) < 0) return null;
          sc += it._t.indexOf(t) >= 0 ? (it._t.indexOf(t) === 0 || it._t.indexOf(" " + t) >= 0 ? 8 : 5) : 1;
        }
        sc += weight[it.k] || 0;
        if (it.dt) sc += Math.max(0, 2 - (Date.now() - new Date(it.dt).getTime()) / (30 * 864e5));
        return { it: it, sc: sc };
      }).filter(Boolean).sort(function (a, b) { return b.sc - a.sc; }).slice(0, 25).map(function (x) { return x.it; });
      if (!results.length) { list.innerHTML = '<p class="search__msg">' + escH((S.none || "").replace("{q}", q)) + "</p>"; return; }
      list.innerHTML = '<p class="search__count">' + escH(results.length === 1 ? S.one : (S.many || "").replace("{n}", results.length)) + "</p>" + items(results, terms);
    }
    function items(arr, terms) {
      return '<ul class="search__list" role="listbox">' + arr.map(function (it, i) {
        return '<li role="option" id="sr-' + i + '"><a href="' + escH(it.u) + '" class="search__item search__item--' + it.k + '"><span class="search__kind">' + escH((data.kinds || {})[it.k] || it.k) + "</span><b>" + mark(it.t, terms) + "</b><small>" + mark(it.d, terms) + "</small></a></li>";
      }).join("") + "</ul>";
    }
    function move(d) {
      var links = list.querySelectorAll(".search__item");
      if (!links.length) return;
      sel = (sel + d + links.length) % links.length;
      links.forEach(function (l, i) { l.classList.toggle("is-sel", i === sel); });
      links[sel].scrollIntoView({ block: "nearest" });
      input.setAttribute("aria-activedescendant", "sr-" + sel);
    }
    function build() {
      box = document.createElement("div");
      box.className = "search";
      box.hidden = true;
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      box.setAttribute("aria-label", S.label || "");
      box.innerHTML = '<div class="search__backdrop" data-search-close></div><div class="search__panel"><div class="search__bar"><svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></g></svg><input type="search" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" role="combobox" aria-expanded="true" aria-controls="search-results"><button type="button" class="search__x" data-search-close>' + escH(S.close || "×") + '</button></div><div class="search__body" id="search-results"></div></div>';
      body.appendChild(box);
      input = box.querySelector("input");
      input.placeholder = S.ph || "";
      input.setAttribute("aria-label", S.label || "");
      list = box.querySelector(".search__body");
      var tq = 0;
      input.addEventListener("input", function () { clearTimeout(tq); tq = setTimeout(function () { render(input.value); }, 60); });
      input.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
        else if (e.key === "Enter") {
          var links = list.querySelectorAll(".search__item");
          var go = links[sel >= 0 ? sel : 0];
          if (go) { e.preventDefault(); location.href = go.href; }
        }
      });
      box.addEventListener("click", function (e) {
        var t = e.target;
        if (t.closest("[data-search-close]")) close();
        else if (t.closest(".search__try")) { input.value = t.closest(".search__try").textContent; render(input.value); input.focus(); }
        else if (t.closest(".search__item")) setTimeout(close, 50);
      });
    }
    function open() {
      if (!box) build();
      lastFocus = document.activeElement;
      box.hidden = false;
      input.value = "";
      list.innerHTML = "";
      input.focus({ preventScroll: true });
      requestAnimationFrame(function () {
        box.classList.add("is-open");
        // bloquear el fondo y pintar sugerencias justo después del primer fotograma
        setTimeout(function () { root.classList.add("sheet-lock"); if (!input.value) render(""); }, 0);
      });
      var p = load();
      if (p && p.then) p.then(function () { render(input.value); });
    }
    function close() {
      if (!box || box.hidden) return;
      box.classList.remove("is-open");
      root.classList.remove("sheet-lock");
      setTimeout(function () { box.hidden = true; }, 200);
      try { if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); } catch (e) {}
    }
    openers.forEach(function (b) { b.addEventListener("click", function () { buzz(); open(); }); b.addEventListener("pointerenter", load, { once: true }); });
    document.addEventListener("keydown", function (e) {
      var a = document.activeElement, typing = a && (/INPUT|TEXTAREA|SELECT/.test(a.tagName) || a.isContentEditable);
      if (e.key === "Escape" && box && !box.hidden) { close(); return; }
      if (((e.key === "/" && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) && (!box || box.hidden)) { e.preventDefault(); open(); }
    });
    window.addEventListener("pageshow", function (e) { if (e.persisted) close(); });
  })();

  // AdSense: activa cada bloque manual presente en la página
  var ads = document.querySelectorAll("ins.adsbygoogle");
  if (ads.length) {
    window.adsbygoogle = window.adsbygoogle || [];
    ads.forEach(function () { try { window.adsbygoogle.push({}); } catch (e) {} });
  }
})();
