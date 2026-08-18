/**
 * フロンティアマーケティング 入札ダッシュボード（全部入り・Gemini版）
 * ─────────────────────────────────────────────
 * このシートに紐づくApps Scriptに、この1ファイルだけを置いてください
 * （旧 コード.gs / 入札目標.gs / 積算即時入力.gs は削除。onOpen重複を防ぐため）
 *
 * できること
 *  1) 入札会議のGeminiメモがメールで届くと自動で：
 *       議事録メモへ貼付 → AI要約(Gemini) → ダッシュボードを実データで再生成
 *  2) 案件リストのF列(URL)を入力すると、P列へAI概算(積み上げ式)＋M列へ内訳
 *
 * 準備：メニュー「入札AI」→「①初期設定（自動反映をON）」を1回実行するだけ。
 *       APIキーはスクリプトプロパティ GEMINI_API_KEY に保存しておくこと。
 */

const BID = {
  DASH: 'ダッシュボード',
  MEMO: '議事録メモ',
  ANALYSIS: '入札・落札分析', // 実績データ源（月次）
  CASES: '案件リスト',
  GOAL_AMOUNT: 700000000, // 年間売上目標 7億円
  GOAL_BIDS: 30,          // 月間入札目標
  GOAL_PICKUP: 150,       // 月間ピックアップ目標
  GOAL_WINRATE: 12,       // 目標落札率(%)
  PROCESSED_LABEL: '入札ダッシュ/処理済み',
  MEMO_CELL: 'A6',        // 議事録メモ貼り付け先
  AI_PROP: 'BID_AI_JSON', // 直近AI要約の保存先
  // 現在の入札チーム（森田は退職のため除外）
  MEMBERS: [
    { name: '名里 真耶', role: 'チームリーダー', color: '#534AB7', bg: '#EEEDFE',
      tasks: ['入札申請・決裁', '見積査定・利益計算', '現場代理人調整', 'PDCA管理'], kpi: '落札率・落札金額の最終責任者' },
    { name: '金山 知沙', role: '入札担当', color: '#0F6E56', bg: '#E1F5EE',
      tasks: ['NJSS案件ピックアップ', '官庁ポータル手続き', '過去実績入力'], kpi: 'ピックアップ件数・入力精度' },
    { name: '杉本', role: '架電チーム', color: '#854F0B', bg: '#FAEEDA',
      tasks: ['協力業者リスト管理', '架電・メール取得', '図面・数量表送付'], kpi: '架電件数・見積受領数' },
  ],
};
const GEMINI_MODEL = 'gemini-2.5-flash';

// ============================================================
//  メニュー
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('入札AI')
    .addItem('① 初期設定（自動反映をON）', 'installBidTriggers')
    .addSeparator()
    .addItem('今すぐGmailからAI反映', 'autoRunFromGmail')
    .addItem('ダッシュボードを再生成（データのみ）', 'rebuildDashboard')
    .addToUi();
}

// ============================================================
//  初期設定：トリガー2種を設置
// ============================================================
function installBidTriggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === 'autoRunFromGmail' || fn === 'handleEstimateOnEdit_') ScriptApp.deleteTrigger(t);
  });
  // 15分ごとにGmailを見て、入札会議メモが来ていたら自動反映
  ScriptApp.newTrigger('autoRunFromGmail').timeBased().everyMinutes(15).create();
  // 案件リストF列(URL)入力でP列へ即概算
  ScriptApp.newTrigger('handleEstimateOnEdit_').forSpreadsheet(ss).onEdit().create();

  var hasKey = !!PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  SpreadsheetApp.getUi().alert(
    '✅ 自動反映をONにしました。\n\n' +
    '・入札会議のGeminiメモがメールで届くと、15分以内に自動でダッシュボードへ反映されます。\n' +
    '・案件リストのF列にURLを入れるとP列へ概算が入ります。\n\n' +
    (hasKey ? 'Geminiキー：設定済み' :
      '⚠️ まだ GEMINI_API_KEY が未設定です。プロジェクトの設定→スクリプトプロパティで保存してください。')
  );
}

