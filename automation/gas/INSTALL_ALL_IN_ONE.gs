/**
 * 会議自動化システム — 導入用オールインワン（このファイル1枚を貼り付けるだけ）
 * 元の分割ファイル(Config/Templates/Notes/CalendarSync/Assets/Improve/Llm/Main)を1枚に結合。
 * appsscript.json だけは別途マニフェストに貼ってください。
 */


// ======================================================================
// ===== Config.gs
// ======================================================================

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
    // 2026-08-10 に分裂していた2系列を隔週金曜の1本へ統合（対面手順つき）
    recurringEventId: 'lnpa6p8domabq8jip91j9lkurk',
    meetCode: 'ppn-qfwg-aus',
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

// ======================================================================
// ===== Templates.gs
// ======================================================================

/**
 * Templates.gs — 会議ごとの「司会進行台本」正本。
 *
 * カレンダー説明文は毎回この正本から再生成されるため、表記のばらつきが消えます。
 * {{MC}}       … 本日の司会（ローテから自動挿入）
 * {{CARRYOVER}}… 前回議事録からの引き継ぎ（自動要約 or 失敗時の回収指示）
 * {{DASHBOARD}}… 統合ダッシュボードURL
 */

/**
 * 全員が同じ部屋にいる「対面会議」で、Meetが自動終了したり
 * 「ひとりで録音」と誤認されて失敗するのを防ぐための開き方ガイド。
 * 条件付き（全員同室のとき）なので、遠隔参加の会議に入っても害はない。
 */
var INROOM_GUIDE = [
  '【全員が同じ部屋にいる対面会議のときは（重要）】',
  '・主端末（PC/タブレット）を部屋の中央に置いてMeetに入室し、「メモを取る（Gemini・日本語）」＋録音を開始。マイクON／スピーカーはOFFか最小（ハウリング防止）。',
  '・スマホ等もう1台を同じMeetに「コンパニオンモードで参加」＝参加者を2人以上にする。これで自動終了・"ひとり録音"の誤認を防ぎます。',
  '・マイクONは主端末の1台だけ。各自、名前を言ってから30秒以上ハッキリ日本語で話す（短い・小声だと会話量不足で失敗）。'
].join('\n');

