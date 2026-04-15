const DEFAULT_MEASUREMENTS = [
  { pressure: 3, flow: 0.635 }, { pressure: 4, flow: 0.75 }, { pressure: 5, flow: 0.86 },
  { pressure: 6, flow: 1.0 }, { pressure: 7, flow: 1.074 }, { pressure: 8, flow: 1.152 },
  { pressure: 9, flow: 1.25 }, { pressure: 10, flow: 1.313 }, { pressure: 11, flow: 1.359 },
  { pressure: 12, flow: 1.463 }, { pressure: 15, flow: 1.641 }
];
const DEFAULT_BLOCKS = [
  { name: 'Яблоня около навеса 0', culture: 'Яблоня', year: 2023, rows: 73, scheme: '4 × 1 м', count: 17380, area: 7.5 },
  { name: 'Слива около базы 1', culture: 'Слива', year: 2023, rows: 102, scheme: '4,5 × 3 м', count: 16040, area: 23.4 },
  { name: 'Яблоня около деревни 2', culture: 'Яблоня', year: 2023, rows: 85, scheme: '4 × 1 м', count: 11880, area: 5.1 },
  { name: 'Яблоня между сливой и берез', culture: 'Яблоня', year: 2023, rows: 25, scheme: '4 × 1 м', count: 10040, area: 5.2 },
  { name: 'Слива за березами', culture: 'Слива', year: 2024, rows: 58, scheme: '4,5 × 3 м', count: 11600, area: 19.1 },
  { name: 'Яблоня за дорогой 2023', culture: 'Яблоня', year: 2023, rows: 49, scheme: '4 × 1 м', count: 16050, area: 7.9 },
  { name: 'Яблоня за дорогой 2025', culture: 'Яблоня', year: 2025, rows: 0, scheme: '4 × 1 м', count: 26500, area: 10.0 }
];
const DEFAULT_WAREHOUSE = [
  { name: 'Купроксат', stock: 0, bought: 0, used: 0 },
  { name: 'Делан', stock: 0, bought: 0, used: 0 },
  { name: 'Каратэ Зеон', stock: 0, bought: 0, used: 0 }
];

const LS = {
  measurements: 'sprayer_measurements_v_static',
  blocks: 'sprayer_blocks_v_static',
  warehouse: 'sprayer_warehouse_v_static',
  weather: 'sprayer_weather_v_static'
};

const state = {
  mode: 'block',
  activeTab: 'calc',
  editBlockIndex: null,
  editWarehouseIndex: null,
  measurements: load(LS.measurements, DEFAULT_MEASUREMENTS),
  blocks: load(LS.blocks, DEFAULT_BLOCKS),
  warehouse: load(LS.warehouse, DEFAULT_WAREHOUSE),
  weather: load(LS.weather, { city: '', lat: 53.41412, lon: 24.678197 })
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function round(value, digits = 3) { return Number.isFinite(value) ? Number(value).toFixed(digits) : '—'; }
function normNum(v) { return Number(String(v).replace(',', '.')); }
function getSpacingFromScheme(scheme) {
  const text = String(scheme || '').replace(',', '.');
  const match = text.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}
function filteredWarehouse() {
  return state.warehouse.filter(x => Number(x.stock) !== 0 || Number(x.bought) !== 0 || Number(x.used) !== 0);
}
function sortMeasurements() {
  return [...state.measurements].sort((a,b) => a.flow - b.flow);
}
function interpolatePressure(targetFlow) {
  const rows = sortMeasurements().filter(x => x.pressure > 0 && x.flow > 0);
  if (rows.length < 2 || !Number.isFinite(targetFlow) || targetFlow <= 0) return { status: 'Недостаточно данных', pressure: null };
  if (targetFlow < rows[0].flow) return { status: 'Ниже диапазона', pressure: null, lower: rows[0], upper: rows[1] };
  if (targetFlow > rows[rows.length - 1].flow) return { status: 'Выше диапазона', pressure: null, lower: rows[rows.length - 2], upper: rows[rows.length - 1] };
  for (let i = 0; i < rows.length - 1; i++) {
    const lower = rows[i], upper = rows[i + 1];
    if (targetFlow === lower.flow) return { status: 'Точное совпадение', pressure: lower.pressure, lower, upper: lower };
    if (targetFlow >= lower.flow && targetFlow <= upper.flow) {
      const ratio = (targetFlow - lower.flow) / (upper.flow - lower.flow);
      return { status: 'В пределах таблицы', pressure: lower.pressure + ratio * (upper.pressure - lower.pressure), lower, upper };
    }
  }
  return { status: 'Ошибка расчёта', pressure: null };
}

function $(id) { return document.getElementById(id); }
function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-panel').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
  const panel = $('tab-' + tab);
  if (panel) panel.classList.add('active');
  document.querySelectorAll(`.tab-btn[data-tab="${tab}"]`).forEach(x => x.classList.add('active'));
  $('drawer').classList.add('hidden');
}