// ============================================================
//  Gmail監視：入札会議のGeminiメモが届いていたら反映
// ============================================================
function autoRunFromGmail() {
  var label = getLabel_(BID.PROCESSED_LABEL);
  var threads = GmailApp.search(
    'from:gemini-notes@google.com newer_than:3d -label:"' + BID.PROCESSED_LABEL + '"', 0, 20);
  var memo = null;

  threads.forEach(function (th) {
    th.getMessages().forEach(function (msg) {
      var subj = msg.getSubject() || '';
      var name = (subj.match(/[「『](.+?)[」』]/) || [])[1] || '';
      if (norm_(name).indexOf('入札会議') === -1) return;
      memo = msg.getPlainBody() || '';
    });
    th.addLabel(label); // 独自ラベルで二重処理防止
  });

  if (memo) pasteMemoAndUpdate_(memo);
}

// ============================================================
//  議事録メモへ貼付 → AI要約 → ダッシュボード再生成 → ログ追記
// ============================================================
function pasteMemoAndUpdate_(memo) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var memoSheet = ss.getSheetByName(BID.MEMO);
  try {
    if (memoSheet) memoSheet.getRange(BID.MEMO_CELL).setValue(memo);

    var ai = summarizeWithGemini_(memo);
    if (ai) PropertiesService.getScriptProperties().setProperty(BID.AI_PROP, JSON.stringify(ai));

    rebuildDashboard();

    if (memoSheet && ai) {
      var nowText = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm');
      var nextRow = Math.max(29, memoSheet.getLastRow() + 1);
      memoSheet.getRange(nextRow, 1, 1, 9).setValues([[
        Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd'),
        cut_(ai.summary || '', 500),
        (ai.decisions || []).join('\n'),
        (ai.issues || []).join('\n'),
        (ai.dashboard_actions || ai.actions || []).join('\n'),
        (ai.owners || []).join('\n'),
        (ai.deadlines || []).join('\n'),
        'ダッシュボード反映済み',
        nowText
      ]]);
      memoSheet.getRange('A3').setValue('反映状況：ダッシュボード反映済み ／ ' + nowText);
    }
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
//  Gemini：会議メモ → ダッシュボード用JSON
// ============================================================
function summarizeWithGemini_(memo) {
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key || !memo) return null;
  var prompt = [
    'あなたは株式会社オールライトの入札会議の参謀AIです。',
    '次の入札会議メモを読み、毎週の入札PDCAダッシュボード更新用に日本語で整理してください。',
    '観点：ピックアップ数/検討数/入札数/落札率/落札金額/億案件、電子証明書・期限管理、入札ミス、協力業者、次回確認事項。',
    'アラートは重要度順に色分けの語(赤/黄/緑)を先頭に付ける。',
    'JSONのみで返す。形式：',
    '{"summary":"3〜5行","decisions":["決定事項"],"issues":["課題/リスク"],',
    '"alerts":["🔴/🟡/🟢 で始まる最大6件"],"dashboard_actions":["今週やる最大7件"],',
    '"owners":["担当者"],"deadlines":["期限"]}',
    '', '--- 会議メモ ---', memo
  ].join('\n');
  return callGeminiJson_(key, prompt);
}

function callGeminiJson_(key, prompt) {
  try {
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(key);
    var payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    };
    var res = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) { Logger.log('Gemini ' + res.getResponseCode() + ':' + res.getContentText()); return null; }
    var data = JSON.parse(res.getContentText());
    var text = data && data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;
    if (!text) return null;
    return JSON.parse(extractJson_(text));
  } catch (e) { Logger.log('Gemini呼び出し失敗: ' + e); return null; }
}

// ============================================================
//  実データ読み取り（入札・落札分析タブ）
// ============================================================
function readMonthly_(year) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BID.ANALYSIS);
  if (!sh) return [];
  var vals = sh.getDataRange().getValues();
  var cur = null, out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    var y = parseInt(String(r[0]).replace(/[^0-9]/g, ''), 10);
    if (y >= 2000 && y <= 2100) cur = y;
    var m = Number(r[1]);
    if (cur === year && m >= 1 && m <= 12) {
      out.push({ month: m, pickup: num_(r[2]), review: num_(r[3]), bid: num_(r[4]),
        oku: num_(r[5]), win: num_(r[6]), amount: num_(r[7]) });
    }
  }
  return out;
}

