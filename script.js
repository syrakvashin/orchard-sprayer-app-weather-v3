const STOCK_API_URL = 'https://script.google.com/macros/s/AKfycbw6CiFU3gHuwHPby3zXv9hCcGIF0HxWDLOroNsRt7apvHM5BvPzrfOD1MA1VAyP0o-z/exec';
const AIRMQ_URL = 'https://api.airmq.cc/';
const AIRMQ_LOCATION_ID = 'BY042010279';
const TREATMENTS_API_URL = 'https://script.google.com/macros/s/AKfycbziEuAPz4Kvg9GsvdSyKytYVEHSe2gcoSEmwKhp0unOVNm5OPdUYJf33mqn2qgDEZVd/exec';

const LS_MEASUREMENTS = 'sprayer_measurements_v1';
const LS_BLOCKS = 'sprayer_blocks_v2';
const LS_WEATHER = 'sprayer_weather_location_v1';

const defaultMeasurements = [
  { pressure: 3, flow: 0.635 },
  { pressure: 4, flow: 0.75 },
  { pressure: 5, flow: 0.86 },
  { pressure: 6, flow: 1.0 },
  { pressure: 7, flow: 1.074 },
  { pressure: 8, flow: 1.152 },
  { pressure: 9, flow: 1.25 },
  { pressure: 10, flow: 1.313 },
  { pressure: 11, flow: 1.359 },
  { pressure: 12, flow: 1.463 },
  { pressure: 15, flow: 1.641 }
];

const defaultBlocks = [
  { id: id(), name: 'Яблоня около навеса 0', culture: 'Яблоня', year: 2023, rows: 73, scheme: '4 × 1 м', count: 17380, area: 7.5 },
  { id: id(), name: 'Слива около базы 1', culture: 'Слива', year: 2023, rows: 102, scheme: '4,5 × 3 м', count: 16040, area: 23.4 },
  { id: id(), name: 'Яблоня около деревни 2', culture: 'Яблоня', year: 2023, rows: 85, scheme: '4 × 1 м', count: 11880, area: 5.1 },
  { id: id(), name: 'Яблоня между сливой и берез 3', culture: 'Яблоня', year: 2023, rows: 25, scheme: '4 × 1 м', count: 10040, area: 5.2 },
  { id: id(), name: 'Слива за березами 4', culture: 'Слива', year: 2024, rows: 58, scheme: '4,5 × 3 м', count: 11600, area: 19.1 },
  { id: id(), name: 'Яблоня за дорогой 2023 5', culture: 'Яблоня', year: 2023, rows: 49, scheme: '4 × 1 м', count: 16050, area: 7.9 },
  { id: id(), name: 'Яблоня за дорогой 2025 5', culture: 'Яблоня', year: 2025, rows: 0, scheme: '4 × 1 м', count: 26500, area: 10.0 }
];

let appState = {
  mode: 'from-block',
  activeTab: 'calc',
  measurements: load(LS_MEASUREMENTS, defaultMeasurements),
  blocks: load(LS_BLOCKS, defaultBlocks),
  editingBlockId: null,
  stockRaw: [],
  stockFiltered: [],
  treatmentRows: [],
  treatmentGroups: [],
  filteredTreatmentGroups: []
};

const els = {};

document.addEventListener('DOMContentLoaded', () => {
  bindElements();
  bindEvents();
  initFromSavedWeather();
  renderTabs();
  renderMeasurements();
  renderBlocks();
  renderBlockSelect();

  if (appState.blocks.length) {
    updateCalcInputsFromBlock();
  }

  calculate();
  loadWeather();
  loadStock();
  loadAirMQ();
  loadTreatments();
});