function renderBlockOptions() {
  const select = $('selectedBlock');
  select.innerHTML = state.blocks.map((b, i) => `<option value="${i}">${b.name}</option>`).join('');
}

function fillCalcFromBlock() {
  const idx = Number($('selectedBlock').value || 0);
  const block = state.blocks[idx];
  if (!block) return;
  $('culture').value = block.culture || '';
  $('area').value = block.area || '';
  $('spacing').value = getSpacingFromScheme(block.scheme);
}

function renderCalc() {
  renderBlockOptions();
  if (!$('norm').value) $('norm').value = 400;
  if (!$('speed').value) $('speed').value = 8;
  if (!$('nozzles').value) $('nozzles').value = 14;
  if (!$('tankVolume').value) $('tankVolume').value = 3000;
  if (state.mode === 'block') fillCalcFromBlock();
  $('blockModeFields').classList.toggle('hidden', state.mode !== 'block');
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === state.mode));

  const culture = $('culture').value.trim();
  const area = normNum($('area').value);
  const norm = normNum($('norm').value);
  const speed = normNum($('speed').value);
  const spacing = normNum($('spacing').value);
  const nozzles = normNum($('nozzles').value);
  const tank = normNum($('tankVolume').value);

  const totalLiters = area * norm;
  const totalFlow = (norm * speed * spacing) / 600;
  const nozzleFlow = totalFlow / nozzles;
  const pressure = interpolatePressure(nozzleFlow);

  $('resultCulture').textContent = culture || '—';
  $('resultArea').textContent = Number.isFinite(area) ? `${round(area,2)} га` : '—';
  $('resultLiters').textContent = Number.isFinite(totalLiters) ? `${round(totalLiters,0)} л` : '—';
  $('resultTanks').textContent = Number.isFinite(totalLiters / tank) ? round(totalLiters / tank, 2) : '—';
  $('resultTotalFlow').textContent = Number.isFinite(totalFlow) ? `${round(totalFlow,3)} л/мин` : '—';
  $('resultNozzleFlow').textContent = Number.isFinite(nozzleFlow) ? `${round(nozzleFlow,3)} л/мин` : '—';
  $('resultPressure').textContent = pressure.pressure ? `${round(pressure.pressure,2)} бар` : '—';
  $('pressureStatus').textContent = pressure.status || '—';
  $('pressurePoints').textContent = pressure.lower ? `Нижняя точка: ${pressure.lower.flow} л/мин при ${pressure.lower.pressure} бар. Верхняя точка: ${pressure.upper.flow} л/мин при ${pressure.upper.pressure} бар.` : '';
}

function renderMeasurements() {
  $('measurementsBody').innerHTML = sortMeasurements().map((row, i) => `
    <tr><td>${row.pressure}</td><td>${row.flow}</td><td>
      <button class="small-btn danger" onclick="deleteMeasurement(${i})">Удалить</button>
    </td></tr>`).join('');
}
window.deleteMeasurement = function(i) {
  const sorted = sortMeasurements();
  const row = sorted[i];
  const idx = state.measurements.findIndex(x => x.pressure === row.pressure && x.flow === row.flow);
  if (idx >= 0) state.measurements.splice(idx, 1);
  save(LS.measurements, state.measurements);
  renderMeasurements(); renderCalc();
};