var TEMPLATES = {

  // 施行管理部会（30分）
  sekokanri: [
    '{{MC}}',
    '',
    '{{CARRYOVER}}',
    '',
    '{{INROOM}}',
    '',
    '【会議開始チェック】',
    '・Gemini「メモを取る」の言語＝日本語',
    '・利用できる場合は文字起こしも開始',
    '・開始1分後、日本語の発言が記録されているか確認',
    '',
    '【統合ダッシュボード】 {{DASHBOARD}}',
    '会議前に「スマホ表示」「統合アクション」「会議ログ」を確認してください。',
    '',
    '【30分の進め方】',
    '1. 前回目標：達成・未達・新しい期限',
    '2. 期限超過の提出書類・工程表・完成図書',
    '3. 工程遅延、協力会社待ち、発注者判断待ち',
    '4. 味川・小松など優先案件の確認',
    '5. 部長判断と社長判断',
    '6. 決定事項：担当者・期限・完了条件',
    '7. 次回までの個人目標：氏名・目標・完了条件・期限',
    '',
    '【会議終了前の必須ルール】',
    '全員が名前を先に言ってから、「氏名｜次回までの個人目標｜数値または完了条件｜期限」を1人ずつ宣言する。',
    '司会者は最後に「個人目標は全員分確認しました」と発言して終了する。',
    '',
    '【共通ルール】報告は 結論 → 数字・期限 → 自分の意見。赤・黄・期限超過を優先。'
  ].join('\n'),

  // 入札会議（毎週）
  nyusatsu: [
    '{{MC}}',
    '',
    '{{CARRYOVER}}',
    '',
    '{{INROOM}}',
    '',
    '【会議開始チェック】Gemini「メモを取る」＝日本語 / 文字起こしON / 開始1分後に記録確認',
    '',
    '【統合ダッシュボード】 {{DASHBOARD}}',
    '会議前に「スマホ表示」「統合アクション」「KPI月次」を確認してください。',
    '',
    '【30分の進め方】',
    '1. 前回タスク：完了・未完了・期限',
    '2. 入札件数、大型案件数、申請期限',
    '3. 判断待ち・見積待ち・ログイン障害',
    '4. 今週注力する案件を3件決定',
    '5. 担当者・期限・次の一手を登録',
    '6. 次回までの個人目標：氏名・目標・完了条件・期限',
    '',
    '【入札判断基準】近畿：500万円以上／近畿以外：1,000万円以上／紙入札：600万円以上を積極検討',
    '【報告の型】結論 → 数字・期限 → 自分の意見'
  ].join('\n'),

  // 工事部会（30分）
  kojibukai: [
    '{{MC}}',
    '',
    '{{CARRYOVER}}',
    '',
    '{{INROOM}}',
    '',
    '【会議開始チェック】Gemini「メモを取る」＝日本語 / 文字起こしON / 録音開始',
    '',
    '【統合ダッシュボード】 {{DASHBOARD}}',
    '会議前に「スマホ表示」「工事部朝夕」「統合アクション」を確認してください。',
    '',
    '【30分の進め方】',
    '1. 前回目標：達成・未達・継続',
    '2. 八戸ノ里など担当現場：完了、未完了、理由',
    '3. 手戻り、材料不足、他業者待ち、人員不足',
    '4. 改善案：数字と期限を入れて提案',
    '5. 施工管理部からの依頼',
    '6. 決定事項：担当者・期限・完了条件',
    '7. 次回までの個人目標',
    '',
    '【報告の型】結論 → 数字・期限 → 自分の意見。緑は説明せず、赤・黄・期限超過を優先。'
  ].join('\n'),

  // 幹部会議（45分）
  kanbu: [
    '幹部会議 司会台本（45分）',
    '',
    '{{MC}}',
    '',
    '{{CARRYOVER}}',
    '',
    '{{INROOM}}',
    '',
    '【会議のルール】各項目は事前にメモし、その場で考えない／報告は 結論→数字・期限→自分の意見／互いを尊重し建設的に。',
    '',
    '1. 開会・次回日程の確認（2分）… カレンダーで次回日時・次回司会者を確定',
    '2. 前回目標の達成確認（5分）… 木下→井上→真耶。未達は新しい期限を決める',
    '3. 個人面談・社員共有（5分）… 重要案件のみ結論から。体調・人員配置',
    '4. 各部長の気づき共有（15分・各5分）… 気づき/悩み/改善案/社長への判断依頼',
    '5. 社長からの共有（5分）',
    '6. 本日の決定事項（5分）… 2〜3件まで。担当・期限・完了条件',
    '7. 次回までの個人目標（5分）… 木下→井上→真耶の順に宣言',
    '8. 宿題・閉会（3分）… 担当・期限・内容の最終確認、次回司会者を確認',
    '',
    '【幹部会議ダッシュボード】 ' + '{{KANBU_DASHBOARD}}'
  ].join('\n'),

  // 工事部 朝礼（現場・短時間）
  koji_asa: [
    '{{CARRYOVER}}',
    '',
    '【会議開始チェック】Gemini「メモを取る」＝日本語 / 30秒以上は日本語で発話（短すぎると記録失敗）',
    '',
    '【統合ダッシュボード】 {{DASHBOARD}}',
    '朝礼後、Gemini議事録は「工事部朝夕」へ集約します。',
    '',
    '【朝礼の報告順】1.担当者 2.作業場所（階・部屋・タイプ）3.今日やる作業 4.完了予定 5.注意点 6.応援依頼・不足材料',
    '短く、同じ順番で。部屋番号・階数・未完理由・不足材料は必ず言葉にしてください。',
    '木下部長は最初に現場全体の注意点を共有してください。'
  ].join('\n'),

  // 工事部 夕礼（現場・短時間）
  koji_yu: [
    '{{CARRYOVER}}',
    '',
    '【会議開始チェック】Gemini「メモを取る」＝日本語 / 30秒以上は日本語で発話（短すぎると記録失敗）',
    '',
    '【統合ダッシュボード】 {{DASHBOARD}}',
    '夕礼後、Gemini議事録は「工事部朝夕」へ集約します。',
    '',
    '【夕礼の報告順】1.担当者名 2.完了した作業 3.未完了の作業 4.未完了の理由 5.明日やる作業 6.追加工事・手戻り・注意事項 7.応援依頼・不足材料',
    '完了と未完了を分け、階数・部屋・タイプ・未完理由を必ず言葉にしてください。',
    '木下部長は最後に、明日の人員配置と部長判断が必要な内容を確認してください。'
  ].join('\n'),

  // 全体朝礼（8:08 / 9:00）Meet化
  chorei: [
    '{{CARRYOVER}}',
    '',
    '【この会議のねらい】Meetを開くだけで全員に共有し、会話をすべて会社の資産として残します。',
    '',
    '【はじめる前に（司会 or 最初の1人）】',
    '・右下「アクティビティ」→「メモを取る（Gemini）」を開始（言語＝日本語）',
    '・可能なら「録音」も開始',
    '',
    '【朝礼の進め方（5〜10分）】',
    '1. 今日の全体連絡（1分）',
    '2. 各自：今日やること・完了予定・困りごと（1人30秒）',
    '3. 安全/体調のひとこと',
    '4. 今日の一言（社長 or 司会）',
    '',
    '【終了時】メモが自動でメール送信され、当日中に「朝礼」資産へ自動集約されます。'
  ].join('\n')
};

