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
