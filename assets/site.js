/* 株式会社オールライト コーポレートサイト 共通スクリプト */
(function () {
  "use strict";

  /* ---- ヘッダー：スクロールで背景切替 ---- */
  var header = document.querySelector(".site-header");
  var hero = document.querySelector(".hero, .hype-hero");
  function onScroll() {
    if (!header) return;
    // ヒーローがないページは常に solid
    var threshold = hero ? window.innerHeight * 0.6 : 10;
    header.classList.toggle("solid", window.scrollY > threshold);
  }
  if (!hero && header) header.classList.add("solid");
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---- モバイルメニュー ---- */
  var toggle = document.querySelector(".nav-toggle");
  var menu = document.querySelector(".mobile-menu");
  var backdrop = document.querySelector(".menu-backdrop");
  function setMenu(open) {
    if (!menu) return;
    menu.classList.toggle("open", open);
    if (backdrop) backdrop.classList.toggle("open", open);
    document.body.style.overflow = open ? "hidden" : "";
  }
  if (toggle) toggle.addEventListener("click", function () { setMenu(!menu.classList.contains("open")); });
  if (backdrop) backdrop.addEventListener("click", function () { setMenu(false); });
  document.querySelectorAll(".mobile-menu a, .menu-close").forEach(function (el) {
    el.addEventListener("click", function () { setMenu(false); });
  });

  /* ---- スクロールリビール（各種演出を一括監視）---- */
  var revealEls = document.querySelectorAll(".reveal, .reveal-soft, .reveal-l, .reveal-r, .reveal-scale, .reveal-wipe, .frame-draw");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -22% 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---- ゆるやかなパララックス（[data-parallax] 要素）---- */
  var plxEls = document.querySelectorAll("[data-parallax]");
  if (plxEls.length && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var ticking = false;
    function updatePlx() {
      var vh = window.innerHeight;
      plxEls.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > vh) return;
        var rate = parseFloat(el.getAttribute("data-parallax")) || 0.12;
        var offset = (rect.top + rect.height / 2 - vh / 2);
        el.style.transform = "translate3d(0," + (-offset * rate).toFixed(1) + "px,0)";
      });
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { window.requestAnimationFrame(updatePlx); ticking = true; }
    }, { passive: true });
    updatePlx();
  }

  /* ---- 数字カウントアップ ---- */
  var counters = document.querySelectorAll("[data-count]");
  if ("IntersectionObserver" in window && counters.length) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var target = parseFloat(el.getAttribute("data-count"));
        var decimals = (el.getAttribute("data-decimals")) ? parseInt(el.getAttribute("data-decimals"), 10) : 0;
        var dur = 1900, start = null;
        function step(ts) {
          if (!start) start = ts;
          var p = Math.min((ts - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = (target * eased).toLocaleString("ja-JP", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = target.toLocaleString("ja-JP", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        }
        requestAnimationFrame(step);
        co.unobserve(el);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { co.observe(el); });
  }

  /* ---- 実績フィルタ（works.html） ---- */
  var filterBtns = document.querySelectorAll("[data-filter]");
  var items = document.querySelectorAll("[data-cat]");
  filterBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var f = btn.getAttribute("data-filter");
      filterBtns.forEach(function (b) { b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
      items.forEach(function (it) {
        var show = f === "all" || (it.getAttribute("data-cat") || "").split(" ").indexOf(f) > -1;
        it.style.display = show ? "" : "none";
      });
    });
  });

  /* ---- 追従ボタン（全ページ共通・採用＋お問い合わせを分けて常時表示）---- */
  (function () {
    if (document.querySelector(".fab-stack")) return;
    var path = location.pathname.replace(/\/index\.html$/, "/");
    var onContact = /contact(\.html)?$/.test(path) || /\/contact\/?$/.test(path);
    var onRecruit = /recruit(\.html)?$/.test(path) || /\/recruit\/?$/.test(path);
    var icoRecruit =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>';
    var icoMail =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/></svg>';
    function pill(href, label, cls, ico) {
      var a = document.createElement("a");
      a.href = href; a.className = "fab " + cls; a.setAttribute("aria-label", label);
      a.innerHTML = ico + '<span class="fab-label">' + label + "</span>";
      return a;
    }
    var stack = document.createElement("div");
    stack.className = "fab-stack";
    if (onRecruit) {
      stack.appendChild(pill("/contact.html?type=recruit", "エントリー", "fab-amber", icoRecruit));
    } else {
      stack.appendChild(pill("/recruit.html", "採用情報", "fab-amber", icoRecruit));
      if (!onContact) stack.appendChild(pill("/contact.html", "お問い合わせ", "fab-navy", icoMail));
    }
    document.body.appendChild(stack);
  })();

  /* ---- 現在年をフッターへ ---- */
  var y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();
})();
