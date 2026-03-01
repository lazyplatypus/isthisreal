/**
 * Saju Reading App — Frontend
 */

const ELEMENT_KR = { wood: '목(木)', fire: '화(火)', earth: '토(土)', metal: '금(金)', water: '수(水)' };
const YY_LABEL = { yang: 'Yang (양)', yin: 'Yin (음)' };

const $ = (sel) => document.querySelector(sel);
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');

// ─── Form Handling ────────────────────────────────────────────────────────

const form = $('#birth-form');
const btnChart = $('#btn-chart');
const btnReading = $('#btn-reading');

function getFormData() {
  return {
    year: parseInt($('#year').value),
    month: parseInt($('#month').value),
    day: parseInt($('#day').value),
    hour: parseInt($('#hour').value),
    minute: parseInt($('#minute').value) || 0,
    gender: $('#gender').value,
    name: $('#name').value || null,
  };
}

btnChart.addEventListener('click', async () => {
  if (!form.reportValidity()) return;
  await fetchChart();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await fetchReading();
});

// ─── API Calls ────────────────────────────────────────────────────────────

async function fetchChart() {
  const data = getFormData();
  setLoading(true, 'Calculating your Four Pillars...');

  try {
    const res = await fetch('/api/chart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Chart calculation failed');
    }

    const chart = await res.json();
    renderChart(chart);
    hide($('#reading-section'));
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    setLoading(false);
  }
}

async function fetchReading() {
  const data = getFormData();
  const readingType = $('#reading-type').value;
  const language = $('#language').value;

  setLoading(true, 'Calculating your Four Pillars...');

  try {
    // Short pause to show "calculating" message, then switch
    await new Promise((r) => setTimeout(r, 500));
    setLoading(true, 'Claude is interpreting your chart... This may take a moment.');

    const res = await fetch('/api/reading', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        birth: data,
        reading_type: readingType,
        language: language,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Reading generation failed');
    }

    const result = await res.json();
    renderChart(result.chart);
    renderReading(result.reading, readingType);
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    setLoading(false);
  }
}

function setLoading(on, text) {
  const section = $('#loading-section');
  const buttons = document.querySelectorAll('.btn');
  if (on) {
    show(section);
    hide($('#chart-section'));
    hide($('#reading-section'));
    if (text) $('#loading-text').textContent = text;
    buttons.forEach((b) => (b.disabled = true));
  } else {
    hide(section);
    buttons.forEach((b) => (b.disabled = false));
  }
}

// ─── Render Chart ─────────────────────────────────────────────────────────

