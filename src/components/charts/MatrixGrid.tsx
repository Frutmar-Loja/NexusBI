import React from 'react';
import { ColumnType } from '../../types/dashboard';
import { cleanNumericValue, formatCompactNumber, formatNumber } from '../../utils/dataEngine';

interface MatrixGridProps {
  rows: Record<string, any>[];
  rowDimKey: string;
  colDimKey: string;
  metricKey: string;
  metricType: ColumnType;
  title: string;
  onSelectDimension: (key: string, value: string) => void;
}

export const MatrixGrid: React.FC<MatrixGridProps> = ({
  rows,
  rowDimKey,
  colDimKey,
  metricKey,
  metricType,
  title,
  onSelectDimension
}) => {
  // Extract unique row and col values (top 5 rows and top 4 cols for clean layout)
  const rowSet = new Set<string>();
  const colSet = new Set<string>();

  for (const r of rows) {
    if (r[rowDimKey] !== undefined) rowSet.add(String(r[rowDimKey]).trim());
    if (r[colDimKey] !== undefined) colSet.add(String(r[colDimKey]).trim());
  }

  const rowLabels = Array.from(rowSet).slice(0, 5);
  const colLabels = Array.from(colSet).slice(0, 4);

  // Compute cell matrix
  const matrix: Record<string, Record<string, number>> = {};
  let maxCellVal = 1;

  for (const r of rowLabels) {
    matrix[r] = {};
    for (const c of colLabels) {
      matrix[r][c] = 0;
    }
  }

  for (const row of rows) {
    const rVal = String(row[rowDimKey] ?? '').trim();
    const cVal = String(row[colDimKey] ?? '').trim();
    if (matrix[rVal] && matrix[rVal][cVal] !== undefined) {
      const val = (metricKey === '__count__' || !metricKey) ? 1 : (cleanNumericValue(row[metricKey]) ?? 1);
      matrix[rVal][cVal] += val;
      if (matrix[rVal][cVal] > maxCellVal) {
        maxCellVal = matrix[rVal][cVal];
      }
    }
  }

  const formatVal = (v: number) => {
    if (v === 0) return '-';
    return formatCompactNumber(v);
  };

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex items-center justify-between mb-2.5">
        <div>
          <h3 className="text-xs font-semibold text-neutral-200 tracking-tight">{title}</h3>
          <p className="text-[11px] text-neutral-500">
            Cruzamento dimensional: {rowDimKey} × {colDimKey}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left font-medium text-neutral-500 py-1.5 px-2.5 border-b border-white/[0.06] text-[11px]">
                {rowDimKey}
              </th>
              {colLabels.map(col => (
                <th
                  key={col}
                  onClick={() => onSelectDimension(colDimKey, col)}
                  className="text-right font-medium text-neutral-400 py-1.5 px-2.5 border-b border-white/[0.06] cursor-pointer hover:text-white truncate max-w-[90px] text-[11px]"
                  title={`Filtrar por ${col}`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {rowLabels.map(rowVal => (
              <tr key={rowVal} className="hover:bg-white/[0.02] transition-colors">
                <td
                  onClick={() => onSelectDimension(rowDimKey, rowVal)}
                  className="py-2 px-2.5 text-neutral-300 font-medium cursor-pointer hover:text-white truncate max-w-[130px] text-xs"
                  title={`Filtrar por ${rowVal}`}
                >
                  {rowVal}
                </td>
                {colLabels.map(colVal => {
                  const val = matrix[rowVal]?.[colVal] || 0;
                  const intensity = Math.min((val / maxCellVal) * 100, 100);

                  return (
                    <td
                      key={colVal}
                      onClick={() => onSelectDimension(rowDimKey, rowVal)}
                      className="py-2 px-2.5 text-right font-mono tabular-nums cursor-pointer transition-all rounded-xs"
                      style={{
                        backgroundColor: val > 0 ? `rgba(16, 185, 129, ${Math.max(intensity * 0.0025, 0.04)})` : 'transparent'
                      }}
                      title={`${rowVal} + ${colVal}: ${formatNumber(val)}`}
                    >
                      <span className={val > 0 ? 'text-neutral-200' : 'text-neutral-600'}>
                        {formatVal(val)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-2 border-t border-white/[0.05] mt-1.5">
        <span>Densidade térmica por cruzamento</span>
        <span className="font-mono tabular-nums">Matriz bidimensional</span>
      </div>
    </div>
  );
};
