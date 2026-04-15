function doGet() {
  const SPREADSHEET_ID = '1y5X3JyLPwPHTJvebBFVZi46RT0rxAHUVHxomgmtc4po';
  const SHEET_NAME = 'api_obrabotka';

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);

  if (!sheet) {
    return jsonOutput({
      ok: false,
      error: 'Лист "api_obrabotka" не найден'
    });
  }

  const values = sheet.getDataRange().getValues();
  const groups = new Map();

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const treatmentNumber = cleanNumber(row[0]);
    const date = normalizeDate(row[1]);
    const worker = clean(row[2]);
    const place = clean(row[3]);
    const method = clean(row[4]);
    const tankLiters = cleanNumber(row[5]);
    const tankUnit = clean(row[6]);
    const chemType = clean(row[7]);
    const chemical = clean(row[8]);
    const amount = cleanNumber(row[9]);
    const amountUnit = clean(row[10]);

    const hasData = !isRowEmpty([
      treatmentNumber,
      date,
      worker,
      place,
      method,
      tankLiters,
      tankUnit,
      chemType,
      chemical,
      amount,
      amountUnit
    ]);

    if (!hasData) continue;

    const key = String(treatmentNumber || ('row_' + r));

    if (!groups.has(key)) {
      groups.set(key, {
        treatmentNumber: treatmentNumber,
        date: date,
        worker: worker,
        place: place,
        method: method,
        tankLiters: tankLiters,
        tankUnit: tankUnit,
        chemicals: []
      });
    }

    const group = groups.get(key);

    if (!group.date && date) group.date = date;
    if (!group.worker && worker) group.worker = worker;
    if (!group.place && place) group.place = place;
    if (!group.method && method) group.method = method;
    if ((group.tankLiters === '' || group.tankLiters === null) && tankLiters !== '') group.tankLiters = tankLiters;
    if (!group.tankUnit && tankUnit) group.tankUnit = tankUnit;

    if (chemical || amount !== '' || chemType || amountUnit) {
      group.chemicals.push({
        chemType: chemType,
        chemical: chemical,
        amount: amount,
        amountUnit: amountUnit
      });
    }
  }

  const result = Array.from(groups.values())
    .map(function(item) {
      item.chemicals = mergeChemicals(item.chemicals);
      return item;
    })
    .sort(sortTreatmentsDesc);

  return jsonOutput({
    ok: true,
    count: result.length,
    data: result
  });
}

function mergeChemicals(list) {
  const merged = new Map();

  list.forEach(function(item) {
    const chemType = clean(item.chemType);
    const chemical = clean(item.chemical);
    const amountUnit = clean(item.amountUnit);
    const amount = cleanNumber(item.amount);

    const key = [
      chemical.toLowerCase(),
      chemType.toLowerCase(),
      amountUnit.toLowerCase()
    ].join('|');

    if (!merged.has(key)) {
      merged.set(key, {
        chemType: chemType,
        chemical: chemical,
        amount: amount,
        amountUnit: amountUnit
      });
      return;
    }

    const current = merged.get(key);

    if (typeof current.amount === 'number' && typeof amount === 'number') {
      current.amount = roundSmart(current.amount + amount);
    } else if (!current.amount && amount !== '') {
      current.amount = amount;
    }
  });

  return Array.from(merged.values());
}

function sortTreatmentsDesc(a, b) {
  const aDate = a.date || '';
  const bDate = b.date || '';

  if (aDate !== bDate) {
    return bDate.localeCompare(aDate);
  }

  const aNum = toSortableNumber(a.treatmentNumber);
  const bNum = toSortableNumber(b.treatmentNumber);

  return bNum - aNum;
}

function toSortableNumber(value) {
  if (typeof value === 'number') return value;
  const n = Number(String(value).replace(',', '.').trim());
  return isNaN(n) ? 0 : n;
}

function normalizeDate(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  if (value === null || value === '' || typeof value === 'undefined') {
    return '';
  }

  const str = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  const normalized = str.replace(/\//g, '.').replace(/-/g, '.');
  const parts = normalized.split('.');

  if (parts.length === 3) {
    let p1 = parts[0];
    let p2 = parts[1];
    let p3 = parts[2];

    if (p3.length === 4) {
      return p3 + '-' + pad(p2) + '-' + pad(p1);
    }

    if (p1.length === 4) {
      return p1 + '-' + pad(p2) + '-' + pad(p3);
    }

    if (p3.length === 2) {
      return ('20' + p3) + '-' + pad(p2) + '-' + pad(p1);
    }
  }

  return str;
}

function pad(v) {
  v = String(v);
  return v.length === 1 ? '0' + v : v;
}

function isRowEmpty(arr) {
  return arr.every(function(v) {
    return v === '' || v === null || typeof v === 'undefined';
  });
}

function clean(value) {
  if (value === null || typeof value === 'undefined') return '';
  return String(value).trim();
}

function cleanNumber(value) {
  if (value === null || value === '' || typeof value === 'undefined') return '';

  if (typeof value === 'number') {
    return roundSmart(value);
  }

  const parsed = Number(String(value).replace(',', '.').trim());
  return isNaN(parsed) ? String(value).trim() : roundSmart(parsed);
}

function roundSmart(value) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}
