import type { AggregatedGroupBy, ColumnDefinition } from './types';

export const getRawColumns = (): ColumnDefinition[] => [
  { key: 'date', label: 'Date', width: '6.5rem', sortable: true },
  { key: 'start_time', label: 'Start', width: '4.5rem', sortable: true },
  { key: 'end_time', label: 'End', width: '4.5rem', sortable: true },
  { key: 'student_name', label: 'Medlem', width: '12rem', sortable: true },
  { key: 'class_name', label: 'Class', width: '16rem', sortable: true },
  { key: 'instructor', label: 'Instructor', width: '12rem', sortable: true },
  { key: 'status', label: 'Status', width: '6.5rem', sortable: true },
  { key: 'category', label: 'Category', width: '7.5rem', sortable: true },
  { key: 'notes', label: 'Notes', width: '18rem', sortable: true },
  { key: 'recorded_by', label: 'Recorded by', width: '14rem', sortable: true },
  { key: 'recorded_at', label: 'Recorded at', width: '11rem', sortable: true },
];

export const getAggregatedColumns = (groupBy: AggregatedGroupBy): ColumnDefinition[] => {
  if (groupBy === 'session') {
    return [
      { key: 'date', label: 'Date', sortable: true },
      { key: 'start_time', label: 'Start', sortable: true },
      { key: 'end_time', label: 'End', sortable: true },
      { key: 'class_name', label: 'Class', sortable: true },
      { key: 'instructor', label: 'Instructor', sortable: true },
      { key: 'presentCount', label: 'Present', sortable: true },
      { key: 'totalCount', label: 'Total', sortable: true },
    ];
  }

  if (groupBy === 'student') {
    return [
      { key: 'student_name', label: 'Medlem', sortable: true },
      { key: 'presentCount', label: 'Present', sortable: true },
      { key: 'totalCount', label: 'Total', sortable: true },
    ];
  }

  if (groupBy === 'instructor') {
    return [
      { key: 'instructor', label: 'Instructor', sortable: true },
      { key: 'presentCount', label: 'Present', sortable: true },
      { key: 'totalCount', label: 'Total', sortable: true },
    ];
  }

  return [
    { key: 'class_name', label: 'Class', sortable: true },
    { key: 'instructor', label: 'Instructor', sortable: true },
    { key: 'presentCount', label: 'Present', sortable: true },
    { key: 'totalCount', label: 'Total', sortable: true },
  ];
};

export const createDefaultRawColumnVisibility = (): Record<string, boolean> =>
  ({
    date: true,
    start_time: true,
    end_time: true,
    student_name: true,
    class_name: true,
    instructor: true,
    status: true,

    category: false,
    notes: false,
    recorded_by: false,
    recorded_at: false,
  }) satisfies Record<string, boolean>;

export const createDefaultAggregatedColumnVisibility = (): Record<string, boolean> =>
  ({
    date: true,
    start_time: true,
    end_time: true,
    student_name: true,
    class_name: true,
    instructor: true,
    presentCount: true,
    totalCount: true,
  }) satisfies Record<string, boolean>;