/** 最新の（データがある）年を返す */
function latestYearWithData_() {
  var y = new Date().getFullYear();
  for (var k = 0; k < 5; k++) {
    var rows = readMonthly_(y - k);
    if (rows.some(function (m) { return m.pickup || m.bid || m.amount; })) return y - k;
  }
  return y;
}

// ============================================================
//  ダッシュボード再生成（実データ＋直近AI要約）
// ============================================================
function rebuildDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var year = latestYearWithData_();
  var months = readMonthly_(year).filter(function (m) { return m.pickup || m.review || m.bid || m.amount; });
  var ai = readAi_();

  var sheet = ss.getSheetByName(BID.DASH);
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet(BID.DASH, 0);
  sheet.setHiddenGridlines(true);
  sheet.setTabColor('#534AB7');
  sheet.setColumnWidth(1, 20);
  [2, 3, 4, 5].forEach(function (c) { sheet.setColumnWidth(c, 165); });
  sheet.setColumnWidth(6, 20);

  var row = 2;
  row = secHeader_(sheet, row, year);
  row++;
  row = secAiSummary_(sheet, row, ai);
  row++;
  row = secAnnualKpi_(sheet, row, months);
  row++;
  row = secAlerts_(sheet, row, ai);
  row++;
  row = secMonthly_(sheet, row, months);
  row++;
  row = secReverseKpi_(sheet, row, months);
  row++;
  row = secActions_(sheet, row, ai);
  row++;
  row = secMembers_(sheet, row);
  row++;
  secFooter_(sheet, row);

  ss.setActiveSheet(sheet);
  SpreadsheetApp.flush();
}

function secHeader_(sheet, row, year) {
  var now = new Date();
  var dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy年M月d日 HH:mm') + ' 更新';
  merge_(sheet, row, 2, row, 5);
  sheet.getRange(row, 2).setValue('📊 入札チーム PDCA ダッシュボード')
    .setFontSize(18).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#2D2A6E')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(row, 50);
  row++;
  merge_(sheet, row, 2, row, 5);
  sheet.getRange(row, 2).setValue('年間売上目標：7億円　／　' + year + '年実績　／　' + dateStr + '　／　会議メモ受信で自動更新')
    .setFontSize(11).setFontColor('#534AB7').setBackground('#EEEDFE').setVerticalAlignment('middle');
  sheet.setRowHeight(row, 28);
  return row + 1;
}

