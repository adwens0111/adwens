/* ADWENS product-page widgets v3.14 (independent COORD loading + placement) */
(function () {
  'use strict';
  var itemMatch = location.pathname.match(/^\/items\/(\d+)/);
  if (!itemMatch) return;

  var ITEM_ID = itemMatch[1];
  var GOLD = '#c9a227';
  var LINE_URL = 'https://l.omct.jp/2006632232-Ex9Ye0xv';
  var SIZEFIT_URLS = [
    'https://raw.githubusercontent.com/adwens0111/adwens/main/sizefit.json',
    'https://adwens0111.github.io/adwens/sizefit.json'
  ];
  var BUILTIN_SIZEFIT = {
    '88671936': {
      H: [160,165,170,175,180,185,190],
      W: [50,55,60,65,70,75,80,85,90,95,100],
      R: 'H',
      G: ['SSSMMMMMMMM','SSSMMMMMMMM','MMMMMLLLLLL','LLLLLLLXXXX','XXXXXXXXX22','22222222222','22222222222'],
      N: '細身の作りです。身長と体重の両方を基準にお選びください。',
      O: [
        {HMIN:160,HMAX:169,WMIN:57,WMAX:70,S:'L'},
        {HMIN:160,HMAX:169,WMIN:71,WMAX:75,S:'XL'},
        {HMIN:160,HMAX:169,WMIN:76,S:'2XL'},
        {HMIN:170,HMAX:179,WMIN:57,WMAX:69,S:'L'},
        {HMIN:170,HMAX:179,WMIN:70,WMAX:75,S:'XL'},
        {HMIN:185,HMAX:190,WMAX:55,S:'L'},
        {HMIN:185,HMAX:190,WMIN:56,WMAX:64,S:'XL'},
        {HMIN:160,HMAX:174,WMAX:56,S:'S'}
      ]
    },
    '157501327': {
      H: [165,170,175,180,185],
      W: [60,70.5,80.5,90.5],
      R: 'H',
      G: ['SMLL','SMLL','SMLL','SMLL','MLLL'],
      N: '細身の作りです。ゆったり着たい方は1サイズアップがおすすめです。'
    }
  };

  var RE_COORD = /\[COORD:([\d,\s]+)(?:\|([^|\]]*))?((?:\|[^\]]*)?)\]/;
  var RE_FIT = /\[SIZEFIT:([^\]]+)\]/;
  var SIZE_MAP = {
    S: 'S', M: 'M', L: 'L', X: 'XL',
    '2': '2XL', '3': '3XL', A: 'XS', F: 'FREE'
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;'
      }[c];
    });
  }

  function yen(n) {
    return n
      ? ('\u00a5' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','))
      : '';
  }

  function findMarkers(re) {
    var out = [];
    var walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    var node;

    while ((node = walker.nextNode())) {
      if (
        node.parentNode &&
        /^(SCRIPT|STYLE|TEXTAREA)$/.test(node.parentNode.nodeName)
      ) {
        continue;
      }
      if (re.test(node.nodeValue)) out.push(node);
    }

    return out;
  }

  function replaceMarker(node, match, box) {
    var after = node.splitText(match.index);
    after.nodeValue = after.nodeValue.slice(match[0].length);
    node.parentNode.insertBefore(box, after);
  }

  /* おすすめコーデ */
  var itemRequests = {};

  function fetchItem(id) {
    var key = 'adwens_coord_' + id;
    var cached = null;

    try {
      cached = JSON.parse(sessionStorage.getItem(key) || 'null');
    } catch (e) {}

    if (cached && cached.n && cached.g) {
      return Promise.resolve(cached);
    }

    if (itemRequests[id]) return itemRequests[id];

    var controller = new AbortController();
    var timeout = setTimeout(function () {
      controller.abort();
    }, 12000);

    var request = fetch('/items/' + id, {
      credentials: 'same-origin',
      signal: controller.signal
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('商品取得 HTTP ' + response.status);
        }
        return response.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');

        function meta(property) {
          var element = doc.querySelector(
            'meta[property="' + property + '"]'
          );
          return element ? element.getAttribute('content') || '' : '';
        }

        var item = {
          id: id,
          n: (meta('og:title') || '').split(' | ')[0].trim(),
          g: (meta('og:image') || '').replace(/&amp;/g, '&'),
          p: parseInt(meta('product:price:amount') || '0', 10) || 0
        };

        if (!item.n || !item.g) {
          throw new Error('商品情報を読み取れませんでした');
        }

        try {
          sessionStorage.setItem(key, JSON.stringify(item));
        } catch (e) {}

        return item;
      });

    itemRequests[id] = request.then(
      function (item) {
        clearTimeout(timeout);
        delete itemRequests[id];
        return item;
      },
      function (error) {
        clearTimeout(timeout);
        delete itemRequests[id];
        throw error;
      }
    );

    return itemRequests[id];
  }

  function parseCoordCrops(source) {
    var empty = { t: 0, r: 0, b: 0, l: 0, z: 100 };
    if (!source) return [empty, empty];

    return source.split(';').slice(0, 2).map(function (part) {
      var values = part.split(',').map(Number);
      var crop = {
        t: isFinite(values[0])
          ? Math.max(0, Math.min(45, values[0])) : 0,
        r: isFinite(values[1])
          ? Math.max(0, Math.min(45, values[1])) : 0,
        b: isFinite(values[2])
          ? Math.max(0, Math.min(45, values[2])) : 0,
        l: isFinite(values[3])
          ? Math.max(0, Math.min(45, values[3])) : 0,
        z: isFinite(values[4])
          ? Math.max(100, Math.min(250, values[4])) : 100
      };

      if (crop.l + crop.r > 80) crop.r = 80 - crop.l;
      if (crop.t + crop.b > 80) crop.b = 80 - crop.t;

      return crop;
    }).concat([empty, empty]).slice(0, 2);
  }

  function cropStyle(crop) {
    crop = crop || { t: 0, r: 0, b: 0, l: 0, z: 100 };

    var rw = Math.max(20, 100 - crop.l - crop.r) / 100;
    var rh = Math.max(20, 100 - crop.t - crop.b) / 100;
    var scale = Math.max(1 / rw, 1 / rh) * (crop.z / 100);
    var cx = crop.l + (100 - crop.l - crop.r) / 2;
    var cy = crop.t + (100 - crop.t - crop.b) / 2;

    return 'width:100%;height:100%;object-fit:cover;display:block;' +
      'transform:scale(' + scale.toFixed(4) + ');' +
      'transform-origin:' + cx.toFixed(2) + '% ' +
      cy.toFixed(2) + '%;';
  }

  function card(item, crop) {
    return '<a href="/items/' + item.id +
      '" style="width:48%;text-decoration:none;color:inherit;display:block;">' +
      (
        item.g
          ? '<span style="width:100%;aspect-ratio:1/1;overflow:hidden;' +
            'border-radius:2px;display:block;background:#111;">' +
            '<img src="' + esc(item.g) + '" alt="' + esc(item.n) +
            '" loading="lazy" style="' + cropStyle(crop) + '"></span>'
          : ''
      ) +
      '<p style="font-size:11px;margin:6px 0 0;color:#ccc;line-height:1.3;">' +
      esc(item.n) + '</p>' +
      '<p style="font-size:12px;font-weight:bold;color:' + GOLD +
      ';margin:2px 0 0;">' + yen(item.p) + '</p></a>';
  }

  function renderCoord(node) {
    var match = node.nodeValue.match(RE_COORD);
    if (!match) return;

    var ids = match[1].split(',').map(function (value) {
      return value.trim();
    }).filter(Boolean).slice(0, 2);

    var heading = (match[2] || '').trim() ||
      '\u25a0 このアイテムに合わせるなら';

    var options = match[3] || '';
    var cropMatch = options.match(/(?:^|\|)C=([^|]*)/);
    var crops = parseCoordCrops(cropMatch ? cropMatch[1] : '');
    var imageMatch = options.match(/(?:^|\|)I=([^|]*)/);

    var box = document.createElement('div');
    box.setAttribute('data-adwens-coord', '');
    box.style.cssText =
      'margin:24px 0;padding-top:16px;border-top:1px solid #333;';

    box.innerHTML =
      '<p style="font-weight:bold;font-size:14px;margin:0 0 12px;' +
      'letter-spacing:1px;">' + esc(heading) + '</p>' +
      '<div style="display:flex;gap:10px;justify-content:space-between;"></div>';

    replaceMarker(node, match, box);
    var row = box.lastChild;

    if (
      imageMatch &&
      /^https:\/\/(?:adwens0111\.github\.io\/adwens\/|raw\.githubusercontent\.com\/adwens0111\/adwens\/)/i.test(imageMatch[1])
    ) {
      var figure = document.createElement('div');
      figure.setAttribute('data-adwens-coord-image', '');
      figure.style.cssText = 'margin:18px 0 0;';

      var image = document.createElement('img');
      image.src = imageMatch[1];
      image.alt = 'このアイテムを使ったおすすめコーデ';
      image.loading = 'lazy';
      image.style.cssText =
        'display:block;width:100%;height:auto;max-width:100%;';

      image.addEventListener('error', function () {
        figure.style.display = 'none';
      });

      figure.appendChild(image);
      box.appendChild(figure);
    }

    ids.forEach(function (id, index) {
      var slot = document.createElement('div');
      slot.style.cssText = 'width:48%;min-width:0;';
      row.appendChild(slot);

      var attempts = 0;

      function loadCard() {
        attempts++;

        slot.innerHTML =
          '<a href="/items/' + id +
          '" style="color:inherit;">商品ページを見る</a>' +
          '<p role="status" style="font-size:11px;">' +
          '商品情報を読み込み中…</p>';

        fetchItem(id).then(function (item) {
          slot.innerHTML = card(item, crops[index]);
          slot.firstElementChild.style.width = '100%';
          placeCoord();
        }).catch(function () {
          if (attempts < 3) {
            setTimeout(loadCard, attempts * 1000);
            return;
          }

          slot.innerHTML =
            '<a href="/items/' + id +
            '" style="color:inherit;">商品ページを見る</a>' +
            '<p style="font-size:11px;">読み込みできませんでした。</p>' +
            '<button type="button">再読み込み</button>';

          slot.querySelector('button').onclick = function () {
            attempts = 0;
            loadCard();
          };
        });
      }

      loadCard();
    });

    placeCoord();
  }

  function placeCoord() {
    var fit = document.querySelector('[data-adwens-sizefit]');
    if (!fit || !fit.parentNode) return;

    var anchor = fit;

    Array.from(
      document.querySelectorAll('[data-adwens-coord]')
    ).forEach(function (box) {
      if (anchor.nextSibling !== box) {
        anchor.parentNode.insertBefore(box, anchor.nextSibling);
      }
      anchor = box;
    });
  }

  /* おすすめサイズ診断 */
  function normalizeFit(raw) {
    if (!raw) return null;

    var fit = {
      H: Array.isArray(raw.H)
        ? raw.H.map(Number).filter(function (x) {
            return !isNaN(x);
          }) : [],
      W: Array.isArray(raw.W)
        ? raw.W.map(Number).filter(function (x) {
            return !isNaN(x);
          }) : [],
      G: Array.isArray(raw.G)
        ? raw.G.map(function (row) {
            return String(row).trim();
          }) : [],
      N: raw.N ? String(raw.N) : '',
      R: String(raw.R || 'H').toUpperCase() === 'W' ? 'W' : 'H',
      O: Array.isArray(raw.O) ? raw.O : [],
      I: raw.I ? String(raw.I) : (raw.IMG ? String(raw.IMG) : '')
    };

    if (!fit.H.length || !fit.W.length) return null;

    if (fit.R === 'W') {
      if (fit.G.length !== fit.W.length) return null;

      var transposed = [];

      for (var i = 0; i < fit.H.length; i++) {
        var row = '';
        for (var j = 0; j < fit.W.length; j++) {
          row += (fit.G[j] || '').charAt(i) || ' ';
        }
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

  function parseFitMarker(source) {
    var raw = { H: [], W: [], G: [], N: '', R: 'H' };

    source.split('|').forEach(function (part) {
      var index = part.indexOf('=');
      if (index < 0) return;

      var key = part.slice(0, index).trim();
      var value = part.slice(index + 1).trim();

      if (key === 'H' || key === 'W') {
        raw[key] = value.split(',');
      } else if (key === 'G') {
        raw.G = value.split(',');
      } else if (
        key === 'N' || key === 'R' ||
        key === 'I' || key === 'IMG'
      ) {
        raw[key] = value;
      }
    });

    return normalizeFit(raw);
  }

  function plusTwoBucket(array, value) {
    var index = 0;

    for (var i = 0; i < array.length - 1; i++) {
      if (value >= array[i] + 2) index = i + 1;
      else break;
    }

    return index;
  }

  function cell(fit, row, column) {
    return SIZE_MAP[(fit.G[row] || '').charAt(column)] || '';
  }

  function publicFitNote(note) {
    note = String(note || '').trim();
    if (!note) return '';

    if (
      /Codex could not|No such file|os error|身長見出し|体重見出し|体重列|weights|実寸|推奨サイズ早見表/i.test(note)
    ) {
      return '';
    }

    if (note.length > 90) return note.slice(0, 87) + '...';
    return note;
  }

  function buildFitBox(fit) {
    var box = document.createElement('div');
    var note = publicFitNote(fit.N);

    box.setAttribute('data-adwens-sizefit', '');
    box.style.cssText =
      'margin:24px 0;padding:16px 14px;border:1px solid #333;';

    box.innerHTML =
      '<p style="font-weight:bold;font-size:14px;margin:0 0 4px;' +
      'letter-spacing:1px;">\u25a0 あなたのおすすめサイズを診断</p>' +
      (
        note
          ? '<p style="font-size:11px;color:#999;margin:0 0 12px;">' +
            esc(note) + '</p>'
          : '<p style="font-size:11px;color:#999;margin:0 0 12px;">' +
            '身長と体重を入力すると、おすすめサイズを診断できます。</p>'
      ) +
      '<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;">' +
      '<label style="flex:1;min-width:90px;font-size:11px;color:#bbb;">' +
      '身長(cm)<input type="number" inputmode="numeric" min="130" max="220"' +
      ' placeholder="175" style="display:block;width:100%;margin-top:4px;' +
      'padding:10px;font-size:16px;border:1px solid #444;background:#111;' +
      'color:#fff;box-sizing:border-box;"></label>' +
      '<label style="flex:1;min-width:90px;font-size:11px;color:#bbb;">' +
      '体重(kg)<input type="number" inputmode="numeric" min="30" max="160"' +
      ' placeholder="65" style="display:block;width:100%;margin-top:4px;' +
      'padding:10px;font-size:16px;border:1px solid #444;background:#111;' +
      'color:#fff;box-sizing:border-box;"></label>' +
      '<button type="button" style="flex:1 1 100%;padding:12px;background:' +
      GOLD + ';color:#0d0d0d;border:0;font-weight:bold;font-size:14px;' +
      'letter-spacing:.06em;cursor:pointer;">診断する</button>' +
      '</div><div data-out style="margin-top:12px;"></div>';

    var inputs = box.querySelectorAll('input');
    var out = box.querySelector('[data-out]');

    function diagnose() {
      var height = parseFloat(inputs[0].value);
      var weight = parseFloat(inputs[1].value);

      if (!height || !weight) {
        out.innerHTML =
          '<p style="font-size:12px;color:#e0b0b0;margin:0;">' +
          '身長と体重を入力してください</p>';
        return;
      }

      var ri = plusTwoBucket(fit.H, height);
      var ci = plusTwoBucket(fit.W, weight);
      var main = cell(fit, ri, ci);

      for (var oi = 0; oi < fit.O.length; oi++) {
        var override = fit.O[oi] || {};

        if (
          (override.HMIN == null || height >= Number(override.HMIN)) &&
          (override.HMAX == null || height <= Number(override.HMAX)) &&
          (override.WMIN == null || weight >= Number(override.WMIN)) &&
          (override.WMAX == null || weight <= Number(override.WMAX)) &&
          override.S
        ) {
          main = String(override.S);
        }
      }

      if (!main) {
        out.innerHTML = '';
        return;
      }

      var tips = [];
      var up = ri + 1 < fit.H.length ? cell(fit, ri + 1, ci) : '';
      var down = ri > 0 ? cell(fit, ri - 1, ci) : '';

      if (up && up !== main) {
        tips.push(
          'ゆったり着たい方は <b style="color:' +
          GOLD + '">' + up + '</b>'
        );
      }

      if (down && down !== main) {
        tips.push(
          'タイトに着たい方は <b style="color:' +
          GOLD + '">' + down + '</b>'
        );
      }

      out.innerHTML =
        '<div style="position:relative;padding:12px 36px 12px 12px;' +
        'background:#111;border-left:3px solid ' + GOLD + ';">' +
        '<button type="button" data-sizefit-close aria-label="診断結果を閉じる"' +
        ' style="position:absolute;right:8px;top:6px;border:0;' +
        'background:transparent;color:#bbb;font-size:22px;line-height:1;' +
        'cursor:pointer;">&times;</button>' +
        '<p style="margin:0;font-size:12px;color:#bbb;">身長 ' +
        height + 'cm / 体重 ' + weight + 'kg のおすすめ</p>' +
        '<p style="margin:4px 0 0;font-size:26px;font-weight:bold;color:' +
        GOLD + ';letter-spacing:.05em;">' + main +
        '<span style="font-size:13px;color:#fff;margin-left:6px;">' +
        'サイズ</span></p>' +
        (
          tips.length
            ? '<p style="margin:8px 0 0;font-size:12px;color:#ccc;' +
              'line-height:1.6;">' + tips.join('<br>') + '</p>'
            : ''
        ) +
        '<p style="margin:10px 0 0;font-size:11px;color:#999;">' +
        '※目安です。個体差があります。迷ったら <a href="' +
        LINE_URL + '" target="_blank" rel="noopener" style="color:' +
        GOLD + ';">LINEでサイズ相談（初回5%OFF）</a></p></div>';

      out.querySelector('[data-sizefit-close]').addEventListener(
        'click',
        function () {
          out.innerHTML = '';
        }
      );
    }

    box.querySelector('button').addEventListener('click', diagnose);

    inputs[1].addEventListener('keydown', function (event) {
      if (event.key === 'Enter') diagnose();
    });

    return box;
  }

  function buildSizeGuideImage(fit) {
    if (!fit.I) return null;

    var box = document.createElement('div');
    box.setAttribute('data-adwens-sizeguide', '');
    box.style.cssText = 'margin:24px 0 0;';

    box.innerHTML =
      '<p style="font-weight:bold;font-size:14px;margin:0 0 10px;' +
      'letter-spacing:1px;">\u25a0 サイズ表</p>' +
      '<img src="' + esc(fit.I) + '" alt="サイズ表" loading="lazy"' +
      ' style="display:block;width:100%;height:auto;background:#111;' +
      'border:1px solid #333;box-sizing:border-box;">';

    return box;
  }

  function buildFitBlock(fit) {
    var form = buildFitBox(fit);
    var guide = buildSizeGuideImage(fit);
    if (!guide) return form;

    var wrap = document.createElement('div');
    wrap.setAttribute('data-adwens-sizefit', '');
    wrap.style.cssText = 'margin:24px 0;';

    form.removeAttribute('data-adwens-sizefit');
    form.style.margin = '16px 0 0';

    wrap.appendChild(guide);
    wrap.appendChild(form);

    return wrap;
  }

  function renderFitMarker(node) {
    var match = node.nodeValue.match(RE_FIT);
    if (!match) return;

    var fit = parseFitMarker(match[1]);
    var box = fit
      ? buildFitBlock(fit)
      : document.createElement('span');

    replaceMarker(node, match, box);
  }

  function insertAutoFit(raw) {
    if (
      document.querySelector('[data-adwens-sizefit]') ||
      findMarkers(RE_FIT).length
    ) {
      return;
    }

    var fit = normalizeFit(raw);
    var guide =
      !document.querySelector('[data-adwens-sizeguide]') &&
      buildSizeGuideImage(raw || {});

    var description = document.querySelector(
      '.item-description > .text.markdown'
    );

    if (guide && description) description.appendChild(guide);
    if (!fit) return;

    var box = buildFitBox(fit);

    if (guide && !description) box.appendChild(guide);

    var price = document.querySelector('.item-detail-main > .price');

    if (price && price.parentNode) {
      price.parentNode.insertBefore(box, price.nextSibling);
      return;
    }

    var walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    var node;

    while ((node = walker.nextNode())) {
      if (/SIZE\s*GUIDE/i.test(node.nodeValue || '')) {
        var anchor = node.parentElement;

        while (
          anchor &&
          anchor.parentElement &&
          !/^(DIV|SECTION|P|H[1-6])$/.test(anchor.tagName)
        ) {
          anchor = anchor.parentElement;
        }

        if (anchor && anchor.parentNode) {
          anchor.parentNode.insertBefore(box, anchor);
          return;
        }
      }
    }

    var fallback = document.querySelector('main') || document.body;
    fallback.appendChild(box);
  }

  function fetchFitJson(index) {
    if (index >= SIZEFIT_URLS.length) {
      return Promise.reject(new Error('sizefit unavailable'));
    }

    return fetch(
      SIZEFIT_URLS[index] + '?v=311-' + Date.now(),
      { cache: 'no-store' }
    )
      .then(function (response) {
        if (!response.ok) throw new Error('sizefit ' + response.status);
        return response.json();
      })
      .catch(function () {
        return fetchFitJson(index + 1);
      });
  }

  var fitLoadStarted = false;

  function loadVerifiedFit() {
    if (
      document.querySelector('[data-adwens-sizefit]') ||
      findMarkers(RE_FIT).length
    ) {
      return;
    }

    if (fitLoadStarted) return;
    fitLoadStarted = true;

    fetchFitJson(0)
      .then(function (data) {
        var fit = data && data[ITEM_ID] || BUILTIN_SIZEFIT[ITEM_ID];
        if (fit) insertAutoFit(fit);
      })
      .catch(function () {
        if (BUILTIN_SIZEFIT[ITEM_ID]) {
          insertAutoFit(BUILTIN_SIZEFIT[ITEM_ID]);
        }
      });
  }

  /* LINE案内 */
  var RE_LINE = /［LINEでサイズを相談する］[ \t]*https:\/\/l\.omct\.jp\/2006632232-Ex9Ye0xv/;

  function renderLine(node) {
    var match = node.nodeValue.match(RE_LINE);
    if (!match) return;

    var link = document.createElement('a');
    link.href = LINE_URL;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'LINEでサイズを相談する';
    link.setAttribute('data-adwens-line', '');

    link.style.cssText =
      'display:inline-block;margin:8px 0 12px;padding:10px 16px;' +
      'border:1px solid #06c755;border-radius:5px;color:#fff;' +
      'background:#078b3e;font-size:14px;line-height:1.5;' +
      'text-decoration:none;max-width:100%;box-sizing:border-box';

    replaceMarker(node, match, link);
  }

  /* 着用動画・カート追尾 */
  var videoRows = [];
  var mediaReady = false;
  var mediaStarted = false;

  function videoKey(url) {
    try {
      var parsed = new URL(url);
      var match;

      if (/^(www\.|m\.)?youtube\.com$/.test(parsed.hostname)) {
        match = parsed.pathname.match(
          /^\/(?:embed|shorts)\/([\w-]{11})/
        );
        return 'yt:' + (
          match ? match[1] : parsed.searchParams.get('v')
        );
      }

      if (parsed.hostname === 'youtu.be') {
        return 'yt:' + parsed.pathname.slice(1);
      }

      return parsed.href;
    } catch (e) {
      return '';
    }
  }

  function mediaCss() {
    if (document.getElementById('adw-media-style')) return;

    var style = document.createElement('style');
    style.id = 'adw-media-style';

    style.textContent =
      '.adw-video-section{margin:24px 0;clear:both;max-width:100%;min-width:0}' +
      '.adw-video-rail{display:flex;gap:12px;overflow-x:auto;' +
      'scroll-snap-type:x mandatory;padding:0 0 12px;' +
      'overscroll-behavior-x:contain}' +
      '.adw-video-card{flex:0 0 82%;max-width:360px;min-width:0;' +
      'margin:0;scroll-snap-align:start}' +
      '.adw-video-card iframe,.adw-video-card video{' +
      'display:block;width:100%!important;height:auto!important;' +
      'aspect-ratio:4/5;object-fit:contain;border:0;background:#101010}' +
      '.adw-video-card figcaption{font-size:13px;line-height:1.6;' +
      'margin-top:8px;white-space:normal}' +
      '.adw-video-controls{display:flex;align-items:center;gap:12px;margin:8px 0}' +
      '.adw-video-controls[hidden]{display:none!important}' +
      '.adw-video-controls button{padding:8px 14px;background:transparent;' +
      'color:inherit;border:1px solid #888;border-radius:4px}' +
      '.adw-video-controls span{font-size:12px}' +
      '.adw-cart-dock{display:none}' +
      '@media(max-width:767px){' +
      '.adw-cart-dock{position:fixed;left:0;right:0;bottom:0;z-index:9000;' +
      'padding:8px 16px calc(8px + env(safe-area-inset-bottom));' +
      'background:#111;border-top:1px solid #555;box-shadow:0 -3px 12px #0005}' +
      '.adw-cart-dock:not([hidden]){display:block}' +
      '.adw-cart-dock button{width:100%;min-height:48px;border:0;' +
      'border-radius:4px;background:#08b3c9;color:#fff;' +
      'font-size:16px;font-weight:700}' +
      '.adw-cart-space{height:82px}' +
      '#purchase_form{scroll-margin-top:90px}}';

    document.head.appendChild(style);
  }

  function renderVideos() {
    var description = document.querySelector(
      '.item-description > .text.markdown'
    );
    if (!description) return;

    var nativeVideos = Array.from(
      document.querySelectorAll(
        '#appsItemDetailCustomTag .appsItemDetailCustomTag_youtube iframe'
      )
    );

    var section = document.querySelector('[data-adw-videos]');

    if (!section && !nativeVideos.length && !videoRows.length) {
      return;
    }

    mediaCss();

    if (!section) {
      section = document.createElement('section');
      section.className = 'adw-video-section';
      section.setAttribute('data-adw-videos', '');

      var heading = document.createElement('h3');
      heading.textContent = '着用動画';
      section.appendChild(heading);

      var controls = document.createElement('div');
      controls.className = 'adw-video-controls';

      var previous = document.createElement('button');
      var next = document.createElement('button');
      var note = document.createElement('span');

      previous.type = next.type = 'button';
      previous.textContent = '←';
      next.textContent = '→';
      previous.setAttribute('aria-label', '前の動画');
      next.setAttribute('aria-label', '次の動画');
      note.textContent = '横にスライドして見る';

      controls.append(previous, note, next);
      section.appendChild(controls);

      var newRail = document.createElement('div');
      newRail.className = 'adw-video-rail';
      newRail.tabIndex = 0;
      newRail.setAttribute('aria-label', '着用動画一覧');
      section.appendChild(newRail);

      previous.onclick = function () {
        newRail.scrollBy({
          left: -newRail.clientWidth * 0.85,
          behavior: 'smooth'
        });
      };

      next.onclick = function () {
        newRail.scrollBy({
          left: newRail.clientWidth * 0.85,
          behavior: 'smooth'
        });
      };

      description.appendChild(section);
    }

    var line = description.querySelector('[data-adwens-line]') ||
      Array.from(description.querySelectorAll('a[href]')).find(
        function (link) {
          return link.href.indexOf(LINE_URL) === 0;
        }
      );

    if (line && line.nextSibling !== section) {
      line.parentNode.insertBefore(section, line.nextSibling);
    }

    var rail = section.querySelector('.adw-video-rail');

    function videoCard(key, element) {
      var figure = document.createElement('figure');
      figure.className = 'adw-video-card';
      figure.dataset.videoKey = key;
      figure.appendChild(element);
      figure.appendChild(document.createElement('figcaption'));
      rail.appendChild(figure);
      return figure;
    }

    nativeVideos.forEach(function (element) {
      var key = videoKey(element.src);
      var old = element.parentElement;
      if (!key) return;

      var found = Array.from(rail.children).find(function (child) {
        return child.dataset.videoKey === key;
      });

      if (!found) {
        element.loading = 'lazy';
        videoCard(key, element);
      } else {
        old.hidden = true;
      }

      if (!old.children.length) old.hidden = true;
    });

    videoRows.forEach(function (row) {
      var key = videoKey(row.url);
      if (!key) return;

      var found = Array.from(rail.children).find(function (child) {
        return child.dataset.videoKey === key;
      });

      if (!found) {
        var element;

        if (
          key.indexOf('yt:') === 0 &&
          /^yt:[\w-]{11}$/.test(key)
        ) {
          element = document.createElement('iframe');
          element.src =
            'https://www.youtube.com/embed/' + key.slice(3) + '?rel=0';
          element.title = '着用動画';
          element.loading = 'lazy';
          element.allow = 'encrypted-media; picture-in-picture';
          element.allowFullscreen = true;
          element.referrerPolicy = 'strict-origin-when-cross-origin';
        } else if (
          /^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]{20,}\/preview(?:\?resourcekey=[A-Za-z0-9_-]+)?$/.test(key)
        ) {
          element = document.createElement('iframe');
          element.src = row.url;
          element.title = '着用動画';
          element.loading = 'lazy';
          element.allow = 'fullscreen';
          element.allowFullscreen = true;
        } else if (
          /^https:\/\/.+\.(mp4|webm)(\?.*)?$/i.test(key)
        ) {
          element = document.createElement('video');
          element.src = row.url;
          element.controls = true;
          element.playsInline = true;
          element.preload = 'none';
        } else {
          return;
        }

        found = videoCard(key, element);
      }

      var text = [
        row.height ? 'モデル身長' + row.height + 'cm' : '',
        row.weight ? '体重' + row.weight + 'kg' : '',
        row.size ? '着用サイズ' + row.size : ''
      ].filter(Boolean).join(' ');

      var caption = found.querySelector('figcaption');

      if (caption.dataset.caption !== text) {
        caption.textContent = text;
        caption.dataset.caption = text;
      }

      if (
        row.url.indexOf('https://drive.google.com/') === 0 &&
        !found.querySelector('.adw-video-fallback')
      ) {
        var link = document.createElement('a');
        link.className = 'adw-video-fallback';
        link.href = row.url.replace('/preview', '/view');
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = '再生できない場合はこちら';
        link.style.cssText =
          'display:block;font-size:12px;margin-top:6px';
        found.appendChild(link);
      }
    });

    var multiple = rail.children.length > 1;
    section.querySelector('.adw-video-controls').hidden = !multiple;
  }

  function loadVideos() {
    if (mediaStarted) return;
    mediaStarted = true;

    var urls = [
      'https://raw.githubusercontent.com/adwens0111/adwens/main/product_media.json',
      'https://adwens0111.github.io/adwens/product_media.json'
    ];

    function read(index) {
      if (index === urls.length) return Promise.reject();

      return fetch(
        urls[index] + '?v=' + Date.now(),
        { cache: 'no-store' }
      )
        .then(function (response) {
          if (!response.ok) throw Error();
          return response.json();
        })
        .catch(function () {
          return read(index + 1);
        });
    }

    read(0).then(function (all) {
      videoRows = Array.isArray(all[ITEM_ID]) ? all[ITEM_ID] : [];
      mediaReady = true;
      renderVideos();
    }).catch(function () {
      renderVideos();
    });
  }

  function setupCartDock() {
    if (document.querySelector('.adw-cart-dock')) return;

    var form = document.querySelector('#purchase_form');
    var nativeButton = form &&
      form.querySelector('.purchaseButton__btn--addToCart');

    if (!form || !nativeButton) return;

    mediaCss();

    var dock = document.createElement('div');
    dock.className = 'adw-cart-dock';
    dock.hidden = true;

    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'サイズを選んでカートへ';

    dock.appendChild(button);
    document.body.appendChild(dock);

    var space = document.createElement('div');
    space.className = 'adw-cart-space';
    space.hidden = true;
    document.body.appendChild(space);

    button.onclick = function () {
      form.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });

      var control =
        form.querySelector('#valiationSelect') || nativeButton;

      control.focus({ preventScroll: true });
    };

    function update() {
      var rect = form.getBoundingClientRect();
      var mobile = window.matchMedia('(max-width:767px)').matches;
      var available =
        !nativeButton.disabled &&
        form.getAttribute('data-disabled') !== 'true' &&
        getComputedStyle(nativeButton).display !== 'none';

      var show = mobile && rect.bottom < 0 && available;
      dock.hidden = !show;
      space.hidden = !show;
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    form.addEventListener('change', update);

    new MutationObserver(update).observe(form, {
      attributes: true,
      subtree: true,
      attributeFilter: ['disabled', 'style', 'data-disabled']
    });

    update();
  }

  var busy = false;

  function run() {
    if (busy || !document.body) return;
    busy = true;

    try {
      findMarkers(RE_LINE).forEach(renderLine);
      findMarkers(RE_COORD).forEach(renderCoord);
      findMarkers(RE_FIT).forEach(renderFitMarker);
      renderVideos();
      setupCartDock();
      placeCoord();
    } finally {
      busy = false;
    }
  }

  function start() {
    run();
    loadVerifiedFit();
    loadVideos();

    var observer = new MutationObserver(function () {
      run();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    var tries = 0;
    var timer = setInterval(function () {
      run();
      if (++tries >= 10) clearInterval(timer);
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
