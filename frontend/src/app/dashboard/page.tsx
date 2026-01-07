"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { createApiClient } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Clock } from "lucide-react";

type ClassInfo = {
  _id: string;
  name: string;
  instructor: string;
  categories: string[];
};

type ClassScheduleSession = {
  date: string;
  instructor: string;
  status?: string;
  notes?: string;
};

type Schedule = {
  _id: string;
  class_id: ClassInfo | string;
  date: string;
  start_time: string;
  end_time: string;
  days_of_week?: string[];
  recurring: boolean;
  status: string;
  sessions?: ClassScheduleSession[];
  _isRecurringInstance?: boolean;
  _originalScheduleId?: string;
};

type AttendanceRecord = {
  _id: string;
  student_id?: {
    _id: string;
    name: string;
    categories: string[];
  };
  student_name?: string; // For "other students" not in the system
  status: string;
  category: string;
  date?: string;
};

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(getTodayISO());
  const [endDate, setEndDate] = useState(getTodayISO());
  const [showDateRange, setShowDateRange] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      fetchSchedules();
    } else if (status === 'unauthenticated') {
      setLoading(false);
      setError('Not authenticated');
    }
  }, [status, session, startDate, endDate, showDateRange]);

  async function fetchSchedules() {
    if (!session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const api = createApiClient((session as any)?.accessToken);
      // Always expand recurring schedules to show individual instances
      const expandParam = '&expandRecurring=true';
      console.log('[Dashboard] Fetching schedules:', { startDate, endDate, showDateRange, expandParam });
      const data = await api.get(`/api/schedules?startDate=${startDate}&endDate=${endDate}${expandParam}`);
      const schedulesData = data.data || [];
      console.log('[Dashboard] Received', schedulesData.length, 'schedules');
      setSchedules(schedulesData);

      // Fetch attendance for completed classes
      const completedSchedules = schedulesData.filter((s: Schedule) => s.status === 'completed');
      const attendancePromises = completedSchedules.map(async (schedule: Schedule) => {
        try {
          // Use original schedule ID for recurring instances
          const scheduleId = (schedule as any)._originalScheduleId || schedule._id;
          const attendanceRes = await api.get(`/api/attendance/class/${scheduleId}`);
          return { scheduleId: schedule._id, data: attendanceRes.data || [] };
        } catch (e) {
          return { scheduleId: schedule._id, data: [] };
        }
      });

      const attendanceResults = await Promise.all(attendancePromises);
      const attendanceMap: Record<string, AttendanceRecord[]> = {};
      attendanceResults.forEach((result) => {
        attendanceMap[result.scheduleId] = result.data;
      });
      setAttendanceData(attendanceMap);

    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("Failed to fetch schedules");
    } finally {
      setLoading(false);
    }
  }

  function getClassName(classId: ClassInfo | string): string {
    if (typeof classId === 'object') return classId.name;
    return 'Unknown';
  }

  function getInstructorName(classId: ClassInfo | string): string {
    if (typeof classId === 'object') return classId.instructor;
    return 'Unknown';
  }

  function getCategories(classId: ClassInfo | string): string {
    if (typeof classId === 'object') return classId.categories?.join(", ") || "-";
    return '-';
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getSessionInstructor(schedule: Schedule): string {
    // For expanded recurring instances, instructor is already set
    if ((schedule as any).instructor) {
      return (schedule as any).instructor;
    }
    
    // Otherwise, check sessions array
    const scheduleDate = schedule.date.split('T')[0];
    const session = schedule.sessions?.find(
      (s) => s.date.split('T')[0] === scheduleDate
    );
    return session?.instructor || getInstructorName(schedule.class_id);
  }

  function getAttendanceSummary(scheduleId: string, scheduleDate: string) {
    const attendance = attendanceData[scheduleId] || [];
    
    // For recurring instances, filter by date; otherwise use all attendance
    const dateStr = scheduleDate.split('T')[0];
    const relevantAttendance = attendance.filter((a: any) => {
      // If no date field exists, this is old data - include it
      if (!a.date) return true;
      
      // Check if the attendance date matches this schedule date
      const attendanceDateStr = a.date.split('T')[0];
      return attendanceDateStr === dateStr;
    });
    
    const present = relevantAttendance.filter((a) => a.status === 'present');
    
    // Group by category with student names
    const byCategory: Record<string, string[]> = {};
    present.forEach((a) => {
      // Use the category from attendance record, or try student categories
      let category = a.category;
      if (!category && a.student_id && typeof a.student_id === 'object' && a.student_id.categories) {
        category = a.student_id.categories[0];
      }
      if (!category) category = 'Uncategorized';
      
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      
      // Get student name - either from student_id (populated) or student_name (for "other students")
      let studentName = '';
      if (a.student_id && typeof a.student_id === 'object' && a.student_id.name) {
        studentName = a.student_id.name;
      } else if (a.student_name) {
        studentName = a.student_name;
      }
      
      if (studentName) {
        byCategory[category].push(studentName);
      }
    });

    return {
      total: present.length,
      byCategory,
    };
  }

  const todaySchedules = schedules.filter(s => s.date.split('T')[0] === getTodayISO());

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-bold mb-4 md:mb-0">Dashboard - Class Schedule</h1>
        <Button 
          variant="outline" 
          onClick={() => setShowDateRange(!showDateRange)}
          className="w-fit"
        >
          <Calendar className="w-4 h-4 mr-2" />
          {showDateRange ? "Show Today Only" : "Show Date Range"}
        </Button>
      </div>

      {showDateRange && (
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Start Date</label>
              <Input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">End Date</label>
              <Input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
              />
            </div>
          </div>
        </Card>
      )}

      {error && (
        <Card className="p-4 bg-red-50 border-red-200 mb-6">
          <p className="text-red-600">{error}</p>
        </Card>
      )}

      {/* Today's Classes Section */}
      {!showDateRange && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Today's Classes ({formatDate(getTodayISO())})
          </h2>
          {loading ? (
            <Card className="p-6">
              <p className="text-muted-foreground">Loading today's classes...</p>
            </Card>
          ) : todaySchedules.length === 0 ? (
            <Card className="p-6">
              <p className="text-muted-foreground">No classes scheduled for today.</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {todaySchedules.map((schedule) => (
                <Card 
                  key={schedule._id} 
                  className={`p-4 ${
                    schedule.status === 'completed' ? 'bg-green-50 border-green-200' :
                    schedule.status === 'cancelled' ? 'bg-red-50 border-red-200' :
                    schedule.status === 'in_progress' ? 'bg-blue-50 border-blue-200' :
                    ''
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold">{getClassName(schedule.class_id)}</h3>
                        <span className={`text-xs px-2 py-1 rounded ${
                          schedule.status === 'completed' ? 'bg-green-100 text-green-800' :
                          schedule.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          schedule.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {schedule.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Instructor: {schedule.status === 'completed' ? getSessionInstructor(schedule) : getInstructorName(schedule.class_id)}
                      </p>
                      <p className="text-sm text-muted-foreground mb-1">
                        Categories: {getCategories(schedule.class_id)}
                      </p>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="w-4 h-4 mr-1" />
                        {schedule.start_time} - {schedule.end_time}
                      </div>
                      
                      {schedule.status === 'completed' && attendanceData[schedule._id] && (() => {
                        const summary = getAttendanceSummary(schedule._id, schedule.date);
                        return (
                          <div className="mt-3 pt-3 border-t border-green-200">
                            <p className="text-sm font-medium text-green-800 mb-2">
                              Present: {summary.total} students
                            </p>
                            {Object.entries(summary.byCategory).length > 0 && (
                              <div className="space-y-1">
                                {Object.entries(summary.byCategory).map(([cat, names]) => (
                                  <div key={cat} className="text-xs text-green-700">
                                    <span className="font-semibold">{cat} ({names.length}):</span> {names.join(', ')}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    {schedule.status === 'scheduled' ? (
                      <Button className="mt-3 md:mt-0 md:ml-4" asChild>
                        <a href={`/dashboard/attendance/${schedule._originalScheduleId || schedule._id}?date=${schedule.date.split('T')[0]}`}>Take Attendance</a>
                      </Button>
                    ) : schedule.status === 'completed' ? (
                      <Button variant="outline" className="mt-3 md:mt-0 md:ml-4" asChild>
                        <a href={`/dashboard/attendance/${schedule._originalScheduleId || schedule._id}?date=${schedule.date.split('T')[0]}`}>Edit Attendance</a>
                      </Button>
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Schedules Section - only show when date range is active */}
      {showDateRange && (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            {showDateRange ? `Classes from ${formatDate(startDate)} to ${formatDate(endDate)}` : 'All Upcoming Classes'}
          </h2>
        {loading ? (
          <Card className="p-6">
            <p className="text-muted-foreground">Loading classes...</p>
          </Card>
        ) : schedules.length === 0 ? (
          <Card className="p-6">
            <p className="text-muted-foreground">No classes found for the selected period.</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {schedules.map((schedule) => {
              // Create unique key for React - use _id + date to handle recurring instances
              const uniqueKey = `${schedule._id}-${schedule.date}`;
              return (
              <Card key={uniqueKey} className="p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold">{getClassName(schedule.class_id)}</h3>
                      <span className={`text-xs px-2 py-1 rounded ${
                        schedule.status === 'completed' ? 'bg-green-100 text-green-800' :
                        schedule.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        schedule.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {schedule.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Date: {formatDate(schedule.date)} | Instructor: {schedule.status === 'completed' ? getSessionInstructor(schedule) : getInstructorName(schedule.class_id)}
                    </p>
                    <p className="text-sm text-muted-foreground mb-1">
                      Categories: {getCategories(schedule.class_id)}
                    </p>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="w-4 h-4 mr-1" />
                      {schedule.start_time} - {schedule.end_time}
                      {schedule.recurring && (
                        <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                          Recurring
                        </span>
                      )}
                    </div>
                    
                    {schedule.status === 'completed' && attendanceData[schedule._id] && (() => {
                      const summary = getAttendanceSummary(schedule._id, schedule.date);
                      return (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm font-medium text-green-800 mb-2">
                            Present: {summary.total} students
                          </p>
                          {Object.entries(summary.byCategory).length > 0 && (
                            <div className="space-y-1">
                              {Object.entries(summary.byCategory).map(([cat, names]) => (
                                <div key={cat} className="text-xs text-green-700">
                                  <span className="font-semibold">{cat} ({names.length}):</span> {names.join(', ')}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  {schedule.status === 'scheduled' ? (
                    <Button className="mt-3 md:mt-0 md:ml-4" asChild>
                      <a href={`/dashboard/attendance/${schedule._originalScheduleId || schedule._id}?date=${schedule.date.split('T')[0]}`}>Take Attendance</a>
                    </Button>
                  ) : schedule.status === 'completed' ? (
                    <Button variant="outline" className="mt-3 md:mt-0 md:ml-4" asChild>
                      <a href={`/dashboard/attendance/${schedule._originalScheduleId || schedule._id}?date=${schedule.date.split('T')[0]}`}>Edit Attendance</a>
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
            })}
          </div>
        )}
        </div>
      )}
    </div>
  );
}
