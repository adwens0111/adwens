/* ADWENS product-page widgets v3.3 (COORD + verified SIZEFIT) */
(function () {
  'use strict';
  var itemMatch = location.pathname.match(/^\/items\/(\d+)/);
  if (!itemMatch) return;


  var ITEM_ID = itemMatch[1];
  var GOLD = '#c9a227';
  var LINE_URL = 'https://l.omct.jp/2006632232-Ex9Ye0xv';
  var SIZEFIT_URL = 'https://adwens0111.github.io/adwens/sizefit.json';
  var RE_COORD = /\[COORD:([\d,\s]+)(?:\|([^\]]*))?\]/;
  var RE_FIT = /\[SIZEFIT:([^\]]+)\]/;
  var SIZE_MAP = { S: 'S', M: 'M', L: 'L', X: 'XL', '2': '2XL', '3': '3XL', A: 'XS', F: 'FREE' };


  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function yen(n) {
    return n ? ('\u00a5' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')) : '';
  }
  function findMarkers(re) {
    var out = [];
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    var n;
    while ((n = w.nextNode())) {
      if (n.parentNode && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName)) continue;
      if (re.test(n.nodeValue)) out.push(n);
    }
    return out;
  }
  function replaceMarker(node, mt, box) {
    var after = node.splitText(mt.index);
    after.nodeValue = after.nodeValue.slice(mt[0].length);
    node.parentNode.insertBefore(box, after);
  }


  /* ---------- COORD ---------- */
  function fetchItem(id) {
    var key = 'adwens_coord_' + id;
    var cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (e) {}
    if (cached) return Promise.resolve(cached);
    return fetch('/items/' + id, { credentials: 'same-origin' })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var d = new DOMParser().parseFromString(html, 'text/html');
        var meta = function (p) {
          var e = d.querySelector('meta[property="' + p + '"]');
          return e ? (e.getAttribute('content') || '') : '';
        };
        var it = {
          id: id,
          n: (meta('og:title') || '').split(' | ')[0].trim(),
          g: (meta('og:image') || '').replace(/&amp;/g, '&'),
          p: parseInt(meta('product:price:amount') || '0', 10) || 0
        };
        try { sessionStorage.setItem(key, JSON.stringify(it)); } catch (e) {}
        return it;
      });
  }
  function card(it) {
    return '<a href="/items/' + it.id + '" style="width:48%;text-decoration:none;color:inherit;display:block;">'
      + (it.g ? '<img src="' + esc(it.g) + '" alt="' + esc(it.n) + '" loading="lazy" style="width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:2px;display:block;background:#111;">' : '')
      + '<p style="font-size:11px;margin:6px 0 0;color:#ccc;line-height:1.3;">' + esc(it.n) + '</p>'
      + '<p style="font-size:12px;font-weight:bold;color:' + GOLD + ';margin:2px 0 0;">' + yen(it.p) + '</p></a>';
  }
  function renderCoord(node) {
    var mt = node.nodeValue.match(RE_COORD);
    if (!mt) return;
    var ids = mt[1].split(',').map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 2);
    var head = (mt[2] || '').trim() || '\u25a0 このアイテムに合わせるなら';
    var box = document.createElement('div');
    box.setAttribute('data-adwens-coord', '');
    box.style.cssText = 'margin:24px 0;padding-top:16px;border-top:1px solid #333;';
    box.innerHTML = '<p style="font-weight:bold;font-size:14px;margin:0 0 12px;letter-spacing:1px;">' + esc(head) + '</p><div style="display:flex;gap:10px;justify-content:space-between;"></div>';
    replaceMarker(node, mt, box);
    var row = box.lastChild;
    Promise.all(ids.map(function (id) {
      return fetchItem(id).catch(function () { return { id: id, n: '商品ページを見る', g: '', p: 0 }; });
    })).then(function (items) { row.innerHTML = items.map(card).join(''); });
  }


  /* ---------- SIZEFIT ---------- */
  function normalizeFit(raw) {
    if (!raw) return null;
    var fit = {
      H: Array.isArray(raw.H) ? raw.H.map(Number).filter(function (x) { return !isNaN(x); }) : [],
      W: Array.isArray(raw.W) ? raw.W.map(Number).filter(function (x) { return !isNaN(x); }) : [],
      G: Array.isArray(raw.G) ? raw.G.map(function (r) { return String(r).trim(); }) : [],
      N: raw.N ? String(raw.N) : '',
      R: String(raw.R || 'H').toUpperCase() === 'W' ? 'W' : 'H'
    };
    if (!fit.H.length || !fit.W.length) return null;
    if (fit.R === 'W') {
      if (fit.G.length !== fit.W.length) return null;
      var transposed = [];
      for (var i = 0; i < fit.H.length; i++) {
        var row = '';
        for (var j = 0; j < fit.W.length; j++) row += (fit.G[j] || '').charAt(i) || ' ';
        transposed.push(row);
      }
      fit.G = transposed;
    }
    if (fit.G.length !== fit.H.length) return null;
    for (var k = 0; k < fit.G.length; k++) {
      if (fit.G[k].length !== fit.W.length) return null;
      for (var q = 0; q < fit.G[k].length; q++) {
        if (!SIZE_MAP[fit.G[k].charAt(q)]) return null;
      }
    }
    return fit;
  }
  function parseFitMarker(src) {
    var raw = { H: [], W: [], G: [], N: '', R: 'H' };
    src.split('|').forEach(function (part) {
      var i = part.indexOf('=');
      if (i < 0) return;
      var key = part.slice(0, i).trim();
      var value = part.slice(i + 1).trim();
      if (key === 'H' || key === 'W') raw[key] = value.split(',');
      else if (key === 'G') raw.G = value.split(',');
      else if (key === 'N' || key === 'R') raw[key] = value;
    });
    return normalizeFit(raw);
  }
  function nearest(arr, value) {
    var best = 0;
    var distance = Infinity;
    for (var i = 0; i < arr.length; i++) {
      var d = Math.abs(arr[i] - value);
      if (d < distance) { distance = d; best = i; }
    }
    return best;
  }
  function cell(fit, row, col) {
    return SIZE_MAP[(fit.G[row] || '').charAt(col)] || '';
  }
  function buildFitBox(fit) {
    var box = document.createElement('div');
    box.setAttribute('data-adwens-sizefit', '');
    box.style.cssText = 'margin:24px 0;padding:16px 14px;border:1px solid #333;';
    box.innerHTML = '<p style="font-weight:bold;font-size:14px;margin:0 0 4px;letter-spacing:1px;">\u25a0 あなたのおすすめサイズを診断</p>'
      + (fit.N ? '<p style="font-size:11px;color:#999;margin:0 0 12px;">' + esc(fit.N) + '</p>' : '<div style="height:8px"></div>')
      + '<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;">'
      + '<label style="flex:1;min-width:90px;font-size:11px;color:#bbb;">身長(cm)<input type="number" inputmode="numeric" min="130" max="220" placeholder="175" style="display:block;width:100%;margin-top:4px;padding:10px;font-size:16px;border:1px solid #444;background:#111;color:#fff;box-sizing:border-box;"></label>'
      + '<label style="flex:1;min-width:90px;font-size:11px;color:#bbb;">体重(kg)<input type="number" inputmode="numeric" min="30" max="160" placeholder="65" style="display:block;width:100%;margin-top:4px;padding:10px;font-size:16px;border:1px solid #444;background:#111;color:#fff;box-sizing:border-box;"></label>'
      + '<button type="button" style="flex:1 1 100%;padding:12px;background:' + GOLD + ';color:#0d0d0d;border:0;font-weight:bold;font-size:14px;letter-spacing:.06em;cursor:pointer;">診断する</button>'
      + '</div><div data-out style="margin-top:12px;"></div>';
    var inputs = box.querySelectorAll('input');
    var out = box.querySelector('[data-out]');
    function diagnose() {
      var h = parseFloat(inputs[0].value);
      var w = parseFloat(inputs[1].value);
      if (!h || !w) {
        out.innerHTML = '<p style="font-size:12px;color:#e0b0b0;margin:0;">身長と体重を入力してください</p>';
        return;
      }
      var ri = nearest(fit.H, h);
      var ci = nearest(fit.W, w);
      var main = cell(fit, ri, ci);
      if (!main) { out.innerHTML = ''; return; }
      var tips = [];
      var up = ri + 1 < fit.H.length ? cell(fit, ri + 1, ci) : '';
      var down = ri > 0 ? cell(fit, ri - 1, ci) : '';
      if (up && up !== main) tips.push('ゆったり履きたい方は <b style="color:' + GOLD + '">' + up + '</b>');
      if (down && down !== main) tips.push('タイトに履きたい方は <b style="color:' + GOLD + '">' + down + '</b>');
      out.innerHTML = '<div style="position:relative;padding:36px 12px 12px;background:#111;border-left:3px solid ' + GOLD + ';">'
        + '<button type="button" data-sizefit-close aria-label="診断結果を閉じる" style="position:absolute;top:7px;right:8px;width:28px;height:28px;padding:0;border:1px solid #555;border-radius:50%;background:transparent;color:#ddd;font-size:20px;line-height:24px;cursor:pointer;">×</button>'
        + '<p style="margin:0;font-size:12px;color:#bbb;">身長 ' + h + 'cm / 体重 ' + w + 'kg のおすすめ</p>'
        + '<p style="margin:4px 0 0;font-size:26px;font-weight:bold;color:' + GOLD + ';letter-spacing:.05em;">' + main + '<span style="font-size:13px;color:#fff;margin-left:6px;">サイズ</span></p>'
        + (tips.length ? '<p style="margin:8px 0 0;font-size:12px;color:#ccc;line-height:1.6;">' + tips.join('<br>') + '</p>' : '')
        + '<p style="margin:10px 0 0;font-size:11px;color:#999;">※目安です。個体差があります。迷ったら <a href="' + LINE_URL + '" target="_blank" rel="noopener" style="color:' + GOLD + ';">LINEでサイズ相談（初回5%OFF）</a></p></div>';
      var closeButton = out.querySelector('[data-sizefit-close]');
      if (closeButton) closeButton.addEventListener('click', function () { out.innerHTML = ''; });
    }
    box.querySelector('button').addEventListener('click', diagnose);
    inputs[1].addEventListener('keydown', function (e) { if (e.key === 'Enter') diagnose(); });
    return box;
  }
  function placeFitBox(box) {
    var variation = document.querySelector('#variationSelectWrap');
    if (variation && variation.parentNode) {
      variation.parentNode.insertBefore(box, variation);
      return;
    }
    var purchaseForm = document.querySelector('.x_purchaseForm');
    if (purchaseForm) {
      purchaseForm.insertBefore(box, purchaseForm.firstChild);
      return;
    }
    var fallback = document.querySelector('.item-description') || document.querySelector('main') || document.body;
    fallback.appendChild(box);
  }
  function renderFitMarker(node) {
    var mt = node.nodeValue.match(RE_FIT);
    if (!mt) return;
    var markerFit = parseFitMarker(mt[1]);
    var box = markerFit ? buildFitBox(markerFit) : document.createElement('span');
    replaceMarker(node, mt, box);
    placeFitBox(box);
    fetch(SIZEFIT_URL, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('sizefit ' + r.status); return r.json(); })
      .then(function (data) {
        var verifiedFit = data && data[ITEM_ID] ? normalizeFit(data[ITEM_ID]) : null;
        if (!verifiedFit || !box.parentNode) return;
        var verifiedBox = buildFitBox(verifiedFit);
        box.parentNode.replaceChild(verifiedBox, box);
      })
      .catch(function () {});
  }
  function insertAutoFit(raw) {
    if (document.querySelector('[data-adwens-sizefit]') || findMarkers(RE_FIT).length) return;
    var fit = normalizeFit(raw);
    if (!fit) return;
    placeFitBox(buildFitBox(fit));
  }
  function loadVerifiedFit() {
    if (document.querySelector('[data-adwens-sizefit]') || findMarkers(RE_FIT).length) return;
    fetch(SIZEFIT_URL, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('sizefit ' + r.status); return r.json(); })
      .then(function (data) { if (data && data[ITEM_ID]) insertAutoFit(data[ITEM_ID]); })
      .catch(function () {});
  }


  var busy = false;
  function run() {
    if (busy || !document.body) return;
    busy = true;
    try {
      findMarkers(RE_COORD).forEach(renderCoord);
      findMarkers(RE_FIT).forEach(renderFitMarker);
    } finally { busy = false; }
  }
  function start() {
    run();
    loadVerifiedFit();
    var mo = new MutationObserver(function () { run(); });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    var tries = 0;
    var timer = setInterval(function () { run(); if (++tries >= 10) clearInterval(timer); }, 1000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();