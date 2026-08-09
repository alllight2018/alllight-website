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
