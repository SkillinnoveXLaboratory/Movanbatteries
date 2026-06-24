function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeText(value) {
  return String(value || '').trim();
}

function readCell(row, aliases) {
  const entries = Object.entries(row || {});
  for (const [key, value] of entries) {
    if (aliases.includes(normalizeKey(key)) && value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
}

function parseVehicleNumbers(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }

  const text = normalizeText(value);
  if (!text) return [];

  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map((item) => normalizeText(item)).filter(Boolean);
    } catch {
      // Fall back to delimiter parsing when the file cell only looks like JSON.
    }
  }

  return text.split(/[\n,|;/]+/).map((item) => normalizeText(item)).filter(Boolean);
}

export function buildShopAliasLookup(shops = []) {
  return shops.reduce((lookup, shop) => {
    if (!shop?._id) return lookup;

    [shop._id, shop.name, shop.branchCode, `${shop.name || ''} ${shop.branchCode || ''}`]
      .map((value) => normalizeKey(value))
      .filter(Boolean)
      .forEach((alias) => {
        lookup[alias] = shop._id;
      });

    return lookup;
  }, {});
}

export function prepareCustomerImportRows(rows = [], shops = [], defaultShopId = '') {
  const shopAliasLookup = buildShopAliasLookup(shops);
  const cleanedDefaultShopId = normalizeText(defaultShopId);
  const preparedRows = [];
  const errors = [];

  rows.forEach((row, index) => {
    const id = normalizeText(readCell(row, ['id', 'customerid']));
    const name = normalizeText(readCell(row, ['name', 'customername']));
    const mobileNumber = normalizeText(readCell(row, ['mobilenumber', 'mobile', 'mobileno', 'phonenumber', 'phone']));
    const vehicleNumbers = parseVehicleNumbers(readCell(row, ['vehiclenumbers', 'vehicles', 'vehiclenumber', 'vehicle']));
    const address = normalizeText(readCell(row, ['address', 'customeraddress']));
    const shopValue = normalizeText(readCell(row, ['shopid', 'shop', 'shopname', 'branch', 'branchcode']));
    const resolvedShopId = shopValue ? (shopAliasLookup[normalizeKey(shopValue)] || shopValue) : cleanedDefaultShopId;
    const rowErrors = [];

    if (!name) rowErrors.push('missing name');
    if (!mobileNumber) rowErrors.push('missing mobileNumber');
    if (!resolvedShopId) rowErrors.push('missing shopId');

    if (rowErrors.length) {
      errors.push(`Row ${index + 2}: ${rowErrors.join(', ')}`);
      return;
    }

    preparedRows.push({
      ...(id ? { id } : {}),
      name,
      mobileNumber,
      vehicleNumbers,
      ...(address ? { address } : {}),
      shopId: resolvedShopId,
    });
  });

  return { rows: preparedRows, errors };
}