function bindElements() {
  [
    'menuButton', 'closeMenuButton', 'sidePanel', 'overlay',
    'blockSelect', 'cultureInput', 'areaInput', 'normInput', 'speedInput', 'spacingInput', 'nozzlesInput', 'tankInput',
    'resultCulture', 'resultArea', 'resultLiters', 'resultTanks', 'resultTotalFlow', 'resultFlowPerNozzle',
    'resultPressure', 'pressureStatus', 'pressureLower', 'pressureUpper',
    'blockSelectWrap',
    'measurementPressure', 'measurementFlow', 'measurementsBody', 'saveMeasurementBtn',
    'blockName', 'blockCulture', 'blockYear', 'blockRows', 'blockScheme', 'blockCount', 'blockArea',
    'saveBlockBtn', 'blocksBody', 'blockEditNotice',
    'weatherCity', 'weatherLat', 'weatherLon', 'weatherLoadBtn', 'weatherPlace', 'weatherStatus', 'weatherCards',
    'stockBody', 'stockStatus', 'stockTypeFilter', 'stockSortBy',
    'airReloadBtn', 'airInfo', 'airStatus', 'airTemp', 'airHum', 'airPms1', 'airPms25', 'airPms10', 'airTime',
    'treatmentsStatus', 'treatmentPlaceFilter', 'treatmentChemFilter', 'treatmentTypeFilter',
    'lastTreatment', 'treatmentsDays'
  ].forEach(id => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      appState.activeTab = btn.dataset.tab;
      closePanels();
      renderTabs();
    });
  });

  document.querySelectorAll('.subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      appState.mode = btn.dataset.mode;
      document.querySelectorAll('.subtab-btn').forEach(x => {
        x.classList.toggle('active', x === btn);
      });
      els.blockSelectWrap.style.display = appState.mode === 'from-block' ? '' : 'none';
      if (appState.mode === 'from-block') {
        updateCalcInputsFromBlock();
      }
      calculate();
    });
  });

  [
    'normInput', 'speedInput', 'spacingInput', 'nozzlesInput',
    'tankInput', 'cultureInput', 'areaInput'
  ].forEach(id => {
    els[id].addEventListener('input', calculate);
  });

  els.blockSelect.addEventListener('change', () => {
    updateCalcInputsFromBlock();
    calculate();
  });

  els.menuButton.addEventListener('click', openMenu);
  els.closeMenuButton.addEventListener('click', closeMenu);
  els.overlay.addEventListener('click', closeMenu);

  document.querySelectorAll('.side-link').forEach(btn => {
    btn.addEventListener('click', () => {
      openPanel(btn.dataset.panel);
      closeMenu();
    });
  });

  els.saveMeasurementBtn.addEventListener('click', saveMeasurement);
  els.saveBlockBtn.addEventListener('click', saveBlock);

  els.weatherLoadBtn.addEventListener('click', loadWeather);

  els.stockTypeFilter.addEventListener('change', applyStockFilters);
  els.stockSortBy.addEventListener('change', applyStockFilters);

  els.airReloadBtn.addEventListener('click', loadAirMQ);

  els.treatmentPlaceFilter.addEventListener('change', applyTreatmentFilters);
  els.treatmentChemFilter.addEventListener('change', applyTreatmentFilters);
  els.treatmentTypeFilter.addEventListener('change', applyTreatmentFilters);
}

function renderTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === appState.activeTab);
  });

  document.querySelectorAll('.tab-content').forEach(sec => {
    sec.classList.remove('active');
  });

  const target = document.getElementById(`tab-${appState.activeTab}`);
  if (target) {
    target.classList.add('active');
  }
}

function openPanel(name) {
  closeTabs();
  document.querySelectorAll('.panel-content').forEach(sec => {
    sec.classList.remove('active');
  });
  const el = document.getElementById(`panel-${name}`);
  if (el) {
    el.classList.add('active');
  }
}

function closePanels() {
  document.querySelectorAll('.panel-content').forEach(sec => {
    sec.classList.remove('active');
  });
}

