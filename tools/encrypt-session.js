'use strict';

/**
 * encrypt-session.js — 配布指示（data/sessions/ID.json）の暗号化
 *
 * 公開リポジトリ・GitHub Pages に平文の担当エリアや禁止物件（個人名・住所）を
 * 置かないための形式。鍵はリンクの # 以降にだけ入り、サーバーには送られない。
 *
 * 使い方（Node 18+）:
 *   node tools/encrypt-session.js 平文.json [セッションID]
 *   → data/sessions/ID.json に暗号文を書き出し、配布用リンクを表示する
 *
 * ブラウザ側の作成ツールからは encryptSession() をそのまま使える（WebCrypto のみ）。
 *
 * 出力形式:
 *   data/sessions/ID.json = {"v":2,"alg":"A256GCM","iv":"base64url","ct":"base64url"}
 *   リンク               = https://admax-tools.github.io/setai-viewer-/?s=ID#k=鍵(base64url)
 */

var BASE_URL = 'https://admax-tools.github.io/setai-viewer-/';

function bytesToB64url(bytes) {
  var bin = '';
  for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomId(len) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var bytes = crypto.getRandomValues(new Uint8Array(len));
  var out = '';
  for (var i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

// session: {mode, staffName, pref, d, kinshi, pw?} → {file: 暗号文オブジェクト, key: 鍵文字列}
async function encryptSession(session) {
  var raw = crypto.getRandomValues(new Uint8Array(32));
  var iv = crypto.getRandomValues(new Uint8Array(12));
  var key = await crypto.subtle.importKey('raw', raw, {name: 'AES-GCM'}, false, ['encrypt']);
  var plain = new TextEncoder().encode(JSON.stringify(session));
  var ct = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv: iv}, key, plain));
  return {
    file: {v: 2, alg: 'A256GCM', iv: bytesToB64url(iv), ct: bytesToB64url(ct)},
    key: bytesToB64url(raw)
  };
}

function sessionUrl(id, key) {
  return BASE_URL + '?s=' + encodeURIComponent(id) + '#k=' + key;
}

if (typeof module !== 'undefined') module.exports = {encryptSession: encryptSession, sessionUrl: sessionUrl, randomId: randomId};

if (typeof require !== 'undefined' && require.main === module) {
  var fs = require('fs');
  var path = require('path');
  var src = process.argv[2];
  if (!src) { console.error('使い方: node tools/encrypt-session.js 平文.json [セッションID]'); process.exit(1); }
  var id = process.argv[3] || randomId(8);
  var session = JSON.parse(fs.readFileSync(src, 'utf8'));
  encryptSession(session).then(function(r) {
    var out = path.join(__dirname, '..', 'data', 'sessions', id + '.json');
    fs.writeFileSync(out, JSON.stringify(r.file) + '\n');
    console.log('書き出し: ' + path.relative(process.cwd(), out));
    console.log('リンク:   ' + sessionUrl(id, r.key));
  });
}
