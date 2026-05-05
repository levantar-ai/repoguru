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
      else if (k === 'innerHTML') node.innerHTML = attrs[k];
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

  // ── Lazy Chart Init via IntersectionObserver ──
  var allCharts = [];
  var pendingCharts = []; // { el, initFn }

  function queueChart(domEl, initFn) {
    if (!domEl) return;
    pendingCharts.push({ el: domEl, initFn: initFn });
  }

  function setupChartObserver() {
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: init all immediately
      pendingCharts.forEach(function (p) {
        var chart = p.initFn(p.el);
        if (chart) allCharts.push(chart);
      });
      pendingCharts = [];
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        for (var i = pendingCharts.length - 1; i >= 0; i--) {
          if (pendingCharts[i].el === entry.target) {
            var p = pendingCharts.splice(i, 1)[0];
            var chart = p.initFn(p.el);
            if (chart) allCharts.push(chart);
            observer.unobserve(entry.target);
            break;
          }
        }
      });
    }, { rootMargin: '200px' });

    pendingCharts.forEach(function (p) { observer.observe(p.el); });
  }

  // ── Single Debounced Resize Handler ──
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      allCharts.forEach(function (c) {
        try { c.resize(); } catch (e) { /* chart may have been disposed */ }
      });
    }, 150);
  });

  // ── Source badge helper — last 2 path segments + mono class ──
  function srcBadge(src) {
    var parts = src.split('/');
    var short = parts.length >= 2 ? parts.slice(-2).join('/') : src;
    return el('span', { className: 'badge badge-gray mono', textContent: short, title: src });
  }

  // ── Navigation ──
  var sections = ['overview', 'languages', 'cloud', 'stack', 'infra', 'quality', 'deps'];
  var navLinks = document.querySelector('.rg-nav-links');
  if (navLinks) {
    navLinks.setAttribute('aria-label', 'Report sections');

    navLinks.addEventListener('click', function (e) {
      if (e.target.tagName !== 'BUTTON') return;
      var target = e.target.getAttribute('data-section');
      if (!target) return;
      var anchor = document.getElementById('section-' + target);
      if (anchor) anchor.scrollIntoView({ behavior: 'smooth' });
      setActiveNav(e.target);
      window.location.hash = target;
    });

    // Scroll-spy via IntersectionObserver
    if (typeof IntersectionObserver !== 'undefined') {
      var spyObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var id = entry.target.id; // e.g. "section-languages"
          var sectionName = id.replace('section-', '');
          var btn = navLinks.querySelector('[data-section="' + sectionName + '"]');
          if (btn) setActiveNav(btn);
        });
      }, { rootMargin: '-20% 0px -60% 0px' });

      sections.forEach(function (s) {
        var anchor = document.getElementById('section-' + s);
        if (anchor) spyObserver.observe(anchor);
      });
    }
  }

  function setActiveNav(activeBtn) {
    if (!navLinks) return;
    navLinks.querySelectorAll('button').forEach(function (b) {
      b.classList.remove('active');
      b.removeAttribute('aria-current');
    });
    activeBtn.classList.add('active');
    activeBtn.setAttribute('aria-current', 'true');
  }

  // ── Back-to-Top Button ──
  (function () {
    var btn = document.querySelector('.back-to-top');
    if (!btn) {
      // Create one if it doesn't exist in the HTML
      btn = el('button', { className: 'back-to-top', title: 'Back to top', 'aria-label': 'Back to top', textContent: '\u2191' });
      document.body.appendChild(btn);
    }
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    window.addEventListener('scroll', function () {
      if (window.scrollY > 300) {
        btn.classList.add('visible');
      } else {
        btn.classList.remove('visible');
      }
    }, { passive: true });
  })();

  // ── Executive Summary ──
  (function () {
    var overviewSection = document.getElementById('section-overview');
    if (!overviewSection) return;

    var langs = D.languages || {};
    var langEntries = Object.keys(langs).map(function (k) { return { name: k, count: langs[k] }; })
      .sort(function (a, b) { return b.count - a.count; });
    var total = langEntries.reduce(function (s, e) { return s + e.count; }, 0);
    var langCount = langEntries.length;

    // Primary language
    var primary = langEntries.length > 0 ? langEntries[0] : null;
    var primaryPct = primary && total > 0 ? (primary.count / total * 100).toFixed(0) : 0;

    // Cloud providers present
    var cloudProviders = [];
    if (D.aws && D.aws.length > 0) cloudProviders.push('AWS');
    if (D.azure && D.azure.length > 0) cloudProviders.push('Azure');
    if (D.gcp && D.gcp.length > 0) cloudProviders.push('GCP');

    // CI/CD tools
    var cicdTools = (D.cicd || []).filter(function (t) { return t.category === 'ci'; });
    var cicdNames = cicdTools.map(function (t) { return t.name; });

    // Testing tools
    var testingTools = (D.testing || []).filter(function (t) { return t.category === 'testing' || t.category === 'e2e'; });
    var lintingTools = (D.testing || []).filter(function (t) { return t.category === 'linting'; });

    // Databases
    var databases = D.databases || [];
    var dbNames = databases.map(function (d) { return d.name; });

    // Build identity line
    var identityParts = [];
    if (primary) identityParts.push('Primary language: ' + primary.name + ' (' + primaryPct + '%)');
    if (langCount > 1) identityParts.push(langCount + ' languages');
    if (cloudProviders.length > 0) identityParts.push(cloudProviders.join(' + '));
    if (cicdNames.length > 0) identityParts.push(cicdNames[0]);

    // Build findings
    var findings = [];

    if (cloudProviders.length > 1) {
      findings.push({ cls: 'finding-info', text: 'Multi-cloud: ' + cloudProviders.join(' + ') + ' detected' });
    }

    if (cicdNames.length === 0) {
      findings.push({ cls: 'finding-risk', text: 'No CI/CD pipeline detected' });
    } else {
      findings.push({ cls: 'finding-good', text: 'CI/CD: ' + cicdNames.join(', ') });
    }

    if (testingTools.length === 0) {
      findings.push({ cls: 'finding-risk', text: 'No testing frameworks detected' });
    } else {
      if (lintingTools.length === 0) {
        findings.push({ cls: 'finding-warn', text: 'No linting tools detected' });
      }
      if (testingTools.length > 3) {
        findings.push({ cls: 'finding-info', text: 'Multiple test frameworks (' + testingTools.length + ') \u2014 consider standardizing' });
      }
    }

    if (databases.length > 0) {
      findings.push({ cls: 'finding-info', text: 'Databases: ' + dbNames.join(', ') });
    }

    // Build the summary card
    var card = el('div', { className: 'exec-summary', id: 'exec-summary' });
    card.appendChild(el('div', { className: 'exec-summary-title', textContent: 'Executive Summary' }));
    if (identityParts.length > 0) {
      card.appendChild(el('div', { className: 'exec-summary-identity', textContent: identityParts.join(' \u00B7 ') }));
    }

    if (findings.length > 0) {
      var pillContainer = el('div', { className: 'exec-findings' });
      findings.forEach(function (f) {
        pillContainer.appendChild(el('span', { className: 'exec-finding ' + f.cls, textContent: f.text }));
      });
      card.appendChild(pillContainer);
    }

    // Insert after the overview header
    overviewSection.parentNode.insertBefore(card, overviewSection.nextSibling);
  })();

  // ── Section: Languages ──
  (function () {
    var langs = D.languages;
    if (!langs || Object.keys(langs).length === 0) return;

    var entries = Object.keys(langs).map(function (k) {
      return { name: k, count: langs[k] };
    }).sort(function (a, b) { return b.count - a.count; });

    var total = entries.reduce(function (s, e) { return s + e.count; }, 0);

    // Language donut chart — REMOVED per review (keep bar only)
    // Remove the donut chart element from DOM and make bar full-width
    var donutEl = document.getElementById('language-donut-chart');
    if (donutEl) {
      var donutCard = donutEl.closest('.card');
      if (donutCard) donutCard.parentNode.removeChild(donutCard);
    }

    // Make the bar chart card full-width
    var barEl = document.getElementById('language-bar-chart');
    if (barEl) {
      var barCard = barEl.closest('.card');
      if (barCard) barCard.style.gridColumn = 'span 2';

      queueChart(barEl, function (domEl) {
        var chart = echarts.init(domEl);
        var top20 = entries.slice(0, 20);
        chart.setOption({
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
        return chart;
      });
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

    // Cloud summary overview cards
    var summaryDiv = el('div', { className: 'cloud-summary' });
    var hasAnyProvider = false;
    providers.forEach(function (prov) {
      var services = D[prov.key];
      if (!services || services.length === 0) return;
      hasAnyProvider = true;
      var grouped = {};
      services.forEach(function (s) { grouped[s.service] = true; });
      var uniqueCount = Object.keys(grouped).length;
      var uniqueSources = {};
      services.forEach(function (s) { uniqueSources[s.source] = true; });

      var card = el('div', { className: 'cloud-summary-card' });
      var icon = el('div', { className: 'cloud-summary-icon', style: 'background:' + prov.color + '22;color:' + prov.color, textContent: prov.icon });
      var info = el('div', { className: 'cloud-summary-info' });
      info.appendChild(el('div', { className: 'cloud-summary-name', textContent: prov.name }));
      var stat = el('div', { className: 'cloud-summary-stat', style: 'color:' + prov.color, textContent: uniqueCount + ' services' });
      info.appendChild(stat);
      info.appendChild(el('div', { className: 'cloud-summary-detail', textContent: 'across ' + Object.keys(uniqueSources).length + ' files · ' + services.length + ' total references' }));
      card.appendChild(icon);
      card.appendChild(info);
      summaryDiv.appendChild(card);
    });
    if (hasAnyProvider) container.appendChild(summaryDiv);

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
          meta.appendChild(srcBadge(src));
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
        meta.appendChild(srcBadge(fw.source));
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
        meta.appendChild(srcBadge(db.source));
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
        meta.appendChild(srcBadge(tool.source));
        card.appendChild(meta);
        grid.appendChild(card);
      });
      section.appendChild(grid);
      container.appendChild(section);
    });

    // Make infra card full-width (donut chart REMOVED per review)
    var infraCard = container.closest('.card');
    if (infraCard) infraCard.style.gridColumn = 'span 2';
    var infraDonutEl = document.getElementById('infra-donut-chart');
    if (infraDonutEl) {
      var donutCard = infraDonutEl.closest('.card');
      if (donutCard) donutCard.parentNode.removeChild(donutCard);
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
        metaDiv.appendChild(srcBadge(tool.source));
        card.appendChild(metaDiv);
        grid.appendChild(card);
      });
      section.appendChild(grid);
      container.appendChild(section);
    });

    // Quality bar chart — with minInterval: 1 fix
    var chartEl = document.getElementById('quality-bar-chart');
    if (chartEl) {
      queueChart(chartEl, function (domEl) {
        var chart = echarts.init(domEl);
        var cats = ['testing', 'e2e', 'linting', 'formatting', 'coverage'];
        var labels = cats.map(function (c) { return (categoryMeta[c] || { label: c }).label; });
        var values = cats.map(function (c) { return grouped[c] ? grouped[c].length : 0; });
        var colors = cats.map(function (c) { return (categoryMeta[c] || { color: '#94a3b8' }).color; });
        chart.setOption({
          tooltip: { trigger: 'axis' },
          grid: { left: 120, right: 40, top: 20, bottom: 20 },
          xAxis: {
            type: 'value',
            minInterval: 1,
            axisLabel: { color: '#94a3b8' },
            splitLine: { lineStyle: { color: 'rgba(71,85,105,0.3)' } }
          },
          yAxis: { type: 'category', data: labels, axisLabel: { color: '#f1f5f9', fontSize: 12 } },
          series: [{
            type: 'bar', barWidth: 20,
            data: values.map(function (v, i) { return { value: v, itemStyle: { color: colors[i], borderRadius: [0, 4, 4, 0] } }; }),
            label: { show: true, position: 'right', color: '#94a3b8', fontSize: 11 }
          }]
        });
        return chart;
      });
    }
  })();

  // ── Section: Resource x File Matrix ──
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

    // State — sets of VISIBLE items (Excel-style: all selected by default)
    var selectedServices = {};
    services.forEach(function (s) { selectedServices[s.provider + '::' + s.service] = true; });
    var selectedFiles = {};
    files.forEach(function (f) { selectedFiles[f] = true; });
    var compareMode = false;
    var compareSelected = {};

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

    // Collapsible wrapper for large matrices
    var COLLAPSIBLE_THRESHOLD = 15;
    var totalRows = services.length;

    // ── Excel-style filter dropdown builder ──
    function buildFilterDropdown(btnLabel, allItems, selectedMap, getLabelFn, getKeyFn, getCountFn, onApply) {
      var wrap = el('div', { className: 'filter-dropdown-wrap' });
      var totalSelected = allItems.filter(function (it) { return selectedMap[getKeyFn(it)]; }).length;
      var hasFilter = totalSelected < allItems.length;

      var btn = el('button', { className: 'filter-dropdown-btn' + (hasFilter ? ' has-filter' : '') });
      btn.innerHTML = '&#9662; ' + btnLabel;
      if (hasFilter) {
        var countBadge = el('span', { className: 'filter-count', textContent: String(totalSelected) + '/' + allItems.length });
        btn.appendChild(countBadge);
      }
      wrap.appendChild(btn);

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        // Close any other open dropdowns
        document.querySelectorAll('.filter-dropdown-panel').forEach(function (p) { p.remove(); });
        document.querySelectorAll('.filter-backdrop').forEach(function (b) { b.remove(); });

        var localSelected = {};
        allItems.forEach(function (it) { localSelected[getKeyFn(it)] = !!selectedMap[getKeyFn(it)]; });
        var searchQuery = '';

        function renderPanel() {
          // Remove old panel
          var old = wrap.querySelector('.filter-dropdown-panel');
          if (old) old.remove();

          var panel = el('div', { className: 'filter-dropdown-panel' });

          // Header
          var header = el('div', { className: 'filter-dropdown-header' });
          var selCount = allItems.filter(function (it) { return localSelected[getKeyFn(it)]; }).length;
          header.appendChild(el('span', { textContent: selCount + ' of ' + allItems.length + ' selected' }));
          panel.appendChild(header);

          // Search
          var searchInput = el('input', { className: 'filter-dropdown-search' });
          searchInput.setAttribute('type', 'text');
          searchInput.setAttribute('placeholder', 'Search...');
          searchInput.value = searchQuery;
          searchInput.addEventListener('input', function () { searchQuery = searchInput.value.toLowerCase(); renderPanel(); });
          panel.appendChild(searchInput);

          // List
          var list = el('div', { className: 'filter-dropdown-list' });

          // Filter items by search
          var visItems = allItems.filter(function (it) {
            return !searchQuery || getLabelFn(it).toLowerCase().indexOf(searchQuery) >= 0;
          });

          // Select All row
          var allChecked = visItems.every(function (it) { return localSelected[getKeyFn(it)]; });
          var someChecked = visItems.some(function (it) { return localSelected[getKeyFn(it)]; });
          var selectAllItem = el('div', { className: 'filter-dropdown-item' + (allChecked ? ' checked' : (someChecked ? ' partial' : '')) });
          selectAllItem.style.borderBottom = '1px solid rgba(71,85,105,0.2)';
          selectAllItem.style.fontWeight = '700';
          var saCheckbox = el('span', { className: 'filter-checkbox', textContent: allChecked ? '\u2713' : (someChecked ? '\u2500' : '') });
          selectAllItem.appendChild(saCheckbox);
          selectAllItem.appendChild(el('span', { className: 'filter-dropdown-label', textContent: '(Select All)' }));
          selectAllItem.addEventListener('click', function () {
            var newState = !allChecked;
            visItems.forEach(function (it) { localSelected[getKeyFn(it)] = newState; });
            renderPanel();
          });
          list.appendChild(selectAllItem);

          // Individual items
          visItems.forEach(function (it) {
            var key = getKeyFn(it);
            var isChecked = localSelected[key];
            var item = el('div', { className: 'filter-dropdown-item' + (isChecked ? ' checked' : '') });
            var cb = el('span', { className: 'filter-checkbox', textContent: isChecked ? '\u2713' : '' });
            item.appendChild(cb);
            var label = el('span', { className: 'filter-dropdown-label', textContent: getLabelFn(it) });
            label.setAttribute('title', getLabelFn(it));
            item.appendChild(label);
            var count = getCountFn(it);
            if (count !== null) {
              item.appendChild(el('span', { className: 'filter-dropdown-count', textContent: String(count) }));
            }
            item.addEventListener('click', function () {
              localSelected[key] = !localSelected[key];
              renderPanel();
            });
            list.appendChild(item);
          });

          panel.appendChild(list);

          // Footer
          var footer = el('div', { className: 'filter-dropdown-footer' });
          var clearBtn = el('button', { textContent: 'Clear All' });
          clearBtn.addEventListener('click', function () {
            allItems.forEach(function (it) { localSelected[getKeyFn(it)] = false; });
            renderPanel();
          });
          footer.appendChild(clearBtn);

          var selectAllBtn = el('button', { textContent: 'Select All' });
          selectAllBtn.addEventListener('click', function () {
            allItems.forEach(function (it) { localSelected[getKeyFn(it)] = true; });
            renderPanel();
          });
          footer.appendChild(selectAllBtn);

          var applyBtn = el('button', { className: 'apply-btn', textContent: 'Apply' });
          applyBtn.addEventListener('click', function () {
            // Copy local state to real state
            allItems.forEach(function (it) { selectedMap[getKeyFn(it)] = !!localSelected[getKeyFn(it)]; });
            closePanel();
            onApply();
          });
          footer.appendChild(applyBtn);

          panel.appendChild(footer);
          wrap.appendChild(panel);

          // Focus search
          setTimeout(function () { searchInput.focus(); }, 50);
        }

        function closePanel() {
          var p = wrap.querySelector('.filter-dropdown-panel');
          if (p) p.remove();
          var b = document.querySelector('.filter-backdrop');
          if (b) b.remove();
        }

        // Backdrop to close on click outside
        var backdrop = el('div', { className: 'filter-backdrop' });
        backdrop.addEventListener('click', closePanel);
        document.body.appendChild(backdrop);

        renderPanel();
      });

      return wrap;
    }

    function render() {
      container.textContent = '';

      // Filter services and files based on selected sets
      var visServices = services.filter(function (s) {
        return selectedServices[s.provider + '::' + s.service];
      });
      var visFiles = files.filter(function (f) {
        return selectedFiles[f];
      });

      // Toolbar
      var toolbar = el('div', { className: 'matrix-toolbar' });

      // Resource filter dropdown
      var resDropdown = buildFilterDropdown(
        'Resources',
        services,
        selectedServices,
        function (s) { return s.service + ' (' + s.provider.toUpperCase() + ')'; },
        function (s) { return s.provider + '::' + s.service; },
        function (s) { return Object.keys(s.files).length; },
        function () { render(); }
      );
      toolbar.appendChild(resDropdown);

      // File filter dropdown
      var fileDropdown = buildFilterDropdown(
        'Files',
        files.map(function (f) { return { path: f }; }),
        selectedFiles,
        function (f) { return shortFile(f.path); },
        function (f) { return f.path; },
        function (f) { return fileServiceCount[f.path] || 0; },
        function () { render(); }
      );
      toolbar.appendChild(fileDropdown);

      // Provider quick toggles
      var fg = el('div', { className: 'filter-group' });
      fg.appendChild(el('label', { textContent: 'Providers:' }));
      providers.forEach(function (p) {
        if (!D[p.key] || D[p.key].length === 0) return;
        var provServices = services.filter(function (s) { return s.provider === p.key; });
        var allOn = provServices.every(function (s) { return selectedServices[s.provider + '::' + s.service]; });
        var btn = el('button', {
          className: 'provider-toggle ' + p.cls + (allOn ? ' active' : ''),
          textContent: p.label
        });
        btn.addEventListener('click', function () {
          var newState = !allOn;
          provServices.forEach(function (s) { selectedServices[s.provider + '::' + s.service] = newState; });
          render();
        });
        fg.appendChild(btn);
      });
      toolbar.appendChild(fg);

      // Compare toggle
      var cmpBtn = el('button', {
        className: 'provider-toggle' + (compareMode ? ' active' : ''),
        textContent: compareMode ? '\u2715 Exit Compare' : '\u2194 Compare',
        style: 'color:#a78bfa' + (compareMode ? ';background:rgba(167,139,250,0.15);border-color:#a78bfa' : '')
      });
      cmpBtn.setAttribute('title', 'Compare mode: click 2+ resources to highlight which files they share');
      cmpBtn.addEventListener('click', function () {
        compareMode = !compareMode;
        if (!compareMode) compareSelected = {};
        render();
      });
      toolbar.appendChild(cmpBtn);

      if (compareMode) {
        var helpText = el('span', { className: 'matrix-stats', style: 'color:#a78bfa;font-style:italic' });
        var selCmp = Object.keys(compareSelected).length;
        helpText.textContent = selCmp === 0
          ? 'Click resource rows to select them for comparison'
          : selCmp + ' selected \u2014 shared files are highlighted';
        toolbar.appendChild(helpText);
      }

      // Stats
      toolbar.appendChild(el('span', { className: 'matrix-stats', textContent: visServices.length + ' resources \u00D7 ' + visFiles.length + ' files' }));

      container.appendChild(toolbar);

      if (visServices.length === 0 || visFiles.length === 0) {
        var empty = el('div', { className: 'empty-state', textContent: 'No matching resources or files. Adjust filters.' });
        container.appendChild(empty);
        return;
      }

      // Wrap in <details> if large
      var matrixWrapper;
      if (totalRows > COLLAPSIBLE_THRESHOLD) {
        var details = document.createElement('details');
        details.className = 'collapsible';
        details.setAttribute('open', '');
        var summary = document.createElement('summary');
        summary.textContent = 'Resource \u00D7 File Matrix (' + visServices.length + ' resources, ' + visFiles.length + ' files) \u2014 click to collapse';
        details.appendChild(summary);
        matrixWrapper = details;
      } else {
        matrixWrapper = el('div');
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
        th.setAttribute('title', f);
        th.style.cursor = 'default';
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
        var fileCount = Object.keys(s.files).filter(function (f) { return selectedFiles[f]; }).length;
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
          rh.style.cursor = 'default';
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
      matrixWrapper.appendChild(scrollDiv);
      container.appendChild(matrixWrapper);

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
      headerRow.appendChild(el('th', { textContent: 'Package', 'aria-sort': 'none' }));
      headerRow.appendChild(el('th', { textContent: 'Version', 'aria-sort': 'none' }));
      headerRow.appendChild(el('th', { textContent: 'Source', 'aria-sort': 'none' }));
      thead.appendChild(headerRow);
      table.appendChild(thead);

      var PAGE_SIZE = 25;
      var currentPage = 0;
      var filteredPkgs = packages.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });

      var tbody = el('tbody');
      table.appendChild(tbody);

      var paginationDiv = el('div', { className: 'pagination' });
      var pageInfo = el('span', { className: 'page-info' });
      var prevBtn = el('button', { textContent: '\u2190 Prev' });
      var nextBtn = el('button', { textContent: 'Next \u2192' });
      paginationDiv.appendChild(pageInfo);
      paginationDiv.appendChild(prevBtn);
      paginationDiv.appendChild(nextBtn);

      function renderPage() {
        tbody.textContent = '';
        var start = currentPage * PAGE_SIZE;
        var end = Math.min(start + PAGE_SIZE, filteredPkgs.length);
        for (var pi = start; pi < end; pi++) {
          var pkg = filteredPkgs[pi];
          var row = el('tr');
          row.appendChild(el('td', { textContent: pkg.name }));
          row.appendChild(el('td', { textContent: pkg.version || '-', className: 'num' }));
          var srcCell = el('td', { className: 'mono' });
          srcCell.textContent = pkg.source.split('/').slice(-2).join('/');
          srcCell.setAttribute('title', pkg.source);
          row.appendChild(srcCell);
          tbody.appendChild(row);
        }
        var totalPages = Math.ceil(filteredPkgs.length / PAGE_SIZE);
        pageInfo.textContent = filteredPkgs.length + ' packages \u2014 page ' + (currentPage + 1) + ' of ' + Math.max(1, totalPages);
        prevBtn.disabled = currentPage === 0;
        nextBtn.disabled = end >= filteredPkgs.length;
      }

      prevBtn.addEventListener('click', function () { if (currentPage > 0) { currentPage--; renderPage(); } });
      nextBtn.addEventListener('click', function () { if ((currentPage + 1) * PAGE_SIZE < filteredPkgs.length) { currentPage++; renderPage(); } });

      panel.appendChild(table);
      panel.appendChild(paginationDiv);

      // Search filtering
      searchInput.addEventListener('input', function () {
        var query = searchInput.value.toLowerCase();
        filteredPkgs = packages.filter(function (pkg) {
          return (pkg.name + ' ' + (pkg.version || '') + ' ' + pkg.source).toLowerCase().indexOf(query) >= 0;
        });
        currentPage = 0;
        renderPage();
      });

      renderPage();
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
      queueChart(depChartEl, function (domEl) {
        var chart = echarts.init(domEl);
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
        return chart;
      });
    }
  })();

  // ── Section: Manifest Files ──
  (function () {
    var container = document.getElementById('manifest-list');
    if (!container || !D.manifest_files || D.manifest_files.length === 0) return;

    var table = el('table', { className: 'data-table' });
    var thead = el('thead');
    var hr = el('tr');
    hr.appendChild(el('th', { textContent: '#', 'aria-sort': 'none' }));
    hr.appendChild(el('th', { textContent: 'Manifest File', 'aria-sort': 'none' }));
    hr.appendChild(el('th', { textContent: 'Directory', 'aria-sort': 'none' }));
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = el('tbody');
    table.appendChild(tbody);

    var MPAGE = 25;
    var mPage = 0;
    var sortedManifests = D.manifest_files.slice().sort();

    var mPag = el('div', { className: 'pagination' });
    var mInfo = el('span', { className: 'page-info' });
    var mPrev = el('button', { textContent: '\u2190 Prev' });
    var mNext = el('button', { textContent: 'Next \u2192' });
    mPag.appendChild(mInfo);
    mPag.appendChild(mPrev);
    mPag.appendChild(mNext);

    function renderManifestPage() {
      tbody.textContent = '';
      var start = mPage * MPAGE;
      var end = Math.min(start + MPAGE, sortedManifests.length);
      for (var mi = start; mi < end; mi++) {
        var f = sortedManifests[mi];
        var row = el('tr');
        row.appendChild(el('td', { className: 'num', textContent: String(mi + 1) }));
        var parts = f.split('/');
        var fname = parts.pop();
        var dir = parts.join('/') || '.';
        row.appendChild(el('td', { textContent: fname, className: 'mono', style: 'color:#f1f5f9;font-weight:600' }));
        row.appendChild(el('td', { textContent: dir, className: 'mono' }));
        tbody.appendChild(row);
      }
      var totalPages = Math.ceil(sortedManifests.length / MPAGE);
      mInfo.textContent = sortedManifests.length + ' files \u2014 page ' + (mPage + 1) + ' of ' + Math.max(1, totalPages);
      mPrev.disabled = mPage === 0;
      mNext.disabled = end >= sortedManifests.length;
    }

    mPrev.addEventListener('click', function () { if (mPage > 0) { mPage--; renderManifestPage(); } });
    mNext.addEventListener('click', function () { if ((mPage + 1) * MPAGE < sortedManifests.length) { mPage++; renderManifestPage(); } });

    container.appendChild(table);
    container.appendChild(mPag);
    renderManifestPage();
  })();

  // ── Hide zero-count metric cards ──
  (function () {
    var grid = document.querySelector('.metric-grid');
    if (!grid) return;
    grid.querySelectorAll('.metric-card').forEach(function (card) {
      var valueEl = card.querySelector('.metric-value');
      if (valueEl && valueEl.textContent.trim() === '0') {
        card.classList.add('zero-count');
      }
    });
  })();

  // ── Table Sorting for data-table th elements ──
  (function () {
    var tables = document.querySelectorAll('.data-table');
    tables.forEach(function (table) {
      var headers = table.querySelectorAll('th');
      headers.forEach(function (th, colIdx) {
        th.style.cursor = 'pointer';
        th.setAttribute('aria-sort', 'none');
        th.addEventListener('click', function () {
          var tbody = table.querySelector('tbody');
          if (!tbody) return;
          var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
          var currentSort = th.getAttribute('aria-sort');
          var ascending = currentSort !== 'ascending';

          // Reset all headers in this table
          headers.forEach(function (h) { h.setAttribute('aria-sort', 'none'); });
          th.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');

          rows.sort(function (a, b) {
            var aCell = a.children[colIdx];
            var bCell = b.children[colIdx];
            if (!aCell || !bCell) return 0;
            var aText = aCell.textContent.trim();
            var bText = bCell.textContent.trim();
            // Try numeric sort
            var aNum = parseFloat(aText);
            var bNum = parseFloat(bText);
            if (!isNaN(aNum) && !isNaN(bNum)) {
              return ascending ? aNum - bNum : bNum - aNum;
            }
            // String sort
            var cmp = aText.localeCompare(bText);
            return ascending ? cmp : -cmp;
          });

          rows.forEach(function (row) { tbody.appendChild(row); });
        });
      });
    });
  })();

  // ── Initialize lazy chart observer ──
  setupChartObserver();
})();
