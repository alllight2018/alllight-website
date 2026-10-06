/* ============================================================
   全国実績マップ（都道府県グリッド地図）
   - 47都道府県を「重ならない正方形タイル」で地理配置し、
     施工実績のある県を金色に色塗り → クリックで案件詳細を表示。
   - ページ側で window.ALLLIGHT_MAP_DATA に案件配列を渡す。
   ============================================================ */
(function () {
  // 都道府県タイルの配置 [row(北→南), col(西→東)]。重複セルなし。
  var GRID = {
    "北海道": [1, 12],
    "青森県": [3, 11],
    "秋田県": [4, 10], "岩手県": [4, 11],
    "山形県": [5, 10], "宮城県": [5, 11],
    "新潟県": [6, 9], "福島県": [6, 11],
    "石川県": [7, 7], "富山県": [7, 8], "長野県": [7, 9], "群馬県": [7, 10], "栃木県": [7, 11], "茨城県": [7, 12],
    "島根県": [8, 3], "鳥取県": [8, 4], "京都府": [8, 5], "滋賀県": [8, 6], "福井県": [8, 7], "岐阜県": [8, 8], "山梨県": [8, 9], "埼玉県": [8, 10], "東京都": [8, 11], "千葉県": [8, 12],
    "山口県": [9, 1], "広島県": [9, 2], "岡山県": [9, 3], "兵庫県": [9, 4], "大阪府": [9, 5], "奈良県": [9, 6], "三重県": [9, 7], "愛知県": [9, 8], "静岡県": [9, 9], "神奈川県": [9, 11],
    "福岡県": [10, 1], "大分県": [10, 2], "香川県": [10, 3], "徳島県": [10, 4], "和歌山県": [10, 5],
    "佐賀県": [11, 1], "愛媛県": [11, 2], "高知県": [11, 3],
    "長崎県": [12, 1], "熊本県": [12, 2], "宮崎県": [12, 3],
    "鹿児島県": [13, 2],
    "沖縄県": [14, 1]
  };
  var ROWS = 0, COLS = 0;
  Object.keys(GRID).forEach(function (k) { ROWS = Math.max(ROWS, GRID[k][0]); COLS = Math.max(COLS, GRID[k][1]); });

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function shortName(name) { return name.replace(/[都道府県]$/, ""); }
  function catBadge(t) {
    var cls = t === "役務" ? "jm-badge jm-badge-eki" : "jm-badge jm-badge-koji";
    return '<span class="' + cls + '">' + (t || "工事") + "</span>";
  }

  function render(root, data) {
    var byPref = {};
    data.forEach(function (p) {
      if (!p.pref || !GRID[p.pref]) return;
      (byPref[p.pref] = byPref[p.pref] || []).push(p);
    });

    var map = el("div", "jm-gridmap");
    map.style.gridTemplateColumns = "repeat(" + COLS + ", 1fr)";
    map.style.gridTemplateRows = "repeat(" + ROWS + ", 1fr)";

    Object.keys(GRID).forEach(function (name) {
      var pos = GRID[name];
      var on = !!byPref[name];
      var node;
      if (on) {
        node = el("button", "jm-cell jm-cell-on");
        node.type = "button";
        node.dataset.pref = name;
        node.setAttribute("aria-label", name + "の施工実績を見る（" + byPref[name].length + "件）");
        node.innerHTML = '<span class="jm-cell-name">' + shortName(name) + "</span>" +
          (byPref[name].length > 1 ? '<span class="jm-cell-count">' + byPref[name].length + "</span>" : "");
        node.addEventListener("click", function () { select(name); });
      } else {
        node = el("span", "jm-cell jm-cell-off", '<span class="jm-cell-name">' + shortName(name) + "</span>");
      }
      node.style.gridRow = pos[0];
      node.style.gridColumn = pos[1];
      map.appendChild(node);
    });

    var legend = el("div", "jm-legend",
      '<span class="jm-legend-item"><i class="jm-legend-on"></i>施工実績あり（タップで詳細）</span>' +
      '<span class="jm-legend-item"><i class="jm-legend-off"></i>その他の都道府県</span>');

    var worked = Object.keys(byPref).sort(function (a, b) { return byPref[b].length - byPref[a].length; });

    var prefs = el("div", "jm-prefs");
    worked.forEach(function (name) {
      var btn = el("button", "jm-pref");
      btn.type = "button";
      btn.dataset.pref = name;
      btn.innerHTML = '<span class="jm-pref-name">' + name + '</span><span class="jm-pref-count">' + byPref[name].length + '</span>';
      btn.addEventListener("click", function () { select(name); });
      prefs.appendChild(btn);
    });

    var panel = el("div", "jm-panel");
    panel.innerHTML = '<div class="jm-panel-empty">上のボタン、または地図の<b style="color:var(--amber);">色のついた都道府県</b>をタップすると、その地域の施工実績が表示されます。</div>';

    function select(name) {
      map.querySelectorAll(".jm-cell-on").forEach(function (s) { s.classList.toggle("is-active", s.dataset.pref === name); });
      prefs.querySelectorAll(".jm-pref").forEach(function (b) { b.classList.toggle("is-active", b.dataset.pref === name); });
      showDetail(name, byPref[name]);
    }

    function showDetail(name, items) {
      var h = '<div class="jm-panel-head"><span class="jm-pin">' + name + '</span>' +
        '<span class="jm-count">' + items.length + '件の実績</span></div><div class="jm-cards">';
      items.forEach(function (p) {
        h += '<article class="jm-card">';
        h += '<img class="jm-card-photo" src="' + (p.photo || "/assets/photos/noimage-general.svg") + '" alt="" loading="lazy" decoding="async" width="92" height="120">';
        h += '<div class="jm-card-body">' +
          '<div class="jm-card-tags">' + catBadge(p.type) +
          (p.status ? '<span class="jm-status">' + p.status + '</span>' : '') + '</div>' +
          '<h4 class="jm-card-title">' + p.name + '</h4>' +
          '<p class="jm-card-client">発注：' + (p.client || "―") + '</p>' +
          (p.amount ? '<p class="jm-card-amount">受注規模：<b>' + p.amount + '</b></p>' : '') +
          (p.score ? '<p class="jm-card-score">工事成績評定点：<b>' + p.score + '</b></p>' : '') +
          (p.desc ? '<p class="jm-card-desc">' + p.desc + '</p>' : '') +
          '</div></article>';
      });
      h += '</div>';
      panel.innerHTML = h;
      if (window.matchMedia && window.matchMedia("(max-width:820px)").matches) {
        panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }

    root.innerHTML = "";
    root.appendChild(prefs);
    var grid = el("div", "jm-grid");
    var left = el("div", "jm-mapcol");
    left.appendChild(map);
    left.appendChild(legend);
    grid.appendChild(left);
    grid.appendChild(panel);
    root.appendChild(grid);

    var first = byPref["兵庫県"] ? "兵庫県" : worked[0];
    if (first) select(first);
  }

  function init() {
    var root = document.getElementById("japan-map");
    if (!root || !window.ALLLIGHT_MAP_DATA) return;
    render(root, window.ALLLIGHT_MAP_DATA);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
