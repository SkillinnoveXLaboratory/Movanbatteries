import { useEffect, useState } from 'react';
import { CarFront, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { api, queryString } from '../lib/api';
import { ErrorState, LoadingState } from '../components/DataState';

const filterFields = [
  { key: 'vehicleType', label: 'Vehicle type' },
  { key: 'vehicleBrand', label: 'Vehicle brand' },
  { key: 'vehicleModel', label: 'Vehicle model' },
  { key: 'fuelType', label: 'Fuel type' },
];

function formatLabel(value) {
  if (value === undefined || value === null || value === '') return '';
  const text = String(value).replaceAll('_', ' ');
  if (text === text.toUpperCase()) return text;
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildOptions(records) {
  return filterFields.reduce((accumulator, field) => {
    const values = new Set();
    (records || []).forEach((record) => {
      const value = record?.[field.key];
      if (value !== undefined && value !== null && String(value).trim() !== '') values.add(String(value));
    });
    accumulator[field.key] = Array.from(values).sort((left, right) => left.localeCompare(right));
    return accumulator;
  }, {});
}

function renderOption(value) {
  return formatLabel(value);
}

export default function BatteryFinder() {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    vehicleType: '',
    vehicleBrand: '',
    vehicleModel: '',
    fuelType: '',
  });
  const [result, setResult] = useState(null);
  const [stats, setStats] = useState(null);
  const [options, setOptions] = useState({ vehicleType: [], vehicleBrand: [], vehicleModel: [], fuelType: [] });
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setResult(null);
    try {
      const [records, summary] = await Promise.all([
        api(`/battery-finder${queryString(filters)}`),
        api('/battery-finder/stats'),
      ]);
      setResult(records);
      setStats(summary.data);
      setError(null);
    } catch (requestError) {
      setError(requestError);
    }
  };

  useEffect(() => {
    let active = true;

    api('/battery-finder?page=1&limit=5000')
      .then((payload) => {
        if (!active) return;
        setOptions(buildOptions(Array.isArray(payload.data) ? payload.data : []));
      })
      .catch(() => {
        if (active) setOptions({ vehicleType: [], vehicleBrand: [], vehicleModel: [], fuelType: [] });
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    load();
  }, [filters]);

  const setFilterValue = (key, value) => {
    setFilters((current) => ({ ...current, page: 1, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      page: 1,
      limit: 10,
      vehicleType: '',
      vehicleBrand: '',
      vehicleModel: '',
      fuelType: '',
    });
  };

  return <div className="page-stack">
    <div className="page-heading">
      <div>
        <p className="eyebrow">Fitment intelligence</p>
        <h1>Battery Finder</h1>
        <p>Search {stats?.totalRecords?.toLocaleString('en-IN') || 'the'} verified vehicle fitments.</p>
      </div>
    </div>
    <section className="finder-hero">
      <CarFront />
      <div>
        <h2>Find the correct battery, first time.</h2>
        <p>Filter by vehicle type, brand, model, and fuel to narrow fitments without typing free text.</p>
      </div>
      <div className="finder-filter-panel">
        {filterFields.map((field) => (
          <label className="finder-field" key={field.key}>
            <span>{field.label}</span>
            <select
              value={filters[field.key]}
              onChange={(event) => setFilterValue(field.key, event.target.value)}
              disabled={optionsLoading}
            >
              <option value="">
                {optionsLoading ? `Loading ${field.label.toLowerCase()}...` : `All ${field.label.toLowerCase()}s`}
              </option>
              {options[field.key].map((option) => (
                <option key={option} value={option}>{renderOption(option)}</option>
              ))}
            </select>
          </label>
        ))}
        <button type="button" className="button button-secondary finder-reset" onClick={resetFilters} disabled={optionsLoading}>
          <RotateCcw size={16} />
          Reset filters
        </button>
      </div>
    </section>
    {!result && !error ? <LoadingState /> : error ? <ErrorState error={error} onRetry={load} /> : <section className="card table-card">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Vehicle</th>
              <th>Fuel</th>
              <th>Battery</th>
              <th>Capacity</th>
              <th>Warranty</th>
              <th>Exchange</th>
              <th>Retail</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((item) => (
              <tr key={item._id}>
                <td><strong>{item.vehicleBrand} {item.vehicleModel}</strong><small>{item.vehicleType}</small></td>
                <td>{item.fuelType}</td>
                <td><strong>{item.batteryBrand}</strong><small>{item.batteryModel}</small></td>
                <td>{item.ah} Ah</td>
                <td className="wrap-cell">{item.warranty}</td>
                <td>₹{item.exchangePrice?.toLocaleString('en-IN')}</td>
                <td><strong>₹{item.withoutExchangePrice?.toLocaleString('en-IN')}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span>{result.meta.total.toLocaleString('en-IN')} fitments</span>
        <div>
          <button disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>
            <ChevronLeft size={16} />
          </button>
          <span>Page {filters.page} of {result.meta.totalPages}</span>
          <button disabled={filters.page >= result.meta.totalPages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>}
  </div>;
}
