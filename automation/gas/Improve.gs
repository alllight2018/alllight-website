/**
 * Improve.gs — 業務改善ループ。
 *
 * 週1回、会議ログ Sheet の直近7日分を読み、社長宛に「業務改善サマリー」をメール送信。
 * さらに会議資産ログ Doc へ追記して蓄積します。
 * これで「会議 → 記録 → 資産 → 改善」が自動で一周します。
 */

var IMPROVE_MAIL_TO = 'yuuta.nazato@alllight2018.com';

function buildWeeklyImprovement() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty(ASSET_SHEET_PROP);
  if (!sheetId) { Logger.log('先に setupAssets() を実行してください'); return; }

  var sh = SpreadsheetApp.openById(sheetId).getSheetByName('log');
  var values = sh.getDataValues ? sh.getDataValues() : sh.getDataRange().getValues();
  var header = values.shift();

  var since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  var rows = values.filter(function (r) {
    var t = r[0] instanceof Date ? r[0] : new Date(r[0]);
    return t >= since;
  });

  if (!rows.length) { Logger.log('直近7日のログなし'); return; }

  var logText = rows.map(function (r) {
    return '[' + r[1] + '] ' + r[2] + '（' + r[3] + '）要点:' + r[4] +
      ' / 次:' + r[5] + ' / 決定:' + r[6];
  }).join('\n');

  var report = maybeLlmImprovement_(logText) || fallbackImprovement_(rows);

  // メール
  MailApp.sendEmail({
    to: IMPROVE_MAIL_TO,
    subject: '【週次】会議からの業務改善サマリー ' + ymd_(new Date()),
    body: report + '\n\n---\nこのレポートは会議ログから自動生成されています。'
  });

  // Docへ蓄積
  var docId = props.getProperty(ASSET_DOC_PROP);
  if (docId) {
    var body = DocumentApp.openById(docId).getBody();
    body.appendParagraph('▼ 週次改善サマリー ' + ymd_(new Date()))
        .setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph(report);
    body.appendHorizontalRule();
  }
  Logger.log('週次改善サマリー送信完了');
}

/** LLM無しのときの簡易集計。 */
function fallbackImprovement_(rows) {
  var failed = rows.filter(function (r) { return String(r[3]).indexOf('失敗') !== -1; });
  var byMeeting = {};
  rows.forEach(function (r) { byMeeting[r[2]] = (byMeeting[r[2]] || 0) + 1; });

  var lines = [];
  lines.push('■ 今週の会議数: ' + rows.length);
  Object.keys(byMeeting).forEach(function (k) { lines.push('　- ' + k + ': ' + byMeeting[k] + '回'); });
  lines.push('');
  lines.push('■ Gemini記録の取得失敗: ' + failed.length + '件');
  failed.forEach(function (r) { lines.push('　- ' + r[1] + ' ' + r[2] + '（次回冒頭で口頭回収）'); });
  lines.push('');
  lines.push('■ 主な次アクション');
  rows.slice(0, 8).forEach(function (r) { if (r[5]) lines.push('　- ' + r[2] + ': ' + r[5]); });
  lines.push('');
  lines.push('※ GEMINI_API_KEY を設定すると、改善提案つきの要約に自動でグレードアップします。');
  return lines.join('\n');
}

function ymd_(d) {
  return d.getFullYear() + '-' + pad2_(d.getMonth() + 1) + '-' + pad2_(d.getDate());
}
