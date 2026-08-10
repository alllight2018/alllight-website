/**
 * Config.gs — 会議レジストリ（唯一の正本 / single source of truth）
 *
 * ここを直せば、全会議の「次回カレンダーへの引き継ぎ」「司会ローテ」「Meet部屋」
 * が一括で切り替わります。会議名の表記ゆれ（施行/施工・朝MTG/朝礼MTG・全角空白）は
 * aliases で吸収し、突き合わせが外れないようにします。
 */

// 会社の統合ダッシュボード（会議前チェック用）
var DASHBOARD_URL = 'https://docs.google.com/spreadsheets/d/1tgiIRBtgWVsGgY-ToLSfRCFktd0ILWErgD9STQbcuoY/edit';
var KANBU_DASHBOARD_URL = 'https://docs.google.com/spreadsheets/d/1mZ8BMku2oXKCM9OWzy4taVodPa11_AiuuUReZmQk1rU/edit';

// 会社カレンダー（連絡事項共有用）。定例は個人カレンダー(primary)にあるため primary を基本にする。
var PRIMARY_CALENDAR_ID = 'primary';

// 資産化の出力先（初回 setupAssets() で自動作成し、ここに ID が入ります）
var ASSET_SHEET_PROP = 'ASSET_SHEET_ID';   // 会議ログ（索引）
var ASSET_DOC_PROP   = 'ASSET_DOC_ID';     // 会議資産ログ（全文の蓄積）

/**
 * 会議レジストリ本体。
 * - key:            内部キー（不変）
 * - displayName:    表示名
 * - aliases:        Geminiメモ件名の表記ゆれを全部ここに（空白除去して部分一致で判定）
 * - recurringEventId: 定例イベントの recurringEventId（分かっているものは固定。無ければ null で summary 検索）
 * - meetCode:       固定Meet部屋（例 'zkd-gifp-res'）
 * - mcRotation:     司会ローテ（順番）。空なら司会行を出さない。
 * - templateKey:    TEMPLATES のキー
 * - assetTab:       資産集約先の見出し（朝夕会などを1つにまとめたい場合に使用）
 */
var MEETINGS = [
  {
    key: 'sekokanri',
    displayName: '施工管理部会',
    // 旧称「施行管理部会」で届くGeminiメモも aliases で吸収（2026-08-10 に施工へ改名）
    aliases: ['施工管理部会', '施行管理部会', '施工管理勉強会', '施行管理勉強会'],
    recurringEventId: 'aemi9o3dnjpl34pko8sdkh8e60',
    meetCode: 'zkd-gifp-res',
    mcRotation: ['井上', '木山', '渡邉', '金井'],
    templateKey: 'sekokanri',
    assetTab: '施工管理部会'
  },
  {
    key: 'nyusatsu',
    displayName: '入札会議',
    aliases: ['入札会議'],
    recurringEventId: 'btf7lvch8tieemkab9sqeqql0k',
    meetCode: 'khx-kawe-uij',
    mcRotation: ['名里真耶', '金山', '森田'],
    templateKey: 'nyusatsu',
    assetTab: '入札会議'
  },
  {
    key: 'kojibukai',
    displayName: '工事部会',
    aliases: ['工事部会'],
    recurringEventId: 'i0a69jtfu66odtdm72rlafbvpc',
    meetCode: 'anc-bxof-ugc',
    mcRotation: ['木下', '澤田', '辻本'],
    templateKey: 'kojibukai',
    assetTab: '工事部会'
  },
  {
    key: 'kanbu',
    displayName: '幹部会議',
    aliases: ['幹部会議'],
    // 幹部会議は定例が2系列に分裂しているため両方を候補にする（次回が近い方を採用）
    recurringEventId: 'lu7jutfb5u63n7n4m9vetn1i0s',
    recurringEventIdAlt: '0i7104fqmhndn8a5pt2b6dr07m',
    meetCode: null,
    mcRotation: ['木下', '井上', '真耶'],
    templateKey: 'kanbu',
    assetTab: '幹部会議'
  },
  {
    key: 'koji_asa',
    displayName: '工事部　朝礼MTG',
    // ★重要バグ修正: Geminiメモ件名は「工事部 朝MTG」、カレンダーは「工事部 朝礼MTG」で不一致だった
    aliases: ['工事部朝礼MTG', '工事部朝MTG', '工事部朝礼', '工事部朝'],
    recurringEventId: 'f0dsli92n6ue6s47nuk68u1440',
    meetCode: 'aav-imey-ubu',
    mcRotation: [],
    templateKey: 'koji_asa',
    assetTab: '工事部朝夕'
  },
  {
    key: 'koji_yu',
    displayName: '工事部　夕礼MTG',
    aliases: ['工事部夕礼MTG', '工事部夕MTG', '工事部夕礼', '工事部夕'],
    recurringEventId: '8iq68lcf456fukiovvp73a3128', // 毎日16:15 / Meet rum-irfn-wby
    meetCode: 'rum-irfn-wby',
    mcRotation: [],
    templateKey: 'koji_yu',
    assetTab: '工事部朝夕'
  },
  // ── 新規: 全体朝礼をMeet化（8:08 / 9:00）。作成後に recurringEventId を記入 ──
  {
    key: 'chorei_0808',
    displayName: '全体朝礼 8:08',
    aliases: ['全体朝礼808', '朝礼808', '全体朝礼8時08分', '全体朝礼8'],
    recurringEventId: 'hfroeeb02k56b170fplacp43jk', // 作成済み（平日8:08）
    meetCode: 'euq-vyiz-wss',
    mcRotation: [],
    templateKey: 'chorei',
    assetTab: '朝礼'
  },
  {
    key: 'chorei_0900',
    displayName: '全体朝礼 9:00',
    aliases: ['全体朝礼900', '朝礼900', '全体朝礼9時'],
    recurringEventId: 'rbpfnj8m4lei27f3samc178h7s', // 作成済み（平日9:00）
    meetCode: 'ehg-dihw-emz',
    mcRotation: [],
    templateKey: 'chorei',
    assetTab: '朝礼'
  }
];

/**
 * 会議名の正規化: 全角/半角スペース・記号を除去して比較キー化。
 */
function normalizeName_(s) {
  if (!s) return '';
  return String(s)
    .replace(/[\s　]+/g, '')      // 半角/全角スペース除去
    .replace(/[　\t\r\n]/g, '')
    .replace(/[「」【】\[\]（）()・\-–—:：]/g, '')
    .toLowerCase();
}

/**
 * Geminiメモ件名から抜いた会議名 → レジストリの1件に解決。
 */
function resolveMeeting_(rawName) {
  var n = normalizeName_(rawName);
  for (var i = 0; i < MEETINGS.length; i++) {
    var m = MEETINGS[i];
    for (var j = 0; j < m.aliases.length; j++) {
      if (n.indexOf(normalizeName_(m.aliases[j])) !== -1) return m;
    }
  }
  return null;
}
