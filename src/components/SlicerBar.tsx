import React, { useState, useRef, useEffect } from 'react';
import { Search, Calendar, ChevronDown, Check, X, MousePointerClick, AlertTriangle, Filter, MapPin, Tag } from 'lucide-react';
import { ColumnSchema, FilterState } from '../types/dashboard';

interface SlicerBarProps {
  columns: ColumnSchema[];
  filters: FilterState;
  dateKey?: string;
  metricColumns: ColumnSchema[];
  activeMetricKey: string;
  anomaliesCount?: number;
  onMetricChange: (metricKey: string) => void;
  onFilterChange: (filters: FilterState) => void;
  onClearCrossFilter: () => void;
  onToggleAnomalies?: () => void;
}

export const SlicerBar: React.FC<SlicerBarProps> = ({
  columns,
  filters,
  dateKey,
  metricColumns,
  activeMetricKey,
  anomaliesCount,
  onMetricChange,
  onFilterChange,
  onClearCrossFilter,
  onToggleAnomalies
}) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const categoryColumns = columns
    .filter(c => (c.type === 'category' || c.semanticRole === 'geographic' || c.semanticRole === 'categorical') && c.distinctCount > 1 && c.distinctCount <= 35)
    .slice(0, 5);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      ...filters,
      searchQuery: e.target.value
    });
  };

  const handleDatePreset = (preset: 'all' | '30d' | '90d' | '2024' | '2025') => {
    const today = new Date();
    let start: string | null = null;
    let end: string | null = null;

    if (preset === '30d') {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      start = d.toISOString().split('T')[0];
    } else if (preset === '90d') {
      const d = new Date(today);
      d.setDate(d.getDate() - 90);
      start = d.toISOString().split('T')[0];
    } else if (preset === '2024') {
      start = '2024-01-01';
      end = '2024-12-31';
    } else if (preset === '2025') {
      start = '2025-01-01';
      end = '2025-12-31';
    }

    onFilterChange({
      ...filters,
      dateRange: { start, end }
    });
  };

  const toggleCategoryValue = (columnKey: string, value: string) => {
    const current = filters.categoryFilters[columnKey] || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];

    onFilterChange({
      ...filters,
      categoryFilters: {
        ...filters.categoryFilters,
        [columnKey]: updated
      }
    });
  };

  const clearCategoryFilter = (columnKey: string) => {
    const copy = { ...filters.categoryFilters };
    delete copy[columnKey];
    onFilterChange({
      ...filters,
      categoryFilters: copy
    });
  };

  return (
    <div className="w-full bg-[#111215] border border-white/[0.07] rounded-xl p-3 space-y-2.5 no-print shadow-xs" ref={dropdownRef}>
      {/* Primary Control Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={handleSearchChange}
            placeholder="Filtrar dados ou dimensões..."
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg pl-8.5 pr-8 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-white/[0.2] focus:bg-white/[0.05] transition-all"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onFilterChange({ ...filters, searchQuery: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dynamic Metric Selector */}
        {metricColumns.length > 1 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-neutral-400 font-medium whitespace-nowrap">
              Métrica:
            </span>
            <div className="flex items-center bg-white/[0.03] p-0.5 border border-white/[0.06] rounded-lg">
              {metricColumns.slice(0, 4).map(m => (
                <button
                  key={m.key}
                  onClick={() => onMetricChange(m.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                    activeMetricKey === m.key
                      ? 'bg-white/[0.1] text-white shadow-xs'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date Presets */}
        {dateKey && (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center bg-white/[0.03] p-0.5 border border-white/[0.06] rounded-lg">
              <Calendar className="w-3.5 h-3.5 text-neutral-500 ml-1.5 mr-0.5" />
              <button
                onClick={() => handleDatePreset('all')}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                  !filters.dateRange.start && !filters.dateRange.end
                    ? 'bg-white/[0.1] text-white shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => handleDatePreset('30d')}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                  filters.dateRange.start && filters.dateRange.start.includes('-') && !filters.dateRange.start.startsWith('202')
                    ? 'bg-white/[0.1] text-white shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                30d
              </button>
              <button
                onClick={() => handleDatePreset('2024')}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                  filters.dateRange.start === '2024-01-01'
                    ? 'bg-white/[0.1] text-white shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                2024
              </button>
              <button
                onClick={() => handleDatePreset('2025')}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                  filters.dateRange.start === '2025-01-01'
                    ? 'bg-white/[0.1] text-white shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                2025
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dimensional Slicers & Quick Toggles */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.05]">
        <div className="flex items-center gap-1 text-[11px] text-neutral-400 font-medium mr-1">
          <Filter className="w-3 h-3 text-neutral-500" />
          <span>Filtros:</span>
        </div>

        {categoryColumns.map(col => {
          const selected = filters.categoryFilters[col.key] || [];
          const isOpen = openDropdown === col.key;
          const distinctOptions = col.sampleValues.map(v => String(v));

          return (
            <div key={col.key} className="relative">
              <button
                onClick={() => setOpenDropdown(isOpen ? null : col.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-all whitespace-nowrap ${
                  selected.length > 0
                    ? 'bg-white/[0.08] border-white/[0.2] text-white font-medium'
                    : 'bg-white/[0.02] border-white/[0.06] text-neutral-300 hover:bg-white/[0.05]'
                }`}
              >
                {col.semanticRole === 'geographic' ? (
                  <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                ) : (
                  <Tag className="w-3 h-3 text-neutral-400 shrink-0" />
                )}
                <span>{col.label}</span>
                {selected.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] flex items-center justify-center font-mono">
                    {selected.length}
                  </span>
                )}
                <ChevronDown className={`w-3 h-3 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-56 p-2 bg-[#16171B] border border-white/[0.1] rounded-xl shadow-2xl z-30 animate-in fade-in">
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/[0.06] text-[11px] text-neutral-400">
                    <span className="font-medium text-neutral-300">{col.label}</span>
                    {selected.length > 0 && (
                      <button
                        onClick={() => clearCategoryFilter(col.key)}
                        className="text-neutral-400 hover:text-white hover:underline text-[10px]"
                      >
                        Limpar ({selected.length})
                      </button>
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {distinctOptions.map(opt => {
                      const isChecked = selected.includes(opt);
                      return (
                        <button
                          key={opt}
                          onClick={() => toggleCategoryValue(col.key, opt)}
                          className="flex items-center justify-between w-full px-2 py-1.5 text-xs text-left rounded-md hover:bg-white/[0.05] transition-colors text-neutral-200"
                        >
                          <span className="truncate pr-2">{opt}</span>
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                            isChecked ? 'bg-white text-black border-white' : 'border-neutral-600 bg-transparent'
                          }`}>
                            {isChecked && <Check className="w-2.5 h-2.5" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Anomaly Outlier Filter */}
        {anomaliesCount !== undefined && anomaliesCount > 0 && (
          <button
            onClick={onToggleAnomalies}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border transition-all whitespace-nowrap ${
              filters.onlyAnomalies
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-200 font-medium'
                : 'bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:text-amber-300 hover:border-amber-500/20'
            }`}
            title="Isolar registros anômalos estatísticos"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Anomalias ({anomaliesCount})</span>
          </button>
        )}

        {/* Active Cross-filter pill */}
        {filters.activeCrossFilter && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg">
            <MousePointerClick className="w-3 h-3 text-emerald-400" />
            <span className="truncate max-w-[180px]">
              Filtro: {filters.activeCrossFilter.value}
            </span>
            <button
              onClick={onClearCrossFilter}
              className="text-emerald-400 hover:text-white ml-0.5"
              title="Remover filtro"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