/**
 * テンプレート差し込みを解決して本文文字列を返す。
 */
function renderTemplate_(meeting, mcName, carryover) {
  var t = TEMPLATES[meeting.templateKey] || '{{CARRYOVER}}';
  var mcLine = '';
  if (mcName) {
    mcLine = '🎤 本日の司会は ' + mcName + ' さんです。';
    if (meeting.mcRotation && meeting.mcRotation.length) {
      mcLine += '（司会順：' + meeting.mcRotation.join('→') + '）';
    }
  }
  return t
    .replace('{{MC}}', mcLine)
    .replace('{{CARRYOVER}}', carryover || '')
    .replace('{{INROOM}}', INROOM_GUIDE)
    .replace('{{DASHBOARD}}', DASHBOARD_URL)
    .replace('{{KANBU_DASHBOARD}}', KANBU_DASHBOARD_URL)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ======================================================================
// ===== Notes.gs
// ======================================================================

/**
 * Notes.gs — Gmailから Gemini会議メモ / 失敗通知 を収集して構造化する。
 *
 * 対象メール:
 *  - gemini-notes@google.com  … 成功メモ（件名「メモ: 「◯◯」（YYYY年M月D日）」）
 *  - meetings-noreply@google.com 件名「メモに関する問題: …」… 生成失敗
 *
 * 冪等化: 処理済みは Gmailラベル PROCESSED_LABEL を付けて二重処理を防ぐ。
 */

var PROCESSED_LABEL = '会議自動化/処理済み';
var LOOKBACK = 'newer_than:3d';

/**
 * 未処理の会議メモ通知を集めて配列で返す。
 * 各要素: { messageId, threadId, meetingRaw, dateStr, status:'ok'|'failed', summary, nextSteps, docUrl }
 */
function collectMeetingNotes_() {
  var label = getOrCreateLabel_(PROCESSED_LABEL);
  var out = [];

  var queries = [
    'from:gemini-notes@google.com ' + LOOKBACK + ' -label:"' + PROCESSED_LABEL + '"',
    'from:meetings-noreply@google.com subject:(メモに関する問題) ' + LOOKBACK + ' -label:"' + PROCESSED_LABEL + '"'
  ];

  queries.forEach(function (q) {
    var threads = GmailApp.search(q, 0, 50);
    threads.forEach(function (th) {
      th.getMessages().forEach(function (msg) {
        var from = msg.getFrom();
        var subject = msg.getSubject() || '';
        var isFailure = /メモに関する問題/.test(subject) || /meetings-noreply/.test(from);
        var isNote = /gemini-notes/.test(from) || /^メモ[:：]/.test(subject);
        if (!isFailure && !isNote) return;

        var parsed = parseNoteSubject_(subject);
        if (!parsed.name) return;

        var body = msg.getPlainBody() || '';
        out.push({
          messageId: msg.getId(),
          thread: th,
          meetingRaw: parsed.name,
          dateStr: parsed.dateStr,
          status: isFailure ? 'failed' : 'ok',
          summary: isFailure ? '' : extractSummary_(body),
          nextSteps: isFailure ? '' : extractNextSteps_(body),
          docUrl: isFailure ? '' : extractDocUrl_(msg.getBody() || body),
          failureReason: isFailure ? extractFailureReason_(body) : ''
        });
      });
      // スレッド単位で処理済みラベル
      th.addLabel(label);
    });
  });

  return out;
}

/** 件名 → { name, dateStr } */
function parseNoteSubject_(subject) {
  // 「メモ: 「工事部　朝MTG」（2026年8月10日）」 / 「メモに関する問題: 「施行管理部会」2026年8月7日」
  var name = '';
  var m = subject.match(/[「『](.+?)[」』]/);
  if (m) name = m[1];
  var d = subject.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  var dateStr = d ? (d[1] + '-' + pad2_(d[2]) + '-' + pad2_(d[3])) : '';
  return { name: name, dateStr: dateStr };
}

/** 本文から「概要」〜（次のステップ/フィードバックの手前）を抜く */
function extractSummary_(body) {
  var text = body.replace(/\r/g, '');
  var start = text.indexOf('概要');
  if (start === -1) return trimTo_(text, 1200);
  var rest = text.substring(start + 2);
  var stops = ['推奨される次のステップ', '次のステップ', '会議メモに関する', 'このメールの', '会議の記録', 'Google LLC'];
  var end = rest.length;
  stops.forEach(function (s) {
    var i = rest.indexOf(s);
    if (i !== -1 && i < end) end = i;
  });
  return cleanup_(rest.substring(0, end));
}

/** 「推奨される次のステップ」以下の項目を抜く */
function extractNextSteps_(body) {
  var text = body.replace(/\r/g, '');
  var i = text.indexOf('次のステップ');
  if (i === -1) return '';
  var rest = text.substring(i + 6);
  var stops = ['会議メモに関する', 'このメールの', '会議の記録', 'Google LLC'];
  var end = rest.length;
  stops.forEach(function (s) {
    var k = rest.indexOf(s);
    if (k !== -1 && k < end) end = k;
  });
  return cleanup_(rest.substring(0, end));
}

/** 会議メモDoc URL（docs.google.com/document/d/...） */
function extractDocUrl_(html) {
  var m = String(html).match(/https:\/\/docs\.google\.com\/document\/d\/[A-Za-z0-9_\-]+/);
  return m ? m[0] : '';
}

/** 失敗理由（言語不足など）を拾う。無ければ既定文。 */
function extractFailureReason_(body) {
  if (/言語/.test(body) && /不足/.test(body)) return 'サポートされている言語での会話量が不足';
  return 'Gemini側でメモ生成に失敗';
}

// ── ユーティリティ ──
function cleanup_(s) {
  return String(s)
    .split('\n')
    .map(function (l) { return l.trim(); })
    .filter(function (l) { return l && !/^[-–—]+$/.test(l); })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function trimTo_(s, n) { s = String(s); return s.length > n ? s.substring(0, n) + '…' : s; }
function pad2_(x) { x = String(x); return x.length < 2 ? '0' + x : x; }

function getOrCreateLabel_(name) {
  var lb = GmailApp.getUserLabelByName(name);
  return lb ? lb : GmailApp.createLabel(name);
}

// ======================================================================
// ===== CalendarSync.gs
// ======================================================================

/**
 * CalendarSync.gs — 次回の定例予定を見つけて、説明文（司会台本＋引き継ぎ）を書き込む。
 *
 * 必須: 拡張サービス「Google Calendar API (Advanced)」を有効化してください
 *       （エディタ左「サービス」→ Calendar を追加。識別子は Calendar）。
 */

/**
 * 1件の会議メモを、対応する次回予定へ反映する。
 * @return {Object} 反映結果ログ
 */
function applyNoteToNextEvent_(note) {
  var meeting = resolveMeeting_(note.meetingRaw);
  if (!meeting) {
    return { ok: false, reason: '会議レジストリに未登録: ' + note.meetingRaw };
  }

  var ev = findNextInstance_(meeting);
  if (!ev) {
    return { ok: false, reason: '次回予定が見つからない: ' + meeting.displayName };
  }

  var mcName = pickMc_(meeting, ev);
  var carryover = buildCarryover_(meeting, note);
  var body = renderTemplate_(meeting, mcName, carryover);

  // Advanced Calendar API で説明文を patch（HTML化して改行を保持）
  Calendar.Events.patch(
    { description: toHtml_(body) },
    PRIMARY_CALENDAR_ID,
    ev.id
  );

  return {
    ok: true,
    meeting: meeting.displayName,
    eventStart: ev.start.dateTime || ev.start.date,
    mc: mcName,
    status: note.status
  };
}

/** 次回（現在時刻以降）の最も近いインスタンスを返す。2系列ある会議は両方見て近い方。 */
function findNextInstance_(meeting) {
  var candidates = [];
  [meeting.recurringEventId, meeting.recurringEventIdAlt].forEach(function (rid) {
    if (!rid) return;
    var e = nextInstanceOfSeries_(rid);
    if (e) candidates.push(e);
  });

  // recurringEventId 不明な会議は summary で検索
  if (!candidates.length) {
    var e2 = nextInstanceBySummary_(meeting);
    if (e2) candidates.push(e2);
  }

  candidates.sort(function (a, b) {
    return startMs_(a) - startMs_(b);
  });
  return candidates[0] || null;
}

function nextInstanceOfSeries_(recurringEventId) {
  var now = new Date();
  var res = Calendar.Events.instances(PRIMARY_CALENDAR_ID, recurringEventId, {
    timeMin: now.toISOString(),
    maxResults: 5,
    orderBy: 'startTime',
    singleEvents: true
  });
  if (!res.items || !res.items.length) return null;
  // 進行中を避け、開始が未来の最初の1件
  for (var i = 0; i < res.items.length; i++) {
    if (startMs_(res.items[i]) > now.getTime()) return res.items[i];
  }
  return res.items[0];
}

function nextInstanceBySummary_(meeting) {
  var now = new Date();
  var later = new Date(now.getTime() + 21 * 24 * 3600 * 1000);
  var res = Calendar.Events.list(PRIMARY_CALENDAR_ID, {
    timeMin: now.toISOString(),
    timeMax: later.toISOString(),
    q: meeting.displayName.replace(/[　\s]/g, ' '),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 10
  });
  if (!res.items) return null;
  for (var i = 0; i < res.items.length; i++) {
    var it = res.items[i];
    if (resolveMeeting_(it.summary || '') &&
        resolveMeeting_(it.summary || '').key === meeting.key &&
        startMs_(it) > now.getTime()) {
      return it;
    }
  }
  return null;
}

/** 司会ローテから今回の司会を決める（Script Propertiesにポインタ保持）。 */
function pickMc_(meeting, ev) {
  if (!meeting.mcRotation || !meeting.mcRotation.length) return '';
  var props = PropertiesService.getScriptProperties();
  var pkey = 'MCIDX_' + meeting.key;
  var idx = parseInt(props.getProperty(pkey) || '0', 10);
  var name = meeting.mcRotation[idx % meeting.mcRotation.length];
  props.setProperty(pkey, String((idx + 1) % meeting.mcRotation.length));
  return name;
}

/** 前回議事録からの引き継ぎブロックを組み立てる（成功/失敗で分岐）。 */
function buildCarryover_(meeting, note) {
  if (note.status === 'failed') {
    return [
      '【重要｜前回（' + note.dateStr + '）のGemini議事録は取得失敗】',
      '理由：' + (note.failureReason || 'Gemini側でメモ生成に失敗') + '。個人目標・決定事項を自動取得できませんでした。',
      '',
      '【今回の冒頭で必ず回収】',
      (meeting.mcRotation && meeting.mcRotation.length
        ? meeting.mcRotation.join('→') + ' の順で、'
        : '') + '前回宣言した個人目標を口頭で再確認してください。',
      '確認形式：氏名｜前回目標｜達成・未達・継続｜新しい期限'
    ].join('\n');
  }

  // 成功時: LLM要約（任意）→ 無ければ抽出要約
  var summarized = summarizeForCarryover_(meeting, note);
  var lines = ['【' + note.dateStr + ' 前回議事録からの引き継ぎ】', summarized];
  if (note.docUrl) lines.push('（前回メモ全文：' + note.docUrl + '）');
  return lines.join('\n');
}

/** GEMINI_API_KEY があればLLM要約、無ければ概要＋次のステップの抽出要約。 */
function summarizeForCarryover_(meeting, note) {
  var raw = (note.summary || '') + (note.nextSteps ? ('\n次のステップ:\n' + note.nextSteps) : '');
  var llm = maybeLlmSummary_(meeting, raw);
  if (llm) return llm;

  var out = [];
  if (note.summary) out.push('・要点：' + firstLine_(note.summary));
  if (note.nextSteps) {
    note.nextSteps.split('\n').slice(0, 4).forEach(function (s) {
      if (s.trim()) out.push('・次アクション：' + s.trim());
    });
  }
  out.push('・冒頭で前回の個人目標（達成/未達/継続・新期限）を確認する。');
  return out.join('\n');
}

function firstLine_(s) { return String(s).split('\n')[0].trim(); }

// ── フォーマット補助 ──
function toHtml_(text) {
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .split('\n').map(function (l) { return '<p>' + l + '</p>'; }).join('');
}
function startMs_(ev) {
  var s = ev.start && (ev.start.dateTime || ev.start.date);
  return s ? new Date(s).getTime() : 0;
}

// ======================================================================
// ===== Assets.gs
// ======================================================================

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

// ======================================================================
// ===== Improve.gs
// ======================================================================

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

// ======================================================================
// ===== Llm.gs
// ======================================================================

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

// ======================================================================
// ===== Main.gs
// ======================================================================

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
