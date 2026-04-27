// RepoAnalyze Report — Premium Analytics Dashboard
// Vanilla JS + ECharts visualization engine
(function () {
  'use strict';

  // ── Color Palette ──
  var COLORS = [
    '#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#f472b6',
    '#facc15', '#22d3ee', '#818cf8', '#4ade80', '#f87171'
  ];

  // ── ECharts Theme Registration ──
  echarts.registerTheme('repoguru', {
    color: COLORS,
    backgroundColor: 'transparent',
    textStyle: { color: '#94a3b8', fontFamily: "'Inter', system-ui, sans-serif" },
    title: { textStyle: { color: '#f1f5f9' }, subtextStyle: { color: '#64748b' } },
    legend: { textStyle: { color: '#94a3b8' }, inactiveColor: '#475569' },
    tooltip: {
      backgroundColor: 'rgba(15,23,42,0.95)', borderColor: '#334155',
      textStyle: { color: '#f1f5f9', fontSize: 13 }
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: '#334155' } },
      axisTick: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#1e293b' } }
    },
    valueAxis: {
      axisLine: { lineStyle: { color: '#334155' } },
      axisTick: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }
    },
    dataZoom: [{
      type: 'inside', borderColor: '#334155',
      textStyle: { color: '#94a3b8' },
      dataBackground: { lineStyle: { color: '#475569' }, areaStyle: { color: '#1e293b' } },
      fillerColor: 'rgba(56,189,248,0.1)',
      handleStyle: { color: '#38bdf8', borderColor: '#38bdf8' }
    }, {
      type: 'slider', borderColor: '#334155',
      textStyle: { color: '#94a3b8' },
      dataBackground: { lineStyle: { color: '#475569' }, areaStyle: { color: '#1e293b' } },
      fillerColor: 'rgba(56,189,248,0.1)',
      handleStyle: { color: '#38bdf8', borderColor: '#38bdf8' }
    }]
  });

  // ── Utility Functions ──
  function fmtNum(n) {
    if (n == null) return '0';
    return Number(n).toLocaleString();
  }

  function fmtK(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  function fmtCompact(n) {
    if (n == null) return '0';
    var abs = Math.abs(n);
    if (abs >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  function fmtPct(n, total) {
    if (!total) return '0%';
    return (n / total * 100).toFixed(1) + '%';
  }

  function ordinal(n) {
    var s = ['th','st','nd','rd'];
    var v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // ── Lazy Chart Initialization via IntersectionObserver ──
  var allCharts = [];
  var lazyChartQueue = []; // { id, optsFn }
  var lazyChartObserver = null;

  if (typeof IntersectionObserver !== 'undefined') {
    lazyChartObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.id;
          for (var i = 0; i < lazyChartQueue.length; i++) {
            if (lazyChartQueue[i].id === id) {
              var item = lazyChartQueue[i];
              var chart = echarts.init(entry.target, 'repoguru');
              chart.setOption(item.opts);
              allCharts.push(chart);
              lazyChartQueue.splice(i, 1);
              lazyChartObserver.unobserve(entry.target);
              break;
            }
          }
        }
      });
    }, { rootMargin: '200px 0px 200px 0px', threshold: 0 });
  }

  function initChart(id, opts) {
    var container = document.getElementById(id);
    if (!container) return null;
    if (lazyChartObserver) {
      lazyChartQueue.push({ id: id, opts: opts });
      lazyChartObserver.observe(container);
      return null;
    }
    // Fallback if IntersectionObserver not available
    var chart = echarts.init(container, 'repoguru');
    chart.setOption(opts);
    allCharts.push(chart);
    return chart;
  }

  // ── DOM Helpers (safe, no innerHTML) ──
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'textContent') node.textContent = attrs[k];
      else if (k === 'className') node.className = attrs[k];
      else if (k === 'disabled') { if (attrs[k]) node.setAttribute('disabled', ''); }
      else if (k === 'style') node.setAttribute('style', attrs[k]);
      else node.setAttribute(k, attrs[k]);
    });
    if (children) children.forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function textEl(tag, text, className) {
    var node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  // ── Insight Card Builder ──
  function createInsightCard(icon, text, type) {
    var card = el('div', { className: 'insight-card insight-' + (type || 'info') });
    var iconSpan = el('span', { className: 'insight-icon', textContent: icon });
    var textSpan = el('span', { className: 'insight-text', textContent: text });
    card.appendChild(iconSpan);
    card.appendChild(textSpan);
    return card;
  }

  function createInsightPanel(insights) {
    var panel = el('div', { className: 'insight-panel' });
    insights.forEach(function (ins) {
      panel.appendChild(createInsightCard(ins[0], ins[1], ins[2]));
    });
    return panel;
  }

  function appendInsightsAfter(chartId, insights) {
    var chartEl = document.getElementById(chartId);
    if (!chartEl) return;
    var parent = chartEl.parentNode;
    if (parent) {
      parent.appendChild(createInsightPanel(insights));
    }
  }

  // ── Mini Stat Card Builder ──
  function createMiniStat(label, value, subtitle, colorClass) {
    var card = el('div', { className: 'mini-stat ' + (colorClass || '') });
    card.appendChild(textEl('div', value, 'mini-stat-value'));
    card.appendChild(textEl('div', label, 'mini-stat-label'));
    if (subtitle) {
      card.appendChild(textEl('div', subtitle, 'mini-stat-subtitle'));
    }
    return card;
  }

  // Styles are loaded from style.css — no dynamic injection needed

  // ── Navigation Bar ──
  function buildNavBar() {
    // Nav is static HTML — just wire up click handlers and observer
    var navButtons = [];
    var btns = document.querySelectorAll('.rg-nav-link[data-target]');
    btns.forEach(function (btn) {
      var target = btn.getAttribute('data-target');
      btn.addEventListener('click', function () {
        var el2 = document.querySelector(target);
        if (el2) {
          el2.scrollIntoView({ behavior: 'smooth', block: 'start' });
          window.location.hash = target.replace('#', '');
        }
      });
      navButtons.push({ btn: btn, target: target });
    });

    // Timezone selector — inject into the static #tz-wrap container
    var tzWrap = document.getElementById('tz-wrap');
    if (tzWrap) {
      var tzLabel = el('span', { className: 'rg-tz-label', textContent: 'Timezone:' });
      var tzSelect = el('select', { className: 'rg-tz-select', title: 'Display timezone for time-based charts' });
      tzSelect.setAttribute('aria-label', 'Timezone');
      var userOffset = Math.round(-(new Date().getTimezoneOffset() / 60));
      for (var tz = -12; tz <= 14; tz++) {
        var opt = document.createElement('option');
        opt.value = tz;
        opt.textContent = 'UTC' + (tz >= 0 ? '+' : '') + tz;
        if (tz === userOffset) opt.selected = true;
        tzSelect.appendChild(opt);
      }
      tzSelect.addEventListener('change', function () {
        window.__TZ_OFFSET = parseInt(tzSelect.value);
        window.dispatchEvent(new Event('tz-change'));
      });
      window.__TZ_OFFSET = userOffset;
      tzWrap.appendChild(tzLabel);
      tzWrap.appendChild(tzSelect);
    }

    // Active section tracking via IntersectionObserver
    if (typeof IntersectionObserver !== 'undefined') {
      var observerTargets = [];
      navButtons.forEach(function (nb, idx) {
        var targetEl = document.querySelector(nb.target);
        if (targetEl) observerTargets.push({ el: targetEl, idx: idx });
      });

      var activeIdx = 0;
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            for (var i = 0; i < observerTargets.length; i++) {
              if (observerTargets[i].el === entry.target) {
                activeIdx = observerTargets[i].idx;
                break;
              }
            }
            navButtons.forEach(function (nb, j) {
              if (j === activeIdx) {
                nb.btn.classList.add('active');
                nb.btn.setAttribute('aria-current', 'true');
              } else {
                nb.btn.classList.remove('active');
                nb.btn.removeAttribute('aria-current');
              }
            });
          }
        });
      }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });

      observerTargets.forEach(function (ot) { observer.observe(ot.el); });
    }

    // Back-to-top button (already in static HTML)
    var topBtn = document.querySelector('.back-to-top');
    if (topBtn) {
      topBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      window.addEventListener('scroll', function () {
        if (window.scrollY > 300) {
          topBtn.classList.add('visible');
        } else {
          topBtn.classList.remove('visible');
        }
      });
    }
  }

  // ── Gradient Helpers ──
  function verticalGradient(top, bottom) {
    return new echarts.graphic.LinearGradient(0, 0, 0, 1,
      [{ offset: 0, color: top }, { offset: 1, color: bottom }]);
  }

  function horizontalGradient(left, right) {
    return new echarts.graphic.LinearGradient(0, 0, 1, 0,
      [{ offset: 0, color: left }, { offset: 1, color: right }]);
  }

  function areaGradient(color, topOpacity, bottomOpacity) {
    return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: color.replace(')', ',' + topOpacity + ')').replace('rgb', 'rgba') },
      { offset: 1, color: color.replace(')', ',' + bottomOpacity + ')').replace('rgb', 'rgba') }
    ]);
  }

  // Common bar style with rounded corners
  function roundedBarStyle(gradient) {
    return {
      color: gradient,
      borderRadius: [4, 4, 4, 4]
    };
  }

  // ── Standard DataZoom for time charts ──
  // Charts using this MUST set grid.bottom >= 44 to avoid slider overlap
  function timeDataZoom() {
    return [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', start: 0, end: 100, bottom: 8, height: 22,
        borderColor: '#334155', fillerColor: 'rgba(56,189,248,0.12)',
        backgroundColor: 'rgba(15,23,42,0.9)',
        dataBackground: { lineStyle: { color: '#334155' }, areaStyle: { color: 'rgba(56,189,248,0.05)' } },
        selectedDataBackground: { lineStyle: { color: '#38bdf8' }, areaStyle: { color: 'rgba(56,189,248,0.1)' } },
        handleStyle: { color: '#38bdf8', borderColor: '#38bdf8' },
        textStyle: { color: '#64748b', fontSize: 10 }
      }
    ];
  }

  // ── Rich tooltip formatter for commits ──
  function commitsTooltip(params) {
    if (!Array.isArray(params)) params = [params];
    var lines = [];
    var header = params[0].axisValueLabel || params[0].name || '';
    lines.push(header);
    params.forEach(function (p) {
      var marker = p.marker || '';
      var val = typeof p.value === 'number' ? fmtNum(p.value) : fmtNum(p.value);
      lines.push(marker + ' ' + p.seriesName + ': ' + val);
    });
    return lines.join('\n');
  }

  // ══════════════════════════════════════════════════
  // ── MAIN INITIALIZATION ──
  // ══════════════════════════════════════════════════

  var D = window.__REPORT_DATA__;
  if (!D) return;

  // ── Derived Stats Computation ──
  var totalCommitsAll = D.metrics ? D.metrics.total_commits : 0;

  // ── KPI Hero Cards — inject derived metrics ──
  (function () {
    var metricGrid = document.querySelector('.metric-grid');
    if (!metricGrid) return;

    // Net LOC
    var netLoc = 0;
    if (D.timeseries && D.timeseries.length > 0) {
      var cumI = 0, cumD = 0;
      D.timeseries.forEach(function (d) { cumI += d.insertions; cumD += d.deletions; });
      netLoc = cumI - cumD;
    }
    var netLocCard = el('div', { className: 'metric-card' });
    netLocCard.appendChild(textEl('div', fmtCompact(netLoc), 'metric-value'));
    netLocCard.appendChild(textEl('div', 'Net LOC', 'metric-label'));
    metricGrid.appendChild(netLocCard);

    // Active Authors (last 90 days) — use bus factor as proxy if author dates unavailable
    var activeAuthorsVal = null;
    if (D.bus_factor && D.bus_factor.factor) {
      activeAuthorsVal = D.bus_factor.factor;
    }
    if (activeAuthorsVal !== null) {
      var aaCard = el('div', { className: 'metric-card' });
      aaCard.appendChild(textEl('div', String(activeAuthorsVal), 'metric-value'));
      aaCard.appendChild(textEl('div', 'Bus Factor', 'metric-label'));
      metricGrid.appendChild(aaCard);
    }

    // Reformat existing metric values to compact form
    var existingValues = metricGrid.querySelectorAll('.metric-value');
    for (var i = 0; i < existingValues.length; i++) {
      var raw = existingValues[i].getAttribute('data-raw');
      if (raw) {
        var num = parseInt(raw, 10);
        if (!isNaN(num) && num >= 1000) {
          existingValues[i].textContent = fmtCompact(num);
        }
      }
    }
  })();

  // ── Executive Summary ──
  (function () {
    if (!D.radar_metrics || D.radar_metrics.length === 0) return;

    // Compute scores
    var avgScore = 0;
    var bestMetric = D.radar_metrics[0], worstMetric = D.radar_metrics[0];
    D.radar_metrics.forEach(function (m) {
      avgScore += m.value;
      if (m.value > bestMetric.value) bestMetric = m;
      if (m.value < worstMetric.value) worstMetric = m;
    });
    avgScore = Math.round(avgScore / D.radar_metrics.length * 100);

    var grade = avgScore >= 80 ? 'A' : avgScore >= 60 ? 'B' : avgScore >= 40 ? 'C' : avgScore >= 20 ? 'D' : 'F';
    var gradeClass = avgScore >= 70 ? 'grade-green' : avgScore >= 50 ? 'grade-yellow' : avgScore >= 30 ? 'grade-orange' : 'grade-red';
    var ringColor = avgScore >= 70 ? '#34d399' : avgScore >= 50 ? '#facc15' : avgScore >= 30 ? '#fb923c' : '#f87171';

    var busFactorNum = D.bus_factor ? D.bus_factor.factor : null;
    var busRisk = busFactorNum === null ? 'N/A' :
      busFactorNum <= 2 ? 'Critical' : (busFactorNum <= 5 ? 'Moderate' : 'Healthy');
    var busKpiClass = busFactorNum === null ? 'kpi-accent' :
      busFactorNum <= 2 ? 'kpi-red' : (busFactorNum <= 5 ? 'kpi-yellow' : 'kpi-green');

    var topHotspot = (D.hotspots && D.hotspots.length > 0) ? D.hotspots[0] : null;
    var M = D.metrics;
    var netLoc = M.total_insertions - M.total_deletions;

    // Build narrative
    var narrativeParts = [];
    narrativeParts.push('This repository has <strong>' + fmtCompact(M.total_commits) + ' commits</strong> from <strong>' + fmtCompact(M.total_authors) + ' contributors</strong>.');
    if (busFactorNum !== null) {
      if (busFactorNum <= 2) {
        narrativeParts.push('The bus factor of <strong>' + busFactorNum + '</strong> is a critical risk — a very small number of contributors own the majority of the codebase.');
      } else if (busFactorNum <= 5) {
        narrativeParts.push('The bus factor is <strong>' + busFactorNum + '</strong>, indicating moderate concentration of knowledge.');
      } else {
        narrativeParts.push('A healthy bus factor of <strong>' + busFactorNum + '</strong> shows well-distributed knowledge.');
      }
    }
    if (topHotspot) {
      narrativeParts.push('The most changed file is <strong>' + topHotspot.path.split('/').slice(-2).join('/') + '</strong> with ' + topHotspot.commits + ' commits across ' + topHotspot.authors + ' authors.');
    }
    narrativeParts.push('Strongest dimension: <strong>' + bestMetric.label + '</strong> (' + Math.round(bestMetric.value * 100) + '%). Weakest: <strong>' + worstMetric.label + '</strong> (' + Math.round(worstMetric.value * 100) + '%).');
    // Add GitHub context if available
    var ghData = D.github;
    if (ghData && ghData.meta) {
      var ghParts = [];
      if (ghData.meta.stars > 0) ghParts.push('<strong>' + fmtCompact(ghData.meta.stars) + '</strong> stars');
      if (ghData.meta.forks > 0) ghParts.push('<strong>' + fmtCompact(ghData.meta.forks) + '</strong> forks');
      if (ghData.pull_requests) ghParts.push('<strong>' + ghData.pull_requests.open_count + '</strong> open PRs');
      if (ghParts.length > 0) narrativeParts.push('On GitHub: ' + ghParts.join(', ') + '.');
      if (ghData.meta.license) narrativeParts.push('Licensed under <strong>' + ghData.meta.license + '</strong>.');
    }

    // Build DOM
    var container = document.getElementById('exec-summary');
    if (!container) return;

    container.className = 'exec-summary';

    var hero = el('div', { className: 'exec-summary-hero' });

    // ── Score ring panel ──
    var scorePanel = el('div', { className: 'exec-summary-score-panel' });
    var ringWrap = el('div', { className: 'exec-summary-score-ring' });
    var circumference = 2 * Math.PI * 46;
    var dashOffset = circumference - (avgScore / 100) * circumference;
    ringWrap.innerHTML =
      '<svg viewBox="0 0 120 120">' +
        '<circle class="ring-bg" cx="60" cy="60" r="46"/>' +
        '<circle class="ring-fg" cx="60" cy="60" r="46" ' +
          'stroke="' + ringColor + '" ' +
          'stroke-dasharray="' + circumference + '" ' +
          'stroke-dashoffset="' + dashOffset + '"/>' +
      '</svg>';
    var scoreNum = el('div', { className: 'exec-summary-score-num', style: 'color:' + ringColor });
    scoreNum.textContent = avgScore;
    ringWrap.appendChild(scoreNum);
    scorePanel.appendChild(ringWrap);
    scorePanel.appendChild(textEl('div', 'Health Score', 'exec-summary-score-label'));
    var gradeBadge = el('span', { className: 'exec-summary-grade ' + gradeClass });
    gradeBadge.textContent = 'Grade ' + grade;
    scorePanel.appendChild(gradeBadge);
    hero.appendChild(scorePanel);

    // ── Details panel ──
    var details = el('div', { className: 'exec-summary-details' });
    details.appendChild(textEl('h2', 'Executive Summary', 'exec-summary-title'));

    var narrative = el('p', { className: 'exec-summary-narrative' });
    narrative.innerHTML = narrativeParts.join(' ');
    details.appendChild(narrative);

    // KPI row
    var kpis = el('div', { className: 'exec-summary-kpis' });

    function addKpi(value, label, sub, klass) {
      var k = el('div', { className: 'exec-kpi ' + (klass || '') });
      k.appendChild(textEl('div', value, 'exec-kpi-value'));
      k.appendChild(textEl('div', label, 'exec-kpi-label'));
      if (sub) k.appendChild(textEl('div', sub, 'exec-kpi-sub'));
      kpis.appendChild(k);
    }

    addKpi(busFactorNum !== null ? String(busFactorNum) : '—', 'Bus Factor', busRisk, busKpiClass);
    addKpi(fmtCompact(Math.abs(netLoc)), netLoc >= 0 ? 'Net Lines Added' : 'Net Lines Removed', null, netLoc >= 0 ? 'kpi-green' : 'kpi-red');
    addKpi(fmtCompact(M.total_paths), 'Unique Files', null, 'kpi-accent');
    addKpi(Math.round(worstMetric.value * 100) + '%', worstMetric.label, 'Weakest', 'kpi-orange');
    addKpi(Math.round(bestMetric.value * 100) + '%', bestMetric.label, 'Strongest', 'kpi-green');

    // GitHub KPIs if available
    var GH = D.github;
    if (GH && GH.meta) {
      addKpi(fmtCompact(GH.meta.stars), 'Stars', null, 'kpi-accent');
      if (GH.pull_requests) addKpi(String(GH.pull_requests.open_count), 'Open PRs', null, 'kpi-green');
      if (GH.issues) addKpi(String(GH.issues.open_count), 'Open Issues', null, 'kpi-orange');
      if (GH.community && GH.community.health_percentage) addKpi(GH.community.health_percentage + '%', 'Community', null, 'kpi-green');
    }

    details.appendChild(kpis);

    // Finding pills
    var findings = el('div', { className: 'exec-summary-findings' });
    if (busFactorNum !== null && busFactorNum <= 3) {
      var pill = el('span', { className: 'exec-finding finding-risk' });
      pill.textContent = '\u26A0 Low bus factor — knowledge concentration risk';
      findings.appendChild(pill);
    }
    if (M.merge_commits > M.total_commits * 0.15) {
      var mp = el('span', { className: 'exec-finding finding-info' });
      mp.textContent = '\u2139 ' + Math.round(M.merge_commits / M.total_commits * 100) + '% merge commits';
      findings.appendChild(mp);
    }
    if (topHotspot && topHotspot.commits > 100) {
      var hp = el('span', { className: 'exec-finding finding-risk' });
      hp.textContent = '\u2622 Hotspot: ' + topHotspot.path.split('/').pop() + ' (' + topHotspot.commits + ' commits)';
      findings.appendChild(hp);
    }
    if (bestMetric.value > 0.7) {
      var sp = el('span', { className: 'exec-finding finding-strength' });
      sp.textContent = '\u2713 Strong ' + bestMetric.label.toLowerCase();
      findings.appendChild(sp);
    }
    // GitHub findings
    var GH2 = D.github;
    if (GH2 && GH2.meta) {
      if (GH2.meta.stars > 100) {
        findings.appendChild(el('span', { className: 'exec-finding finding-strength', textContent: '\u2B50 ' + fmtCompact(GH2.meta.stars) + ' stars on GitHub' }));
      }
      if (GH2.meta.archived) {
        findings.appendChild(el('span', { className: 'exec-finding finding-risk', textContent: '\u26A0 Repository is archived' }));
      }
      if (GH2.pull_requests && GH2.pull_requests.avg_merge_time_hours !== null) {
        var mergeH = GH2.pull_requests.avg_merge_time_hours;
        if (mergeH > 168) {
          findings.appendChild(el('span', { className: 'exec-finding finding-risk', textContent: '\u23F1 Slow PR merge: ' + Math.round(mergeH / 24) + ' days avg' }));
        } else if (mergeH < 24) {
          findings.appendChild(el('span', { className: 'exec-finding finding-strength', textContent: '\u26A1 Fast PR merge: ' + Math.round(mergeH) + 'h avg' }));
        }
      }
      if (GH2.dependabot_alerts && GH2.dependabot_alerts.length > 0) {
        var critCount = GH2.dependabot_alerts.filter(function (a) { return a.severity === 'critical'; }).length;
        if (critCount > 0) {
          findings.appendChild(el('span', { className: 'exec-finding finding-risk', textContent: '\u2622 ' + critCount + ' critical security alerts' }));
        }
      }
      if (GH2.community && GH2.community.health_percentage >= 80) {
        findings.appendChild(el('span', { className: 'exec-finding finding-strength', textContent: '\u2713 Strong community health (' + GH2.community.health_percentage + '%)' }));
      }
    }
    if (findings.children.length > 0) details.appendChild(findings);

    hero.appendChild(details);
    container.appendChild(hero);
  })();

  // ── Code Frequency Chart ──
  if (D.timeseries && D.timeseries.length > 0) {
    var ts = D.timeseries;
    var avgCommits = 0;
    var peakCommits = 0;
    var peakPeriod = '';
    ts.forEach(function (d) {
      avgCommits += d.commits;
      if (d.commits > peakCommits) {
        peakCommits = d.commits;
        peakPeriod = d.period_start;
      }
    });
    avgCommits = Math.round(avgCommits / ts.length);

    initChart('code-frequency-chart', {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', crossStyle: { color: '#475569' } }
      },
      legend: { data: ['Insertions', 'Deletions', 'Commits'], top: 8 },
      grid: { left: 60, right: 60, top: 50, bottom: 80 },
      xAxis: {
        type: 'category',
        data: ts.map(function (d) { return d.period_start; }),
        axisLabel: { rotate: 45, fontSize: 10 },
        boundaryGap: false
      },
      yAxis: [
        { type: 'value', name: 'Lines',
          splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } } },
        { type: 'value', name: 'Commits', position: 'right' }
      ],
      dataZoom: timeDataZoom(),
      animationDuration: 1200,
      animationEasing: 'cubicInOut',
      series: [
        {
          name: 'Insertions', type: 'line', stack: 'lines', smooth: true,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(46,204,113,0.4)' },
              { offset: 1, color: 'rgba(46,204,113,0)' }
            ])
          },
          data: ts.map(function (d) { return d.insertions; }),
          lineStyle: { color: '#2ecc71', width: 1.5 },
          itemStyle: { color: '#2ecc71' },
          symbol: 'none'
        },
        {
          name: 'Deletions', type: 'line', stack: 'lines', smooth: true,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(231,76,60,0.4)' },
              { offset: 1, color: 'rgba(231,76,60,0)' }
            ])
          },
          data: ts.map(function (d) { return -(d.deletions || 0); }),
          lineStyle: { color: '#e74c3c', width: 1.5 },
          itemStyle: { color: '#e74c3c' },
          symbol: 'none'
        },
        {
          name: 'Commits', type: 'bar', yAxisIndex: 1, barMaxWidth: 6,
          data: ts.map(function (d) { return d.commits; }),
          itemStyle: { color: 'rgba(56,189,248,0.5)', borderRadius: [2, 2, 0, 0] },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: '#facc15', type: 'dashed', width: 1 },
            label: { color: '#facc15', fontSize: 11, formatter: 'avg: ' + fmtNum(avgCommits) },
            data: [{ yAxis: avgCommits }]
          },
          markPoint: {
            symbol: 'pin', symbolSize: 40,
            itemStyle: { color: '#fb923c' },
            label: { color: '#fff', fontSize: 10 },
            data: [
              { type: 'max', name: 'Peak' }
            ]
          }
        }
      ]
    });

    // Code frequency insights
    var totalIns = 0, totalDel = 0;
    ts.forEach(function (d) { totalIns += d.insertions; totalDel += d.deletions || 0; });
    var netGrowth = totalIns - totalDel;
    var growthDir = netGrowth >= 0 ? 'grown' : 'shrunk';
    appendInsightsAfter('code-frequency-chart', [
      ['\u{1F4C8}', 'Peak activity period: ' + peakPeriod + ' with ' + fmtNum(peakCommits) + ' commits', 'info'],
      ['\u{1F4CA}', 'Average ' + fmtNum(avgCommits) + ' commits per period. Codebase has ' + growthDir + ' by ' + fmtNum(Math.abs(netGrowth)) + ' net lines', 'info'],
      ['\u{2696}', 'Churn ratio: ' + fmtNum(totalIns) + ' insertions / ' + fmtNum(totalDel) + ' deletions (' + (totalDel > 0 ? (totalIns / totalDel).toFixed(2) : 'N/A') + 'x)', 'info']
    ]);
  }

  // ── Contributor Breakdown ──
  // (Removed: Commit Share pie chart — redundant with Top Contributors bar)
  if (D.authors && D.authors.length > 0) {
    var totalAuthorCommits = 0;
    D.authors.forEach(function (a) { totalAuthorCommits += a.commits; });

    var top15 = D.authors.slice(0, 15);
    initChart('contributor-bar-chart', {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function (params) {
          var p = params[0];
          var pct = fmtPct(p.value, totalAuthorCommits);
          return p.name + '\n' + fmtNum(p.value) + ' commits (' + pct + ')';
        }
      },
      grid: { left: 180, right: 60, top: 10, bottom: 30 },
      xAxis: { type: 'value' },
      yAxis: {
        type: 'category',
        data: top15.map(function (a) { return a.name; }).reverse(),
        axisLabel: { width: 160, overflow: 'truncate', fontSize: 11 }
      },
      animationDuration: 800,
      animationEasing: 'cubicOut',
      series: [{
        type: 'bar',
        data: top15.map(function (a) {
          return {
            value: a.commits,
            label: {
              show: true,
              position: 'right',
              color: '#64748b',
              fontSize: 11,
              formatter: function (p) { return fmtPct(p.value, totalAuthorCommits); }
            }
          };
        }).reverse(),
        itemStyle: {
          color: horizontalGradient('#38bdf8', '#818cf8'),
          borderRadius: [0, 4, 4, 0]
        },
        barMaxWidth: 20,
        emphasis: {
          itemStyle: {
            color: horizontalGradient('#67d5ff', '#a78bfa'),
            shadowBlur: 8,
            shadowColor: 'rgba(56,189,248,0.3)'
          }
        }
      }]
    });

    // Contributor insights
    var topContrib = D.authors[0];
    var topPct = fmtPct(topContrib.commits, totalAuthorCommits);
    var top5Commits = 0;
    D.authors.slice(0, 5).forEach(function (a) { top5Commits += a.commits; });
    var top5Pct = fmtPct(top5Commits, totalAuthorCommits);
    appendInsightsAfter('contributor-bar-chart', [
      ['\u{1F451}', topContrib.name + ' is the top contributor with ' + fmtNum(topContrib.commits) + ' commits (' + topPct + ' of total)', 'info'],
      ['\u{1F465}', 'Top 5 contributors account for ' + top5Pct + ' of all commits (' + fmtNum(D.authors.length) + ' total authors)', D.authors.length < 5 ? 'warning' : 'info']
    ]);
  }

  // ── File Churn Table ──
  if (D.hotspots && D.hotspots.length > 0) {
    buildSortableTable('hotspot-table', D.hotspots,
      [
        { key: 'path', label: 'File', type: 'string', isPath: true },
        { key: 'commits', label: 'Commits', type: 'number' },
        { key: 'distinct_authors', label: 'Authors', type: 'number' },
        { key: 'total_churn', label: 'Total Churn', type: 'number' }
      ], 25);

    // Hotspot insights
    var topHotspot = D.hotspots[0];
    var hotspotCount = D.hotspots.length;
    appendInsightsAfter('hotspot-table', [
      ['\u{1F4DD}', 'Most changed file: ' + topHotspot.path + ' (' + fmtNum(topHotspot.commits) + ' commits, ' + fmtNum(topHotspot.distinct_authors) + ' authors)', 'warning'],
      ['\u{1F4C1}', fmtNum(hotspotCount) + ' files tracked with change history', 'info']
    ]);
  }

  // ── Repo Growth Timeline ──
  if (D.timeseries && D.timeseries.length > 0) {
    var ts3 = D.timeseries;
    var cumIns = [], cumDel = [], cumNet = [];
    var si = 0, sd = 0;
    ts3.forEach(function (d) {
      si += d.insertions; sd += d.deletions;
      cumIns.push(si); cumDel.push(sd); cumNet.push(si - sd);
    });

    initChart('repo-growth-chart', {
      tooltip: {
        trigger: 'axis',
        formatter: function (params) {
          var lines = [params[0].axisValueLabel];
          params.forEach(function (p) {
            lines.push(p.marker + ' ' + p.seriesName + ': ' + fmtNum(p.value));
          });
          return lines.join('\n');
        }
      },
      legend: { data: ['Net Lines', 'Cumulative Insertions', 'Cumulative Deletions'], top: 8 },
      grid: { left: 80, right: 40, top: 50, bottom: 80 },
      xAxis: {
        type: 'category',
        data: ts3.map(function (d) { return d.period_start; }),
        axisLabel: { rotate: 45, fontSize: 10 },
        boundaryGap: false
      },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: function (v) { return fmtK(v); } }
      },
      dataZoom: timeDataZoom(),
      animationDuration: 1200,
      series: [
        {
          name: 'Net Lines', type: 'line', data: cumNet, smooth: true,
          lineStyle: { color: '#38bdf8', width: 2.5 },
          itemStyle: { color: '#38bdf8' },
          symbol: 'none',
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(56,189,248,0.25)' },
              { offset: 1, color: 'rgba(56,189,248,0)' }
            ])
          }
        },
        {
          name: 'Cumulative Insertions', type: 'line', data: cumIns, smooth: true,
          lineStyle: { color: '#2ecc71', width: 1, type: 'dashed' },
          itemStyle: { color: '#2ecc71' }, symbol: 'none'
        },
        {
          name: 'Cumulative Deletions', type: 'line', data: cumDel, smooth: true,
          lineStyle: { color: '#e74c3c', width: 1, type: 'dashed' },
          itemStyle: { color: '#e74c3c' }, symbol: 'none'
        }
      ]
    });

    // Growth insights
    var finalNet = cumNet[cumNet.length - 1];
    appendInsightsAfter('repo-growth-chart', [
      ['\u{1F4CF}', 'Current codebase size: ~' + fmtK(Math.abs(finalNet)) + ' net lines (' + fmtK(si) + ' added, ' + fmtK(sd) + ' removed over project lifetime)', 'info']
    ]);
  }

  // ── Derived Stats Section (mini stats row) ──
  (function () {
    // Weekend vs Weekday
    var weekdayStats = null;
    if (D.commits_by_weekday) {
      var weekdayTotal = 0, weekendTotal = 0;
      D.commits_by_weekday.forEach(function (c, idx) {
        if (idx >= 5) weekendTotal += c;
        else weekdayTotal += c;
      });
      var totalWk = weekdayTotal + weekendTotal;
      weekdayStats = {
        weekdayPct: totalWk > 0 ? (weekdayTotal / totalWk * 100).toFixed(1) : '0',
        weekendPct: totalWk > 0 ? (weekendTotal / totalWk * 100).toFixed(1) : '0'
      };
    }

    // Average commit size
    var avgCommitSize = null;
    if (D.commit_size_histogram) {
      var totalH = 0, weightedSum = 0;
      D.commit_size_histogram.forEach(function (b) {
        var label = b[0];
        var count = b[1];
        totalH += count;
        // Parse median value from label like "1-10", "11-50", etc
        var parts = label.split('-');
        var median;
        if (parts.length === 2) {
          var lo = parseInt(parts[0], 10) || 0;
          var hi = parseInt(parts[1], 10) || lo;
          median = (lo + hi) / 2;
        } else {
          median = parseInt(label, 10) || 0;
        }
        weightedSum += median * count;
      });
      if (totalH > 0) {
        avgCommitSize = Math.round(weightedSum / totalH);
      }
    }

    // Gini coefficient from author data
    var giniCoeff = null;
    if (D.authors && D.authors.length > 1) {
      var authorCommits = D.authors.map(function (a) { return a.commits; });
      authorCommits.sort(function (a, b) { return a - b; });
      var n = authorCommits.length;
      var totalC = 0;
      authorCommits.forEach(function (c) { totalC += c; });
      var sumRanked = 0;
      authorCommits.forEach(function (c, idx) {
        sumRanked += (idx + 1) * c;
      });
      giniCoeff = (2 * sumRanked) / (n * totalC) - (n + 1) / n;
      giniCoeff = Math.max(0, Math.min(1, giniCoeff));
    }

    // Top 10 most active days from timeseries
    var topDays = null;
    if (D.timeseries && D.timeseries.length >= 10) {
      var sorted = D.timeseries.slice().sort(function (a, b) { return b.commits - a.commits; });
      topDays = sorted.slice(0, 10);
    }

    // Insert mini stats row before the weekday chart section
    var weekdayChartEl = document.getElementById('weekday-chart');
    if (weekdayChartEl) {
      var statsRow = el('div', { className: 'mini-stats-row' });
      var targetCard = weekdayChartEl.closest('.card');
      var targetGrid = targetCard ? targetCard.parentNode : null;

      if (weekdayStats) {
        statsRow.appendChild(createMiniStat(
          'Weekday Commits', weekdayStats.weekdayPct + '%',
          'Mon-Fri activity share', 'accent-blue'
        ));
        statsRow.appendChild(createMiniStat(
          'Weekend Commits', weekdayStats.weekendPct + '%',
          'Sat-Sun activity share', 'accent-purple'
        ));
      }

      if (avgCommitSize !== null) {
        statsRow.appendChild(createMiniStat(
          'Avg Commit Size', '~' + fmtNum(avgCommitSize) + ' lines',
          'Estimated lines per commit', 'accent-green'
        ));
      }

      if (giniCoeff !== null) {
        var giniLabel = giniCoeff < 0.3 ? 'Well distributed' :
                        giniCoeff < 0.5 ? 'Moderate inequality' :
                        giniCoeff < 0.7 ? 'Unequal distribution' : 'Highly concentrated';
        statsRow.appendChild(createMiniStat(
          'Contribution Inequality', giniCoeff.toFixed(3),
          'Gini coefficient \u2014 ' + giniLabel, 'accent-orange'
        ));
      }

      if (targetGrid && statsRow.children.length > 0) {
        targetGrid.parentNode.insertBefore(statsRow, targetGrid);
      }
    }

    // Top 10 Most Active Days leaderboard
    if (topDays) {
      var leaderSection = el('div', { className: 'card' });
      leaderSection.appendChild(textEl('h2', 'Top 10 Most Active Periods'));

      var list = el('ul', { className: 'leaderboard' });
      var topMax = topDays[0].commits;

      topDays.forEach(function (d, idx) {
        var item = el('li', { className: 'leaderboard-item' });

        var rank = el('span', {
          className: 'leaderboard-rank' + (idx < 3 ? ' top3' : ''),
          textContent: '#' + (idx + 1)
        });

        var dateSpan = el('span', {
          className: 'leaderboard-date',
          textContent: d.period_start
        });

        var barBg = el('div', { className: 'leaderboard-bar-bg' });
        var bar = el('div', {
          className: 'leaderboard-bar',
          style: 'width:' + Math.round(d.commits / topMax * 100) + '%'
        });
        barBg.appendChild(bar);

        var valSpan = el('span', {
          className: 'leaderboard-value',
          textContent: fmtNum(d.commits) + ' commits'
        });

        item.appendChild(rank);
        item.appendChild(dateSpan);
        item.appendChild(barBg);
        item.appendChild(valSpan);
        list.appendChild(item);
      });

      leaderSection.appendChild(list);

      // Insert before the temporal analysis grid
      if (targetGrid) {
        targetGrid.parentNode.insertBefore(leaderSection, targetGrid);
      }
    }
  })();

  // ── Commits by Weekday ──
  if (D.commits_by_weekday) {
    var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var maxDay = 0, maxDayIdx = 0;
    D.commits_by_weekday.forEach(function (c, idx) {
      if (c > maxDay) { maxDay = c; maxDayIdx = idx; }
    });

    initChart('weekday-chart', {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function (params) {
          var p = params[0];
          var total = 0;
          D.commits_by_weekday.forEach(function (c) { total += c; });
          return p.name + '\n' + fmtNum(p.value) + ' commits (' + fmtPct(p.value, total) + ')';
        }
      },
      grid: { left: 50, right: 20, top: 10, bottom: 30 },
      xAxis: { type: 'category', data: days },
      yAxis: { type: 'value' },
      animationDuration: 800,
      series: [{
        type: 'bar',
        data: D.commits_by_weekday,
        itemStyle: {
          color: verticalGradient('#a78bfa', '#7c3aed'),
          borderRadius: [4, 4, 0, 0]
        },
        barMaxWidth: 40,
        emphasis: {
          itemStyle: {
            color: verticalGradient('#c4b5fd', '#8b5cf6'),
            shadowBlur: 6,
            shadowColor: 'rgba(167,139,250,0.3)'
          }
        }
      }]
    });

    appendInsightsAfter('weekday-chart', [
      ['\u{1F4C5}', 'Most active day: ' + days[maxDayIdx] + ' with ' + fmtNum(maxDay) + ' commits', 'info']
    ]);
  }

  // ── Commits by Month ──
  if (D.commits_by_month) {
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var maxMonth = 0, maxMonthIdx = 0;
    D.commits_by_month.forEach(function (c, idx) {
      if (c > maxMonth) { maxMonth = c; maxMonthIdx = idx; }
    });

    initChart('month-chart', {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function (params) {
          var p = params[0];
          var total = 0;
          D.commits_by_month.forEach(function (c) { total += c; });
          return p.name + '\n' + fmtNum(p.value) + ' commits (' + fmtPct(p.value, total) + ')';
        }
      },
      grid: { left: 50, right: 20, top: 10, bottom: 30 },
      xAxis: { type: 'category', data: months },
      yAxis: { type: 'value' },
      animationDuration: 800,
      series: [{
        type: 'bar',
        data: D.commits_by_month,
        itemStyle: {
          color: verticalGradient('#34d399', '#059669'),
          borderRadius: [4, 4, 0, 0]
        },
        barMaxWidth: 40,
        emphasis: {
          itemStyle: {
            color: verticalGradient('#6ee7b7', '#10b981'),
            shadowBlur: 6,
            shadowColor: 'rgba(52,211,153,0.3)'
          }
        }
      }]
    });

    appendInsightsAfter('month-chart', [
      ['\u{1F324}', 'Peak month: ' + months[maxMonthIdx] + ' with ' + fmtNum(maxMonth) + ' commits historically', 'info']
    ]);
  }

  // ── Commits by Year ──
  if (D.commits_by_year) {
    var yrs = Object.keys(D.commits_by_year).sort();
    var yrValues = yrs.map(function (y) { return D.commits_by_year[y]; });
    var maxYr = 0, maxYrKey = '';
    yrs.forEach(function (y) {
      if (D.commits_by_year[y] > maxYr) { maxYr = D.commits_by_year[y]; maxYrKey = y; }
    });

    initChart('year-chart', {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function (params) {
          var p = params[0];
          return p.name + '\n' + fmtNum(p.value) + ' commits';
        }
      },
      grid: { left: 50, right: 20, top: 10, bottom: 30 },
      xAxis: { type: 'category', data: yrs },
      yAxis: { type: 'value' },
      animationDuration: 800,
      series: [{
        type: 'bar',
        data: yrValues,
        itemStyle: {
          color: verticalGradient('#fb923c', '#ea580c'),
          borderRadius: [4, 4, 0, 0]
        },
        barMaxWidth: 40,
        emphasis: {
          itemStyle: {
            color: verticalGradient('#fdba74', '#f97316'),
            shadowBlur: 6,
            shadowColor: 'rgba(251,146,60,0.3)'
          }
        }
      }]
    });

    // Year trend insight
    if (yrs.length >= 2) {
      var lastYr = D.commits_by_year[yrs[yrs.length - 1]];
      var prevYr = D.commits_by_year[yrs[yrs.length - 2]];
      var diff = lastYr - prevYr;
      var trendWord = diff >= 0 ? 'up' : 'down';
      var trendType = diff >= 0 ? 'success' : 'warning';
      appendInsightsAfter('year-chart', [
        ['\u{1F4C6}', 'Most active year: ' + maxYrKey + ' (' + fmtNum(maxYr) + ' commits). ' + yrs[yrs.length - 1] + ' is ' + trendWord + ' ' + fmtNum(Math.abs(diff)) + ' vs ' + yrs[yrs.length - 2], trendType]
      ]);
    }
  }

  // ── Punch Card (day x hour heatmap) ──
  if (D.punch_card && D.punch_card.length > 0) {
    var days2 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var hours = [];
    for (var h = 0; h < 24; h++) hours.push(h + ':00');
    var maxPunch = Math.max.apply(null, D.punch_card.map(function (p) { return p[2]; }));
    var totalPunchCommits = 0;
    D.punch_card.forEach(function (p) { totalPunchCommits += p[2]; });

    // Find peak hour
    var peakHour = 0, peakHourCount = 0, peakDay = 0;
    D.punch_card.forEach(function (p) {
      if (p[2] > peakHourCount) {
        peakHourCount = p[2];
        peakDay = p[0];
        peakHour = p[1];
      }
    });

    initChart('punch-card-chart', {
      tooltip: {
        position: 'top',
        formatter: function (p) {
          var day = days2[p.value[1]];
          var hour = p.value[0];
          var count = p.value[2];
          var pct = totalPunchCommits > 0 ? (count / totalPunchCommits * 100).toFixed(1) : '0';
          var ampm = hour < 12 ? 'am' : 'pm';
          var h12 = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
          return day + ' ' + h12 + ampm + '\n' + fmtNum(count) + ' commits (' + pct + '% of total)';
        }
      },
      grid: { left: 60, right: 20, top: 10, bottom: 40 },
      xAxis: { type: 'category', data: hours, axisLabel: { fontSize: 10 }, splitArea: { show: true, areaStyle: { color: ['rgba(30,41,59,0.3)', 'rgba(30,41,59,0.1)'] } } },
      yAxis: { type: 'category', data: days2, splitArea: { show: true, areaStyle: { color: ['rgba(30,41,59,0.3)', 'rgba(30,41,59,0.1)'] } } },
      visualMap: {
        min: 0,
        max: maxPunch || 1,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: {
          color: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353']
        },
        textStyle: { color: '#94a3b8' }
      },
      animationDuration: 1000,
      series: [{
        type: 'heatmap',
        data: D.punch_card.map(function (p) { return [p[1], p[0], p[2]]; }),
        label: { show: false },
        itemStyle: { borderColor: '#0f172a', borderWidth: 1, borderRadius: 2 },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(56,189,248,0.5)'
          }
        }
      }]
    });

    var peakAmpm = peakHour < 12 ? 'am' : 'pm';
    var peakH12 = peakHour === 0 ? 12 : (peakHour > 12 ? peakHour - 12 : peakHour);
    appendInsightsAfter('punch-card-chart', [
      ['\u{23F0}', 'Peak activity: ' + days2[peakDay] + ' at ' + peakH12 + peakAmpm + ' (' + fmtNum(peakHourCount) + ' commits)', 'info']
    ]);
  }

  // ── Commit Size Histogram ──
  if (D.commit_size_histogram) {
    initChart('size-histogram-chart', {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function (params) {
          var p = params[0];
          var totalH = 0;
          D.commit_size_histogram.forEach(function (b) { totalH += b[1]; });
          return p.name + ' lines\n' + fmtNum(p.value) + ' commits (' + fmtPct(p.value, totalH) + ')';
        }
      },
      grid: { left: 70, right: 20, top: 10, bottom: 55 },
      xAxis: {
        type: 'category',
        name: 'Lines Changed',
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        nameLocation: 'center',
        nameGap: 35,
        data: D.commit_size_histogram.map(function (b) { return b[0]; }),
        axisLabel: { rotate: 30, fontSize: 10 }
      },
      yAxis: { type: 'value', name: 'Number of Commits', nameTextStyle: { color: '#94a3b8', fontSize: 11 } },
      animationDuration: 800,
      series: [{
        type: 'bar',
        data: D.commit_size_histogram.map(function (b) { return b[1]; }),
        itemStyle: {
          color: verticalGradient('#38bdf8', '#0284c7'),
          borderRadius: [4, 4, 0, 0]
        },
        barMaxWidth: 40,
        emphasis: {
          itemStyle: {
            color: verticalGradient('#67d5ff', '#0ea5e9'),
            shadowBlur: 6,
            shadowColor: 'rgba(56,189,248,0.3)'
          }
        }
      }]
    });

    // Histogram insight
    var mostCommonBucket = D.commit_size_histogram[0];
    D.commit_size_histogram.forEach(function (b) {
      if (b[1] > mostCommonBucket[1]) mostCommonBucket = b;
    });
    appendInsightsAfter('size-histogram-chart', [
      ['\u{1F4E6}', 'Most common commit size: ' + mostCommonBucket[0] + ' lines (' + fmtNum(mostCommonBucket[1]) + ' commits)', 'info']
    ]);
  }

  // ── Bus Factor (Lorenz Curve) via D3 ──
  if (D.bus_factor && typeof d3 !== 'undefined') {
    renderLorenzCurve('bus-factor-chart', D.bus_factor);

    // Bus factor insights
    var bf = D.bus_factor;
    var bfType = bf.factor <= 2 ? 'warning' : (bf.factor <= 5 ? 'info' : 'success');
    var bfDesc = bf.factor <= 2 ? 'Critical risk: very few key contributors' :
                 bf.factor <= 5 ? 'Moderate risk: consider spreading knowledge' :
                 'Healthy distribution of knowledge across the team';
    appendInsightsAfter('bus-factor-chart', [
      ['\u{1F3AF}', 'Bus factor of ' + bf.factor + ': ' + bfDesc, bfType]
    ]);
  }

  // ── Commits by Extension ──
  if (D.commits_by_extension && D.commits_by_extension.length > 0) {
    var extData = D.commits_by_extension.slice(0, 20);
    var totalExtCommits = 0;
    extData.forEach(function (e) { totalExtCommits += e[1]; });

    initChart('extension-chart', {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function (params) {
          var p = params[0];
          return '.' + p.name + '\n' + fmtNum(p.value) + ' commits (' + fmtPct(p.value, totalExtCommits) + ')';
        }
      },
      grid: { left: 120, right: 60, top: 10, bottom: 30 },
      xAxis: { type: 'value' },
      yAxis: {
        type: 'category',
        data: extData.map(function (e) { return e[0]; }).reverse(),
        axisLabel: { fontSize: 11 }
      },
      animationDuration: 800,
      series: [{
        type: 'bar',
        data: extData.map(function (e) {
          return {
            value: e[1],
            label: {
              show: true,
              position: 'right',
              color: '#64748b',
              fontSize: 10,
              formatter: function (p) { return fmtPct(p.value, totalExtCommits); }
            }
          };
        }).reverse(),
        itemStyle: {
          color: horizontalGradient('#22d3ee', '#06b6d4'),
          borderRadius: [0, 4, 4, 0]
        },
        barMaxWidth: 20,
        emphasis: {
          itemStyle: {
            color: horizontalGradient('#67e8f9', '#22d3ee'),
            shadowBlur: 6,
            shadowColor: 'rgba(34,211,238,0.3)'
          }
        }
      }]
    });
  }

  // ── Conventional Commit Patterns (donut) ──
  if (D.conventional_commits) {
    var ccKeys = Object.keys(D.conventional_commits);
    if (ccKeys.length > 0) {
      var ccData = ccKeys.map(function (k) { return { name: k, value: D.conventional_commits[k] }; });
      ccData.sort(function (a, b) { return b.value - a.value; });
      var totalCC = 0;
      ccData.forEach(function (c) { totalCC += c.value; });

      initChart('conventional-commits-chart', {
        tooltip: {
          trigger: 'item',
          formatter: function (p) {
            return p.name + '\n' + fmtNum(p.value) + ' commits (' + p.percent.toFixed(1) + '%)';
          }
        },
        animationDuration: 1000,
        series: [{
          type: 'pie', radius: ['35%', '70%'], center: ['50%', '55%'],
          roseType: 'area',
          padAngle: 2,
          data: ccData,
          label: { color: '#94a3b8', fontSize: 11, formatter: '{b}\n{d}%' },
          itemStyle: {
            borderRadius: 6,
            borderColor: '#0f172a',
            borderWidth: 2
          },
          emphasis: {
            itemStyle: { shadowBlur: 12, shadowColor: 'rgba(56,189,248,0.35)' },
            scaleSize: 6
          }
        }]
      });

      appendInsightsAfter('conventional-commits-chart', [
        ['\u{1F3F7}', 'Most common commit type: "' + ccData[0].name + '" with ' + fmtNum(ccData[0].value) + ' commits (' + fmtPct(ccData[0].value, totalCC) + ')', 'info'],
        ['\u{2705}', fmtNum(ccKeys.length) + ' different commit types detected across ' + fmtNum(totalCC) + ' conventional commits', 'success']
      ]);
    }
  }

  // ── Word Cloud ──
  if (D.word_frequencies && D.word_frequencies.length > 0 && typeof echarts !== 'undefined') {
    var wcData = D.word_frequencies.map(function (w) {
      return { name: w[0], value: w[1] };
    });
    var wcEl = document.getElementById('wordcloud-chart');
    if (wcEl) {
      // Use lazy init for wordcloud too
      if (lazyChartObserver) {
        lazyChartQueue.push({
          id: 'wordcloud-chart',
          opts: {
            tooltip: {
              trigger: 'item',
              formatter: function (p) {
                return p.name + ': ' + fmtNum(p.value) + ' occurrences';
              }
            },
            series: [{
              type: 'wordCloud', shape: 'circle',
              left: 'center', top: 'center', width: '90%', height: '90%',
              sizeRange: [12, 60], rotationRange: [-30, 30], rotationStep: 15,
              gridSize: 8, drawOutOfBound: false,
              textStyle: {
                fontFamily: "'Inter', system-ui, sans-serif",
                color: function () {
                  return COLORS[Math.floor(Math.random() * COLORS.length)];
                }
              },
              emphasis: { textStyle: { shadowBlur: 10, shadowColor: 'rgba(56,189,248,0.5)' } },
              data: wcData
            }]
          }
        });
        lazyChartObserver.observe(wcEl);
      } else {
        try {
          var wcChart = echarts.init(wcEl, 'repoguru');
          wcChart.setOption({
            tooltip: {
              trigger: 'item',
              formatter: function (p) {
                return p.name + ': ' + fmtNum(p.value) + ' occurrences';
              }
            },
            series: [{
              type: 'wordCloud', shape: 'circle',
              left: 'center', top: 'center', width: '90%', height: '90%',
              sizeRange: [12, 60], rotationRange: [-30, 30], rotationStep: 15,
              gridSize: 8, drawOutOfBound: false,
              textStyle: {
                fontFamily: "'Inter', system-ui, sans-serif",
                color: function () {
                  return COLORS[Math.floor(Math.random() * COLORS.length)];
                }
              },
              emphasis: { textStyle: { shadowBlur: 10, shadowColor: 'rgba(56,189,248,0.5)' } },
              data: wcData
            }]
          });
          allCharts.push(wcChart);
        } catch (e) { /* wordcloud extension not loaded */ }
      }
    }
  }

  // ── Language Breakdown (treemap only — donut removed as redundant) ──
  if (D.language_breakdown) {
    var langKeys = Object.keys(D.language_breakdown);
    if (langKeys.length > 0) {
      var langData = langKeys.map(function (k) { return { name: k, value: D.language_breakdown[k] }; });
      langData.sort(function (a, b) { return b.value - a.value; });
      var totalLang = 0;
      langData.forEach(function (l) { totalLang += l.value; });

      initChart('language-treemap-chart', {
        tooltip: {
          formatter: function (p) {
            return p.name + '\n' + fmtNum(p.value) + ' files (' + fmtPct(p.value, totalLang) + ')';
          }
        },
        animationDuration: 1000,
        series: [{
          type: 'treemap', width: '95%', height: '85%',
          data: langData,
          label: { show: true, color: '#f1f5f9', fontSize: 12, formatter: '{b}\n{c}' },
          breadcrumb: { show: false },
          itemStyle: { borderColor: '#0f172a', borderWidth: 2, gapWidth: 2, borderRadius: 3 },
          levels: [{
            itemStyle: { borderColor: '#0f172a', borderWidth: 3, gapWidth: 3 },
            upperLabel: { show: false }
          }]
        }]
      });

      appendInsightsAfter('language-treemap-chart', [
        ['\u{1F4BB}', 'Dominant language: ' + langData[0].name + ' with ' + fmtNum(langData[0].value) + ' files (' + fmtPct(langData[0].value, totalLang) + ')', 'info'],
        ['\u{1F30D}', fmtNum(langKeys.length) + ' languages detected across ' + fmtNum(totalLang) + ' total files', 'info']
      ]);
    }
  }

  // ── File Coupling Table (wrapped in collapsible details) ──
  if (D.file_coupling && D.file_coupling.length > 0) {
    var couplingContainer = document.getElementById('coupling-table');
    if (couplingContainer) {
      var couplingParent = couplingContainer.parentNode;
      var details = document.createElement('details');
      details.className = 'collapsible';
      var summary = document.createElement('summary');
      summary.textContent = 'File Coupling (' + D.file_coupling.length + ' pairs)';
      details.appendChild(summary);
      var innerDiv = document.createElement('div');
      innerDiv.id = 'coupling-table';
      details.appendChild(innerDiv);
      couplingParent.replaceChild(details, couplingContainer);

      buildSortableTable('coupling-table', D.file_coupling,
        [
          { key: 'file_a', label: 'File A', type: 'string', isPath: true },
          { key: 'file_b', label: 'File B', type: 'string', isPath: true },
          { key: 'count', label: 'Co-changes', type: 'number' },
          { key: 'coupling_pct', label: 'Coupling %', type: 'number' }
        ], 25);

      var topCoupled = D.file_coupling[0];
      appendInsightsAfter('coupling-table', [
        ['\u{1F517}', 'Strongest coupling: ' + topCoupled.file_a + ' and ' + topCoupled.file_b + ' (' + fmtNum(topCoupled.count) + ' co-changes, ' + topCoupled.coupling_pct + '% coupling)', 'warning']
      ]);
    }
  }

  // ── Radar Chart (repo health) via D3 ──
  if (D.radar_metrics && typeof d3 !== 'undefined') {
    renderRadarChart('radar-chart', D.radar_metrics);

    // Radar insights
    if (D.radar_metrics.length > 0) {
      var bestMetric = D.radar_metrics[0], worstMetric = D.radar_metrics[0];
      D.radar_metrics.forEach(function (m) {
        if (m.value > bestMetric.value) bestMetric = m;
        if (m.value < worstMetric.value) worstMetric = m;
      });
      var avgScore = 0;
      D.radar_metrics.forEach(function (m) { avgScore += m.value; });
      avgScore = (avgScore / D.radar_metrics.length * 100).toFixed(0);

      appendInsightsAfter('radar-chart', [
        ['\u{2B50}', 'Overall health score: ' + avgScore + '/100. Strongest: ' + bestMetric.label + ' (' + (bestMetric.value * 100).toFixed(0) + '%)', 'success'],
        ['\u{26A0}', 'Area for improvement: ' + worstMetric.label + ' (' + (worstMetric.value * 100).toFixed(0) + '%)', 'warning']
      ]);
    }
  }

  // ── Repository Size Metrics ──
  (function () {
    var container = document.getElementById('repo-size-metrics');
    var rm = D.metrics && D.metrics.repo_metrics;
    if (!container || !rm) return;

    function fmtBytes(b) {
      if (b >= 1073741824) return (b / 1073741824).toFixed(1) + ' GB';
      if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
      if (b >= 1024) return (b / 1024).toFixed(1) + ' KB';
      return b + ' B';
    }

    // Summary stats row
    var stats = el('div', { className: 'mini-stats-row' });
    function addStat(val, label, cls) {
      var s = el('div', { className: 'mini-stat ' + (cls || '') });
      s.appendChild(el('div', { className: 'mini-stat-value', textContent: val }));
      s.appendChild(el('div', { className: 'mini-stat-label', textContent: label }));
      stats.appendChild(s);
    }

    var oc = rm.object_counts || {};
    var tb = rm.total_bytes || {};
    var totalObjects = (oc.blob || 0) + (oc.tree || 0) + (oc.commit || 0) + (oc.tag || 0);
    var totalBytes = (tb.blob || 0) + (tb.tree || 0) + (tb.commit || 0) + (tb.tag || 0);

    addStat(fmtCompact(totalObjects), 'Total Objects', 'accent-blue');
    addStat(fmtBytes(totalBytes), 'Total Size', 'accent-purple');
    addStat(fmtCompact(oc.blob || 0), 'Blobs', '');
    addStat(fmtCompact(oc.tree || 0), 'Trees', '');
    addStat(fmtCompact(oc.commit || 0), 'Commits', '');
    if (rm.checkout_num_files) addStat(fmtCompact(rm.checkout_num_files), 'Checkout Files', 'accent-green');
    if (rm.checkout_total_size) addStat(fmtBytes(rm.checkout_total_size), 'Checkout Size', 'accent-orange');
    container.appendChild(stats);

    // Detail table
    var details = [];
    if (rm.max_history_depth) details.push(['Max History Depth', fmtCompact(rm.max_history_depth) + ' commits']);
    if (rm.total_tree_entries) details.push(['Total Tree Entries', fmtCompact(rm.total_tree_entries)]);
    if (rm.ref_count) details.push(['References', fmtCompact(rm.ref_count)]);
    if (rm.branch_count) details.push(['Branches', fmtCompact(rm.branch_count)]);
    if (rm.tag_ref_count) details.push(['Tags', fmtCompact(rm.tag_ref_count)]);
    if (rm.merge_count) details.push(['Merge Commits', fmtCompact(rm.merge_count)]);
    if (rm.max_parents) details.push(['Max Parents (octopus)', String(rm.max_parents)]);
    if (rm.checkout_num_dirs) details.push(['Checkout Directories', fmtCompact(rm.checkout_num_dirs)]);
    if (rm.checkout_num_symlinks) details.push(['Symlinks', String(rm.checkout_num_symlinks)]);
    if (rm.checkout_num_submodules) details.push(['Submodules', String(rm.checkout_num_submodules)]);
    if (rm.deepest_path) details.push(['Deepest Path', rm.deepest_path]);
    if (rm.longest_path) details.push(['Longest Path', rm.longest_path]);
    if (rm.largest_directory) details.push(['Largest Directory', rm.largest_directory[0] + ' (' + rm.largest_directory[1] + ' entries)']);
    if (rm.largest_commit && rm.largest_commit[1]) details.push(['Largest Commit', rm.largest_commit[0].substring(0, 12) + ' (' + fmtBytes(rm.largest_commit[1]) + ')']);

    if (details.length > 0) {
      var grid = el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin-top:16px;font-size:13px' });
      details.forEach(function (d) {
        var label = el('div', { style: 'color:#64748b;font-weight:500', textContent: d[0] });
        var val = el('div', { style: 'color:#f1f5f9;font-weight:600;word-break:break-all' });
        val.textContent = d[1];
        if (d[0].indexOf('Path') >= 0 || d[0].indexOf('Directory') >= 0) val.className = 'mono';
        grid.appendChild(label);
        grid.appendChild(val);
      });
      container.appendChild(grid);
    }

    // Top 5 largest blobs
    if (rm.largest_blobs && rm.largest_blobs.length > 0) {
      container.appendChild(el('h3', { style: 'font-size:13px;font-weight:700;color:#94a3b8;margin:20px 0 8px;text-transform:uppercase;letter-spacing:0.5px', textContent: 'Largest Objects' }));
      var blobList = el('div');
      rm.largest_blobs.slice(0, 10).forEach(function (b, i) {
        var item = el('div', { style: 'display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(71,85,105,0.15);font-size:12px' });
        item.appendChild(el('span', { style: 'color:#64748b;width:20px;text-align:right;flex-shrink:0', textContent: '#' + (i + 1) }));
        item.appendChild(el('span', { className: 'mono', style: 'color:#94a3b8;flex-shrink:0', textContent: b[0].substring(0, 12) }));
        var barBg = el('div', { style: 'flex:1;height:6px;background:#1e293b;border-radius:3px;overflow:hidden' });
        var pct = Math.round(b[1] / rm.largest_blobs[0][1] * 100);
        barBg.appendChild(el('div', { style: 'height:100%;width:' + pct + '%;background:linear-gradient(90deg,#38bdf8,#a78bfa);border-radius:3px' }));
        item.appendChild(barBg);
        item.appendChild(el('span', { style: 'color:#f1f5f9;font-weight:600;min-width:60px;text-align:right', textContent: fmtBytes(b[1]) }));
        blobList.appendChild(item);
      });
      container.appendChild(blobList);
    }
  })();

  // ─�� Commits by Hour of Day (timezone-aware) ──
  if (D.commits_by_hour && D.commits_by_hour.length === 24) {
    function shiftHours(offset) {
      var shifted = [];
      for (var h = 0; h < 24; h++) {
        var src = ((h - offset) % 24 + 24) % 24;
        shifted.push(D.commits_by_hour[src]);
      }
      return shifted;
    }
    function hourChartOption(offset) {
      var data = shiftHours(offset);
      var labels = [];
      for (var h = 0; h < 24; h++) labels.push(h + ':00');
      var peak = 0;
      data.forEach(function (c, i) { if (c > data[peak]) peak = i; });
      return {
        opt: {
          tooltip: { trigger: 'axis', formatter: commitsTooltip },
          grid: { left: 50, right: 20, top: 20, bottom: 40 },
          xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 10 } },
          yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } } },
          animationDuration: 800,
          series: [{
            name: 'Commits', type: 'bar',
            data: data,
            itemStyle: roundedBarStyle(verticalGradient('#22d3ee', '#0891b2'))
          }]
        },
        peak: peak, peakVal: data[peak]
      };
    }

    var hourResult = hourChartOption(window.__TZ_OFFSET || 0);
    initChart('hour-chart', hourResult.opt);

    appendInsightsAfter('hour-chart', [
      ['\u{23F0}', 'Peak hour: ' + hourResult.peak + ':00 with ' + fmtNum(hourResult.peakVal) + ' commits (in selected timezone)', 'info']
    ]);

    // Update on timezone change
    window.addEventListener('tz-change', function () {
      var chart = allCharts.find(function (c) { return c.getDom && c.getDom().id === 'hour-chart'; });
      if (chart) {
        var r = hourChartOption(window.__TZ_OFFSET || 0);
        chart.setOption(r.opt);
      }
    });
  }

  // ── Commits by Email Domain ──
  if (D.commits_by_domain && D.commits_by_domain.length > 0) {
    var domainData = D.commits_by_domain.map(function (d) {
      return { name: d[0], value: d[1] };
    });
    var totalDomainCommits = 0;
    domainData.forEach(function (d) { totalDomainCommits += d.value; });

    initChart('domain-chart', {
      tooltip: {
        trigger: 'item',
        formatter: function (p) {
          return p.name + '\n' + fmtNum(p.value) + ' commits (' + p.percent.toFixed(1) + '%)';
        }
      },
      animationDuration: 1000,
      series: [{
        type: 'pie', radius: ['35%', '70%'], center: ['50%', '55%'],
        padAngle: 2,
        data: domainData.slice(0, 12),
        label: { color: '#94a3b8', fontSize: 11, formatter: '{b}\n{d}%' },
        itemStyle: { borderRadius: 6, borderColor: '#0f172a', borderWidth: 2 },
        emphasis: {
          itemStyle: { shadowBlur: 12, shadowColor: 'rgba(56,189,248,0.3)' },
          scaleSize: 6
        }
      }]
    });

    appendInsightsAfter('domain-chart', [
      ['\u{1F4E7}', 'Top domain: ' + domainData[0].name + ' with ' + fmtNum(domainData[0].value) + ' commits (' + fmtPct(domainData[0].value, totalDomainCommits) + ')', 'info'],
      ['\u{1F310}', fmtNum(domainData.length) + ' email domains contributing to this repository', 'info']
    ]);
  }

  // (Removed: Weekly Activity chart — redundant with streak calendar)

  // ── Tag / Release History (time-axis with cadence coloring) ──
  if (D.tag_history && D.tag_history.length > 0) {
    // Compute days_since_prev for cadence coloring
    var tagData = D.tag_history.map(function (t, i) {
      var daysSincePrev = 0;
      if (i > 0) {
        daysSincePrev = Math.round((t.timestamp - D.tag_history[i - 1].timestamp) / 86400);
      }
      return { name: t.name, date: t.date, timestamp: t.timestamp, commits: t.commits_since_prev, days: daysSincePrev };
    });

    function cadenceColor(days) {
      if (days <= 30) return '#22c55e';
      if (days <= 90) return '#facc15';
      return '#ef4444';
    }

    initChart('tag-history-chart', {
      tooltip: {
        trigger: 'axis',
        formatter: function (params) {
          var idx = params[0].dataIndex;
          var d = tagData[idx];
          var lines = ['Tag: ' + d.name, 'Date: ' + d.date, 'Commits: ' + fmtNum(d.commits)];
          if (d.days > 0) lines.push('Days since previous: ' + d.days);
          return lines.join('\n');
        }
      },
      grid: { left: 70, right: 30, top: 50, bottom: 80 },
      xAxis: {
        type: 'time',
        axisLabel: { fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        name: 'Commits Since Previous Release',
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { formatter: fmtK },
        splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }
      },
      dataZoom: timeDataZoom(),
      animationDuration: 1000,
      series: [{
        name: 'Commits', type: 'bar',
        data: tagData.map(function (t) {
          return {
            value: [t.timestamp * 1000, t.commits],
            itemStyle: { color: cadenceColor(t.days), borderRadius: [4, 4, 0, 0] }
          };
        }),
        barMaxWidth: 20,
        label: {
          show: tagData.length <= 30,
          position: 'top', rotate: 60, fontSize: 9, color: '#94a3b8',
          formatter: function (p) { return tagData[p.dataIndex].name; }
        }
      }, {
        name: 'Tags', type: 'scatter', symbolSize: 10, symbol: 'diamond',
        data: tagData.map(function (t) {
          return { value: [t.timestamp * 1000, t.commits], name: t.name };
        }),
        itemStyle: { color: '#38bdf8', borderColor: '#0f172a', borderWidth: 2 },
        label: { show: false },
        z: 10
      }]
    });

    // Tag history table
    var tagTableData = D.tag_history.map(function (t) {
      return { name: t.name, date: t.date, commits_since_prev: t.commits_since_prev };
    });
    tagTableData.reverse();
    buildSortableTable('tag-history-table', tagTableData, [
      { key: 'name', label: 'Tag', type: 'string' },
      { key: 'date', label: 'Date', type: 'string' },
      { key: 'commits_since_prev', label: 'Commits Since Prev', type: 'number' }
    ], 15);

    var tagNames = D.tag_history.map(function (t) { return t.name; });
    var tagDates = D.tag_history.map(function (t) { return t.date; });
    appendInsightsAfter('tag-history-chart', [
      ['\u{1F3F7}', fmtNum(D.tag_history.length) + ' tags/releases tracked. Most recent: ' + tagNames[tagNames.length - 1] + ' (' + tagDates[tagDates.length - 1] + ')', 'info']
    ]);
  }

  // ── Lines of Code Over Time ──
  if (D.timeseries && D.timeseries.length > 0) {
    var locDates = [];
    var netLinesData = [];
    var cumIns = 0, cumDel = 0;
    D.timeseries.forEach(function (d) {
      locDates.push(d.period_start);
      cumIns += d.insertions;
      cumDel += d.deletions;
      netLinesData.push(cumIns - cumDel);
    });

    initChart('loc-over-time-chart', {
      tooltip: {
        trigger: 'axis',
        formatter: function (params) {
          var p = params[0];
          return p.axisValueLabel + '\nNet Lines: ' + fmtNum(p.value);
        }
      },
      grid: { left: 80, right: 30, top: 30, bottom: 80 },
      xAxis: {
        type: 'category', data: locDates, boundaryGap: false,
        axisLabel: { rotate: 45, fontSize: 10 }
      },
      yAxis: {
        type: 'value', name: 'Lines of Code',
        axisLabel: { formatter: function (v) { return fmtK(v); } },
        splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } }
      },
      dataZoom: timeDataZoom(),
      animationDuration: 1200,
      series: [{
        name: 'Net Lines', type: 'line', smooth: true,
        data: netLinesData,
        lineStyle: { color: '#34d399', width: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(52,211,153,0.25)' },
            { offset: 1, color: 'rgba(52,211,153,0.02)' }
          ])
        },
        itemStyle: { color: '#34d399' },
        symbol: 'none'
      }]
    });

    appendInsightsAfter('loc-over-time-chart', [
      ['\u{1F4CF}', 'Current codebase: ~' + fmtK(netLinesData[netLinesData.length - 1]) + ' net lines of code', 'success'],
      ['\u{1F4C8}', 'Growth from ' + locDates[0] + ' to ' + locDates[locDates.length - 1], 'info']
    ]);
  }

  // ── Author of Year Table ──
  if (D.author_of_year && D.author_of_year.length > 0) {
    var aoyData = D.author_of_year.map(function (a) {
      var authorName = 'Author #' + a.author_id;
      if (D.authors) {
        for (var i = 0; i < D.authors.length; i++) {
          if (D.authors[i].author_id === a.author_id) {
            authorName = D.authors[i].name;
            break;
          }
        }
      }
      return { period: a.period, author: authorName, commits: a.commits, total_authors: a.total_authors };
    });
    buildSortableTable('author-of-year-table', aoyData, [
      { key: 'period', label: 'Year', type: 'string' },
      { key: 'author', label: 'Top Author', type: 'string' },
      { key: 'commits', label: 'Commits', type: 'number' },
      { key: 'total_authors', label: 'Active Authors', type: 'number' }
    ], 20);
  }

  // ── Author of Month Table (recent 24) ──
  if (D.author_of_month && D.author_of_month.length > 0) {
    var aomData = D.author_of_month.slice(-24).reverse().map(function (a) {
      var authorName = 'Author #' + a.author_id;
      if (D.authors) {
        for (var i = 0; i < D.authors.length; i++) {
          if (D.authors[i].author_id === a.author_id) {
            authorName = D.authors[i].name;
            break;
          }
        }
      }
      return { period: a.period, author: authorName, commits: a.commits, total_authors: a.total_authors };
    });
    buildSortableTable('author-of-month-table', aomData, [
      { key: 'period', label: 'Month', type: 'string' },
      { key: 'author', label: 'Top Author', type: 'string' },
      { key: 'commits', label: 'Commits', type: 'number' },
      { key: 'total_authors', label: 'Active Authors', type: 'number' }
    ], 12);
  }

  // ══════════════════════════════════════════════════════════
  // Phase 6: New Visualizations
  // ══════════════════════════════════════════════════════════

  // ── Cumulative Files Over Time ──
  if (D.cumulative_files && D.cumulative_files.length > 0) {
    initChart('cumulative-files-chart', {
      tooltip: { trigger: 'axis', formatter: function (p) { return p[0].axisValue + '<br/>' + fmtNum(p[0].value) + ' files'; } },
      grid: { left: 70, right: 30, top: 30, bottom: 80 },
      xAxis: { type: 'category', data: D.cumulative_files.map(function (r) { return r[0]; }), axisLabel: { rotate: 45 } },
      yAxis: { type: 'value', name: 'Files', axisLabel: { formatter: fmtK } },
      dataZoom: timeDataZoom(),
      series: [{
        type: 'line', smooth: true, showSymbol: false,
        data: D.cumulative_files.map(function (r) { return r[1]; }),
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(56,189,248,0.4)' },
          { offset: 1, color: 'rgba(56,189,248,0.02)' }
        ]) },
        lineStyle: { color: '#38bdf8', width: 2 },
        itemStyle: { color: '#38bdf8' }
      }]
    });
  }

  // ── File Operations Breakdown ──
  if (D.file_operations && D.file_operations.length > 0) {
    var opColors = { 'Added': '#22c55e', 'Modified': '#3b82f6', 'Deleted': '#ef4444', 'Renamed': '#f97316', 'Copied': '#a855f7', 'Type Changed': '#64748b' };
    var opTotal = D.file_operations.reduce(function (s, r) { return s + r[1]; }, 0);
    initChart('file-operations-chart', {
      tooltip: { trigger: 'item', formatter: function (p) { return p.name + ': ' + fmtNum(p.value) + ' (' + p.percent.toFixed(1) + '%)'; } },
      legend: { orient: 'vertical', right: 10, top: 'center' },
      series: [{
        type: 'pie', radius: ['40%', '70%'], center: ['40%', '50%'],
        label: { show: false },
        data: D.file_operations.map(function (r) {
          return { name: r[0], value: r[1], itemStyle: { color: opColors[r[0]] || '#64748b' } };
        })
      }],
      graphic: [{
        type: 'text', left: '36%', top: '45%',
        style: { text: fmtNum(opTotal), fill: '#f1f5f9', fontSize: 20, fontWeight: 'bold', textAlign: 'center' }
      }, {
        type: 'text', left: '36%', top: '55%',
        style: { text: 'operations', fill: '#64748b', fontSize: 12, textAlign: 'center' }
      }]
    });
  }

  // ── Lines Changed by Language (diverging horizontal bar) ──
  if (D.lines_by_ext && D.lines_by_ext.length > 0) {
    var lbeData = D.lines_by_ext.slice(0, 15).reverse();
    initChart('lines-by-language-chart', {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: function (p) {
          var ins = p[0] ? Math.abs(p[0].value) : 0;
          var del = p[1] ? Math.abs(p[1].value) : 0;
          return p[0].axisValue + '<br/>+' + fmtNum(ins) + ' / -' + fmtNum(del);
        }
      },
      legend: { data: ['Insertions', 'Deletions'] },
      grid: { left: 80, right: 30, top: 40, bottom: 20 },
      xAxis: {
        type: 'value',
        axisLabel: { formatter: function (v) { return fmtK(Math.abs(v)); } }
      },
      yAxis: { type: 'category', data: lbeData.map(function (r) { return '.' + r[0]; }) },
      series: [
        {
          name: 'Insertions', type: 'bar', stack: 'total',
          data: lbeData.map(function (r) { return r[1]; }),
          itemStyle: { color: '#22c55e', borderRadius: [0, 4, 4, 0] }
        },
        {
          name: 'Deletions', type: 'bar', stack: 'total',
          data: lbeData.map(function (r) { return -(r[2] || 0); }),
          itemStyle: { color: '#ef4444', borderRadius: [4, 0, 0, 4] }
        }
      ]
    });
  }

  // ── Lines Statistics Table ──
  if (D.lines_stats_summary && D.lines_stats_summary.length > 0) {
    var lssData = D.lines_stats_summary.map(function (r) {
      return { label: r.label, min: r.min, max: r.max, avg: r.avg.toFixed(1), median: r.median, total: r.total };
    });
    buildSortableTable('lines-stats-table', lssData, [
      { key: 'label', label: 'Metric', type: 'string' },
      { key: 'min', label: 'Min', type: 'number' },
      { key: 'max', label: 'Max', type: 'number' },
      { key: 'avg', label: 'Average', type: 'number' },
      { key: 'median', label: 'Median', type: 'number' },
      { key: 'total', label: 'Total', type: 'number' }
    ], 10);
  }

  // ── Author Activity Timelines ──
  if (D.author_timelines && D.author_timelines.length > 0) {
    // Collect all months across all authors
    var allMonths = {};
    D.author_timelines.forEach(function (at) {
      at.points.forEach(function (p) { allMonths[p[0]] = true; });
    });
    var monthKeys = Object.keys(allMonths).sort();

    var atSeries = D.author_timelines.map(function (at, idx) {
      var authorName = 'Author #' + at.author_id;
      if (D.authors) {
        for (var i = 0; i < D.authors.length; i++) {
          if (D.authors[i].author_id === at.author_id) { authorName = D.authors[i].name; break; }
        }
      }
      var pointMap = {};
      at.points.forEach(function (p) { pointMap[p[0]] = p[1]; });
      return {
        name: authorName, type: 'line', smooth: true, showSymbol: false,
        data: monthKeys.map(function (m) { return pointMap[m] || 0; }),
        lineStyle: { width: 2 },
        itemStyle: { color: COLORS[idx % COLORS.length] }
      };
    });

    initChart('author-timelines-chart', {
      tooltip: { trigger: 'axis' },
      legend: { type: 'scroll', top: 0, selectedMode: 'single' },
      grid: { left: 60, right: 30, top: 40, bottom: 80 },
      xAxis: { type: 'category', data: monthKeys, axisLabel: { rotate: 45 } },
      yAxis: { type: 'value', name: 'Commits' },
      dataZoom: timeDataZoom(),
      series: atSeries
    });
  }

  // (Enhanced tag timeline merged into tag-history-chart above)

  // ── Contributor Network Graph (D3 force-directed) — limited to top 20 authors ──
  (function () {
    var container = document.getElementById('contributor-network-chart');
    if (!container || !D.contributor_network_nodes || D.contributor_network_nodes.length === 0) return;

    // Wrap in a <details> collapsible
    var parent = container.parentNode;
    var details = document.createElement('details');
    details.className = 'collapsible';
    var summaryEl = document.createElement('summary');
    summaryEl.textContent = 'Contributor Network (' + Math.min(D.contributor_network_nodes.length, 20) + ' authors)';
    details.appendChild(summaryEl);
    parent.replaceChild(details, container);
    details.appendChild(container);

    var width = container.clientWidth || 600;
    var height = 400;
    container.style.height = height + 'px';

    var svg = d3.select(container).append('svg')
      .attr('width', width).attr('height', height)
      .attr('viewBox', '0 0 ' + width + ' ' + height);

    // Limit to top 20 authors
    var topNodeIds = {};
    var limitedNodes = D.contributor_network_nodes.slice(0, 20);
    limitedNodes.forEach(function (n) { topNodeIds[n[0]] = true; });

    var nodes = limitedNodes.map(function (n, i) {
      return { id: n[0], name: n[1] || ('Author #' + n[0]), index: i };
    });
    var nodeMap = {};
    nodes.forEach(function (n) { nodeMap[n.id] = n; });

    var edges = (D.contributor_network_edges || []).filter(function (e) {
      return topNodeIds[e.source] && topNodeIds[e.target] && nodeMap[e.source] && nodeMap[e.target];
    });

    var maxWeight = d3.max(edges, function (e) { return e.weight; }) || 1;

    var simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id(function (d) { return d.id; }).distance(120))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(30));

    var link = svg.selectAll('.link')
      .data(edges).enter().append('line')
      .attr('class', 'link')
      .attr('stroke', '#475569')
      .attr('stroke-width', function (d) { return Math.max(1, (d.weight / maxWeight) * 5); })
      .attr('stroke-opacity', function (d) { return 0.3 + (d.weight / maxWeight) * 0.5; });

    var node = svg.selectAll('.node')
      .data(nodes).enter().append('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', function (event, d) { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', function (event, d) { d.fx = event.x; d.fy = event.y; })
        .on('end', function (event, d) { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

    node.append('circle')
      .attr('r', 12)
      .attr('fill', function (d) { return COLORS[d.index % COLORS.length]; })
      .attr('stroke', '#0f172a').attr('stroke-width', 2);

    node.append('text')
      .text(function (d) { return d.name.length > 12 ? d.name.substring(0, 12) + '...' : d.name; })
      .attr('dx', 16).attr('dy', 4)
      .attr('fill', '#94a3b8').attr('font-size', 11);

    // Tooltip
    node.append('title').text(function (d) { return d.name; });

    simulation.on('tick', function () {
      link.attr('x1', function (d) { return d.source.x; }).attr('y1', function (d) { return d.source.y; })
          .attr('x2', function (d) { return d.target.x; }).attr('y2', function (d) { return d.target.y; });
      node.attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });
    });
  })();

  // ── Code Ownership Treemap ──
  if (D.code_ownership && D.code_ownership.length > 0) {
    var ownerColors = {};
    var colorIdx = 0;
    var ownerData = D.code_ownership.map(function (o) {
      if (!ownerColors[o.owner_id]) {
        ownerColors[o.owner_id] = COLORS[colorIdx % COLORS.length];
        colorIdx++;
      }
      var ownerName = 'Author #' + o.owner_id;
      if (D.authors) {
        for (var i = 0; i < D.authors.length; i++) {
          if (D.authors[i].author_id === o.owner_id) { ownerName = D.authors[i].name; break; }
        }
      }
      return { name: o.path, value: o.lines, ownerName: ownerName, itemStyle: { color: ownerColors[o.owner_id] } };
    });

    initChart('code-ownership-chart', {
      tooltip: {
        formatter: function (p) {
          return p.name + '<br/>Owner: ' + p.data.ownerName + '<br/>' + fmtNum(p.value) + ' lines changed';
        }
      },
      series: [{
        type: 'treemap',
        data: ownerData,
        width: '95%', height: '90%',
        roam: false,
        breadcrumb: { show: true, itemStyle: { color: '#1e293b', borderColor: '#334155', textStyle: { color: '#94a3b8' } } },
        label: { show: true, formatter: '{b}', fontSize: 11, color: '#f1f5f9' },
        itemStyle: { borderColor: '#0f172a', borderWidth: 2, gapWidth: 2 },
        levels: [{
          itemStyle: { borderColor: '#334155', borderWidth: 3, gapWidth: 3 },
          upperLabel: { show: false }
        }]
      }]
    });
  }

  // ── Commit Streak Calendar (with year range slider) ──
  (function () {
    var container = document.getElementById('streak-calendar-chart');
    if (!container || !D.timeseries || D.timeseries.length === 0) return;

    // Build commit map
    var commitMap = {};
    D.timeseries.forEach(function (t) { var d = t.date || t.period_start; commitMap[d] = t.commits || 0; });
    var dates = Object.keys(commitMap).sort();
    if (dates.length === 0) return;
    var startYear = parseInt(dates[0].substring(0, 4));
    var endYear = parseInt(dates[dates.length - 1].substring(0, 4));

    // Compute streak (full history)
    var longestStreak = 0, currentStreak = 0;
    var prevDate = null;
    dates.forEach(function (date) {
      if (commitMap[date] > 0) {
        if (prevDate) {
          var diff = (new Date(date) - new Date(prevDate)) / 86400000;
          currentStreak = diff === 1 ? currentStreak + 1 : 1;
        } else { currentStreak = 1; }
        if (currentStreak > longestStreak) longestStreak = currentStreak;
        prevDate = date;
      } else { currentStreak = 0; prevDate = date; }
    });

    var ghColors = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
    var allCalData = dates.map(function (d) { return [d, commitMap[d] || 0]; });

    // State: visible year range (default: last 1 year)
    var viewStart = Math.max(startYear, endYear);
    var viewEnd = endYear;

    // ── Controls ──
    var controls = el('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:12px' });

    // Preset buttons
    var presets = [
      { label: 'Last Year', fn: function () { viewStart = endYear; viewEnd = endYear; } },
      { label: 'Last 3 Years', fn: function () { viewStart = Math.max(startYear, endYear - 2); viewEnd = endYear; } },
      { label: 'All Time', fn: function () { viewStart = startYear; viewEnd = endYear; } }
    ];
    presets.forEach(function (p) {
      var btn = el('button', { style: 'background:none;border:1px solid #475569;color:#94a3b8;padding:4px 12px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.15s', textContent: p.label });
      btn.addEventListener('mouseenter', function () { btn.style.borderColor = '#38bdf8'; btn.style.color = '#f1f5f9'; });
      btn.addEventListener('mouseleave', function () { btn.style.borderColor = '#475569'; btn.style.color = '#94a3b8'; });
      btn.addEventListener('click', function () { p.fn(); renderCalendar(); });
      controls.appendChild(btn);
    });

    // Year range slider (from–to)
    var sliderLabel = el('span', { style: 'color:#64748b;font-size:11px;margin-left:auto;font-weight:500' });
    controls.appendChild(sliderLabel);

    var fromSelect = el('select', { style: 'background:#1e293b;border:1px solid #475569;color:#f1f5f9;padding:3px 8px;border-radius:4px;font-size:12px;font-family:inherit' });
    var toSelect = el('select', { style: 'background:#1e293b;border:1px solid #475569;color:#f1f5f9;padding:3px 8px;border-radius:4px;font-size:12px;font-family:inherit' });
    for (var y = startYear; y <= endYear; y++) {
      fromSelect.appendChild(el('option', { textContent: String(y) }));
      toSelect.appendChild(el('option', { textContent: String(y) }));
    }
    fromSelect.value = String(viewStart);
    toSelect.value = String(viewEnd);

    fromSelect.addEventListener('change', function () {
      viewStart = parseInt(fromSelect.value);
      if (viewStart > viewEnd) { viewEnd = viewStart; toSelect.value = String(viewEnd); }
      renderCalendar();
    });
    toSelect.addEventListener('change', function () {
      viewEnd = parseInt(toSelect.value);
      if (viewEnd < viewStart) { viewStart = viewEnd; fromSelect.value = String(viewStart); }
      renderCalendar();
    });

    controls.appendChild(el('span', { style: 'color:#64748b;font-size:11px', textContent: 'From:' }));
    controls.appendChild(fromSelect);
    controls.appendChild(el('span', { style: 'color:#64748b;font-size:11px', textContent: 'To:' }));
    controls.appendChild(toSelect);

    container.appendChild(controls);

    // Chart container
    var chartDiv = el('div');
    container.appendChild(chartDiv);

    var streakChart = null;

    function renderCalendar() {
      fromSelect.value = String(viewStart);
      toSelect.value = String(viewEnd);
      var numYears = viewEnd - viewStart + 1;
      sliderLabel.textContent = numYears + ' year' + (numYears > 1 ? 's' : '') + ' \u00B7 ' + viewStart + '\u2013' + viewEnd;

      // Filter data
      var calData = allCalData.filter(function (d) {
        var y = parseInt(d[0].substring(0, 4));
        return y >= viewStart && y <= viewEnd;
      });
      var maxVal = Math.max.apply(null, calData.map(function (d) { return d[1]; }).concat([1]));

      // Build calendar/series per year
      var calendarList = [];
      var seriesList = [];
      for (var yr = viewStart; yr <= viewEnd; yr++) {
        var calIdx = yr - viewStart;
        calendarList.push({
          top: 40 + calIdx * 150, left: 50, right: 50,
          cellSize: ['auto', numYears > 3 ? 12 : 15],
          range: String(yr),
          itemStyle: { borderColor: '#1e293b', borderWidth: 2, color: '#161b22' },
          splitLine: { lineStyle: { color: '#334155' } },
          yearLabel: { color: '#94a3b8', fontSize: numYears > 5 ? 10 : 12 },
          dayLabel: { color: '#64748b', nameMap: 'en', fontSize: numYears > 5 ? 8 : 10 },
          monthLabel: { color: '#64748b', fontSize: numYears > 5 ? 8 : 10 }
        });
        seriesList.push({
          type: 'heatmap', coordinateSystem: 'calendar', calendarIndex: calIdx,
          data: calData.filter(function (d) { return d[0].substring(0, 4) === String(yr); }),
          itemStyle: { borderRadius: numYears > 5 ? 2 : 3 }
        });
      }

      var cellH = numYears > 3 ? 130 : 150;
      var calHeight = 40 + numYears * cellH + 30;
      chartDiv.style.height = Math.max(calHeight, 180) + 'px';

      if (!streakChart) {
        streakChart = echarts.init(chartDiv, 'repoguru');
        allCharts.push(streakChart);
      }
      streakChart.resize();
      streakChart.setOption({
        tooltip: { formatter: function (p) { return p.value[0] + ': ' + p.value[1] + ' commits'; } },
        visualMap: { min: 0, max: maxVal, show: false, inRange: { color: ghColors } },
        calendar: calendarList,
        series: seriesList,
        graphic: [{
          type: 'text', left: 'center', bottom: 4,
          style: { text: 'Longest streak: ' + longestStreak + ' days', fill: '#94a3b8', fontSize: 12 }
        }]
      }, true);
    }

    renderCalendar();
  })();

  // ── Timezone World Map (Leaflet + full-height bands) ──
  (function () {
    var container = document.getElementById('timezone-map-chart');
    if (!container || !D.timezone_data || D.timezone_data.length === 0) return;
    if (typeof L === 'undefined') {
      container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#64748b;font-size:14px">Leaflet library failed to load — timezone map requires internet</div>';
      return;
    }

    var map = L.map(container, {
      center: [20, 10],
      zoom: 2,
      minZoom: 2,
      maxZoom: 5,
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: false
    });

    // Dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution('\u00a9 <a href="https://www.openstreetmap.org/copyright" style="color:#64748b">OSM</a> \u00a9 <a href="https://carto.com/" style="color:#64748b">CARTO</a>')
      .addTo(map);

    // Compute scales
    var maxCount = Math.max.apply(null, D.timezone_data.map(function (t) { return t[1]; }));
    var totalCommits = 0;
    D.timezone_data.forEach(function (t) { totalCommits += t[1]; });

    // Color: transparent at zero, through blue to bright cyan at max
    function bandColor(count) {
      if (count === 0) return 'rgba(0,0,0,0)';
      var ratio = Math.pow(count / maxCount, 0.5);
      var r = Math.round(15 + ratio * (56 - 15));
      var g = Math.round(40 + ratio * (189 - 40));
      var b = Math.round(80 + ratio * (248 - 80));
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }
    function bandOpacity(count) {
      if (count === 0) return 0;
      return 0.15 + 0.45 * Math.pow(count / maxCount, 0.4);
    }

    // Draw full-height rectangular bands per timezone
    D.timezone_data.forEach(function (t) {
      var offset = t[0];
      var count = t[1];
      if (count === 0) return;

      var lngCenter = offset * 15;
      var lngLeft = lngCenter - 7.5;
      var lngRight = lngCenter + 7.5;
      var pct = Math.round(count / totalCommits * 100);

      // Full-height band from pole to pole
      var bounds = [[85, lngLeft], [-85, lngRight]];
      var band = L.rectangle(bounds, {
        color: bandColor(count),
        weight: 1,
        opacity: 0.6,
        fillColor: bandColor(count),
        fillOpacity: bandOpacity(count),
        interactive: true
      }).addTo(map);

      // Popup on click
      band.bindPopup(
        '<div style="font-family:Inter,sans-serif;font-size:13px;color:#f1f5f9;background:#1e293b;padding:10px 14px;border-radius:8px;border:1px solid #334155;min-width:150px">' +
          '<div style="font-weight:700;font-size:16px;color:#38bdf8;margin-bottom:6px">UTC' + (offset >= 0 ? '+' : '') + offset + '</div>' +
          '<div style="display:flex;justify-content:space-between;gap:16px">' +
            '<span>Commits</span><span style="font-weight:700;color:#f1f5f9">' + fmtNum(count) + '</span>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;gap:16px;color:#64748b">' +
            '<span>Share</span><span>' + pct + '%</span>' +
          '</div>' +
          '<div style="margin-top:6px;height:4px;border-radius:2px;background:#334155;overflow:hidden">' +
            '<div style="height:100%;width:' + pct + '%;background:#38bdf8;border-radius:2px"></div>' +
          '</div>' +
        '</div>',
        { className: 'tz-popup', closeButton: false }
      );

      // Tooltip on hover
      band.bindTooltip(
        '<b>UTC' + (offset >= 0 ? '+' : '') + offset + '</b>: ' + fmtNum(count) + ' commits (' + pct + '%)',
        { sticky: true, className: 'tz-tooltip' }
      );

      // Highlight on hover
      band.on('mouseover', function () {
        band.setStyle({ fillOpacity: Math.min(bandOpacity(count) + 0.2, 0.8), weight: 2 });
      });
      band.on('mouseout', function () {
        band.setStyle({ fillOpacity: bandOpacity(count), weight: 1 });
      });
    });

    // Force map to recalculate size after layout settles
    setTimeout(function () { map.invalidateSize(); }, 200);

    // Legend overlay
    var legend = L.control({ position: 'topright' });
    legend.onAdd = function () {
      var div = L.DomUtil.create('div');
      div.style.cssText = 'background:rgba(15,23,42,0.92);padding:12px 16px;border-radius:8px;border:1px solid #334155;font-family:Inter,sans-serif;font-size:12px;color:#94a3b8;backdrop-filter:blur(8px);min-width:170px';
      var top5 = D.timezone_data.slice().sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
      var html = '<div style="font-weight:600;margin-bottom:8px;color:#f1f5f9;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Top Timezones</div>';
      top5.forEach(function (t) {
        var pct = Math.round(t[1] / totalCommits * 100);
        var barW = Math.max(2, Math.round(t[1] / maxCount * 60));
        html += '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
          '<span style="color:#64748b;font-size:11px;width:42px;flex-shrink:0">UTC' + (t[0] >= 0 ? '+' : '') + t[0] + '</span>' +
          '<span style="flex:1;height:6px;border-radius:3px;background:#1e293b;overflow:hidden">' +
            '<span style="display:block;height:100%;width:' + barW + 'px;background:' + bandColor(t[1]) + ';border-radius:3px"></span>' +
          '</span>' +
          '<span style="font-weight:600;color:#f1f5f9;font-size:11px;width:32px;text-align:right">' + pct + '%</span>' +
        '</div>';
      });
      div.innerHTML = html;
      return div;
    };
    legend.addTo(map);
  })();

  // ── Hotspot Bubble Chart + Treemap (Item 8) ──
  if (D.hotspots && D.hotspots.length > 0) {
    var top50 = D.hotspots.slice(0, 50);
    var maxChurn = d3.max(top50, function (h) { return h.total_churn; }) || 1;

    // Bubble chart: X=commits, Y=authors, size=sqrt(churn)
    initChart('hotspot-bubble-chart', {
      tooltip: {
        formatter: function (p) {
          var d = p.data;
          return d[3] + '\nCommits: ' + fmtNum(d[0]) + '\nAuthors: ' + d[1] + '\nChurn: ' + fmtNum(d[2]);
        }
      },
      grid: { left: 60, right: 30, top: 30, bottom: 50 },
      xAxis: { type: 'value', name: 'Commits', nameTextStyle: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } } },
      yAxis: { type: 'value', name: 'Authors', nameTextStyle: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } } },
      visualMap: { show: true, dimension: 2, min: 0, max: maxChurn, inRange: { color: ['#22d3ee', '#38bdf8', '#a78bfa', '#f472b6', '#f87171'] }, text: ['High Churn', 'Low'], textStyle: { color: '#94a3b8' }, right: 10, top: 'center' },
      series: [{
        type: 'scatter',
        data: top50.map(function (h) {
          var shortPath = h.path.split('/').slice(-2).join('/');
          return [h.commits, h.distinct_authors, h.total_churn, shortPath];
        }),
        symbolSize: function (val) { return Math.max(10, Math.min(60, Math.sqrt(val[2]) * 0.5)); },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(56,189,248,0.5)' } }
      }]
    });

    // Treemap: value=total_churn, color by authors
    var maxAuthors = d3.max(top50, function (h) { return h.distinct_authors; }) || 1;
    var treemapData = top50.map(function (h) {
      var shortPath = h.path.split('/').slice(-2).join('/');
      return { name: shortPath, value: h.total_churn, authors: h.distinct_authors, fullPath: h.path };
    });

    initChart('hotspot-treemap-chart', {
      tooltip: {
        formatter: function (p) {
          return p.data.fullPath + '\nChurn: ' + fmtNum(p.value) + '\nAuthors: ' + p.data.authors;
        }
      },
      visualMap: { show: false, min: 1, max: maxAuthors, inRange: { color: ['#0e4429', '#006d32', '#26a641', '#facc15', '#f87171'] } },
      series: [{
        type: 'treemap',
        data: treemapData,
        width: '95%', height: '88%',
        roam: false,
        label: { show: true, formatter: '{b}', fontSize: 10, color: '#f1f5f9' },
        breadcrumb: { show: true, itemStyle: { color: '#1e293b', borderColor: '#334155', textStyle: { color: '#94a3b8' } } },
        itemStyle: { borderColor: '#0f172a', borderWidth: 2, gapWidth: 2 },
        levels: [{ itemStyle: { borderColor: '#334155', borderWidth: 3, gapWidth: 3 }, upperLabel: { show: false } }],
        visualDimension: 'authors'
      }]
    });
  }

  // ── File Coupling Network Graph (Item 4) ──
  (function () {
    var container = document.getElementById('coupling-graph');
    if (!container || !D.file_coupling || D.file_coupling.length === 0 || typeof d3 === 'undefined') return;

    // Wrap in a <details> collapsible
    var couplingParent = container.parentNode;
    var couplingDetails = document.createElement('details');
    couplingDetails.className = 'collapsible';
    var couplingSummary = document.createElement('summary');
    couplingSummary.textContent = 'File Coupling Network Graph';
    couplingDetails.appendChild(couplingSummary);
    couplingParent.replaceChild(couplingDetails, container);
    couplingDetails.appendChild(container);

    var pairs = D.file_coupling.slice(0, 30);
    var width = container.clientWidth || 600;
    // Scale height with node count: min 400, +15px per node beyond 10, max 700
    var nodeCount = (function () { var s = {}; pairs.forEach(function (p) { s[p.file_a] = 1; s[p.file_b] = 1; }); return Object.keys(s).length; })();
    var height = Math.min(700, Math.max(400, 400 + Math.max(0, nodeCount - 10) * 15));
    container.style.height = height + 'px';
    container.style.overflow = 'hidden';

    // Extract unique nodes
    var nodeSet = {};
    pairs.forEach(function (p) {
      var a = p.file_a.split('/').slice(-2).join('/');
      var b = p.file_b.split('/').slice(-2).join('/');
      nodeSet[p.file_a] = a;
      nodeSet[p.file_b] = b;
    });
    var nodeKeys = Object.keys(nodeSet);
    var nodes = nodeKeys.map(function (k, i) { return { id: k, label: nodeSet[k], index: i, connections: 0 }; });
    var nodeMap = {};
    nodes.forEach(function (n) { nodeMap[n.id] = n; });

    pairs.forEach(function (p) {
      if (nodeMap[p.file_a]) nodeMap[p.file_a].connections++;
      if (nodeMap[p.file_b]) nodeMap[p.file_b].connections++;
    });

    var edges = pairs.map(function (p) {
      return { source: p.file_a, target: p.file_b, count: p.count, pct: p.coupling_pct };
    });

    function linkColor(pct) {
      if (pct > 75) return '#ef4444';
      if (pct > 50) return '#facc15';
      return '#22c55e';
    }

    var svg = d3.select(container).append('svg')
      .attr('width', width).attr('height', height)
      .attr('viewBox', '0 0 ' + width + ' ' + height);

    var maxPct = d3.max(edges, function (e) { return e.pct; }) || 100;

    var simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id(function (d) { return d.id; }).distance(100))
      .force('charge', d3.forceManyBody().strength(-150))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(25));

    var link = svg.selectAll('.coupling-link')
      .data(edges).enter().append('line')
      .attr('stroke', function (d) { return linkColor(d.pct); })
      .attr('stroke-width', function (d) { return Math.max(1, (d.pct / maxPct) * 5); })
      .attr('stroke-opacity', 0.6);

    var maxConn = d3.max(nodes, function (n) { return n.connections; }) || 1;
    var nodeGroup = svg.selectAll('.coupling-node')
      .data(nodes).enter().append('g')
      .call(d3.drag()
        .on('start', function (event, d) { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', function (event, d) { d.fx = event.x; d.fy = event.y; })
        .on('end', function (event, d) { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

    nodeGroup.append('circle')
      .attr('r', function (d) { return 6 + (d.connections / maxConn) * 10; })
      .attr('fill', function (d) { return COLORS[d.index % COLORS.length]; })
      .attr('stroke', '#0f172a').attr('stroke-width', 2);

    nodeGroup.append('text')
      .text(function (d) { return d.label.length > 18 ? d.label.substring(0, 18) + '...' : d.label; })
      .attr('dx', 14).attr('dy', 4)
      .attr('fill', '#94a3b8').attr('font-size', 9);

    nodeGroup.append('title').text(function (d) { return d.id; });

    simulation.on('tick', function () {
      // Constrain nodes within the SVG bounds
      var pad = 30;
      nodes.forEach(function (d) {
        d.x = Math.max(pad, Math.min(width - pad, d.x));
        d.y = Math.max(pad, Math.min(height - pad, d.y));
      });
      link.attr('x1', function (d) { return d.source.x; }).attr('y1', function (d) { return d.source.y; })
          .attr('x2', function (d) { return d.target.x; }).attr('y2', function (d) { return d.target.y; });
      nodeGroup.attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });
    });
  })();

  // ── Radar Explanation Cards (Item 3) ──
  (function () {
    var container = document.getElementById('radar-explanation');
    if (!container || !D.radar_metrics || D.radar_metrics.length === 0) return;

    var descriptions = {
      'Activity': 'Commit velocity \u2014 1000+ commits scores 100%',
      'Team Size': 'Contributor breadth \u2014 20+ authors scores 100%',
      'Bus Factor': 'Knowledge distribution \u2014 5+ core contributors scores 100%',
      'Code Balance': 'Ratio of insertions to deletions \u2014 balanced growth vs churn',
      'PR Hygiene': 'Proportion of atomic (non-merge) commits',
      'Recency': 'Days since last commit \u2014 within 30 days scores 100%'
    };

    var grid = el('div', { className: 'radar-grid' });
    D.radar_metrics.forEach(function (m) {
      var score = Math.round(m.value * 100);
      var colorClass = score >= 70 ? 'score-green' : (score >= 40 ? 'score-yellow' : 'score-red');
      var card = el('div', { className: 'radar-metric-card' });
      var header = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px' });
      header.appendChild(textEl('span', m.label, 'radar-metric-name'));
      header.appendChild(textEl('span', score + '%', 'score-badge ' + colorClass));
      card.appendChild(header);
      card.appendChild(textEl('div', descriptions[m.label] || '', 'radar-metric-desc'));
      grid.appendChild(card);
    });
    container.appendChild(grid);
  })();

  // ── Lines Changed by Language Over Time (Item 7) — lines only, no areaStyle ──
  if (D.lines_by_ext_time && D.lines_by_ext_time.months && D.lines_by_ext_time.months.length > 0) {
    var lbet = D.lines_by_ext_time;
    var extSeries = lbet.extensions.map(function (ext, idx) {
      return {
        name: '.' + ext,
        type: 'line',
        stack: 'lang',
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.5 },
        itemStyle: { color: COLORS[idx % COLORS.length] },
        data: lbet.data[idx]
      };
    });

    initChart('lines-by-ext-time-chart', {
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { type: 'scroll', top: 0, textStyle: { color: '#94a3b8' } },
      grid: { left: 70, right: 30, top: 40, bottom: 80 },
      xAxis: { type: 'category', data: lbet.months, axisLabel: { rotate: 45, fontSize: 10 }, boundaryGap: false },
      yAxis: { type: 'value', name: 'Lines Changed', nameTextStyle: { color: '#94a3b8' }, axisLabel: { formatter: fmtK }, splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } } },
      dataZoom: timeDataZoom(),
      animationDuration: 1200,
      series: extSeries
    });
  }

  // ── Build Navigation Bar (after all sections rendered) ──
  buildNavBar();

  // ── Global Resize Handler ──
  var resizeTimeout;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function () {
      allCharts.forEach(function (c) {
        try { c.resize(); } catch (e) { /* chart may be disposed */ }
      });
    }, 150);
  });

  // ── Lazy Resize via IntersectionObserver ──
  if (typeof IntersectionObserver !== 'undefined') {
    var chartResizeObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          allCharts.forEach(function (c) {
            var dom = c.getDom();
            if (dom && dom === entry.target) {
              try { c.resize(); } catch (e) { /* ignore */ }
            }
          });
        }
      });
    }, { threshold: 0.1 });

    // Observe all chart containers that are already initialized
    allCharts.forEach(function (c) {
      var dom = c.getDom();
      if (dom) chartResizeObserver.observe(dom);
    });
  }

  // ═══════════════════════════════════════════════════════
  // ── Sortable + Paginated Table Builder (safe DOM API) ──
  // ═══════════════════════════════════════════════════════

  function buildSortableTable(containerId, data, columns, pageSize) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var sortCol = null, sortDir = 1, page = 0;
    var sorted = data.slice();

    function render() {
      while (container.firstChild) container.removeChild(container.firstChild);

      var start = page * pageSize;
      var pageData = sorted.slice(start, start + pageSize);
      var totalPages = Math.ceil(sorted.length / pageSize);

      // Wrap in scroll container
      var scrollWrap = el('div', { className: 'table-scroll-wrap' });

      var table = document.createElement('table');
      var thead = document.createElement('thead');
      var headRow = document.createElement('tr');

      columns.forEach(function (col) {
        var th = document.createElement('th');
        if (col.type === 'number') th.className = 'num';
        th.setAttribute('data-key', col.key);
        th.style.cursor = 'pointer';
        th.textContent = col.label;
        // aria-sort for accessibility
        if (sortCol === col.key) {
          var arrow = document.createElement('span');
          arrow.className = 'sort-arrow';
          arrow.textContent = sortDir === 1 ? ' \u25B2' : ' \u25BC';
          th.appendChild(arrow);
          th.setAttribute('aria-sort', sortDir === 1 ? 'ascending' : 'descending');
        } else {
          th.setAttribute('aria-sort', 'none');
        }
        th.addEventListener('click', function () {
          var key = col.key;
          if (sortCol === key) { sortDir *= -1; }
          else { sortCol = key; sortDir = 1; }
          sorted.sort(function (a, b) {
            var va = a[key], vb = b[key];
            if (col.type === 'number') return (va - vb) * sortDir;
            return String(va || '').localeCompare(String(vb || '')) * sortDir;
          });
          page = 0;
          render();
        });
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);

      var tbody = document.createElement('tbody');
      pageData.forEach(function (row) {
        var tr = document.createElement('tr');
        columns.forEach(function (col) {
          var td = document.createElement('td');
          var val = row[col.key];
          if (col.type === 'number') {
            td.className = 'num';
            td.textContent = fmtNum(val);
          } else {
            td.textContent = String(val || '');
          }
          // Add path-cell class for file path columns
          if (col.isPath) {
            td.classList.add('path-cell');
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      scrollWrap.appendChild(table);
      container.appendChild(scrollWrap);

      // Pagination controls
      var controls = document.createElement('div');
      controls.className = 'table-controls';

      var info = document.createElement('span');
      info.textContent = 'Showing ' + (start + 1) + '\u2013' + Math.min(start + pageSize, sorted.length) + ' of ' + fmtNum(sorted.length);
      controls.appendChild(info);

      var btns = document.createElement('span');
      var prevBtn = document.createElement('button');
      prevBtn.className = 'prev-btn';
      prevBtn.textContent = '\u00AB Prev';
      if (page === 0) prevBtn.setAttribute('disabled', '');
      prevBtn.addEventListener('click', function () { if (page > 0) { page--; render(); } });

      var nextBtn = document.createElement('button');
      nextBtn.className = 'next-btn';
      nextBtn.textContent = 'Next \u00BB';
      if (page >= totalPages - 1) nextBtn.setAttribute('disabled', '');
      nextBtn.addEventListener('click', function () { if (page < totalPages - 1) { page++; render(); } });

      btns.appendChild(prevBtn);
      btns.appendChild(document.createTextNode(' '));
      btns.appendChild(nextBtn);
      controls.appendChild(btns);
      container.appendChild(controls);
    }

    render();
  }

  // ═══════════════════════════════════════════════════════
  // ── D3: Lorenz Curve for Bus Factor ──
  // ═══════════════════════════════════════════════════════

  function renderLorenzCurve(containerId, bf) {
    var container = document.getElementById(containerId);
    if (!container || !bf.lorenz || bf.lorenz.length === 0) return;

    var w = container.clientWidth || 500, h = 400;
    var margin = { top: 30, right: 30, bottom: 55, left: 60 };
    var iw = w - margin.left - margin.right;
    var ih = h - margin.top - margin.bottom;

    var svg = d3.select('#' + containerId).append('svg')
      .attr('viewBox', '0 0 ' + w + ' ' + h)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    var defs = svg.append('defs');

    // Gradient for inequality area
    var grad = defs.append('linearGradient')
      .attr('id', 'lorenz-fill-grad')
      .attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#f472b6').attr('stop-opacity', 0.25);
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#f472b6').attr('stop-opacity', 0.02);

    // Gradient for Lorenz area
    var grad2 = defs.append('linearGradient')
      .attr('id', 'lorenz-curve-grad')
      .attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
    grad2.append('stop').attr('offset', '0%').attr('stop-color', '#38bdf8').attr('stop-opacity', 0.3);
    grad2.append('stop').attr('offset', '100%').attr('stop-color', '#38bdf8').attr('stop-opacity', 0.02);

    var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var x = d3.scaleLinear().domain([0, 1]).range([0, iw]);
    var y = d3.scaleLinear().domain([0, 1]).range([ih, 0]);

    // Axes
    g.append('g').attr('transform', 'translate(0,' + ih + ')')
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('.0%')))
      .selectAll('text').style('fill', '#94a3b8');
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('.0%')))
      .selectAll('text').style('fill', '#94a3b8');
    g.selectAll('.domain, .tick line').style('stroke', '#334155');

    // Equality line (diagonal)
    g.append('line').attr('x1', 0).attr('y1', ih).attr('x2', iw).attr('y2', 0)
      .style('stroke', '#475569').style('stroke-dasharray', '6,4').style('stroke-width', 1.5);

    var lorenz = bf.lorenz;
    var n = lorenz.length;
    var pts = lorenz.map(function (v, i) { return [i / (n - 1), v]; });
    pts.unshift([0, 0]);

    // Shade the inequality area (between diagonal and Lorenz curve)
    var inequalityPath = 'M' + x(0) + ',' + y(0);
    pts.forEach(function (p) {
      inequalityPath += ' L' + x(p[0]) + ',' + y(p[0]); // diagonal
    });
    // Walk back along the Lorenz curve
    for (var li = pts.length - 1; li >= 0; li--) {
      inequalityPath += ' L' + x(pts[li][0]) + ',' + y(pts[li][1]);
    }
    inequalityPath += ' Z';
    g.append('path').attr('d', inequalityPath)
      .style('fill', 'url(#lorenz-fill-grad)');

    // Lorenz curve area (under curve)
    var area = d3.area().x(function (d) { return x(d[0]); })
      .y0(ih).y1(function (d) { return y(d[1]); });
    g.append('path').datum(pts).attr('d', area)
      .style('fill', 'url(#lorenz-curve-grad)');

    // Lorenz curve line
    var line = d3.line().x(function (d) { return x(d[0]); }).y(function (d) { return y(d[1]); })
      .curve(d3.curveMonotoneX);
    g.append('path').datum(pts).attr('d', line)
      .style('fill', 'none').style('stroke', '#38bdf8').style('stroke-width', 2.5);

    // Bus factor vertical line
    if (n > 0) {
      var bfX = Math.min(bf.factor / n, 1);
      g.append('line').attr('x1', x(bfX)).attr('y1', 0).attr('x2', x(bfX)).attr('y2', ih)
        .style('stroke', '#f472b6').style('stroke-dasharray', '4,4').style('stroke-width', 1.5);
    }

    // Compute Gini coefficient
    var gini = 0;
    if (pts.length > 1) {
      // Trapezoidal integration under Lorenz curve
      var areaUnder = 0;
      for (var gi = 1; gi < pts.length; gi++) {
        areaUnder += (pts[gi][0] - pts[gi - 1][0]) * (pts[gi][1] + pts[gi - 1][1]) / 2;
      }
      gini = Math.max(0, Math.min(1, 1 - 2 * areaUnder));
    }

    // Bus factor label
    g.append('text').attr('x', iw - 10).attr('y', 20)
      .style('fill', '#38bdf8').style('font-size', '16px').style('font-weight', '700')
      .style('text-anchor', 'end')
      .text('Bus Factor: ' + bf.factor);

    // Gini coefficient label on the Lorenz curve itself
    var giniLabelIdx = Math.floor(pts.length * 0.5);
    var giniPt = pts[giniLabelIdx] || pts[Math.floor(pts.length / 2)];
    g.append('text')
      .attr('x', x(giniPt[0]) + 8).attr('y', y(giniPt[1]) - 8)
      .style('fill', '#f472b6').style('font-size', '13px').style('font-weight', '600')
      .text('Gini: ' + gini.toFixed(3));

    // Equality label
    g.append('text').attr('x', x(0.15)).attr('y', y(0.2))
      .style('fill', '#475569').style('font-size', '11px')
      .attr('transform', 'rotate(-45,' + x(0.15) + ',' + y(0.2) + ')')
      .text('Perfect equality');

    // Axis labels
    svg.append('text').attr('x', w / 2).attr('y', h - 8)
      .style('fill', '#94a3b8').style('font-size', '12px').style('text-anchor', 'middle')
      .text('Cumulative % of Contributors');
    svg.append('text').attr('transform', 'rotate(-90)').attr('x', -h / 2).attr('y', 15)
      .style('fill', '#94a3b8').style('font-size', '12px').style('text-anchor', 'middle')
      .text('Cumulative % of Commits');
  }

  // ═══════════════════════════════════════════════════════
  // ── D3: Radar Chart for Repo Health ──
  // ═══════════════════════════════════════════════════════

  function renderRadarChart(containerId, metrics) {
    var container = document.getElementById(containerId);
    if (!container || !metrics || metrics.length === 0) return;

    var w = container.clientWidth || 500, h = 420;
    var cx = w / 2, cy = h / 2, radius = Math.min(w, h) / 2 - 65;

    var svg = d3.select('#' + containerId).append('svg')
      .attr('viewBox', '0 0 ' + w + ' ' + h)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    var defs = svg.append('defs');
    var radarGrad = defs.append('radialGradient')
      .attr('id', 'radar-fill-grad')
      .attr('cx', '50%').attr('cy', '50%').attr('r', '50%');
    radarGrad.append('stop').attr('offset', '0%').attr('stop-color', '#38bdf8').attr('stop-opacity', 0.3);
    radarGrad.append('stop').attr('offset', '100%').attr('stop-color', '#38bdf8').attr('stop-opacity', 0.08);

    var n = metrics.length;
    var angleSlice = (Math.PI * 2) / n;

    // Grid levels with reference rings at 25/50/75/100
    var refLevels = [25, 50, 75, 100];
    refLevels.forEach(function (pct) {
      var r = radius * pct / 100;
      svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', r)
        .style('fill', 'none').style('stroke', '#334155').style('stroke-width', 0.5);
      // Level label
      svg.append('text')
        .attr('x', cx + 4).attr('y', cy - r + 3)
        .style('fill', '#475569').style('font-size', '9px')
        .text(pct + '%');
    });

    // Axis lines and labels
    metrics.forEach(function (m, i) {
      var angle = angleSlice * i - Math.PI / 2;
      var lx = cx + Math.cos(angle) * radius;
      var ly = cy + Math.sin(angle) * radius;
      svg.append('line').attr('x1', cx).attr('y1', cy).attr('x2', lx).attr('y2', ly)
        .style('stroke', '#334155').style('stroke-width', 0.5);

      var labelDist = radius + 28;
      var tx = cx + Math.cos(angle) * labelDist;
      var ty = cy + Math.sin(angle) * labelDist;

      // Label
      svg.append('text').attr('x', tx).attr('y', ty)
        .style('fill', '#e2e8f0').style('font-size', '11px').style('font-weight', '500')
        .style('text-anchor', 'middle').style('dominant-baseline', 'middle')
        .text(m.label);

      // Score label on the data point
      var scoreDist = radius * Math.min(m.value, 1) + 14;
      var sx = cx + Math.cos(angle) * scoreDist;
      var sy = cy + Math.sin(angle) * scoreDist;
      svg.append('text').attr('x', sx).attr('y', sy)
        .style('fill', '#38bdf8').style('font-size', '10px').style('font-weight', '600')
        .style('text-anchor', 'middle').style('dominant-baseline', 'middle')
        .text(Math.round(m.value * 100));
    });

    // Data polygon
    var points = metrics.map(function (m, i) {
      var angle = angleSlice * i - Math.PI / 2;
      var r = radius * Math.min(m.value, 1);
      return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
    });
    points.push(points[0]);

    svg.append('polygon')
      .attr('points', points.map(function (p) { return p[0] + ',' + p[1]; }).join(' '))
      .style('fill', 'url(#radar-fill-grad)')
      .style('stroke', '#38bdf8').style('stroke-width', 2);

    // Data points
    points.slice(0, -1).forEach(function (p) {
      svg.append('circle').attr('cx', p[0]).attr('cy', p[1]).attr('r', 5)
        .style('fill', '#38bdf8').style('stroke', '#0f172a').style('stroke-width', 2.5);
    });
  }

  // ── Sequential Change Chains ──
  // Renders a table of recurring file-change cascades detected across commit history.
  // All data comes from the server-side Rust pipeline via window.__REPORT_DATA__
  // and contains only path strings + numeric values (no user-editable content).
  (function () {
    var container = document.getElementById('sequential-coupling-table');
    if (!container || !D.sequential_coupling || D.sequential_coupling.length === 0) return;

    // Wrap in a <details> collapsible
    var seqParent = container.parentNode;
    var seqDetails = document.createElement('details');
    seqDetails.className = 'collapsible';
    var seqSummary = document.createElement('summary');
    seqSummary.textContent = 'Sequential Change Chains (' + D.sequential_coupling.length + ' chains)';
    seqDetails.appendChild(seqSummary);
    seqParent.replaceChild(seqDetails, container);
    seqDetails.appendChild(container);

    var chains = D.sequential_coupling;

    // Insight cards (built via safe DOM helpers)
    var totalOccurrences = chains.reduce(function (s, c) { return s + c.occurrences; }, 0);
    var longest = chains.reduce(function (a, b) { return b.files.length > a.files.length ? b : a; }, chains[0]);
    var mostFrequent = chains.reduce(function (a, b) { return b.occurrences > a.occurrences ? b : a; }, chains[0]);

    function shortName(f) { return f.split('/').pop(); }
    function chainLabel(c) { return c.files.map(shortName).join(' \u2192 '); }

    var insightCards = el('div', { className: 'insight-cards' });
    insightCards.appendChild(createInsightCard('\uD83D\uDD17',
      chains.length + ' recurring change chains detected across ' + totalOccurrences + ' total occurrences'));
    insightCards.appendChild(createInsightCard('\uD83D\uDCCB',
      'Longest chain: ' + longest.files.length + ' files (' + chainLabel(longest) + ') seen ' + longest.occurrences + 'x'));
    if (mostFrequent !== longest) {
      insightCards.appendChild(createInsightCard('\uD83D\uDD01',
        'Most frequent: ' + chainLabel(mostFrequent) + ' (' + mostFrequent.occurrences + 'x, ~' + mostFrequent.avg_span_hours + 'h avg span)'));
    }
    container.appendChild(insightCards);

    // Build table via DOM
    var table = el('table', { className: 'data-table' });
    var thead = el('thead');
    var headerRow = el('tr');
    ['Chain', 'Length', 'Occurrences', 'Avg Span', 'Confidence'].forEach(function (h) {
      headerRow.appendChild(el('th', { textContent: h }));
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    var tbody = el('tbody');
    chains.forEach(function (c) {
      var row = el('tr');
      var shortFiles = c.files.map(function (f) {
        var parts = f.split('/');
        return parts.length > 2 ? parts.slice(-2).join('/') : f;
      });
      // Chain cell with arrow separators
      var chainCell = el('td', { className: 'path-cell' });
      shortFiles.forEach(function (f, i) {
        if (i > 0) {
          var arrow = el('span', { style: 'color:#38bdf8', textContent: ' \u2192 ' });
          chainCell.appendChild(arrow);
        }
        chainCell.appendChild(document.createTextNode(f));
      });
      row.appendChild(chainCell);
      row.appendChild(el('td', { className: 'num', textContent: String(c.files.length) }));
      row.appendChild(el('td', { className: 'num', textContent: String(c.occurrences) }));
      row.appendChild(el('td', { className: 'num', textContent: c.avg_span_hours + 'h' }));
      var confPct = Math.round(c.confidence * 100);
      var confColor = confPct >= 50 ? '#22c55e' : (confPct >= 25 ? '#facc15' : '#94a3b8');
      row.appendChild(el('td', { className: 'num', style: 'color:' + confColor, textContent: confPct + '%' }));
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    var scrollWrap = el('div', { className: 'table-scroll-wrap' });
    scrollWrap.appendChild(table);
    container.appendChild(scrollWrap);
  })();

  // ══════════════════════════════════════════════════════════
  // GitHub Section
  // ══════════════════════════════════════════════════════════
  (function () {
    var GH = D.github;
    if (!GH) return;
    try {

    // ── GitHub Meta Overview ──
    (function () {
      var container = document.getElementById('github-meta');
      if (!container || !GH.meta) return;
      var m = GH.meta;

      // Repo identity badge
      var identity = el('div', { style: 'display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:20px' });
      var nameLink = el('a', { style: 'font-size:20px;font-weight:800;color:#38bdf8;text-decoration:none' });
      nameLink.textContent = m.full_name;
      nameLink.href = m.html_url;
      nameLink.target = '_blank';
      identity.appendChild(nameLink);
      if (m.archived) {
        identity.appendChild(el('span', { className: 'badge badge-red', textContent: 'Archived' }));
      }
      if (m.is_fork) {
        identity.appendChild(el('span', { className: 'badge badge-purple', textContent: 'Fork' }));
      }
      if (m.visibility) {
        identity.appendChild(el('span', { className: 'badge badge-gray', textContent: m.visibility }));
      }
      if (m.license) {
        identity.appendChild(el('span', { className: 'badge badge-green', textContent: m.license }));
      }
      container.appendChild(identity);

      if (m.description) {
        container.appendChild(el('p', { style: 'color:#94a3b8;font-size:14px;margin:0 0 16px;line-height:1.5', textContent: m.description }));
      }

      // Stats row
      var stats = el('div', { className: 'mini-stats-row' });
      function addStat(value, label, cls) {
        var s = el('div', { className: 'mini-stat ' + (cls || '') });
        s.appendChild(el('div', { className: 'mini-stat-value', textContent: String(value) }));
        s.appendChild(el('div', { className: 'mini-stat-label', textContent: label }));
        stats.appendChild(s);
      }
      addStat(fmtCompact(m.stars), 'Stars', 'accent-blue');
      addStat(fmtCompact(m.forks), 'Forks', 'accent-purple');
      addStat(fmtCompact(m.open_issues), 'Open Issues', 'accent-orange');
      addStat(fmtCompact(m.watchers), 'Watchers', '');
      if (GH.community && GH.community.health_percentage) {
        addStat(GH.community.health_percentage + '%', 'Community Health', 'accent-green');
      }
      container.appendChild(stats);

      // Topics
      if (m.topics && m.topics.length > 0) {
        var topicsDiv = el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin-top:12px' });
        m.topics.forEach(function (t) {
          topicsDiv.appendChild(el('span', { className: 'badge badge-blue', textContent: t }));
        });
        container.appendChild(topicsDiv);
      }
    })();

    // ── Pull Requests ──
    (function () {
      var container = document.getElementById('github-prs');
      if (!container || !GH.pull_requests) return;
      var pr = GH.pull_requests;

      var stats = el('div', { className: 'mini-stats-row' });
      var openStat = el('div', { className: 'mini-stat accent-green' });
      openStat.appendChild(el('div', { className: 'mini-stat-value', textContent: String(pr.open_count) }));
      openStat.appendChild(el('div', { className: 'mini-stat-label', textContent: 'Open PRs' }));
      stats.appendChild(openStat);

      if (pr.avg_merge_time_hours !== null && pr.avg_merge_time_hours !== undefined) {
        var avgStat = el('div', { className: 'mini-stat accent-blue' });
        var hours = pr.avg_merge_time_hours;
        var timeStr = hours < 24 ? Math.round(hours) + 'h' : (hours / 24).toFixed(1) + 'd';
        avgStat.appendChild(el('div', { className: 'mini-stat-value', textContent: timeStr }));
        avgStat.appendChild(el('div', { className: 'mini-stat-label', textContent: 'Avg Merge Time' }));
        stats.appendChild(avgStat);
      }

      var mergedCount = pr.recently_merged ? pr.recently_merged.length : 0;
      var mergedStat = el('div', { className: 'mini-stat accent-purple' });
      mergedStat.appendChild(el('div', { className: 'mini-stat-value', textContent: String(mergedCount) }));
      mergedStat.appendChild(el('div', { className: 'mini-stat-label', textContent: 'Recently Merged' }));
      stats.appendChild(mergedStat);
      container.appendChild(stats);

      // Recent open PRs list
      if (pr.open_prs && pr.open_prs.length > 0) {
        var list = el('div', { style: 'margin-top:12px' });
        pr.open_prs.slice(0, 10).forEach(function (p) {
          var item = el('div', { style: 'display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(71,85,105,0.2);font-size:13px;overflow:hidden;min-width:0' });
          item.appendChild(el('span', { style: 'color:#34d399;font-weight:700;flex-shrink:0', textContent: '#' + p.number }));
          item.appendChild(el('span', { style: 'color:#f1f5f9;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', textContent: p.title }));
          item.appendChild(el('span', { style: 'color:#64748b;font-size:11px;flex-shrink:0', textContent: p.user }));
          if (p.draft) item.appendChild(el('span', { className: 'badge badge-gray', textContent: 'draft' }));
          list.appendChild(item);
        });
        container.appendChild(list);
      }
    })();

    // ── Issues ──
    (function () {
      var container = document.getElementById('github-issues');
      if (!container || !GH.issues) return;
      var iss = GH.issues;

      var stats = el('div', { className: 'mini-stats-row' });
      var openS = el('div', { className: 'mini-stat accent-orange' });
      openS.appendChild(el('div', { className: 'mini-stat-value', textContent: String(iss.open_count) }));
      openS.appendChild(el('div', { className: 'mini-stat-label', textContent: 'Open' }));
      stats.appendChild(openS);
      var closedS = el('div', { className: 'mini-stat accent-green' });
      closedS.appendChild(el('div', { className: 'mini-stat-value', textContent: String(iss.closed_count) }));
      closedS.appendChild(el('div', { className: 'mini-stat-label', textContent: 'Closed' }));
      stats.appendChild(closedS);
      container.appendChild(stats);

      if (iss.recent_issues && iss.recent_issues.length > 0) {
        var list = el('div', { style: 'margin-top:12px' });
        iss.recent_issues.slice(0, 10).forEach(function (i) {
          var item = el('div', { style: 'display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(71,85,105,0.2);font-size:13px;overflow:hidden;min-width:0' });
          item.appendChild(el('span', { style: 'color:#fb923c;font-weight:700;flex-shrink:0', textContent: '#' + i.number }));
          item.appendChild(el('span', { style: 'color:#f1f5f9;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', textContent: i.title }));
          i.labels.slice(0, 3).forEach(function (l) {
            item.appendChild(el('span', { className: 'badge badge-purple', textContent: l }));
          });
          list.appendChild(item);
        });
        container.appendChild(list);
      }
    })();

    // ── Contributors ──
    (function () {
      var container = document.getElementById('github-contributors');
      if (!container || !GH.contributors || GH.contributors.length === 0) return;

      var grid = el('div', { style: 'display:flex;flex-wrap:wrap;gap:10px' });
      GH.contributors.slice(0, 30).forEach(function (c) {
        var card = el('a', { style: 'display:flex;align-items:center;gap:8px;background:rgba(15,23,42,0.5);border:1px solid rgba(71,85,105,0.3);border-radius:8px;padding:8px 12px;text-decoration:none;transition:border-color 0.15s;min-width:140px;flex:1 1 140px' });
        card.href = c.html_url;
        card.target = '_blank';
        card.addEventListener('mouseenter', function () { card.style.borderColor = 'rgba(56,189,248,0.3)'; });
        card.addEventListener('mouseleave', function () { card.style.borderColor = 'rgba(71,85,105,0.3)'; });
        var avatar = el('img', { style: 'width:32px;height:32px;border-radius:50%;flex-shrink:0' });
        avatar.src = c.avatar_url + '&s=64';
        avatar.alt = c.login;
        avatar.loading = 'lazy';
        card.appendChild(avatar);
        var info = el('div', { style: 'flex:1;min-width:0' });
        info.appendChild(el('div', { style: 'font-size:13px;font-weight:600;color:#f1f5f9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', textContent: c.login }));
        info.appendChild(el('div', { style: 'font-size:11px;color:#64748b', textContent: fmtCompact(c.contributions) + ' contributions' }));
        card.appendChild(info);
        grid.appendChild(card);
      });
      container.appendChild(grid);
    })();

    // ── CI/CD Workflows ──
    (function () {
      var container = document.getElementById('github-ci');
      if (!container) return;

      if (GH.ci_workflows && GH.ci_workflows.length > 0) {
        GH.ci_workflows.slice(0, 15).forEach(function (w) {
          var item = el('div', { style: 'display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(71,85,105,0.2);font-size:13px;overflow:hidden;min-width:0' });
          var stateColor = w.state === 'active' ? '#34d399' : '#64748b';
          item.appendChild(el('span', { style: 'width:8px;height:8px;border-radius:50%;background:' + stateColor + ';flex-shrink:0' }));
          item.appendChild(el('span', { style: 'color:#f1f5f9;flex:1', textContent: w.name }));
          item.appendChild(el('span', { className: 'badge badge-gray mono', textContent: w.path.split('/').pop() }));
          container.appendChild(item);
        });
      } else {
        container.appendChild(el('div', { className: 'empty-state', textContent: 'No CI/CD workflows detected' }));
      }

      // Recent runs
      if (GH.recent_runs && GH.recent_runs.length > 0) {
        container.appendChild(el('h3', { style: 'font-size:13px;font-weight:700;color:#94a3b8;margin:16px 0 8px;text-transform:uppercase;letter-spacing:0.5px', textContent: 'Recent Runs' }));
        GH.recent_runs.slice(0, 5).forEach(function (r) {
          var item = el('div', { style: 'display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px' });
          var conc = r.conclusion || r.status;
          var color = conc === 'success' ? '#34d399' : conc === 'failure' ? '#f87171' : '#facc15';
          item.appendChild(el('span', { style: 'width:8px;height:8px;border-radius:50%;background:' + color + ';flex-shrink:0' }));
          item.appendChild(el('span', { style: 'color:#f1f5f9', textContent: r.workflow_name }));
          item.appendChild(el('span', { style: 'color:#64748b;margin-left:auto', textContent: '#' + r.run_number + ' · ' + r.head_branch }));
          container.appendChild(item);
        });
      }
    })();

    // ── OpenSSF Health Score ──
    (function () {
      var container = document.getElementById('github-openssf');
      if (!container) return;

      // Calculate OpenSSF-style score from GitHub data
      var checks = [];
      var totalPoints = 0;
      var earnedPoints = 0;

      function check(name, passed, points, detail) {
        totalPoints += points;
        if (passed) earnedPoints += points;
        checks.push({ name: name, passed: passed, points: points, detail: detail || '' });
      }

      // Branch protection (20 pts)
      var bp = GH.branch_protection;
      if (bp) {
        check('Branch protection enabled', true, 5, '');
        check('Required reviews', bp.required_reviews > 0, 5, bp.required_reviews ? bp.required_reviews + ' reviewer(s)' : 'Not configured');
        check('Dismiss stale reviews', bp.dismiss_stale_reviews, 3, '');
        check('Require CODEOWNERS', bp.require_code_owner_reviews, 3, '');
        check('No force pushes', !bp.allow_force_pushes, 2, '');
        check('No deletions', !bp.allow_deletions, 2, '');
      } else {
        check('Branch protection', false, 20, 'Not configured or requires auth');
      }

      // CI/CD (15 pts)
      var hasCi = GH.ci_workflows && GH.ci_workflows.length > 0;
      check('CI/CD pipelines', hasCi, 10, hasCi ? GH.ci_workflows.length + ' workflows' : 'No workflows found');
      var hasSuccessRun = GH.recent_runs && GH.recent_runs.some(function (r) { return r.conclusion === 'success'; });
      check('Recent successful CI run', hasSuccessRun, 5, '');

      // Community (15 pts)
      var comm = GH.community;
      if (comm) {
        check('README', comm.has_readme, 3, '');
        check('License', comm.has_license, 3, '');
        check('Contributing guide', comm.has_contributing, 3, '');
        check('Code of conduct', comm.has_code_of_conduct, 3, '');
        check('Issue templates', comm.has_issue_template, 1.5, '');
        check('PR templates', comm.has_pull_request_template, 1.5, '');
      } else {
        check('Community profile', false, 15, 'Could not fetch');
      }

      // Security (15 pts)
      var hasAlerts = GH.dependabot_alerts && GH.dependabot_alerts.length > 0;
      var critAlerts = hasAlerts ? GH.dependabot_alerts.filter(function (a) { return a.severity === 'critical' || a.severity === 'high'; }).length : 0;
      check('No critical/high alerts', critAlerts === 0, 10, critAlerts > 0 ? critAlerts + ' critical/high alerts' : 'Clean');
      check('Dependabot enabled', GH.dependabot_alerts !== undefined && GH.dependabot_alerts !== null, 5, '');

      // Maintenance (10 pts)
      if (GH.meta) {
        var pushDate = new Date(GH.meta.pushed_at);
        var daysSincePush = Math.floor((Date.now() - pushDate.getTime()) / 86400000);
        check('Recently maintained', daysSincePush < 90, 5, daysSincePush + ' days since last push');
        check('Not archived', !GH.meta.archived, 5, '');
      }

      // PR health (10 pts)
      if (GH.pull_requests) {
        check('Active PR process', GH.pull_requests.open_count > 0 || (GH.pull_requests.recently_merged && GH.pull_requests.recently_merged.length > 0), 5, '');
        var fastMerge = GH.pull_requests.avg_merge_time_hours !== null && GH.pull_requests.avg_merge_time_hours < 168;
        check('PRs merged within 7 days', fastMerge, 5, GH.pull_requests.avg_merge_time_hours !== null ? Math.round(GH.pull_requests.avg_merge_time_hours) + 'h avg' : 'N/A');
      }

      // Render score
      var score = totalPoints > 0 ? Math.round(earnedPoints / totalPoints * 100) : 0;
      var grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F';
      var gradeColor = score >= 70 ? '#34d399' : score >= 50 ? '#facc15' : score >= 30 ? '#fb923c' : '#f87171';

      var header = el('div', { style: 'display:flex;align-items:center;gap:16px;margin-bottom:16px;flex-wrap:wrap' });
      header.appendChild(el('div', { style: 'font-size:42px;font-weight:800;color:' + gradeColor + ';line-height:1', textContent: score }));
      var headerInfo = el('div');
      headerInfo.appendChild(el('div', { style: 'font-size:14px;font-weight:700;color:#f1f5f9', textContent: 'OpenSSF Score: ' + grade }));
      headerInfo.appendChild(el('div', { style: 'font-size:12px;color:#64748b', textContent: Math.round(earnedPoints) + ' of ' + totalPoints + ' points earned' }));
      header.appendChild(headerInfo);
      container.appendChild(header);

      // Checklist
      checks.forEach(function (c) {
        var item = el('div', { style: 'display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(71,85,105,0.15);font-size:12px' });
        var icon = c.passed ? '\u2713' : '\u2717';
        var iconColor = c.passed ? '#34d399' : '#f87171';
        item.appendChild(el('span', { style: 'color:' + iconColor + ';font-weight:700;width:16px;text-align:center;flex-shrink:0', textContent: icon }));
        item.appendChild(el('span', { style: 'color:#f1f5f9;flex:1', textContent: c.name }));
        if (c.detail) {
          item.appendChild(el('span', { style: 'color:#64748b;font-size:11px', textContent: c.detail }));
        }
        item.appendChild(el('span', { style: 'color:#64748b;font-size:11px;font-weight:600;min-width:30px;text-align:right', textContent: '+' + c.points }));
        container.appendChild(item);
      });
    })();

    // ── Security & Dependabot ──
    (function () {
      var container = document.getElementById('github-security');
      if (!container) return;

      if (!GH.dependabot_alerts || GH.dependabot_alerts.length === 0) {
        var msg = GH.dependabot_alerts === undefined ? 'Dependabot alerts require authentication (set GITHUB_TOKEN)' : 'No open Dependabot alerts \u2014 looking good!';
        var color = GH.dependabot_alerts === undefined ? '#64748b' : '#34d399';
        container.appendChild(el('div', { style: 'padding:20px;text-align:center;color:' + color + ';font-size:14px', textContent: msg }));
        return;
      }

      // Severity summary
      var sevCounts = { critical: 0, high: 0, medium: 0, low: 0 };
      GH.dependabot_alerts.forEach(function (a) { sevCounts[a.severity] = (sevCounts[a.severity] || 0) + 1; });

      var stats = el('div', { className: 'mini-stats-row' });
      if (sevCounts.critical > 0) {
        var cs = el('div', { className: 'mini-stat' });
        cs.appendChild(el('div', { className: 'mini-stat-value', style: 'color:#f87171', textContent: String(sevCounts.critical) }));
        cs.appendChild(el('div', { className: 'mini-stat-label', textContent: 'Critical' }));
        stats.appendChild(cs);
      }
      if (sevCounts.high > 0) {
        var hs = el('div', { className: 'mini-stat' });
        hs.appendChild(el('div', { className: 'mini-stat-value', style: 'color:#fb923c', textContent: String(sevCounts.high) }));
        hs.appendChild(el('div', { className: 'mini-stat-label', textContent: 'High' }));
        stats.appendChild(hs);
      }
      var ms2 = el('div', { className: 'mini-stat' });
      ms2.appendChild(el('div', { className: 'mini-stat-value', style: 'color:#facc15', textContent: String(sevCounts.medium) }));
      ms2.appendChild(el('div', { className: 'mini-stat-label', textContent: 'Medium' }));
      stats.appendChild(ms2);
      var ls = el('div', { className: 'mini-stat' });
      ls.appendChild(el('div', { className: 'mini-stat-value', style: 'color:#64748b', textContent: String(sevCounts.low) }));
      ls.appendChild(el('div', { className: 'mini-stat-label', textContent: 'Low' }));
      stats.appendChild(ls);
      container.appendChild(stats);

      // Alert list
      GH.dependabot_alerts.slice(0, 15).forEach(function (a) {
        var item = el('div', { style: 'display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(71,85,105,0.2);font-size:12px' });
        var sevColor = a.severity === 'critical' ? '#f87171' : a.severity === 'high' ? '#fb923c' : a.severity === 'medium' ? '#facc15' : '#64748b';
        item.appendChild(el('span', { className: 'badge', style: 'background:' + sevColor + '22;color:' + sevColor, textContent: a.severity }));
        item.appendChild(el('span', { style: 'color:#f1f5f9;flex:1', textContent: a.summary }));
        item.appendChild(el('span', { className: 'badge badge-gray mono', textContent: a.package_name }));
        container.appendChild(item);
      });
    })();
    } catch (err) {
      console.error('[RepoAnalyze] GitHub section error:', err);
      var errContainer = document.getElementById('github-meta');
      if (errContainer) errContainer.textContent = 'Error rendering GitHub section: ' + err.message;
    }
  })();

})();