function secAiSummary_(sheet, row, ai) {
  secTitle_(sheet, row, '🧠  前回会議のAI要約');
  row++;
  merge_(sheet, row, 2, row, 5);
  var text = ai && ai.summary ? ai.summary : '（入札会議のGeminiメモが届くと、ここに自動で要約が入ります）';
  sheet.getRange(row, 2).setValue(text)
    .setFontSize(11).setFontColor('#1a1a2e').setBackground('#F8F8FF').setWrap(true).setVerticalAlignment('top')
    .setBorder(true, true, true, true, false, false, '#DDDDDD', SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(row, 84);
  return row + 1;
}

function secAnnualKpi_(sheet, row, months) {
  var t = totals_(months);
  secTitle_(sheet, row, '📈  累計KPI');
  row++;
  sheet.setRowHeight(row, 8); row++;
  var cards = [
    { label: 'ピックアップ総数', value: t.pickup + '件', sub: '月平均 ' + (months.length ? Math.round(t.pickup / months.length) : 0) + '件', color: '#185FA5', bg: '#E6F1FB' },
    { label: '入札総数', value: t.bid + '件', sub: '落札率 ' + t.winRate + '%', color: '#0F6E56', bg: '#E1F5EE' },
    { label: '落札件数', value: t.win + '件', sub: '平均単価 ' + yen_(t.avg), color: '#854F0B', bg: '#FAEEDA' },
    { label: '落札金額', value: oku_(t.amount), sub: '目標達成率 ' + t.goalRate + '%', color: '#A32D2D', bg: '#FCEBEB' },
  ];
  cards.forEach(function (k, i) {
    var col = 2 + i;
    sheet.getRange(row, col).setValue(k.label).setFontSize(10).setFontColor(k.color).setBackground(k.bg).setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
    sheet.getRange(row + 1, col).setValue(k.value).setFontSize(20).setFontWeight('bold').setFontColor(k.color).setBackground(k.bg).setHorizontalAlignment('center').setVerticalAlignment('middle');
    sheet.getRange(row + 2, col).setValue(k.sub).setFontSize(9).setFontColor('#666666').setBackground(k.bg).setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  sheet.setRowHeight(row, 22); sheet.setRowHeight(row + 1, 40); sheet.setRowHeight(row + 2, 18);
  row += 3;
  sheet.setRowHeight(row, 8); row++;
  merge_(sheet, row, 2, row, 5);
  var filled = Math.max(0, Math.round(Number(t.goalRate) / 2)), empty = Math.max(0, 50 - filled);
  sheet.getRange(row, 2).setValue('年間目標進捗　' + t.goalRate + '%　' + rep_('█', filled) + rep_('░', empty) + '　残り ' + oku_(BID.GOAL_AMOUNT - t.amount))
    .setFontSize(10).setFontColor('#534AB7').setBackground('#EEEDFE').setFontFamily('Courier New').setVerticalAlignment('middle');
  sheet.setRowHeight(row, 26);
  return row + 1;
}

function secAlerts_(sheet, row, ai) {
  secTitle_(sheet, row, '🚨  課題アラート（今週）');
  row++;
  sheet.setRowHeight(row, 8); row++;
  var alerts = (ai && ai.alerts && ai.alerts.length) ? ai.alerts
    : ['（会議メモが届くと、AIが今週のアラートを自動抽出します）'];
  alerts.forEach(function (a) {
    merge_(sheet, row, 2, row, 5);
    var bg = '#EEEDFE', fg = '#26215C';
    if (a.indexOf('🔴') === 0 || a.indexOf('赤') === 0) { bg = '#FCEBEB'; fg = '#A32D2D'; }
    else if (a.indexOf('🟡') === 0 || a.indexOf('黄') === 0) { bg = '#FAEEDA'; fg = '#633806'; }
    else if (a.indexOf('🟢') === 0 || a.indexOf('緑') === 0) { bg = '#E1F5EE'; fg = '#085041'; }
    sheet.getRange(row, 2).setValue(a).setFontSize(11).setFontColor(fg).setBackground(bg).setWrap(true).setVerticalAlignment('middle');
    sheet.setRowHeight(row, 28);
    row++;
  });
  return row;
}

function secMonthly_(sheet, row, months) {
  secTitle_(sheet, row, '📅  月次推移');
  row++;
  sheet.setRowHeight(row, 8); row++;
  ['月', 'ピックアップ', '検討数', '入札数', '落札数 / 金額'].forEach(function (h, i) {
    sheet.getRange(row, 2 + i).setValue(h).setFontSize(10).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#534AB7').setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  sheet.setRowHeight(row, 26); row++;
  months.forEach(function (m) {
    var amt = m.amount > 0 ? oku_(m.amount) : (m.win === 0 ? '0円' : '—');
    [m.month + '月', m.pickup || '—', m.review || '—', m.bid || '—', (m.win || 0) + '件 / ' + amt].forEach(function (v, i) {
      sheet.getRange(row, 2 + i).setValue(v).setFontSize(11).setBackground('#FFFFFF').setHorizontalAlignment('center').setVerticalAlignment('middle')
        .setBorder(true, true, true, true, false, false, '#DDDDDD', SpreadsheetApp.BorderStyle.SOLID);
    });
    sheet.setRowHeight(row, 26); row++;
  });
  var t = totals_(months);
  ['合計', t.pickup, t.review, t.bid, t.win + '件 / ' + oku_(t.amount)].forEach(function (v, i) {
    sheet.getRange(row, 2 + i).setValue(v).setFontSize(11).setFontWeight('bold').setBackground('#EEEDFE').setFontColor('#26215C').setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  sheet.setRowHeight(row, 28);
  return row + 1;
}

function secReverseKpi_(sheet, row, months) {
  secTitle_(sheet, row, '🎯  7億円達成　逆算KPI');
  row++;
  sheet.setRowHeight(row, 8); row++;
  var t = totals_(months);
  var n = months.length || 1;
  var remMonths = Math.max(1, 12 - n);
  var needPer = Math.round((BID.GOAL_AMOUNT - t.amount) / remMonths);
  var rows = [
    ['指標', '現状(月平均)', '目標(月)', 'ギャップ'],
    ['ピックアップ', Math.round(t.pickup / n) + '件', BID.GOAL_PICKUP + '件', '▲' + (BID.GOAL_PICKUP - Math.round(t.pickup / n)) + '件'],
    ['入札数', Math.round(t.bid / n) + '件', BID.GOAL_BIDS + '件', '▲' + (BID.GOAL_BIDS - Math.round(t.bid / n)) + '件'],
    ['落札率', t.winRate + '%', BID.GOAL_WINRATE + '%', '▲' + (BID.GOAL_WINRATE - Number(t.winRate)).toFixed(1) + '%'],
    ['月間落札金額', yen_(Math.round(t.amount / n)), yen_(needPer), '▲' + yen_(needPer - Math.round(t.amount / n))],
  ];
  rows.forEach(function (rd, ri) {
    rd.forEach(function (v, ci) {
      var cell = sheet.getRange(row + ri, 2 + ci);
      if (ri === 0) cell.setValue(v).setFontSize(10).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#534AB7').setHorizontalAlignment('center').setVerticalAlignment('middle');
      else cell.setValue(v).setFontSize(11).setFontColor(ci === 3 ? '#A32D2D' : '#1a1a2e').setBackground(ci === 3 ? '#FFF5F5' : (ri % 2 === 0 ? '#F8F8FF' : '#FFFFFF')).setHorizontalAlignment('center').setVerticalAlignment('middle')
        .setBorder(true, true, true, true, false, false, '#DDDDDD', SpreadsheetApp.BorderStyle.SOLID);
    });
    sheet.setRowHeight(row + ri, ri === 0 ? 26 : 28);
  });
  return row + rows.length;
}

function secActions_(sheet, row, ai) {
  secTitle_(sheet, row, '✅  今週のアクション（AI抽出）');
  row++;
  sheet.setRowHeight(row, 8); row++;
  var actions = (ai && (ai.dashboard_actions || ai.actions) || []);
  if (!actions.length) actions = ['（会議メモが届くと、AIが今週のアクションを自動抽出します）'];
  actions.forEach(function (a, i) {
    merge_(sheet, row, 2, row, 5);
    var urgent = String(a).indexOf('今週') >= 0;
    sheet.getRange(row, 2).setValue((i + 1) + '.  ' + a).setFontSize(11).setFontColor(urgent ? '#A32D2D' : '#1a1a2e').setBackground(urgent ? '#FCEBEB' : '#FFFFFF').setWrap(true).setVerticalAlignment('middle')
      .setBorder(false, false, true, false, false, false, '#EEEEEE', SpreadsheetApp.BorderStyle.SOLID);
    sheet.setRowHeight(row, 30); row++;
  });
  return row;
}

function secMembers_(sheet, row) {
  secTitle_(sheet, row, '👥  メンバー別 役割 & KPI');
  row++;
  sheet.setRowHeight(row, 8); row++;
  BID.MEMBERS.forEach(function (m, i) {
    var col = 2 + i;
    sheet.getRange(row, col).setValue(m.name).setFontSize(13).setFontWeight('bold').setFontColor(m.color).setBackground(m.bg).setHorizontalAlignment('center').setVerticalAlignment('middle');
    sheet.getRange(row + 1, col).setValue(m.role).setFontSize(10).setFontColor('#555555').setBackground(m.bg).setHorizontalAlignment('center').setVerticalAlignment('middle');
    sheet.getRange(row + 2, col).setValue(m.tasks.join('\n')).setFontSize(10).setFontColor('#333333').setBackground('#FAFAFA').setWrap(true).setVerticalAlignment('top')
      .setBorder(true, true, true, true, false, false, '#DDDDDD', SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(row + 3, col).setValue('KPI: ' + m.kpi).setFontSize(9).setFontColor(m.color).setBackground(m.bg).setFontStyle('italic').setWrap(true).setVerticalAlignment('middle');
  });
  sheet.setRowHeight(row, 30); sheet.setRowHeight(row + 1, 20); sheet.setRowHeight(row + 2, 80); sheet.setRowHeight(row + 3, 36);
  return row + 4;
}

function secFooter_(sheet, row) {
  sheet.setRowHeight(row, 12); row++;
  merge_(sheet, row, 2, row, 5);
  sheet.getRange(row, 2).setValue('このダッシュボードは、入札会議のGeminiメモがメールで届くと自動更新されます（実績＝入札・落札分析タブ）。')
    .setFontSize(9).setFontColor('#999999').setHorizontalAlignment('center');
}

// ============================================================
//  案件リスト：F列(URL)入力 → P列へAI概算(積み上げ式) ＋ M列へ内訳
// ============================================================
var EST = { SHEET: '案件リスト', HEADER_ROW: 1, C_TANTO: 3, C_NAME: 5, C_URL: 6, C_PREF: 7, C_ORG: 8, C_MEMO: 13, C_PRICE: 16 };

function handleEstimateOnEdit_(e) {
  if (!e || !e.range) return;
  var range = e.range, sheet = range.getSheet();
  if (sheet.getName() !== EST.SHEET) return;
  var sc = range.getColumn(), ec = sc + range.getNumColumns() - 1;
  if (EST.C_URL < sc || EST.C_URL > ec) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    for (var i = 0; i < range.getNumRows(); i++) {
      var r = range.getRow() + i;
      if (r <= EST.HEADER_ROW) continue;
      estimateRow_(sheet, r);
    }
  } finally { lock.releaseLock(); }
}

function estimateRow_(sheet, row) {
  var url = String(sheet.getRange(row, EST.C_URL).getDisplayValue() || '').trim();
  if (!url) return;
  var pCell = sheet.getRange(row, EST.C_PRICE);
  if (String(pCell.getDisplayValue() || '').trim()) return; // 既に入っていれば触らない

  var info = {
    案件名: String(sheet.getRange(row, EST.C_NAME).getDisplayValue() || '').trim(),
    発注機関: String(sheet.getRange(row, EST.C_ORG).getDisplayValue() || '').trim(),
    都道府県: String(sheet.getRange(row, EST.C_PREF).getDisplayValue() || '').trim(),
    url: url
  };
  var mCell = sheet.getRange(row, EST.C_MEMO);
  var oldMemo = String(mCell.getDisplayValue() || '').trim();
  mCell.setValue(appendMemo_(oldMemo, 'AI即時概算中：' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm')));

  try {
    var pageText = fetchPageText_(url); // 公告/NJSSページ本文を読む（取得できれば精度UP）
    var result = estimateWithGemini_(info, pageText);
    var yenVal = Number(result.estimate_yen || 0);
    if (!isFinite(yenVal) || yenVal <= 0) throw new Error('数値が返りませんでした：' + JSON.stringify(result));
    pCell.setValue(Math.round(yenVal)).setNumberFormat('¥#,##0');
    var breakdown = (result.breakdown || []).map(function (b) {
      return '・' + (b.item || '') + ' ' + (b.qty || '') + (b.unit || '') + '×' + yen_(b.unit_price || 0) + '=' + yen_(b.subtotal || 0);
    }).join(' ／ ');
    var memo = 'AI概算：' + yen_(Math.round(yenVal)) + '／信頼度' + (result.confidence || '中') + '／' + (result.basis || '') +
      (breakdown ? '　内訳：' + breakdown : '');
    mCell.setValue(appendMemo_(oldMemo, memo));
  } catch (err) {
    mCell.setValue(appendMemo_(oldMemo, 'AI概算エラー・手動確認：' + err.message));
  }
}

function estimateWithGemini_(info, pageText) {
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY 未設定');
  var prompt = [
    'あなたは公共工事（電気・照明・受変電・発電機・通信）の積算のプロです。',
    '次の入札案件の概算価格を「積み上げ式」で算出してください。ざっくりの総額ではなく、',
    '主要な品目ごとに「数量×単価」を出して合計します。仕様書/公告本文があれば数量を読み取る。',
    '社内ルール：照明器具は 台数×単価×1.3〜1.5 を目安。受変電・発電機は機器費＋据付＋試験。',
    '不明な数量は案件名・発注者・規模から妥当に推定し、必ず暫定値を出す。',
    'JSONのみで返す。形式：',
    '{"estimate_yen": 数値(税抜概算総額),',
    ' "confidence":"高|中|低",',
    ' "basis":"80字以内の根拠",',
    ' "breakdown":[{"item":"品目","qty":数量,"unit":"台/式/m","unit_price":単価,"subtotal":小計}] }',
    '',
    '案件情報：' + JSON.stringify(info),
    '',
    (pageText ? ('--- 公告/仕様ページ本文（抜粋）---\n' + cut_(pageText, 6000)) : '（ページ本文は取得できませんでした。案件名等から推定してください）')
  ].join('\n');
  var out = callGeminiJson_(key, prompt);
  if (!out) throw new Error('AI応答なし');
  return out;
}

/** URLのページ本文をざっくり取得（失敗しても概算は続行） */
function fetchPageText_(url) {
  try {
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() >= 200 && res.getResponseCode() < 400) {
      var html = res.getContentText();
      return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    }
  } catch (e) {}
  return '';
}

// ============================================================
//  ユーティリティ
// ============================================================
function readAi_() {
  var p = PropertiesService.getScriptProperties().getProperty(BID.AI_PROP);
  if (!p) return null;
  try { return JSON.parse(p); } catch (e) { return null; }
}
function totals_(months) {
  var pickup = 0, review = 0, bid = 0, win = 0, amount = 0;
  months.forEach(function (m) { pickup += m.pickup || 0; review += m.review || 0; bid += m.bid || 0; win += m.win || 0; amount += m.amount || 0; });
  var winRate = bid > 0 ? (win / bid * 100).toFixed(1) : '0.0';
  var goalRate = (amount / BID.GOAL_AMOUNT * 100).toFixed(1);
  var avg = win > 0 ? Math.round(amount / win) : 0;
  return { pickup: pickup, review: review, bid: bid, win: win, amount: amount, winRate: winRate, goalRate: goalRate, avg: avg };
}
function merge_(sheet, r1, c1, r2, c2) { sheet.getRange(r1, c1, r2 - r1 + 1, c2 - c1 + 1).merge(); }
function secTitle_(sheet, row, title) {
  merge_(sheet, row, 2, row, 5);
  sheet.getRange(row, 2).setValue(title).setFontSize(12).setFontWeight('bold').setFontColor('#2D2A6E').setBackground('#EEEDFE').setVerticalAlignment('middle');
  sheet.setRowHeight(row, 32);
}
function yen_(a) {
  if (!a) return '0円';
  if (a >= 100000000) return (a / 100000000).toFixed(2) + '億円';
  if (a >= 10000) return Math.round(a / 10000).toLocaleString() + '万円';
  return Math.round(a).toLocaleString() + '円';
}
function oku_(a) {
  if (!a) return '0円';
  if (a >= 100000000) return (a / 100000000).toFixed(2) + '億円';
  return Math.round(a / 10000).toLocaleString() + '万円';
}
function rep_(ch, n) { return new Array(Math.max(0, n) + 1).join(ch); }
function num_(v) { var n = Number(String(v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; }
function norm_(s) { return String(s || '').replace(/[\s　]+/g, ''); }
function cut_(t, n) { t = String(t || ''); return t.length > n ? t.substring(0, n) : t; }
function extractJson_(t) { var s = t.indexOf('{'), e = t.lastIndexOf('}'); return (s >= 0 && e > s) ? t.substring(s, e + 1) : t; }
function appendMemo_(oldMemo, add) { if (!oldMemo) return add; if (oldMemo.indexOf(add) >= 0) return oldMemo; return oldMemo + ' ／ ' + add; }
function getLabel_(name) { var l = GmailApp.getUserLabelByName(name); return l ? l : GmailApp.createLabel(name); }
