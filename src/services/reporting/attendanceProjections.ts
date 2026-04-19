import type { PipelineStage } from 'mongoose';

export const rawAttendanceRowProjectionStage = (): PipelineStage.Project => ({
  $project: {
    attendance_id: { $toString: '$_id' },
    date: '$date',
    status: '$status',
    category: '$category',
    notes: '$notes',
    recorded_by: '$recorded_by',
    recorded_at: '$recorded_at',

    student_id: { $toString: '$student._id' },
    student_name: '$student.name',

    class_schedule_id: { $toString: '$schedule._id' },
    start_time: '$schedule.start_time',
    end_time: '$schedule.end_time',

    class_id: { $toString: '$class._id' },
    class_name: '$class.name',
    instructor: '$class.instructor'
  }
});

export const aggregatedAttendanceRowProjectionStage = (): PipelineStage.Project => ({
  $project: {
    presentCount: 1,
    totalCount: 1,

    student_id: { $cond: [{ $ifNull: ['$student_id', false] }, { $toString: '$student_id' }, '$$REMOVE'] },
    student_name: 1,

    instructor: 1,

    class_schedule_id: {
      $cond: [{ $ifNull: ['$class_schedule_id', false] }, { $toString: '$class_schedule_id' }, '$$REMOVE']
    },
    date: 1,
    start_time: 1,
    end_time: 1,

    class_id: { $cond: [{ $ifNull: ['$class_id', false] }, { $toString: '$class_id' }, '$$REMOVE'] },
    class_name: 1
  }
});
