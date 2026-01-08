// src/services/AttendanceService.ts - Core attendance business logic
import moment from 'moment';
import { Types } from 'mongoose';
import { Attendance, IAttendanceDocument, IAttendanceModel } from '../models/Attendance';
import { ClassScheduleModel, IClassScheduleDocument } from '../models/ClassSchedule';
import { UserModel } from '../models/User';
import { 
  MarkAttendanceDto, 
  AttendanceWithDetails, 
  StudentCategory,
  ClassScheduleSession
} from '../types/interfaces';

// Cast the model to include our custom methods
const AttendanceModel = Attendance as unknown as IAttendanceModel;

// Common interface for class information
interface IClassInfo {
  _id: Types.ObjectId;
  name: string;
  instructor: string;
  categories: StudentCategory[];
}

// Type for populated class schedule with class_id
interface PopulatedClassSchedule extends Omit<IClassScheduleDocument, 'class_id'> {
  class_id: IClassInfo;
}

// Type for the result of searchPastClasses
interface PastClassResult extends Omit<IClassScheduleDocument, 'class_id'> {
  class_id: IClassInfo;
}

// Type guard for error handling
function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

export class AttendanceService {

  // Get all classes scheduled for a specific date
  async getClassesForDate(date: Date): Promise<PopulatedClassSchedule[]> {
    const startOfDay = moment(date).startOf('day').toDate();
    const endOfDay = moment(date).endOf('day').toDate();

    const results = await ClassScheduleModel.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      status: 'scheduled'
    })
    .populate<{ class_id: IClassInfo }>('class_id')
    .sort({ start_time: 1 });

    return results as PopulatedClassSchedule[];
  }

  // Get the next upcoming class (closest in time to now)
  async getNextUpcomingClass(): Promise<any | null> {
    const now = new Date();

    // First try to find classes today that haven't started yet
    const todayClasses = await this.getClassesForDate(now);
    const currentTime = moment(now).format('HH:mm');

    for (const classSchedule of todayClasses) {
      if (classSchedule.start_time >= currentTime) {
        return classSchedule;
      }
    }

    // If no classes today, find next day with classes
    const tomorrow = moment(now).add(1, 'day').toDate();
    const upcomingClasses = await ClassScheduleModel.findOne({
      date: { $gte: tomorrow },
      status: 'scheduled'
    })
    .populate('class_id')
    .sort({ date: 1, start_time: 1 });

    return upcomingClasses;
  }

  /**
   * Marks attendance for multiple students with parallel processing and improved error handling
   * @param attendanceData Array of attendance records to process
   * @param recordedBy ID of the user recording the attendance
   * @returns Array of results for each attendance record
   */
  async markMultipleAttendance(
    attendanceData: MarkAttendanceDto[], 
    recordedBy: string
  ): Promise<Array<{
    success: boolean;
    attendance?: IAttendanceDocument;
    error?: string;
    student_id?: string | Types.ObjectId;
  }>> {
    // Process records in parallel with a concurrency limit
    const BATCH_SIZE = 5; // Limit concurrent operations to avoid overwhelming the database
    const results = [];
    
    for (let i = 0; i < attendanceData.length; i += BATCH_SIZE) {
      const batch = attendanceData.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (data) => {
          try {
            // Validate input data
            if (!data.student_id || !data.class_schedule_id) {
              throw new Error('Missing required fields: student_id and class_schedule_id are required');
            }

            const studentId = new Types.ObjectId(data.student_id);
            const scheduleId = new Types.ObjectId(data.class_schedule_id);
            const attendanceDate = data.date ? new Date(data.date) : new Date();
            const now = new Date();

            // Check for existing attendance for this student, schedule, and date
            const existingAttendance = await AttendanceModel.findOne({
              student_id: studentId,
              class_schedule_id: scheduleId,
              date: {
                $gte: moment(attendanceDate).startOf('day').toDate(),
                $lte: moment(attendanceDate).endOf('day').toDate()
              }
            });

            let attendance;
            if (existingAttendance) {
              // Update existing attendance
              existingAttendance.status = data.status;
              existingAttendance.notes = data.notes || '';
              existingAttendance.category = data.category;
              existingAttendance.recorded_by = recordedBy;
              existingAttendance.recorded_at = now;
              existingAttendance.updated_at = now;
              attendance = await existingAttendance.save();
            } else {
              // Create new attendance
              attendance = await AttendanceModel.create({
                ...data,
                student_id: studentId,
                class_schedule_id: scheduleId,
                recorded_by: recordedBy,
                recorded_at: now,
                date: attendanceDate,
                updated_at: now
              });
            }

            return { 
              success: true, 
              attendance,
              student_id: data.student_id 
            };
          } catch (error) {
            return { 
              success: false, 
              error: isErrorWithMessage(error) 
                ? `Failed to update attendance for student ${data.student_id}: ${error.message}`
                : 'An unknown error occurred',
              student_id: data.student_id 
            };
          }
        })
      );

      results.push(...batchResults);
    }

    // After all attendance is processed, update the schedule's sessions array
    // Get the user who recorded the attendance for the instructor field
    let user;
    
    // Check if recordedBy is a valid ObjectId or an email/string
    if (Types.ObjectId.isValid(recordedBy)) {
      user = await UserModel.findById(recordedBy).select('name email');
    } else {
      // Assume it's an email or name, try to find by email first
      user = await UserModel.findOne({ email: recordedBy }).select('name email');
    }
    
    let instructorName = user ? user.name : recordedBy;

    // Group results by schedule and date to update sessions
    const scheduleUpdates = new Map<string, { date: Date; scheduleId: Types.ObjectId }>();
    
    for (const result of results) {
      if (result.success && result.attendance) {
        const att = result.attendance;
        const dateStr = att.date.toISOString().split('T')[0];
        const key = `${att.class_schedule_id}-${dateStr}`;
        
        if (!scheduleUpdates.has(key)) {
          scheduleUpdates.set(key, {
            date: att.date,
            scheduleId: att.class_schedule_id
          });
        }
      }
    }

    // Update schedules efficiently: batch fetch instead of looping
    if (scheduleUpdates.size > 0) {
      try {
        // Get all schedule IDs
        const scheduleIds = Array.from(scheduleUpdates.values()).map(u => u.scheduleId);
        
        // Fetch all schedules in one query
        const schedules = await ClassScheduleModel.find({ _id: { $in: scheduleIds } });
        
        // Create a map for O(1) lookup
        const scheduleMap = new Map(schedules.map(s => [s._id.toString(), s]));
        
        // Update all schedules in memory
        for (const [, update] of scheduleUpdates) {
          const schedule = scheduleMap.get(update.scheduleId.toString());
          if (schedule && schedule.sessions) {
            const dateStr = update.date.toISOString().split('T')[0];
            const existingSessionIndex = schedule.sessions.findIndex(
              (s: ClassScheduleSession) => s.date.toISOString().split('T')[0] === dateStr
            );

            if (existingSessionIndex >= 0) {
              // Update existing session to completed
              schedule.sessions[existingSessionIndex].status = 'completed' as any;
              schedule.sessions[existingSessionIndex].instructor = instructorName;
            } else {
              // Create new session
              if (!schedule.sessions) {
                schedule.sessions = [];
              }
              schedule.sessions.push({
                date: update.date,
                instructor: instructorName,
                status: 'completed' as any,
                notes: ''
              });
            }
          }
        }
        
        // Save all schedules in parallel
        await Promise.all(schedules.map(s => s.save()));
      } catch (error) {
        console.error('Failed to update sessions after marking attendance:', error);
        // Don't throw - attendance is already saved, session update is secondary
      }
    }

    return results;
  }

  /**
   * Retrieves attendance records for a specific class schedule and optional category
   * @param classScheduleId The ID of the class schedule to get attendance for
   * @param category Optional category filter
   * @returns Array of attendance records with populated student and class details
   * @throws Error if the class schedule ID is invalid or if there's a database error
   */
  async getClassAttendance(
    classScheduleId: string, 
    category?: StudentCategory
  ): Promise<AttendanceWithDetails[]> {
    // Validate the class schedule ID format
    // Use the project ValidationError for consistent error handling
    const { validateObjectId } = require('../utils/validators');
    validateObjectId(classScheduleId, 'class schedule ID');
5509
    const query: { 
      class_schedule_id: Types.ObjectId;
      category?: StudentCategory;
    } = { 
      class_schedule_id: new Types.ObjectId(classScheduleId) 
    };
    
    if (category) {
      query.category = category;
    }

    try {
      // Define the populated attendance type
      type PopulatedAttendance = Omit<IAttendanceDocument, 'student_id' | 'class_schedule_id'> & {
        student_id: { _id: Types.ObjectId; name: string; email: string; categories: StudentCategory[] };
        class_schedule_id: IClassScheduleDocument & {
          class_id: IClassInfo | Types.ObjectId;
          date: Date;
          start_time: string;
          end_time: string;
          status: string;
        };
      };

      // Execute the query with proper typing
      const attendanceRecords = await (Attendance as IAttendanceModel)
        .find(query)
        .populate<{ student_id: { _id: Types.ObjectId; name: string; email: string; categories: StudentCategory[] } }>('student_id', 'name email categories')
        .populate<{ 
          class_schedule_id: IClassScheduleDocument & { 
            class_id: IClassInfo | Types.ObjectId;
            date: Date;
            start_time: string;
            end_time: string;
            status: string;
          } 
        }>({
          path: 'class_schedule_id',
          populate: { 
            path: 'class_id',
            select: 'name instructor categories'
          }
        })
        .sort({ 'student_id.name': 1 })
        .lean<PopulatedAttendance[]>();

      // Filter out any records missing required populated fields
      // Note: student_id can be null for "other students" attendance
      const filteredRecords = attendanceRecords.filter(r => r.class_schedule_id);

      console.log('[AttendanceService] getClassAttendance returning', filteredRecords.length, 'records');
      // Normalize `student_id` to a string id (tests and API expect ID strings)
      const normalized = filteredRecords.map(rec => {
        const studentField: any = rec.student_id;
        const studentIdString = studentField && typeof studentField === 'object' && '_id' in studentField
          ? (studentField._id as Types.ObjectId).toString()
          : studentField;

        // Preserve student details separately so UI can show names while
        // keeping student_id as a string for API/tests.
        const student = studentField && typeof studentField === 'object'
          ? { ...studentField, _id: (studentField._id as Types.ObjectId).toString() }
          : undefined;

        return {
          ...rec,
          student_id: studentIdString,
          student
        } as any;
      });

      return normalized as AttendanceWithDetails[];
    } catch (error) {
      const errorMessage = isErrorWithMessage(error)
        ? `Failed to retrieve class attendance: ${error.message}`
        : 'An unknown error occurred while retrieving class attendance';
      
      console.error(errorMessage, error);
      throw new Error(errorMessage);
    }
  }

  // Search past classes for editing attendance
  async searchPastClasses(filters: {
    date?: Date;
    instructor?: string;
    category?: StudentCategory;
  }): Promise<PastClassResult[]> {
    try {
      const query: {
        date: { $lt: Date } | { $gte: Date; $lte: Date };
        'class_id.instructor'?: string;
        'class_id.categories'?: { $in: StudentCategory[] };
      } = {
        date: { $lt: new Date() } // Only past classes
      };

      if (filters.date) {
        const startOfDay = moment(filters.date).startOf('day').toDate();
        const endOfDay = moment(filters.date).endOf('day').toDate();
        query.date = { $gte: startOfDay, $lte: endOfDay };
      }

      // Build the query for instructor and category filters
      const classQuery: { 
        instructor?: string; 
        categories?: { $in: StudentCategory[] } 
      } = {};

      if (filters.instructor) {
        classQuery.instructor = filters.instructor;
      }
      if (filters.category) {
        classQuery.categories = { $in: [filters.category] };
      }

      // Find class schedules and populate the related class data
      const classes = await ClassScheduleModel.find(query)
        .populate<{ class_id: { _id: Types.ObjectId; name: string; instructor: string; categories: StudentCategory[] } }>({
          path: 'class_id',
          match: classQuery,
          select: 'name instructor categories',
          // Use the lean option to get plain JavaScript objects
          options: { lean: true }
        })
        .sort({ date: -1, start_time: -1 })
        .lean<PopulatedClassSchedule[]>();

      // Filter out any null class_id (from the match condition) and ensure proper typing
      return classes.filter((cls): cls is PastClassResult => {
        if (!cls.class_id) return false;
        if (filters.category && !cls.class_id.categories.includes(filters.category)) {
          return false;
        }
        return true;
      });
    } catch (error) {
      console.error('Error in searchPastClasses:', error);
      throw new Error(
        isErrorWithMessage(error)
          ? error.message
          : 'Failed to search past classes'
      );
    }
  }

  // Generate attendance reports
  async generateAttendanceReports(dateRange: string): Promise<Array<{
    student_id: Types.ObjectId;
    student_name: string;
    category: StudentCategory;
    total_classes: number;
    present: number;
    absent: number;
    late: number;
    attendance_percentage: number;
  }>> {
    try {
      const [startDate, endDate] = this.parseDateRange(dateRange);

      const pipeline = [
        {
          $match: {
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $lookup: {
            from: 'students',
            localField: 'student_id',
            foreignField: '_id',
            as: 'student'
          }
        },
        { $unwind: '$student' },
        {
          $lookup: {
            from: 'classschedules',
            localField: 'class_schedule_id',
            foreignField: '_id',
            as: 'schedule'
          }
        },
        { $unwind: '$schedule' },
        {
          $lookup: {
            from: 'classes',
            localField: 'schedule.class_id',
            foreignField: '_id',
            as: 'class'
          }
        },
        { $unwind: '$class' },
        {
          $group: {
            _id: {
              student_id: '$student._id',
              student_name: '$student.name',
              category: { $arrayElemAt: ['$student.categories', 0] }
            },
            class_name: { $first: '$class.name' },
            total_classes: { $sum: 1 },
            present: {
              $sum: {
                $cond: [{ $eq: ['$status', 'present'] }, 1, 0]
              }
            },
            absent: {
              $sum: {
                $cond: [{ $eq: ['$status', 'absent'] }, 1, 0]
              }
            },
            late: {
              $sum: {
                $cond: [{ $eq: ['$status', 'late'] }, 1, 0]
              }
            },
            excused: {
              $sum: {
                $cond: [{ $eq: ['$status', 'excused'] }, 1, 0]
              }
            }
          }
        },

        {
          $project: {
            _id: 0,
            student_id: '$_id.student_id',
            student_name: '$_id.student_name',
            category: '$_id.category',
            class_name: '$class_name',
            total_classes: 1,
            total_students: '$total_classes',
            present: 1,
            present_count: '$present',
            absent: 1,
            late: 1,
            excused: 1,
            excused_count: '$excused',
            attendance_percentage: {
              $multiply: [
                {
                  $cond: [
                    { $eq: ['$total_classes', 0] },
                    0,
                    {
                      $divide: [
                        { $add: ['$present', '$excused', { $multiply: ['$late', 0.5] }] },
                        '$total_classes'
                      ]
                    }
                  ]
                },
                100
              ]
            }
          }
        },
        { $sort: { student_name: 1 } }
      ] as const;

      // Convert the readonly pipeline to mutable array
      const mutablePipeline = [...pipeline];
      const result = await Attendance.aggregate(mutablePipeline);
      
      // Map the result to the expected return type
        return result.map((item: any) => ({
        student_id: new Types.ObjectId(item.student_id),
        student_name: item.student_name,
        category: item.category as StudentCategory,
        class_name: item.class_name || '',
        total_classes: item.total_classes,
        total_students: item.total_students || item.total_classes,
        present: item.present,
        present_count: item.present || 0,
        absent: item.absent,
        late: item.late,
        excused: item.excused || 0,
        excused_count: item.excused || 0,
        attendance_percentage: parseFloat(item.attendance_percentage.toFixed(2))
      }));
    } catch (error) {
      console.error('Error in generateAttendanceReports:', error);
      throw new Error(
        isErrorWithMessage(error)
          ? error.message
          : 'Failed to generate attendance reports'
      );
    }
  }

  private parseDateRange(dateRange: string): [Date, Date] {
    const now = new Date();

    switch (dateRange) {
      case 'week':
        return [
          moment(now).startOf('week').toDate(),
          moment(now).endOf('week').toDate()
        ];
      case 'month':
        return [
          moment(now).startOf('month').toDate(),
          moment(now).endOf('month').toDate()
        ];
      case 'quarter':
        return [
          moment(now).startOf('quarter').toDate(),
          moment(now).endOf('quarter').toDate()
        ];
      default:
        return [
          moment(now).startOf('month').toDate(),
          moment(now).endOf('month').toDate()
        ];
    }
  }
}