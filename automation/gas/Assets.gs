/**
 * Assets.gs — 「会話をすべて会社の資産として残す」層。
 *
 *  1) 会議ログ Sheet … 全会議の索引（日付・会議・状態・要点・決定・Doc URL）
 *  2) 会議資産ログ Doc … 要約と全文リンクを時系列で追記していく蓄積ドキュメント
 *
 * これが後段の「業務改善ループ」(Improve.gs) の入力になります。
 */

/** 初回セットアップ: 資産の器（SheetとDoc）を作り、IDをScript Propertiesに保存。 */
function setupAssets() {
  var props = PropertiesService.getScriptProperties();

  if (!props.getProperty(ASSET_SHEET_PROP)) {
    var ss = SpreadsheetApp.create('会議ログ（自動）');
    var sh = ss.getSheets()[0];
    sh.setName('log');
    sh.appendRow(['記録日時', '会議日', '会議', '状態', '要点', '次アクション', '決定事項', 'メモDoc', '反映先開始']);
    sh.setFrozenRows(1);
    props.setProperty(ASSET_SHEET_PROP, ss.getId());
    Logger.log('会議ログ Sheet 作成: ' + ss.getUrl());
  }

  if (!props.getProperty(ASSET_DOC_PROP)) {
    var doc = DocumentApp.create('会議資産ログ（自動）');
    doc.getBody().appendParagraph('会議資産ログ').setHeading(DocumentApp.ParagraphHeading.TITLE);
    doc.getBody().appendParagraph('Meetの会議メモを自動で時系列に蓄積します。業務改善の元データです。');
    doc.saveAndClose();
    props.setProperty(ASSET_DOC_PROP, doc.getId());
    Logger.log('会議資産ログ Doc 作成: ' + doc.getUrl());
  }
}

/** 1件のメモを資産（Sheet + Doc）へ記録する。 */
function recordAsset_(note, applyResult) {
  var props = PropertiesService.getScriptProperties();
  var meeting = resolveMeeting_(note.meetingRaw);
  var name = meeting ? meeting.displayName : note.meetingRaw;

  var sheetId = props.getProperty(ASSET_SHEET_PROP);
  if (sheetId) {
    try {
      var sh = SpreadsheetApp.openById(sheetId).getSheetByName('log');
      sh.appendRow([
        new Date(),
        note.dateStr,
        name,
        note.status === 'ok' ? '記録OK' : '取得失敗',
        firstLine_(note.summary || ''),
        (note.nextSteps || '').replace(/\n/g, ' / '),
        extractDecisions_(note.summary || ''),
        note.docUrl || '',
        applyResult && applyResult.eventStart ? applyResult.eventStart : ''
      ]);
    } catch (e) { Logger.log('Sheet記録失敗: ' + e); }
  }

  var docId = props.getProperty(ASSET_DOC_PROP);
  if (docId && note.status === 'ok') {
    try {
      var body = DocumentApp.openById(docId).getBody();
      body.appendParagraph(note.dateStr + '　' + name)
          .setHeading(DocumentApp.ParagraphHeading.HEADING2);
      if (note.summary) body.appendParagraph(note.summary);
      if (note.nextSteps) body.appendParagraph('次のステップ:\n' + note.nextSteps);
      if (note.docUrl) body.appendParagraph('全文: ' + note.docUrl);
      body.appendHorizontalRule();
    } catch (e) { Logger.log('Doc記録失敗: ' + e); }
  }
}

/** 概要テキストから決定事項っぽい行を軽く抽出（ベストエフォート）。 */
function extractDecisions_(text) {
  var lines = String(text).split('\n');
  var picks = lines.filter(function (l) {
    return /(決定|完了|徹底|担当|期限|開始|設置|方針)/.test(l);
  }).slice(0, 3);
  return picks.join(' / ');
}
