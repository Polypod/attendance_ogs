
// TypeScript interfaces for Karate School Attendance System

// Enums for better type safety and value usage
export enum StudentCategoryEnum {
  BEGINNER = 'beginner',
  KIDS = 'kids',
  YOUTH = 'youth',
  ADULT = 'adult',
  ADVANCED = 'advanced'
}

export enum AttendanceStatusEnum {
  PRESENT = 'present',
  ABSENT = 'absent',
  LATE = 'late'
}

export enum ClassStatusEnum {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed'
}

export enum StudentStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive'
}

export enum DayOfWeekEnum {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday'
}

export enum UserRoleEnum {
  ADMIN = 'admin',
  INSTRUCTOR = 'instructor',
  STAFF = 'staff',
  STUDENT = 'student'
}

export enum UserStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

// Type aliases using enum values for better type safety
export type StudentCategory = StudentCategoryEnum;
export type AttendanceStatus = AttendanceStatusEnum;
export type ClassStatus = ClassStatusEnum;
export type StudentStatus = StudentStatusEnum;
export type DayOfWeek = DayOfWeekEnum;
export type UserRole = UserRoleEnum;
export type UserStatus = UserStatusEnum;

export interface EmergencyContact {
  name: string;
  phone: string;
}

export interface User {
  _id?: string;
  email: string;
  name: string;
  role: UserRoleEnum;
  status: UserStatusEnum;
  created_by: string;
  last_login?: Date;
  password_changed_at?: Date;
  created_at?: Date;
  updated_at?: Date;
}

export interface Student {
  _id?: string;
  name: string;
  email: string;
  categories: StudentCategoryEnum[];
  belt_level: string;
  registration_date: Date;
  phone: string;
  emergency_contact: EmergencyContact;
  status: StudentStatusEnum;
  created_at?: Date;
  updated_at?: Date;
}

export interface Class {
  _id?: string;
  name: string;
  description: string;
  categories: StudentCategoryEnum[];
  instructor: string;
  max_capacity: number;
  duration_minutes: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface ClassScheduleSession {
  date: Date;
  instructor: string;
  status?: ClassStatusEnum;
  notes?: string;
}

export interface ClassSchedule {
  _id?: string;
  class_id: string;
  date: Date;
  start_time: string;
  end_time: string;
  day_of_week?: DayOfWeekEnum; // Made optional - legacy field
  days_of_week?: number[]; // New field - array of weekdays (0=Sunday, 1=Monday, etc)
  recurring: boolean;
  recurrence_end_date?: Date; // New field for recurring schedules
  status: ClassStatusEnum;
  sessions?: ClassScheduleSession[]; // Array of session-specific data
  created_at?: Date;
  updated_at?: Date;
}

export interface Attendance {
  _id?: string;
  student_id: string;
  class_schedule_id: string;
  date: Date;
  status: AttendanceStatusEnum;
  category: StudentCategoryEnum;
  notes?: string;
  recorded_by: string;
  recorded_at: Date;
  created_at?: Date;
  updated_at?: Date;
}

// Extended interfaces for populated documents
export interface AttendanceWithDetails extends Attendance {
  student?: Student;
  class_schedule?: ClassScheduleWithClass;
}

export interface ClassScheduleWithClass extends ClassSchedule {
  class?: Class;
}

// DTOs for API requests/responses
export interface CreateStudentDto {
  name: string;
  email: string;
  categories: StudentCategoryEnum[];
  belt_level: string;
  phone: string;
  emergency_contact: EmergencyContact;
}

export interface UpdateStudentDto extends Partial<Omit<CreateStudentDto, 'email' | 'emergency_contact'>> {
  emergency_contact?: Partial<EmergencyContact>;
}

export interface CreateClassDto {
  name: string;
  description: string;
  categories: StudentCategoryEnum[];
  instructor: string;
  max_capacity: number;
  duration_minutes: number;
}

export interface UpdateClassDto extends Partial<CreateClassDto> {}

export interface CreateClassScheduleDto {
  class_id: string;
  date: Date;
  start_time: string;
  end_time: string;
  day_of_week?: DayOfWeek; // Legacy field - optional
  days_of_week?: DayOfWeek[]; // New field - array of days
  recurring: boolean;
  recurrence_end_date?: Date; // New field for recurring end date
  status?: ClassStatusEnum;
}

export interface UpdateClassScheduleDto extends Partial<Omit<CreateClassScheduleDto, 'class_id'>> {}

export interface MarkAttendanceDto {
  student_id: string;
  class_schedule_id: string;
  date?: Date | string; // Optional date for the attendance record
  status: AttendanceStatusEnum;
  category: StudentCategoryEnum;
  notes?: string;
}

export interface AttendanceReport {
  date: Date;
  class_name: string;
  total_students: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  attendance_percentage: number;
}

// User management DTOs
export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  role: UserRoleEnum;
}

export interface UpdateUserDto {
  name?: string;
  role?: UserRoleEnum;
  status?: UserStatusEnum;
  password?: string; // Only for password reset
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  refreshToken?: string;
  user: Omit<User, 'password'>;
}