function renderBlocks() {
  $('blocksBody').innerHTML = state.blocks.map((b, i) => `
    <tr><td>${b.name}</td><td>${b.culture}</td><td>${b.year || ''}</td><td>${b.rows || ''}</td><td>${b.scheme || ''}</td><td>${b.count || ''}</td><td>${b.area || ''}</td>
    <td><button class="small-btn" onclick="editBlock(${i})">Изменить</button> <button class="small-btn danger" onclick="deleteBlock(${i})">Удалить</button></td></tr>`).join('');
  renderBlockOptions();
}
window.editBlock = function(i) {
  const b = state.blocks[i];
  state.editBlockIndex = i;
  $('bName').value = b.name || '';
  $('bCulture').value = b.culture || 'Яблоня';
  $('bYear').value = b.year || '';
  $('bRows').value = b.rows || '';
  $('bScheme').value = b.scheme || '';
  $('bCount').value = b.count || '';
  $('bArea').value = b.area || '';
  $('cancelEditBlock').classList.remove('hidden');
  switchTab('blocks');
};
window.deleteBlock = function(i) {
  state.blocks.splice(i,1);
  save(LS.blocks, state.blocks);
  state.editBlockIndex = null;
  renderBlocks(); renderCalc();
};

function renderWarehouse() {
  const rows = filteredWarehouse();
  $('warehouseBody').innerHTML = rows.length ? rows.map(row => {
    const originalIndex = state.warehouse.findIndex(x => x.name === row.name && Number(x.stock) === Number(row.stock) && Number(x.bought) === Number(row.bought) && Number(x.used) === Number(row.used));
    return `<tr><td>${row.name}</td><td>${row.stock}</td><td>${row.bought}</td><td>${row.used}</td><td><button class="small-btn" onclick="editWarehouse(${originalIndex})">Изменить</button> <button class="small-btn danger" onclick="deleteWarehouse(${originalIndex})">Удалить</button></td></tr>`;
  }).join('') : `<tr><td colspan="5" class="muted">Пока нет позиций с движением или остатком.</td></tr>`;
}
window.editWarehouse = function(i) {
  const w = state.warehouse[i];
  state.editWarehouseIndex = i;
  $('wName').value = w.name || '';
  $('wStock').value = w.stock || 0;
  $('wBought').value = w.bought || 0;
  $('wUsed').value = w.used || 0;
  $('cancelEditWarehouse').classList.remove('hidden');
  switchTab('warehouse');
};
window.deleteWarehouse = function(i) {
  state.warehouse.splice(i,1);
  save(LS.warehouse, state.warehouse);
  state.editWarehouseIndex = null;
  renderWarehouse();
};

