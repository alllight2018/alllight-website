/* ============================================================
   全国実績マップ（都道府県の星マーク → クリックで案件詳細＆写真）
   - ページ側で window.ALLLIGHT_MAP_DATA に案件配列を渡す
   - 47都道府県を薄い点で配置して日本の形（星座）を作り、
     実績のある県を金色の星で強調・クリック可能にする
   ============================================================ */
(function () {
  // 都道府県の相対座標（x:西→東, y:北→南／おおよその地理配置）
  var PREF = {
    "北海道": [83, 9], "青森県": [74, 22], "岩手県": [77, 27], "秋田県": [70, 27],
    "宮城県": [75, 32], "山形県": [69, 33], "福島県": [73, 37], "茨城県": [78, 45],
    "栃木県": [73, 42], "群馬県": [69, 44], "埼玉県": [72, 47], "千葉県": [78, 50],
    "東京都": [74, 50], "神奈川県": [73, 53], "新潟県": [66, 38], "富山県": [61, 44],
    "石川県": [58, 41], "福井県": [57, 47], "山梨県": [69, 51], "長野県": [65, 47],
    "岐阜県": [61, 48], "静岡県": [67, 54], "愛知県": [63, 52], "三重県": [59, 55],
    "滋賀県": [57, 50], "京都府": [54, 49], "大阪府": [54, 54], "兵庫県": [50, 51],
    "奈良県": [56, 55], "和歌山県": [54, 58], "鳥取県": [47, 49], "島根県": [42, 50],
    "岡山県": [49, 53], "広島県": [44, 54], "山口県": [37, 55], "徳島県": [51, 58],
    "香川県": [49, 57], "愛媛県": [44, 58], "高知県": [47, 61], "福岡県": [34, 58],
    "佐賀県": [31, 59], "長崎県": [27, 60], "熊本県": [32, 62], "大分県": [37, 60],
    "宮崎県": [36, 65], "鹿児島県": [32, 66], "沖縄県": [16, 84]
  };

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function catBadge(t) {
    var cls = t === "役務" ? "jm-badge jm-badge-eki" : "jm-badge jm-badge-koji";
    return '<span class="' + cls + '">' + (t || "工事") + "</span>";
  }

  function render(root, data) {
    // 県ごとに案件をまとめる
    var byPref = {};
    data.forEach(function (p) {
      if (!p.pref || !PREF[p.pref]) return;
      (byPref[p.pref] = byPref[p.pref] || []).push(p);
    });

    var map = el("div", "jm-map");
    // 全県の薄い点（日本の形）
    Object.keys(PREF).forEach(function (name) {
      var c = PREF[name];
      var dot = el("span", "jm-dot");
      dot.style.left = c[0] + "%";
      dot.style.top = c[1] + "%";
      if (byPref[name]) dot.classList.add("jm-dot-on");
      map.appendChild(dot);
    });
    // 実績県の星
    var worked = Object.keys(byPref);
    worked.forEach(function (name) {
      var c = PREF[name];
      var star = el("button", "jm-star");
      star.type = "button";
      star.style.left = c[0] + "%";
      star.style.top = c[1] + "%";
      star.setAttribute("aria-label", name + "の実績を見る");
      star.innerHTML = '<span class="jm-star-mark">★</span><span class="jm-star-label">' + name.replace(/[都道府県]$/, "") + "</span>";
      star.addEventListener("click", function () {
        map.querySelectorAll(".jm-star").forEach(function (s) { s.classList.remove("is-active"); });
        star.classList.add("is-active");
        showDetail(name, byPref[name]);
      });
      map.appendChild(star);
    });

    var panel = el("div", "jm-panel");
    panel.innerHTML = '<div class="jm-panel-empty">地図の <span class="jm-star-mark">★</span> をタップすると、その地域の施工実績が表示されます。</div>';

    function showDetail(name, items) {
      var h = '<div class="jm-panel-head"><span class="jm-pin">' + name + '</span>' +
        '<span class="jm-count">' + items.length + '件の実績</span></div><div class="jm-cards">';
      items.forEach(function (p) {
        h += '<article class="jm-card">';
        h += '<div class="jm-card-photo" style="background-image:url(\'' + (p.photo || "/assets/photos/noimage-general.svg") + '\')"></div>';
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
    var grid = el("div", "jm-grid");
    grid.appendChild(map);
    grid.appendChild(panel);
    root.appendChild(grid);

    // 初期表示：兵庫（本社）を選択
    var first = byPref["兵庫県"] ? "兵庫県" : worked[0];
    if (first) {
      var b = map.querySelector('.jm-star[aria-label="' + first + 'の実績を見る"]');
      if (b) b.click();
    }
  }

  function init() {
    var root = document.getElementById("japan-map");
    if (!root || !window.ALLLIGHT_MAP_DATA) return;
    render(root, window.ALLLIGHT_MAP_DATA);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