function renderChart(chart) {
  show($('#chart-section'));

  // Chart info
  $('#chart-info').innerHTML = `
    ${chart.name ? `<strong>${chart.name}</strong> &mdash; ` : ''}
    Solar: ${chart.birth_solar} &bull; Lunar: ${chart.birth_lunar} &bull; ${chart.gender_kr}
  `;

  // Four Pillars
  const pillars = [
    { label: 'Hour (시주)', data: chart.hour_pillar },
    { label: 'Day (일주)', data: chart.day_pillar },
    { label: 'Month (월주)', data: chart.month_pillar },
    { label: 'Year (년주)', data: chart.year_pillar },
  ];

  const grid = $('#pillars-grid');
  grid.innerHTML = pillars.map(({ label, data }) => {
    const gz = data.ganzhi;
    const elClass = `el-${gz.element}`;
    const hiddenHtml = data.hidden_stems.length > 0
      ? `<div class="pillar-hidden">Hidden: ${data.hidden_stems.map(
          (h) => `<span class="el-${h.element}">${h.stem_cn}</span>`
        ).join(' ')}</div>`
      : '';
    const tenGodHtml = data.stem_ten_god
      ? `<div class="pillar-ten-god">${data.stem_ten_god_kr} (${data.stem_ten_god})</div>`
      : '';

    return `
      <div class="pillar">
        <div class="pillar-label">${label}</div>
        <div class="pillar-stem ${elClass}">${gz.stem_cn}</div>
        <div class="pillar-branch ${elClass}">${gz.branch_cn}</div>
        <div class="pillar-info">
          ${gz.stem_kr}${gz.branch_kr}
        </div>
        <div class="pillar-animal">${gz.branch_animal_kr} (${gz.branch_animal_en})</div>
        ${tenGodHtml}
        ${hiddenHtml}
      </div>
    `;
  }).join('');

  // Day Master
  const dm = chart;
  $('#day-master-card').innerHTML = `
    <h2>Day Master <span class="kr-label">일간 / 日主</span></h2>
    <div class="day-master-display">
      <div class="day-master-char el-${dm.day_master_element}">${chart.day_pillar.ganzhi.stem_cn}</div>
      <div class="day-master-info">
        <div class="label">Identity</div>
        <div class="value">${dm.day_master_kr}</div>
        <div class="label">Element</div>
        <div class="value el-${dm.day_master_element}">${ELEMENT_KR[dm.day_master_element]}</div>
        <div class="label">Polarity</div>
        <div class="value">${YY_LABEL[dm.day_master_yin_yang]}</div>
      </div>
    </div>
  `;

  // Element Balance
  const eb = chart.element_balance;
  const total = eb.wood + eb.fire + eb.earth + eb.metal + eb.water;
  const maxVal = Math.max(eb.wood, eb.fire, eb.earth, eb.metal, eb.water, 1);

  const elements = [
    { key: 'wood', label: ELEMENT_KR.wood, val: eb.wood },
    { key: 'fire', label: ELEMENT_KR.fire, val: eb.fire },
    { key: 'earth', label: ELEMENT_KR.earth, val: eb.earth },
    { key: 'metal', label: ELEMENT_KR.metal, val: eb.metal },
    { key: 'water', label: ELEMENT_KR.water, val: eb.water },
  ];

  $('#element-bars').innerHTML = elements.map(({ key, label, val }) => {
    const pct = Math.max((val / maxVal) * 100, 8);
    const isDominant = key === eb.dominant;
    const isWeakest = key === eb.weakest;
    const badge = isDominant ? ' (dominant)' : isWeakest ? ' (weakest)' : '';
    return `
      <div class="element-row">
        <div class="element-label el-${key}">${label}</div>
        <div class="element-bar-track">
          <div class="element-bar-fill ${key}" style="width: ${pct}%">${val}${badge}</div>
        </div>
      </div>
    `;
  }).join('');

  // Symbolic Stars
  const starsCard = $('#stars-card');
  if (chart.symbolic_stars && chart.symbolic_stars.length > 0) {
    starsCard.style.display = '';
    $('#stars-list').innerHTML = chart.symbolic_stars.map((s) => `
      <div class="star-item">
        <div class="star-name">${s.name_kr} <span class="cn">${s.name_cn}</span></div>
        <div class="star-pillar">${s.pillar}</div>
        <div class="star-desc">${s.description_en}</div>
      </div>
    `).join('');
  } else {
    starsCard.style.display = 'none';
  }

  // Luck Cycles
  $('#luck-cycles').innerHTML = chart.luck_cycles.map((lc) => `
    <div class="luck-cycle">
      <div class="luck-age">${lc.start_age} - ${lc.end_age}</div>
      <div class="luck-chars el-${lc.element}">${lc.stem_cn}${lc.branch_cn}</div>
      <div class="luck-element el-${lc.element}">${ELEMENT_KR[lc.element]}</div>
      <div class="luck-animal">${lc.branch_animal_kr}</div>
    </div>
  `).join('');

  // Scroll to chart
  $('#chart-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Render Reading ───────────────────────────────────────────────────────

function renderReading(text, readingType) {
  show($('#reading-section'));

  const typeLabels = {
    full: '종합운',
    personality: '성격',
    career: '재물운',
    love: '연애운',
    yearly: '올해운세',
  };

  $('#reading-type-label').textContent = typeLabels[readingType] || '';
  $('#reading-content').innerHTML = markdownToHtml(text);

  // Scroll to reading
  $('#reading-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Simple Markdown to HTML ──────────────────────────────────────────────

function markdownToHtml(md) {
  let html = md
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Horizontal rules
    .replace(/^---+$/gm, '<hr>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p>')
    // Line breaks
    .replace(/\n/g, '<br>');

  // Wrap loose <li> in <ul>
  html = html.replace(/(<li>.*?<\/li>(?:<br>)?)+/g, (match) => {
    return '<ul>' + match.replace(/<br>/g, '') + '</ul>';
  });

  return '<p>' + html + '</p>';
}