function closeTabs() {
  document.querySelectorAll('.tab-content').forEach(sec => {
    sec.classList.remove('active');
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
}

function openMenu() {
  els.sidePanel.classList.add('open');
  els.overlay.classList.add('show');
}

function closeMenu() {
  els.sidePanel.classList.remove('open');
  els.overlay.classList.remove('show');
}

function renderBlockSelect() {
  els.blockSelect.innerHTML = '';
  appState.blocks.forEach(block => {
    const opt = document.createElement('option');
    opt.value = block.id;
    opt.textContent = block.name;
    els.blockSelect.appendChild(opt);
  });
}

function getSelectedBlock() {
  return appState.blocks.find(b => String(b.id) === String(els.blockSelect.value)) || appState.blocks[0];
}

function updateCalcInputsFromBlock() {
  const block = getSelectedBlock();
  if (!block) return;
  els.cultureInput.value = block.culture || '';
  els.areaInput.value = num(block.area);
  els.spacingInput.value = parseSpacing(block.scheme);
}

function calculate() {
  const culture = els.cultureInput.value || '—';
  const area = toNum(els.areaInput.value);
  const norm = toNum(els.normInput.value);
  const speed = toNum(els.speedInput.value);
  const spacing = toNum(els.spacingInput.value);
  const nozzles = toNum(els.nozzlesInput.value);
  const tank = toNum(els.tankInput.value);

  const totalLiters = area * norm;
  const totalFlow = speed > 0 && spacing > 0 ? (norm * speed * spacing) / 600 : 0;
  const flowPerNozzle = nozzles > 0 ? totalFlow / nozzles : 0;
  const pressure = interpolatePressure(flowPerNozzle, appState.measurements);

  els.resultCulture.textContent = culture;
  els.resultArea.textContent = isFinite(area) ? `${fmt(area, 2)} га` : '—';
  els.resultLiters.textContent = isFinite(totalLiters) ? `${fmt(totalLiters, 0)} л` : '—';
  els.resultTanks.textContent = tank > 0 ? fmt(totalLiters / tank, 2) : '—';
  els.resultTotalFlow.textContent = isFinite(totalFlow) ? `${fmt(totalFlow, 3)} л/мин` : '—';
  els.resultFlowPerNozzle.textContent = isFinite(flowPerNozzle) ? `${fmt(flowPerNozzle, 3)} л/мин` : '—';
  els.resultPressure.textContent = pressure.pressure != null ? `${fmt(pressure.pressure, 2)} бар` : '—';
  els.pressureStatus.textContent = pressure.status;
  els.pressureLower.textContent = pressure.lower
    ? `Нижняя точка: ${fmt(pressure.lower.flow, 3)} л/мин при ${fmt(pressure.lower.pressure, 0)} бар`
    : '';
  els.pressureUpper.textContent = pressure.upper
    ? `Верхняя точка: ${fmt(pressure.upper.flow, 3)} л/мин при ${fmt(pressure.upper.pressure, 0)} бар`
    : '';
}

function sortMeasurements(list) {
  return [...list]
    .map(x => ({ pressure: toNum(x.pressure), flow: toNum(x.flow) }))
    .filter(x => x.pressure > 0 && x.flow > 0)
    .sort((a, b) => a.flow - b.flow);
}

function interpolatePressure(targetFlow, list) {
  const rows = sortMeasurements(list);

  if (!rows.length || !isFinite(targetFlow) || targetFlow <= 0) {
    return { status: 'Нет данных', pressure: null };
  }

  if (rows.length === 1) {
    return {
      status: 'Мало точек',
      pressure: rows[0].pressure,
      lower: rows[0],
      upper: rows[0]
    };
  }

  if (targetFlow < rows[0].flow) {
    return {
      status: 'Ниже таблицы',
      pressure: null,
      lower: rows[0],
      upper: rows[1]
    };
  }

  if (targetFlow > rows[rows.length - 1].flow) {
    return {
      status: 'Выше таблицы',
      pressure: null,
      lower: rows[rows.length - 2],
      upper: rows[rows.length - 1]
    };
  }

  for (let i = 0; i < rows.length - 1; i++) {
    const lower = rows[i];
    const upper = rows[i + 1];

    if (targetFlow === lower.flow) {
      return {
        status: 'Точное совпадение',
        pressure: lower.pressure,
        lower,
        upper: lower
      };
    }

    if (targetFlow >= lower.flow && targetFlow <= upper.flow) {
      const ratio = (targetFlow - lower.flow) / (upper.flow - lower.flow);
      return {
        status: 'В пределах таблицы',
        pressure: lower.pressure + ratio * (upper.pressure - lower.pressure),
        lower,
        upper
      };
    }
  }

  return { status: 'Ошибка расчёта', pressure: null };
}

function saveMeasurement() {
  const pressure = toNum(els.measurementPressure.value);
  const flow = toNum(els.measurementFlow.value);

  if (!(pressure > 0 && flow > 0)) return;

  appState.measurements.push({ pressure, flow });
  save(LS_MEASUREMENTS, appState.measurements);

  els.measurementPressure.value = '';
  els.measurementFlow.value = '';

  renderMeasurements();
  calculate();
}

function renderMeasurements() {
  const rows = sortMeasurements(appState.measurements);
  els.measurementsBody.innerHTML = '';

  rows.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${fmt(row.pressure, 3)}</td><td>${fmt(row.flow, 3)}</td><td><button class="action-btn" data-remove="${idx}">Удалить</button></td>`;
    els.measurementsBody.appendChild(tr);
  });

  els.measurementsBody.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.remove);
      const sorted = sortMeasurements(appState.measurements);
      const target = sorted[idx];

      appState.measurements = appState.measurements.filter(x => !(
        toNum(x.pressure) === target.pressure &&
        toNum(x.flow) === target.flow
      ));

      save(LS_MEASUREMENTS, appState.measurements);
      renderMeasurements();
      calculate();
    });
  });
}

function saveBlock() {
  const block = {
    id: appState.editingBlockId || id(),
    name: els.blockName.value.trim(),
    culture: els.blockCulture.value.trim(),
    year: toNum(els.blockYear.value),
    rows: toNum(els.blockRows.value),
    scheme: els.blockScheme.value.trim(),
    count: toNum(els.blockCount.value),
    area: toNum(els.blockArea.value)
  };

  if (!block.name) return;

  if (appState.editingBlockId) {
    appState.blocks = appState.blocks.map(b => b.id === appState.editingBlockId ? block : b);
  } else {
    appState.blocks.push(block);
  }

  appState.editingBlockId = null;
  els.blockEditNotice.textContent = '';
  clearBlockForm();

  save(LS_BLOCKS, appState.blocks);
  renderBlocks();
  renderBlockSelect();
  calculate();
}

function renderBlocks() {
  els.blocksBody.innerHTML = '';

  appState.blocks.forEach(block => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(block.name)}</td>
      <td>${escapeHtml(block.culture || '')}</td>
      <td>${fmt(block.year, 0)}</td>
      <td>${fmt(block.rows, 0)}</td>
      <td>${escapeHtml(block.scheme || '')}</td>
      <td>${fmt(block.count, 0)}</td>
      <td>${fmt(block.area, 2)}</td>
      <td>
        <button class="action-btn" data-edit="${block.id}">Изменить</button>
        <button class="action-btn" data-delete="${block.id}">Удалить</button>
      </td>
    `;
    els.blocksBody.appendChild(tr);
  });

  els.blocksBody.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => editBlock(btn.dataset.edit));
  });

  els.blocksBody.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteBlock(btn.dataset.delete));
  });
}

