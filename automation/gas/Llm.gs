/**
 * Llm.gs — 任意のGemini要約。
 *
 * Script Properties に GEMINI_API_KEY を設定すると、引き継ぎ要約と週次改善レポートの
 * 品質が上がります。未設定でも全機能は動作します（抽出ベースにフォールバック）。
 * APIキーは Google AI Studio (aistudio.google.com) で取得できます。
 */

var GEMINI_MODEL = 'gemini-2.5-flash';

/** 引き継ぎ用の短い要約。失敗時・キー無しは null を返す。 */
function maybeLlmSummary_(meeting, rawText) {
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key || !rawText) return null;

  var prompt =
    '次の会議メモを、次回会議の冒頭で読み上げる「引き継ぎ」に整形してください。\n' +
    '会議名: ' + meeting.displayName + '\n' +
    '出力条件: 箇条書き4〜6行。①前回の要点 ②決定事項（担当・期限があれば明記）③次回の宿題/未達 の順。前置き・締めの言葉は不要。\n\n' +
    '=== 会議メモ ===\n' + rawText;

  return callGemini_(key, prompt);
}

/** 週次改善レポート本文を生成。キー無しは null。 */
function maybeLlmImprovement_(logText) {
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key || !logText) return null;

  var prompt =
    'あなたは中小建設・電気工事会社の経営参謀です。直近1週間の全会議ログを読み、' +
    '社長向けに「業務改善サマリー」を作ってください。\n' +
    '出力: ①今週の決定事項と担当・期限 ②繰り返し出ている問題（未達・材料不足・待ち等）' +
    '③改善提案3つ（各1行、実行可能な粒度）④来週フォローすべき点。日本語・簡潔に。\n\n' +
    '=== 会議ログ ===\n' + logText;

  return callGemini_(key, prompt);
}

function callGemini_(key, prompt) {
  try {
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(key);
    var payload = { contents: [{ parts: [{ text: prompt }] }] };
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) {
      Logger.log('Gemini API ' + res.getResponseCode() + ': ' + res.getContentText());
      return null;
    }
    var data = JSON.parse(res.getContentText());
    var text = data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;
    return text ? String(text).trim() : null;
  } catch (e) {
    Logger.log('Gemini呼び出し失敗: ' + e);
    return null;
  }
}
