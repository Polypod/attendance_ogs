// src/services/AttendanceService.ts - Core attendance business logic
import moment from 'moment';
import { Types, Document, Model } from 'mongoose';
import { Attendance, IAttendanceDocument, IAttendanceModel } from '../models/Attendance';
import { ClassScheduleModel, IClassScheduleDocument } from '../models/ClassSchedule';
import { StudentModel } from '../models/Student';
import { 
  MarkAttendanceDto, 
  AttendanceWithDetails, 
  StudentCategory,
  StudentStatusEnum,
  AttendanceStatus,
  ClassStatus
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

// Type for attendance record with populated fields
type AttendanceWithPopulatedFields = IAttendanceDocument & {
  student_id: { _id: Types.ObjectId; name: string; email: string };
  class_schedule_id: IClassScheduleDocument & {
    class_id: IClassInfo | Types.ObjectId;
  };
};

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
  async getClassesForDate(date: Date): Promise<any[]> {
    const startOfDay = moment(date).startOf('day').toDate();
    const endOfDay = moment(date).endOf('day').toDate();

    return await ClassScheduleModel.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      status: 'scheduled'
    })
    .populate('class_id')
    .sort({ start_time: 1 });
  }

  // Get the next upcoming class (closest in time to now)
  async getNextUpcomingClass(): Promise<any> {
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
            const now = new Date();

            const existingAttendance = await AttendanceModel.findOne({
              student_id: studentId,
              class_schedule_id: scheduleId,
              date: now
            });

            if (existingAttendance) {
              throw new Error('Attendance already recorded for this student and class schedule');
            }

            const attendance = await AttendanceModel.create({
              ...data,
              student_id: studentId,
              class_schedule_id: scheduleId,
              recorded_by: recordedBy,
              recorded_at: now,
              date: now,
              updated_at: now
            });

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
    if (!Types.ObjectId.isValid(classScheduleId)) {
      throw new Error('Invalid class schedule ID format');
    }

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
        student_id: { _id: Types.ObjectId; name: string; email: string };
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
        .populate<{ student_id: { _id: Types.ObjectId; name: string; email: string } }>('student_id', 'name email')
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

      // Map the results to the expected output format
      return attendanceRecords.map((record) => {
        const schedule = record.class_schedule_id;
        const student = record.student_id;
        
        // Safely extract class information whether it's populated or not
        let className = 'Unknown';
        let classInstructor = 'Unknown';
        let classCategories: StudentCategory[] = [];
        let classDescription = '';
        let classMaxCapacity = 20; // Default value
        let classDurationMinutes = 60; // Default value
        
        if (schedule?.class_id && typeof schedule.class_id === 'object' && 'name' in schedule.class_id) {
          const classInfo = schedule.class_id as IClassInfo;
          className = classInfo.name;
          classInstructor = classInfo.instructor;
          classCategories = classInfo.categories || [];
          // Extract additional class info if available
          if ('description' in schedule.class_id) {
            classDescription = (schedule.class_id as any).description || '';
          }
          if ('max_capacity' in schedule.class_id) {
            classMaxCapacity = (schedule.class_id as any).max_capacity || 20;
          }
          if ('duration_minutes' in schedule.class_id) {
            classDurationMinutes = (schedule.class_id as any).duration_minutes || 60;
          }
        }

        // Create the attendance details with all required fields
        const result: AttendanceWithDetails = {
          _id: record._id.toString(),
          student_id: student._id.toString(),
          class_schedule_id: schedule._id.toString(),
          date: schedule.date,
          status: record.status as AttendanceStatus,
          category: record.category as StudentCategory,
          notes: record.notes || '',
          recorded_by: record.recorded_by,
          recorded_at: record.recorded_at,
          created_at: record.created_at,
          updated_at: record.updated_at,
          student: {
            _id: student._id.toString(),
            name: student.name,
            email: student.email,
            categories: [],
            belt_level: '',
            registration_date: new Date(),
            phone: '',
            emergency_contact: { name: '', phone: '' },
            status: StudentStatusEnum.ACTIVE,
            created_at: new Date(),
            updated_at: new Date()
          },
          class_schedule: {
            _id: schedule._id.toString(),
            class_id: (schedule.class_id as IClassInfo)?._id?.toString() || '',
            date: schedule.date,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            day_of_week: schedule.day_of_week || 'monday', // Default to monday if not provided
            recurring: schedule.recurring || false, // Default to false if not provided
            status: schedule.status as ClassStatus,
            created_at: schedule.created_at || new Date(),
            updated_at: schedule.updated_at || new Date(),
            class: {
              _id: (schedule.class_id as IClassInfo)?._id?.toString() || '',
              name: className,
              description: classDescription,
              categories: classCategories,
              instructor: classInstructor,
              max_capacity: classMaxCapacity,
              duration_minutes: classDurationMinutes,
              created_at: new Date(),
              updated_at: new Date()
            }
          }
        };
        
        return result;
      });
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
              category: '$student.category'
            },
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
            }
          }
        },
        {
          $project: {
            _id: 0,
            student_id: '$_id.student_id',
            student_name: '$_id.student_name',
            category: '$_id.category',
            total_classes: 1,
            present: 1,
            absent: 1,
            late: 1,
            attendance_percentage: {
              $multiply: [
                {
                  $cond: [
                    { $eq: ['$total_classes', 0] },
                    0,
                    {
                      $divide: [
                        { $add: ['$present', { $multiply: ['$late', 0.5] }] },
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
        total_classes: item.total_classes,
        present: item.present,
        absent: item.absent,
        late: item.late,
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