function editBlock(blockId) {
  const block = appState.blocks.find(b => String(b.id) === String(blockId));
  if (!block) return;

  appState.editingBlockId = block.id;
  els.blockName.value = block.name || '';
  els.blockCulture.value = block.culture || '';
  els.blockYear.value = block.year || '';
  els.blockRows.value = block.rows || '';
  els.blockScheme.value = block.scheme || '';
  els.blockCount.value = block.count || '';
  els.blockArea.value = block.area || '';
  els.blockEditNotice.textContent = `Редактируется: ${block.name}`;

  openPanel('blocks');
}

function deleteBlock(blockId) {
  appState.blocks = appState.blocks.filter(b => String(b.id) !== String(blockId));
  save(LS_BLOCKS, appState.blocks);
  renderBlocks();
  renderBlockSelect();
  calculate();
}

function clearBlockForm() {
  ['blockName', 'blockCulture', 'blockYear', 'blockRows', 'blockScheme', 'blockCount', 'blockArea'].forEach(id => {
    els[id].value = '';
  });
}

async function loadWeather() {
  const city = (els.weatherCity.value || '').trim();
  let lat = toNum(els.weatherLat.value);
  let lon = toNum(els.weatherLon.value);

  els.weatherStatus.textContent = 'Загрузка погоды...';
  els.weatherCards.innerHTML = '';

  try {
    if (city) {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ru&format=json`;
      const geoResp = await fetch(geoUrl);
      const geoData = await geoResp.json();

      if (!geoData.results || !geoData.results.length) {
        throw new Error('Город не найден');
      }

      lat = geoData.results[0].latitude;
      lon = geoData.results[0].longitude;

      els.weatherLat.value = lat;
      els.weatherLon.value = lon;
      els.weatherPlace.textContent = `${geoData.results[0].name}${geoData.results[0].country ? ', ' + geoData.results[0].country : ''}`;
    } else {
      els.weatherPlace.textContent = `Координаты: ${fmt(lat, 6)}, ${fmt(lon, 6)}`;
    }

    save(LS_WEATHER, { city, lat, lon });

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,precipitation_probability_max&timezone=auto`;
    const resp = await fetch(url);
    const data = await resp.json();

    renderWeather(data);
    els.weatherStatus.textContent = '';
  } catch (e) {
    els.weatherStatus.textContent = `Ошибка погоды: ${e.message}`;
  }
}

function renderWeather(data) {
  const d = data.daily;
  els.weatherCards.innerHTML = '';

  if (!d || !d.time) {
    els.weatherStatus.textContent = 'Нет данных погоды';
    return;
  }

  d.time.forEach((date, i) => {
    const card = document.createElement('div');
    card.className = 'weather-card';
    card.innerHTML = `
      <div class="day">${formatDateRu(date)}</div>
      <div>Темп.: <strong>${fmt(d.temperature_2m_max[i], 1)} / ${fmt(d.temperature_2m_min[i], 1)} °C</strong></div>
      <div>Осадки: <strong>${fmt(d.precipitation_sum[i], 1)} мм</strong></div>
      <div>Вероятность дождя: <strong>${fmt(d.precipitation_probability_max[i], 0)}%</strong></div>
      <div>Ветер: <strong>${fmt(d.windspeed_10m_max[i], 1)} км/ч</strong></div>
    `;
    els.weatherCards.appendChild(card);
  });
}

function initFromSavedWeather() {
  const saved = load(LS_WEATHER, { city: '', lat: 53.414120, lon: 24.678197 });
  els.weatherCity.value = saved.city || '';
  els.weatherLat.value = saved.lat ?? 53.414120;
  els.weatherLon.value = saved.lon ?? 24.678197;
}

async function loadAirMQ() {
  els.airStatus.textContent = 'Загрузка AirMQ...';

  try {
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const payload = {
      operationName: 'LocationTimeseries',
      query: 'query LocationTimeseries($id: String!, $tFrom: String!, $tTo: String!, $intervalM: Int!) { location(filter: {_id: $id}) { _id city name isOnline latitude longitude timeSeries(filter: {t_from: $tFrom, t_to: $tTo, interval_m: $intervalM}) { time Temp Hum Press PMS1 PMS10 PMS25 Count NOx VOC __typename } metricList status { uptime __typename } currentValue { time Temp Hum Press PMS1 PMS10 PMS25 Count NOx VOC __typename } __typename } }',
      variables: {
        id: AIRMQ_LOCATION_ID,
        tFrom: from.toISOString(),
        tTo: now.toISOString(),
        intervalM: 10
      }
    };

    const resp = await fetch(AIRMQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();
    const location = data?.data?.location;
    const current = location?.currentValue;

    if (!location || !current) {
      throw new Error('Нет данных датчика');
    }

    els.airInfo.textContent = `${location.name || 'Датчик'} · ${location.city || ''}`;
    els.airTemp.textContent = `${fmt(current.Temp, 2)} °C`;
    els.airHum.textContent = `${fmt(current.Hum, 2)} %`;
    els.airPms1.textContent = fmt(current.PMS1, 2);
    els.airPms25.textContent = fmt(current.PMS25, 2);
    els.airPms10.textContent = fmt(current.PMS10, 2);
    els.airTime.textContent = formatDateTimeRu(current.time);
    els.airStatus.textContent = location.isOnline ? 'Датчик онлайн' : 'Датчик офлайн, показаны последние данные';
  } catch (e) {
    els.airStatus.textContent = `Ошибка AirMQ: ${e.message}`;
  }
}

async function loadStock() {
  els.stockStatus.textContent = 'Загрузка склада...';
  els.stockBody.innerHTML = '';

  try {
    const resp = await fetch(STOCK_API_URL);
    const raw = await resp.json();
    const rows = Array.isArray(raw) ? raw : (raw.data || []);

    appState.stockRaw = rows.map(normalizeStockItem).filter(x => x.name);
    renderStockTypeOptions();
    applyStockFilters();
  } catch (e) {
    els.stockStatus.textContent = `Ошибка загрузки склада: ${e.message}`;
  }
}

function normalizeStockItem(item) {
  const keys = Object.keys(item || {});

  const get = (...variants) => {
    for (const v of variants) {
      if (item[v] !== undefined) return item[v];
      const found = keys.find(k => normalizeKey(k) === normalizeKey(v));
      if (found) return item[found];
    }
    return '';
  };

  return {
    name: String(get('Название', 'name')).trim(),
    type: 