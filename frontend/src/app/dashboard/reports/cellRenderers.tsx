import { TableCell } from '@/components/ui/table';

import type { AggregatedAttendanceRow, ColumnDefinition, RawAttendanceRow } from './types';
import { formatDateSv } from './utils';

export const renderRawCell = (col: ColumnDefinition, row: RawAttendanceRow) => {
  switch (col.key) {
    case 'date':
      return <TableCell key={col.key}>{formatDateSv(row.date)}</TableCell>;
    case 'start_time':
      return <TableCell key={col.key}>{row.start_time}</TableCell>;
    case 'end_time':
      return <TableCell key={col.key}>{row.end_time}</TableCell>;
    case 'student_name':
      return (
        <TableCell key={col.key} className="font-medium truncate" title={row.student_name}>
          {row.student_name}
        </TableCell>
      );
    case 'class_name':
      return (
        <TableCell key={col.key} className="truncate" title={row.class_name}>
          {row.class_name}
        </TableCell>
      );
    case 'instructor':
      return (
        <TableCell key={col.key} className="truncate" title={row.instructor}>
          {row.instructor}
        </TableCell>
      );
    case 'status':
      return (
        <TableCell key={col.key} className="capitalize">
          {row.status}
        </TableCell>
      );
    case 'category':
      return <TableCell key={col.key}>{row.category}</TableCell>;
    case 'notes':
      return (
        <TableCell key={col.key} className="truncate" title={row.notes}>
          {row.notes}
        </TableCell>
      );
    case 'recorded_by':
      return (
        <TableCell key={col.key} className="truncate" title={row.recorded_by}>
          {row.recorded_by}
        </TableCell>
      );
    case 'recorded_at':
      return <TableCell key={col.key}>{formatDateSv(row.recorded_at)}</TableCell>;
    default:
      return null;
  }
};

export const renderAggregatedCell = (col: ColumnDefinition, row: AggregatedAttendanceRow) => {
  switch (col.key) {
    case 'date':
      return <TableCell key={col.key}>{row.date ? formatDateSv(row.date) : ''}</TableCell>;
    case 'start_time':
      return <TableCell key={col.key}>{row.start_time ?? ''}</TableCell>;
    case 'end_time':
      return <TableCell key={col.key}>{row.end_time ?? ''}</TableCell>;
    case 'class_name':
      return <TableCell key={col.key}>{row.class_name ?? ''}</TableCell>;
    case 'student_name':
      return <TableCell key={col.key}>{row.student_name ?? ''}</TableCell>;
    case 'instructor':
      return <TableCell key={col.key}>{row.instructor ?? ''}</TableCell>;
    case 'presentCount':
      return <TableCell key={col.key}>{row.presentCount}</TableCell>;
    case 'totalCount':
      return <TableCell key={col.key}>{row.totalCount}</TableCell>;
    default:
      return null;
  }
};
