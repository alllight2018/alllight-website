/**
 * Main.gs — 入口とスケジュール設定。
 *
 * ■ 初回だけ手動で実行する関数
 *   1. setupAssets()          … 資産の器（会議ログSheet / 資産ログDoc）を作成
 *   2. installTriggers()      … 15分毎の取り込み + 週次改善レポートのトリガー設置
 *   3. createMorningAssemblies() … 全体朝礼(8:08/9:00)のMeet定例を作成（任意・要確認）
 *
 * ■ 自動で回る関数
 *   - processMeetingNotes()   … Gemini会議メモを取り込み→次回予定へ引き継ぎ→資産化
 *   - buildWeeklyImprovement()… 週次の業務改善サマリー送信
 */

/** メイン: 未処理の会議メモを取り込み、次回予定へ反映し、資産へ記録する。 */
function processMeetingNotes() {
  var notes = collectMeetingNotes_();
  Logger.log('未処理メモ: ' + notes.length + '件');

  notes.forEach(function (note) {
    var result;
    try {
      result = applyNoteToNextEvent_(note);
    } catch (e) {
      result = { ok: false, reason: '例外: ' + e };
    }
    try { recordAsset_(note, result); } catch (e2) { Logger.log('資産記録エラー: ' + e2); }
    Logger.log(JSON.stringify({ meeting: note.meetingRaw, status: note.status, result: result }));
  });
}

/** トリガー設置（重複を避けてから作り直す）。 */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === 'processMeetingNotes' || fn === 'buildWeeklyImprovement') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('processMeetingNotes')
    .timeBased().everyMinutes(15).create();

  // 毎週月曜 8:00 に週次改善レポート
  ScriptApp.newTrigger('buildWeeklyImprovement')
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();

  Logger.log('トリガー設置完了');
}

/**
 * 全体朝礼(8:08 / 9:00)をMeet固定・Gemini自動メモONの前提でカレンダーへ作成。
 * ・平日(月〜金)くり返し
 * ・出席者は下の ATTENDEES を編集してから実行
 * ・Meetリンクは各定例に自動発行される固定リンクが付きます
 */
function createMorningAssemblies() {
  var ATTENDEES = [
    // 例: 'morita.maho@alllight2018.com', 'kinoshita.daichi@alllight2018.com'
  ];
  var specs = [
    { key: 'chorei_0808', title: '全体朝礼 8:08', h: 8, m: 8, dur: 10 },
    { key: 'chorei_0900', title: '全体朝礼 9:00', h: 9, m: 0, dur: 10 }
  ];

  var props = PropertiesService.getScriptProperties();
  specs.forEach(function (s) {
    var start = nextWeekdayAt_(s.h, s.m);
    var end = new Date(start.getTime() + s.dur * 60000);

    var resource = {
      summary: s.title,
      description: toHtml_(TEMPLATES.chorei
        .replace('{{CARRYOVER}}', '（前回メモが届き次第、ここに自動で引き継ぎが入ります）')
        .replace('{{DASHBOARD}}', DASHBOARD_URL)),
      start: { dateTime: start.toISOString(), timeZone: 'Asia/Tokyo' },
      end: { dateTime: end.toISOString(), timeZone: 'Asia/Tokyo' },
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'],
      attendees: ATTENDEES.map(function (e) { return { email: e }; }),
      guestsCanModify: true,
      conferenceData: {
        createRequest: {
          requestId: 'chorei-' + s.key + '-' + start.getTime(),
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    };

    var created = Calendar.Events.insert(resource, PRIMARY_CALENDAR_ID, { conferenceDataVersion: 1 });
    // レジストリと突き合わせできるよう recurringEventId を控える
    props.setProperty('CHOREI_ID_' + s.key, created.id);
    Logger.log(s.title + ' 作成: ' + created.htmlLink + ' / id=' + created.id);
  });

  Logger.log('作成後: Config.gs の chorei_0808 / chorei_0900 の recurringEventId に、' +
    '上記 id（末尾の日付部分を除いた定例ID）を記入してください。');
}

/** 次の平日の h:m を返す。 */
function nextWeekdayAt_(h, m) {
  var d = new Date();
  d.setSeconds(0, 0);
  d.setHours(h, m);
  if (d.getTime() < Date.now()) d = new Date(d.getTime() + 24 * 3600 * 1000);
  while (d.getDay() === 0 || d.getDay() === 6) d = new Date(d.getTime() + 24 * 3600 * 1000);
  return d;
}

/** 手元確認用: いま何が次回予定として拾えるかを一覧ログ。 */
function diagnose() {
  MEETINGS.forEach(function (m) {
    var ev = null;
    try { ev = findNextInstance_(m); } catch (e) {}
    Logger.log(m.displayName + ' → ' +
      (ev ? (ev.start.dateTime || ev.start.date) : '（次回予定なし/ID未設定）'));
  });
}