async function updateWeather() {
  const status = $('weatherStatus');
  const grid = $('weatherGrid');
  status.textContent = 'Загрузка погоды...';
  grid.innerHTML = '';
  let lat = normNum($('weatherLat').value);
  let lon = normNum($('weatherLon').value);
  const city = $('weatherCity').value.trim();

  try {
    if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && city) {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ru&format=json`;
      const geoRes = await fetch(geoUrl);
      const geoData = await geoRes.json();
      if (!geoData.results || !geoData.results.length) throw new Error('Место не найдено');
      lat = geoData.results[0].latitude;
      lon = geoData.results[0].longitude;
      $('weatherLat').value = lat;
      $('weatherLon').value = lon;
      $('weatherLocation').textContent = `${geoData.results[0].name}, ${geoData.results[0].country || ''}`;
    } else {
      $('weatherLocation').textContent = `Координаты: ${lat}, ${lon}`;
    }

    state.weather = { city, lat, lon };
    save(LS.weather, state.weather);

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,windspeed_10m_max&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();
    const d = data.daily;
    if (!d || !d.time) throw new Error('Нет данных прогноза');

    grid.innerHTML = d.time.map((date, i) => {
      const day = new Date(date).toLocaleDateString('ru-RU', { weekday: 'short', day: '2-digit', month: '2-digit' });
      return `<div class="weather-card"><h3>${day}</h3>
        <div>Днём: <strong>${round(d.temperature_2m_max[i],1)} °C</strong></div>
        <div>Ночью: <strong>${round(d.temperature_2m_min[i],1)} °C</strong></div>
        <div>Осадки: ${round(d.precipitation_sum[i],1)} мм</div>
        <div>Вероятность дождя: ${round(d.precipitation_probability_max[i],0)}%</div>
        <div>Ветер: ${round(d.windspeed_10m_max[i],1)} км/ч</div></div>`;
    }).join('');
    status.textContent = '';
  } catch (e) {
    status.textContent = `Ошибка: ${e.message}`;
  }
}

function setupEvents() {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  document.querySelectorAll('.mode-btn').forEach(btn => btn.addEventListener('click', () => { state.mode = btn.dataset.mode; renderCalc(); }));
  ['selectedBlock','culture','area','norm','speed','spacing','nozzles','tankVolume'].forEach(id => $(id).addEventListener('input', renderCalc));
  $('selectedBlock').addEventListener('change', renderCalc);
  $('menuBtn').addEventListener('click', () => $('drawer').classList.remove('hidden'));
  $('closeDrawer').addEventListener('click', () => $('drawer').classList.add('hidden'));
  $('drawer').addEventListener('click', e => { if (e.target.id === 'drawer') $('drawer').classList.add('hidden'); });
  document.querySelectorAll('.drawer-link').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.drawerTab)));

  $('addMeasurement').addEventListener('click', () => {
    const pressure = normNum($('mPressure').value), flow = normNum($('mFlow').value);
    if (!Number.isFinite(pressure) || !Number.isFinite(flow) || pressure <= 0 || flow <= 0) return;
    state.measurements.push({ pressure, flow });
    save(LS.measurements, state.measurements);
    $('mPressure').value = ''; $('mFlow').value = '';
    renderMeasurements(); renderCalc();
  });
  $('resetMeasurements').addEventListener('click', () => { state.measurements = [...DEFAULT_MEASUREMENTS]; save(LS.measurements, state.measurements); renderMeasurements(); renderCalc(); });

  $('saveBlock').addEventListener('click', () => {
    const block = {
      name: $('bName').value.trim(), culture: $('bCulture').value, year: normNum($('bYear').value), rows: normNum($('bRows').value),
      scheme: $('bScheme').value.trim(), count: normNum($('bCount').value), area: normNum($('bArea').value)
    };
    if (!block.name) return;
    if (state.editBlockIndex === null) state.blocks.push(block); else state.blocks[state.editBlockIndex] = block;
    save(LS.blocks, state.blocks);
    state.editBlockIndex = null;
    ['bName','bYear','bRows','bScheme','bCount','bArea'].forEach(id => $(id).value = '');
    $('bCulture').value = 'Яблоня'; $('cancelEditBlock').classList.add('hidden');
    renderBlocks(); renderCalc();
  });
  $('cancelEditBlock').addEventListener('click', () => { state.editBlockIndex = null; $('cancelEditBlock').classList.add('hidden'); });
  $('resetBlocks').addEventListener('click', () => { state.blocks = [...DEFAULT_BLOCKS]; save(LS.blocks, state.blocks); renderBlocks(); renderCalc(); });

  $('saveWarehouse').addEventListener('click', () => {
    const item = { name: $('wName').value.trim(), stock: normNum($('wStock').value) || 0, bought: normNum($('wBought').value) || 0, used: normNum($('wUsed').value) || 0 };
    if (!item.name) return;
    if (state.editWarehouseIndex === null) state.warehouse.push(item); else state.warehouse[state.editWarehouseIndex] = item;
    save(LS.warehouse, state.warehouse);
    state.editWarehouseIndex = null;
    ['wName','wStock','wBought','wUsed'].forEach(id => $(id).value = '');
    $('cancelEditWarehouse').classList.add('hidden');
    renderWarehouse();
  });
  $('cancelEditWarehouse').addEventListener('click', () => { state.editWarehouseIndex = null; $('cancelEditWarehouse').classList.add('hidden'); });

  $('weatherUpdate').addEventListener('click', updateWeather);
}

function initWeatherDefaults() {
  $('weatherCity').value = state.weather.city || '';
  $('weatherLat').value = state.weather.lat ?? 53.41412;
  $('weatherLon').value = state.weather.lon ?? 24.678197;
}

function init() {
  setupEvents();
  renderMeasurements();
  renderBlocks();
  renderWarehouse();
  initWeatherDefaults();
  renderCalc();
  updateWeather();
}

document.addEventListener('DOMContentLoaded', init);
