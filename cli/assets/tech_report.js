// TechDetect Report — Interactive Visualizations
// Self-contained JS for the technology detection HTML report.
// Data injected as window.__TECH_DATA__ by the Rust generator.
(function () {
  'use strict';

  var D = window.__TECH_DATA__;
  if (!D) return;

  // ── DOM Helpers ──
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'textContent') node.textContent = attrs[k];
      else if (k === 'className') node.className = attrs[k];
      else if (k === 'style') node.setAttribute('style', attrs[k]);
      else if (k === 'disabled') { if (attrs[k]) node.setAttribute('disabled', ''); }
      else node.setAttribute(k, attrs[k]);
    });
    return node;
  }

  function textNode(t) { return document.createTextNode(t); }

  function appendChildren(parent, kids) {
    kids.forEach(function (c) { if (c) parent.appendChild(c); });
    return parent;
  }

  // ── Navigation ──
  var sections = ['overview', 'languages', 'cloud', 'stack', 'infra', 'quality', 'deps'];
  var navLinks = document.querySelector('.rg-nav-links');
  if (navLinks) {
    navLinks.addEventListener('click', function (e) {
      if (e.target.tagName !== 'BUTTON') return;
      var target = e.target.getAttribute('data-section');
      if (!target) return;
      var anchor = document.getElementById('section-' + target);
      if (anchor) anchor.scrollIntoView({ behavior: 'smooth' });
      navLinks.querySelectorAll('button').forEach(function (b) { b.classList.remove('active'); });
      e.target.classList.add('active');
    });
  }

  // ── Section: Languages ──
  (function () {
    var langs = D.languages;
    if (!langs || Object.keys(langs).length === 0) return;

    var entries = Object.keys(langs).map(function (k) {
      return { name: k, count: langs[k] };
    }).sort(function (a, b) { return b.count - a.count; });

    var total = entries.reduce(function (s, e) { return s + e.count; }, 0);

    // Donut chart
    var donutEl = document.getElementById('language-donut-chart');
    if (donutEl) {
      var chart = echarts.init(donutEl);
      var top12 = entries.slice(0, 12);
      var otherCount = entries.slice(12).reduce(function (s, e) { return s + e.count; }, 0);
      var pieData = top12.map(function (e) { return { name: e.name, value: e.count }; });
      if (otherCount > 0) pieData.push({ name: 'Other', value: otherCount });
      chart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c} files ({d}%)' },
        legend: { type: 'scroll', bottom: 0, textStyle: { color: '#94a3b8', fontSize: 11 } },
        series: [{
          type: 'pie', radius: ['45%', '72%'], center: ['50%', '45%'],
          padAngle: 2, itemStyle: { borderRadius: 6 },
          label: { show: false }, emphasis: { label: { show: true, fontSize: 14, fontWeight: 700, color: '#f1f5f9' } },
          data: pieData
        }]
      });
      window.addEventListener('resize', function () { chart.resize(); });
    }

    // Bar chart
    var barEl = document.getElementById('language-bar-chart');
    if (barEl) {
      var chart2 = echarts.init(barEl);
      var top20 = entries.slice(0, 20);
      chart2.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: 120, right: 40, top: 20, bottom: 30 },
        xAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(71,85,105,0.3)' } } },
        yAxis: {
          type: 'category', inverse: true,
          data: top20.map(function (e) { return e.name; }),
          axisLabel: { color: '#f1f5f9', fontSize: 12 }
        },
        series: [{
          type: 'bar', barWidth: 16,
          data: top20.map(function (e) { return e.count; }),
          itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#38bdf8' }, { offset: 1, color: '#a78bfa' }
          ]), borderRadius: [0, 4, 4, 0] },
          label: {
            show: true, position: 'right',
            formatter: function (p) {
              var pct = (p.value / total * 100).toFixed(1);
              return p.value + ' (' + pct + '%)';
            },
            color: '#94a3b8', fontSize: 11
          }
        }]
      });
      window.addEventListener('resize', function () { chart2.resize(); });
    }
  })();

  // ── Section: Cloud Services ──
  (function () {
    var providers = [
      { key: 'aws', name: 'Amazon Web Services', icon: 'AWS', color: '#ff9900', badgeClass: 'badge-orange' },
      { key: 'azure', name: 'Microsoft Azure', icon: 'Az', color: '#0078d4', badgeClass: 'badge-blue' },
      { key: 'gcp', name: 'Google Cloud Platform', icon: 'GCP', color: '#4285f4', badgeClass: 'badge-cyan' }
    ];

    var container = document.getElementById('cloud-services');
    if (!container) return;

    var hasAny = false;
    providers.forEach(function (prov) {
      var services = D[prov.key];
      if (!services || services.length === 0) return;
      hasAny = true;

      // Group by service name
      var grouped = {};
      services.forEach(function (s) {
        if (!grouped[s.service]) grouped[s.service] = [];
        grouped[s.service].push(s);
      });

      var section = el('div', { className: 'category-section' });

      var header = el('div', { className: 'provider-header' });
      var icon = el('div', { className: 'provider-icon', style: 'background:' + prov.color + '22;color:' + prov.color, textContent: prov.icon });
      var nameDiv = el('div');
      nameDiv.appendChild(el('div', { className: 'provider-name', textContent: prov.name }));
      nameDiv.appendChild(el('div', { className: 'provider-count', textContent: Object.keys(grouped).length + ' services detected' }));
      header.appendChild(icon);
      header.appendChild(nameDiv);
      section.appendChild(header);

      var grid = el('div', { className: 'tech-cards' });
      Object.keys(grouped).sort().forEach(function (serviceName) {
        var items = grouped[serviceName];
        var card = el('div', { className: 'tech-card' });
        var cardHeader = el('div', { className: 'tech-card-header' });
        var cardIcon = el('div', { className: 'tech-card-icon', style: 'background:' + prov.color + '18;color:' + prov.color, textContent: serviceName.substring(0, 2) });
        cardHeader.appendChild(cardIcon);
        cardHeader.appendChild(el('div', { className: 'tech-card-name', textContent: serviceName }));
        card.appendChild(cardHeader);

        var meta = el('div', { className: 'tech-card-meta' });
        // Collect unique via methods
        var vias = {};
        items.forEach(function (it) { vias[it.via] = true; });
        Object.keys(vias).forEach(function (v) {
          meta.appendChild(el('span', { className: 'badge ' + prov.badgeClass, textContent: v }));
        });
        // Show source files (unique, max 3)
        var sources = {};
        items.forEach(function (it) { sources[it.source] = true; });
        var srcList = Object.keys(sources).slice(0, 3);
        srcList.forEach(function (src) {
          meta.appendChild(el('span', { className: 'badge badge-gray', textContent: src.split('/').pop() }));
        });
        card.appendChild(meta);
        grid.appendChild(card);
      });
      section.appendChild(grid);
      container.appendChild(section);
    });

    if (!hasAny) {
      var empty = el('div', { className: 'empty-state' });
      empty.appendChild(el('div', { className: 'empty-icon', textContent: '\u2601\uFE0F' }));
      empty.appendChild(el('div', { textContent: 'No cloud services detected in this repository' }));
      container.appendChild(empty);
    }
  })();

  // ── Section: Frameworks & Databases ──
  (function () {
    // Frameworks
    var fwContainer = document.getElementById('frameworks-grid');
    if (fwContainer && D.frameworks && D.frameworks.length > 0) {
      var grid = el('div', { className: 'tech-cards' });
      D.frameworks.forEach(function (fw) {
        var card = el('div', { className: 'tech-card' });
        var header = el('div', { className: 'tech-card-header' });
        var icon = el('div', { className: 'tech-card-icon', style: 'background:rgba(167,139,250,0.15);color:#a78bfa', textContent: fw.name.substring(0, 2) });
        var nameWrap = el('div');
        nameWrap.appendChild(el('div', { className: 'tech-card-name', textContent: fw.name }));
        if (fw.version) nameWrap.appendChild(el('div', { className: 'tech-card-version', textContent: fw.version }));
        header.appendChild(icon);
        header.appendChild(nameWrap);
        card.appendChild(header);
        var meta = el('div', { className: 'tech-card-meta' });
        meta.appendChild(el('span', { className: 'badge badge-purple', textContent: fw.via }));
        meta.appendChild(el('span', { className: 'badge badge-gray', textContent: fw.source.split('/').pop() }));
        card.appendChild(meta);
        grid.appendChild(card);
      });
      fwContainer.appendChild(grid);
    } else if (fwContainer) {
      var empty = el('div', { className: 'empty-state' });
      empty.appendChild(el('div', { className: 'empty-icon', textContent: '\uD83D\uDCE6' }));
      empty.appendChild(el('div', { textContent: 'No frameworks detected' }));
      fwContainer.appendChild(empty);
    }

    // Databases
    var dbContainer = document.getElementById('databases-grid');
    if (dbContainer && D.databases && D.databases.length > 0) {
      var dbGrid = el('div', { className: 'tech-cards' });
      D.databases.forEach(function (db) {
        var card = el('div', { className: 'tech-card' });
        var header = el('div', { className: 'tech-card-header' });
        var icon = el('div', { className: 'tech-card-icon', style: 'background:rgba(52,211,153,0.15);color:#34d399', textContent: db.name.substring(0, 2) });
        var nameWrap = el('div');
        nameWrap.appendChild(el('div', { className: 'tech-card-name', textContent: db.name }));
        if (db.version) nameWrap.appendChild(el('div', { className: 'tech-card-version', textContent: db.version }));
        header.appendChild(icon);
        header.appendChild(nameWrap);
        card.appendChild(header);
        var meta = el('div', { className: 'tech-card-meta' });
        meta.appendChild(el('span', { className: 'badge badge-green', textContent: db.via }));
        meta.appendChild(el('span', { className: 'badge badge-gray', textContent: db.source.split('/').pop() }));
        card.appendChild(meta);
        dbGrid.appendChild(card);
      });
      dbContainer.appendChild(dbGrid);
    } else if (dbContainer) {
      var dbEmpty = el('div', { className: 'empty-state' });
      dbEmpty.appendChild(el('div', { className: 'empty-icon', textContent: '\uD83D\uDDC4\uFE0F' }));
      dbEmpty.appendChild(el('div', { textContent: 'No database technologies detected' }));
      dbContainer.appendChild(dbEmpty);
    }
  })();

  // ── Section: Infrastructure (CI/CD) ──
  (function () {
    var container = document.getElementById('infra-grid');
    if (!container || !D.cicd || D.cicd.length === 0) {
      if (container) {
        var empty = el('div', { className: 'empty-state' });
        empty.appendChild(el('div', { className: 'empty-icon', textContent: '\u2699\uFE0F' }));
        empty.appendChild(el('div', { textContent: 'No CI/CD or infrastructure tools detected' }));
        container.appendChild(empty);
      }
      return;
    }

    var categoryColors = {
      ci: { bg: 'rgba(56,189,248,0.15)', fg: '#38bdf8', badge: 'badge-blue', label: 'Continuous Integration' },
      container: { bg: 'rgba(34,211,238,0.15)', fg: '#22d3ee', badge: 'badge-cyan', label: 'Containers' },
      orchestration: { bg: 'rgba(167,139,250,0.15)', fg: '#a78bfa', badge: 'badge-purple', label: 'Orchestration' },
      build: { bg: 'rgba(251,146,60,0.15)', fg: '#fb923c', badge: 'badge-orange', label: 'Build Tools' },
      iac: { bg: 'rgba(52,211,153,0.15)', fg: '#34d399', badge: 'badge-green', label: 'Infrastructure as Code' }
    };

    // Group by category
    var grouped = {};
    D.cicd.forEach(function (tool) {
      var cat = tool.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(tool);
    });

    var catOrder = ['ci', 'container', 'orchestration', 'iac', 'build'];
    catOrder.forEach(function (cat) {
      var tools = grouped[cat];
      if (!tools || tools.length === 0) return;

      var colors = categoryColors[cat] || { bg: 'rgba(148,163,184,0.1)', fg: '#94a3b8', badge: 'badge-gray', label: cat };
      var section = el('div', { className: 'category-section' });
      section.appendChild(el('div', { className: 'category-label', textContent: colors.label }));

      var grid = el('div', { className: 'tech-cards' });
      tools.forEach(function (tool) {
        var card = el('div', { className: 'tech-card' });
        var header = el('div', { className: 'tech-card-header' });
        var icon = el('div', { className: 'tech-card-icon', style: 'background:' + colors.bg + ';color:' + colors.fg, textContent: tool.name.substring(0, 2) });
        header.appendChild(icon);
        header.appendChild(el('div', { className: 'tech-card-name', textContent: tool.name }));
        card.appendChild(header);
        var meta = el('div', { className: 'tech-card-meta' });
        meta.appendChild(el('span', { className: 'badge ' + colors.badge, textContent: cat }));
        meta.appendChild(el('span', { className: 'badge badge-gray', textContent: tool.source.split('/').pop() }));
        card.appendChild(meta);
        grid.appendChild(card);
      });
      section.appendChild(grid);
      container.appendChild(section);
    });

    // Infra donut chart
    var chartEl = document.getElementById('infra-donut-chart');
    if (chartEl) {
      var chart = echarts.init(chartEl);
      var catCounts = catOrder.map(function (cat) {
        var items = grouped[cat];
        var colors2 = categoryColors[cat] || { label: cat };
        return { name: colors2.label, value: items ? items.length : 0 };
      }).filter(function (d) { return d.value > 0; });
      chart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c} tools' },
        legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 11 } },
        series: [{
          type: 'pie', radius: ['40%', '70%'], center: ['50%', '42%'],
          padAngle: 3, itemStyle: { borderRadius: 6 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 14, fontWeight: 700, color: '#f1f5f9' } },
          data: catCounts
        }]
      });
      window.addEventListener('resize', function () { chart.resize(); });
    }
  })();

  // ── Section: Quality (Testing/Linting) ──
  (function () {
    var container = document.getElementById('quality-grid');
    if (!container || !D.testing || D.testing.length === 0) {
      if (container) {
        var empty = el('div', { className: 'empty-state' });
        empty.appendChild(el('div', { className: 'empty-icon', textContent: '\u2705' }));
        empty.appendChild(el('div', { textContent: 'No testing or quality tools detected' }));
        container.appendChild(empty);
      }
      return;
    }

    var categoryMeta = {
      testing: { label: 'Testing', color: '#34d399', badge: 'badge-green' },
      e2e: { label: 'End-to-End Testing', color: '#22d3ee', badge: 'badge-cyan' },
      linting: { label: 'Linting', color: '#facc15', badge: 'badge-yellow' },
      formatting: { label: 'Formatting', color: '#a78bfa', badge: 'badge-purple' },
      coverage: { label: 'Code Coverage', color: '#38bdf8', badge: 'badge-blue' }
    };

    // Group by category
    var grouped = {};
    D.testing.forEach(function (tool) {
      var cat = tool.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(tool);
    });

    ['testing', 'e2e', 'linting', 'formatting', 'coverage'].forEach(function (cat) {
      var tools = grouped[cat];
      if (!tools || tools.length === 0) return;
      var meta = categoryMeta[cat] || { label: cat, color: '#94a3b8', badge: 'badge-gray' };

      var section = el('div', { className: 'category-section' });
      section.appendChild(el('div', { className: 'category-label', textContent: meta.label }));

      var grid = el('div', { className: 'tech-cards' });
      tools.forEach(function (tool) {
        var card = el('div', { className: 'tech-card' });
        var header = el('div', { className: 'tech-card-header' });
        var icon = el('div', { className: 'tech-card-icon', style: 'background:' + meta.color + '22;color:' + meta.color, textContent: tool.name.substring(0, 2) });
        header.appendChild(icon);
        header.appendChild(el('div', { className: 'tech-card-name', textContent: tool.name }));
        card.appendChild(header);
        var metaDiv = el('div', { className: 'tech-card-meta' });
        metaDiv.appendChild(el('span', { className: 'badge ' + meta.badge, textContent: tool.via }));
        metaDiv.appendChild(el('span', { className: 'badge badge-gray', textContent: tool.source.split('/').pop() }));
        card.appendChild(metaDiv);
        grid.appendChild(card);
      });
      section.appendChild(grid);
      container.appendChild(section);
    });

    // Quality bar chart
    var chartEl = document.getElementById('quality-bar-chart');
    if (chartEl) {
      var chart = echarts.init(chartEl);
      var cats = ['testing', 'e2e', 'linting', 'formatting', 'coverage'];
      var labels = cats.map(function (c) { return (categoryMeta[c] || { label: c }).label; });
      var values = cats.map(function (c) { return grouped[c] ? grouped[c].length : 0; });
      var colors = cats.map(function (c) { return (categoryMeta[c] || { color: '#94a3b8' }).color; });
      chart.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: 120, right: 40, top: 20, bottom: 20 },
        xAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(71,85,105,0.3)' } } },
        yAxis: { type: 'category', data: labels, axisLabel: { color: '#f1f5f9', fontSize: 12 } },
        series: [{
          type: 'bar', barWidth: 20,
          data: values.map(function (v, i) { return { value: v, itemStyle: { color: colors[i], borderRadius: [0, 4, 4, 0] } }; }),
          label: { show: true, position: 'right', color: '#94a3b8', fontSize: 11 }
        }]
      });
      window.addEventListener('resize', function () { chart.resize(); });
    }
  })();

  // ── Section: Resource × File Matrix ──
  (function () {
    var container = document.getElementById('resource-matrix');
    if (!container) return;

    var providers = [
      { key: 'aws', label: 'AWS', color: '#fb923c', cls: 'aws' },
      { key: 'azure', label: 'Azure', color: '#38bdf8', cls: 'azure' },
      { key: 'gcp', label: 'GCP', color: '#22d3ee', cls: 'gcp' }
    ];

    // Collect all entries with provider tag
    var entries = [];
    providers.forEach(function (p) {
      (D[p.key] || []).forEach(function (s) {
        entries.push({ service: s.service, source: s.source, via: s.via, provider: p.key, cls: p.cls, color: p.color });
      });
    });
    if (entries.length === 0) return;

    // Build unique sorted lists
    var serviceSet = {};
    var fileSet = {};
    entries.forEach(function (e) {
      var sk = e.provider + '::' + e.service;
      if (!serviceSet[sk]) serviceSet[sk] = { service: e.service, provider: e.provider, cls: e.cls, color: e.color, files: {} };
      serviceSet[sk].files[e.source] = (serviceSet[sk].files[e.source] || []);
      serviceSet[sk].files[e.source].push(e.via);
      fileSet[e.source] = true;
    });

    // Sort: group by provider, then alpha within provider
    var provOrder = { aws: 0, azure: 1, gcp: 2 };
    var services = Object.keys(serviceSet).map(function (k) { return serviceSet[k]; })
      .sort(function (a, b) {
        var po = (provOrder[a.provider] || 0) - (provOrder[b.provider] || 0);
        if (po !== 0) return po;
        return a.service.localeCompare(b.service);
      });

    // Sort files: by number of services using them (desc), then alpha
    var fileServiceCount = {};
    services.forEach(function (s) {
      Object.keys(s.files).forEach(function (f) {
        fileServiceCount[f] = (fileServiceCount[f] || 0) + 1;
      });
    });
    var files = Object.keys(fileSet).sort(function (a, b) {
      var diff = (fileServiceCount[b] || 0) - (fileServiceCount[a] || 0);
      return diff !== 0 ? diff : a.localeCompare(b);
    });

    // Short file name for column headers
    function shortFile(f) {
      var parts = f.split('/');
      return parts.length > 2 ? parts.slice(-2).join('/') : f;
    }

    // State
    var hiddenRows = {};
    var hiddenCols = {};
    var compareMode = false;
    var compareSelected = {};
    var serviceFilter = '';
    var fileFilter = '';
    var providerVisible = { aws: true, azure: true, gcp: true };

    // Tooltip
    var tooltip = document.getElementById('matrix-tooltip');

    function showTooltip(e, text) {
      if (!tooltip) return;
      tooltip.textContent = text;
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 12) + 'px';
      tooltip.style.top = (e.clientY - 8) + 'px';
    }
    function hideTooltip() {
      if (tooltip) tooltip.style.display = 'none';
    }

    function render() {
      container.textContent = '';

      // Filter services and files
      var visServices = services.filter(function (s) {
        if (hiddenRows[s.provider + '::' + s.service]) return false;
        if (!providerVisible[s.provider]) return false;
        if (serviceFilter && s.service.toLowerCase().indexOf(serviceFilter) < 0) return false;
        return true;
      });
      var visFiles = files.filter(function (f) {
        if (hiddenCols[f]) return false;
        if (fileFilter && f.toLowerCase().indexOf(fileFilter) < 0) return false;
        return true;
      });

      // Toolbar
      var toolbar = el('div', { className: 'matrix-toolbar' });

      // Service filter
      var sInput = el('input', { className: 'search-box' });
      sInput.setAttribute('type', 'text');
      sInput.setAttribute('placeholder', 'Filter resources...');
      sInput.value = serviceFilter;
      sInput.addEventListener('input', function () { serviceFilter = sInput.value.toLowerCase(); render(); });
      toolbar.appendChild(sInput);

      // File filter
      var fInput = el('input', { className: 'search-box' });
      fInput.setAttribute('type', 'text');
      fInput.setAttribute('placeholder', 'Filter files...');
      fInput.value = fileFilter;
      fInput.addEventListener('input', function () { fileFilter = fInput.value.toLowerCase(); render(); });
      toolbar.appendChild(fInput);

      // Provider toggles
      var fg = el('div', { className: 'filter-group' });
      fg.appendChild(el('label', { textContent: 'Providers:' }));
      providers.forEach(function (p) {
        if (!D[p.key] || D[p.key].length === 0) return;
        var btn = el('button', {
          className: 'provider-toggle ' + p.cls + (providerVisible[p.key] ? ' active' : ''),
          textContent: p.label
        });
        btn.addEventListener('click', function () {
          providerVisible[p.key] = !providerVisible[p.key];
          render();
        });
        fg.appendChild(btn);
      });
      toolbar.appendChild(fg);

      // Compare toggle
      var cmpBtn = el('button', {
        className: 'provider-toggle' + (compareMode ? ' active' : ''),
        textContent: compareMode ? 'Exit Compare' : 'Compare',
        style: 'color:#a78bfa' + (compareMode ? ';background:rgba(167,139,250,0.15);border-color:#a78bfa' : '')
      });
      cmpBtn.addEventListener('click', function () {
        compareMode = !compareMode;
        if (!compareMode) compareSelected = {};
        render();
      });
      toolbar.appendChild(cmpBtn);

      // Reset
      var hasHidden = Object.keys(hiddenRows).length > 0 || Object.keys(hiddenCols).length > 0;
      if (hasHidden) {
        var resetBtn = el('button', { className: 'matrix-reset', textContent: 'Reset Hidden (' + (Object.keys(hiddenRows).length + Object.keys(hiddenCols).length) + ')' });
        resetBtn.addEventListener('click', function () { hiddenRows = {}; hiddenCols = {}; render(); });
        toolbar.appendChild(resetBtn);
      }

      // Stats
      toolbar.appendChild(el('span', { className: 'matrix-stats', textContent: visServices.length + ' resources \u00D7 ' + visFiles.length + ' files' }));

      container.appendChild(toolbar);

      if (visServices.length === 0 || visFiles.length === 0) {
        var empty = el('div', { className: 'empty-state', textContent: 'No matching resources or files. Adjust filters.' });
        container.appendChild(empty);
        return;
      }

      // Build table
      var scrollDiv = el('div', { className: 'matrix-scroll' });
      var table = el('table', { className: 'matrix-table' + (compareMode ? ' compare-mode' : '') });

      // Header row
      var thead = el('thead');
      var headerRow = el('tr');
      var corner = el('th', { className: 'corner' });
      corner.appendChild(el('span', { textContent: 'Resource \\ File', style: 'font-size:10px;color:#64748b' }));
      headerRow.appendChild(corner);

      visFiles.forEach(function (f, ci) {
        var th = el('th');
        th.setAttribute('data-col', String(ci));
        var label = el('div', { className: 'col-label', textContent: shortFile(f) });
        th.appendChild(label);
        th.setAttribute('title', 'Click to hide: ' + f);
        th.addEventListener('click', function () { hiddenCols[f] = true; render(); });
        th.addEventListener('mouseenter', function (e) { showTooltip(e, f); highlightCol(ci, true); });
        th.addEventListener('mouseleave', function () { hideTooltip(); highlightCol(ci, false); });
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // Body
      var tbody = el('tbody');
      var currentProvider = '';

      visServices.forEach(function (s) {
        // Provider group header
        if (s.provider !== currentProvider) {
          currentProvider = s.provider;
          var provLabel = providers.filter(function (p) { return p.key === s.provider; })[0];
          var groupRow = el('tr', { className: 'provider-row' });
          var groupCell = el('td');
          groupCell.setAttribute('colspan', String(visFiles.length + 1));
          groupCell.style.color = s.color;
          groupCell.textContent = provLabel ? provLabel.label : s.provider;
          groupRow.appendChild(groupCell);
          tbody.appendChild(groupRow);
        }

        var sk = s.provider + '::' + s.service;
        var row = el('tr');
        if (compareMode && compareSelected[sk]) row.className = 'compare-selected';

        // Row header
        var rh = el('td', { className: 'row-header' });
        var dot = el('span', { className: 'provider-dot', style: 'background:' + s.color });
        rh.appendChild(dot);
        rh.appendChild(textNode(s.service));
        var fileCount = Object.keys(s.files).filter(function (f) { return !hiddenCols[f]; }).length;
        rh.appendChild(el('span', { className: 'file-count', textContent: '(' + fileCount + ')' }));

        if (compareMode) {
          rh.style.cursor = 'pointer';
          rh.setAttribute('title', 'Click to select for comparison');
          rh.addEventListener('click', function () {
            if (compareSelected[sk]) delete compareSelected[sk];
            else compareSelected[sk] = true;
            render();
          });
        } else {
          rh.setAttribute('title', 'Click to hide this resource');
          rh.addEventListener('click', function () { hiddenRows[sk] = true; render(); });
        }
        row.appendChild(rh);

        // Cells
        visFiles.forEach(function (f, ci) {
          var td = el('td', { className: 'matrix-cell' });
          td.setAttribute('data-col', String(ci));
          if (s.files[f]) {
            var dotEl = el('span', { className: 'matrix-dot ' + s.cls });
            var vias = s.files[f];
            dotEl.addEventListener('mouseenter', function (e) {
              showTooltip(e, s.service + ' \u2192 ' + shortFile(f) + ' (via ' + vias.join(', ') + ')');
            });
            dotEl.addEventListener('mouseleave', hideTooltip);
            td.appendChild(dotEl);
          }
          row.appendChild(td);
        });

        tbody.appendChild(row);
      });

      table.appendChild(tbody);
      scrollDiv.appendChild(table);
      container.appendChild(scrollDiv);

      // Column highlight helper
      function highlightCol(ci, on) {
        var cells = table.querySelectorAll('[data-col="' + ci + '"]');
        cells.forEach(function (c) {
          if (on) c.classList.add('col-highlight');
          else c.classList.remove('col-highlight');
        });
      }
    }

    render();
  })();

  // ── Section: Dependencies ──
  (function () {
    var ecosystems = [
      { key: 'node', label: 'Node.js (npm)', color: '#34d399' },
      { key: 'python', label: 'Python (pip)', color: '#facc15' },
      { key: 'rust', label: 'Rust (Cargo)', color: '#fb923c' },
      { key: 'go', label: 'Go (modules)', color: '#22d3ee' },
      { key: 'java', label: 'Java (Maven/Gradle)', color: '#f87171' },
      { key: 'ruby', label: 'Ruby (Gems)', color: '#f472b6' },
      { key: 'php', label: 'PHP (Composer)', color: '#a78bfa' }
    ];

    var container = document.getElementById('deps-container');
    if (!container) return;

    // Filter to ecosystems that have packages
    var active = ecosystems.filter(function (eco) { return D[eco.key] && D[eco.key].length > 0; });
    if (active.length === 0) {
      var empty = el('div', { className: 'empty-state' });
      empty.appendChild(el('div', { className: 'empty-icon', textContent: '\uD83D\uDCE6' }));
      empty.appendChild(el('div', { textContent: 'No package dependencies detected' }));
      container.appendChild(empty);
      return;
    }

    // Tab bar
    var tabBar = el('div', { className: 'tab-bar' });
    active.forEach(function (eco, i) {
      var btn = el('button', {
        className: 'tab-btn' + (i === 0 ? ' active' : ''),
        textContent: eco.label + ' (' + D[eco.key].length + ')'
      });
      btn.setAttribute('data-tab', eco.key);
      tabBar.appendChild(btn);
    });
    container.appendChild(tabBar);

    // Tab panels
    active.forEach(function (eco, i) {
      var panel = el('div', { className: 'tab-panel' + (i === 0 ? ' active' : '') });
      panel.setAttribute('data-tab-panel', eco.key);

      var packages = D[eco.key];

      // Search
      var searchInput = el('input', { className: 'search-box', textContent: '' });
      searchInput.setAttribute('placeholder', 'Search ' + eco.label + ' packages...');
      searchInput.setAttribute('type', 'text');
      panel.appendChild(searchInput);

      // Table
      var table = el('table', { className: 'data-table' });
      var thead = el('thead');
      var headerRow = el('tr');
      headerRow.appendChild(el('th', { textContent: 'Package' }));
      headerRow.appendChild(el('th', { textContent: 'Version' }));
      headerRow.appendChild(el('th', { textContent: 'Source' }));
      thead.appendChild(headerRow);
      table.appendChild(thead);

      var tbody = el('tbody');
      packages.sort(function (a, b) { return a.name.localeCompare(b.name); });
      packages.forEach(function (pkg) {
        var row = el('tr');
        row.appendChild(el('td', { textContent: pkg.name }));
        row.appendChild(el('td', { textContent: pkg.version || '-', className: 'num' }));
        row.appendChild(el('td', { textContent: pkg.source }));
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      panel.appendChild(table);

      // Search filtering
      searchInput.addEventListener('input', function () {
        var query = searchInput.value.toLowerCase();
        var rows = tbody.querySelectorAll('tr');
        rows.forEach(function (row) {
          var text = row.textContent.toLowerCase();
          row.style.display = text.indexOf(query) >= 0 ? '' : 'none';
        });
      });

      container.appendChild(panel);
    });

    // Tab switching
    tabBar.addEventListener('click', function (e) {
      if (!e.target.classList.contains('tab-btn')) return;
      var tab = e.target.getAttribute('data-tab');
      tabBar.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      e.target.classList.add('active');
      container.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
      var panel = container.querySelector('[data-tab-panel="' + tab + '"]');
      if (panel) panel.classList.add('active');
    });

    // Dependency ecosystem donut
    var depChartEl = document.getElementById('deps-donut-chart');
    if (depChartEl) {
      var chart = echarts.init(depChartEl);
      chart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c} packages ({d}%)' },
        legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 11 } },
        series: [{
          type: 'pie', radius: ['40%', '70%'], center: ['50%', '42%'],
          padAngle: 3, itemStyle: { borderRadius: 6 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 14, fontWeight: 700, color: '#f1f5f9' } },
          data: active.map(function (eco) {
            return { name: eco.label.split(' (')[0], value: D[eco.key].length, itemStyle: { color: eco.color } };
          })
        }]
      });
      window.addEventListener('resize', function () { chart.resize(); });
    }
  })();

  // ── Section: Manifest Files ──
  (function () {
    var container = document.getElementById('manifest-list');
    if (!container || !D.manifest_files || D.manifest_files.length === 0) return;

    var table = el('table', { className: 'data-table' });
    var thead = el('thead');
    var hr = el('tr');
    hr.appendChild(el('th', { textContent: '#' }));
    hr.appendChild(el('th', { textContent: 'Manifest File' }));
    hr.appendChild(el('th', { textContent: 'Directory' }));
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = el('tbody');
    D.manifest_files.sort().forEach(function (f, i) {
      var row = el('tr');
      row.appendChild(el('td', { className: 'num', textContent: String(i + 1) }));
      var parts = f.split('/');
      var fname = parts.pop();
      var dir = parts.join('/') || '.';
      row.appendChild(el('td', { textContent: fname, style: 'color:#f1f5f9;font-weight:600' }));
      row.appendChild(el('td', { textContent: dir }));
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  })();

})();
