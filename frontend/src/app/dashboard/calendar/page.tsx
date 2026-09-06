"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { createApiClient } from "@/lib/api";
import { logger } from "@/lib/logger";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Trash2, Edit, Plus, Calendar as CalendarIcon, Users, Clock, MapPin, Info } from "lucide-react";
import {
  attendanceCountKey,
  countPresentAttendance,
  dayValuesToNumbers,
  DAYS_OF_WEEK,
  daysOfWeekToValues,
  filterAttendanceForScheduleDate,
  isoDatePart,
} from "@/app/dashboard/calendar/calendarHelpers";

type ClassInfo = {
  _id: string;
  name: string;
  instructor: string;
};

type AttendanceRecord = {
  _id: string;
  student?: { _id: string; name: string };
  status: string;
  date?: string;
  category?: string;
  notes?: string;
};

type ClassScheduleSession = {
  date: string;
  status?: string;
  notes?: string;
  "S-instructor": string;
};

type Schedule = {
  _id: string;
  class_id: ClassInfo | string;
  date: string;
  start_time: string;
  end_time: string;
  day_of_week?: string; // Old field - deprecated
  days_of_week?: (string | number)[]; // Can be strings (legacy) or numbers (0-6)
  recurring: boolean;
  recurrence_end_date?: string; // New field for recurring end date
  status: string;
  sessions?: ClassScheduleSession[];
  _isRecurringInstance?: boolean; // Marker for expanded recurring instances
  _instanceDate?: string; // Original instance date (YYYY-MM-DD)
  _originalScheduleId?: string; // ID of the original recurring schedule
};

type Class = {
  _id: string;
  name: string;
  instructor: string;
};

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getThreeMonthsBack() {
  const date = new Date();
  date.setMonth(date.getMonth() - 3);
  return date.toISOString().slice(0, 10);
}

function getThreeMonthsForward() {
  const date = new Date();
  date.setMonth(date.getMonth() + 3);
  return date.toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [attendanceCounts, setAttendanceCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(getThreeMonthsBack());
  const [endDate, setEndDate] = useState(getThreeMonthsForward());

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

  // Summary dialog state
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [summarySchedule, setSummarySchedule] = useState<Schedule | null>(null);
  const [summaryAttendance, setSummaryAttendance] = useState<AttendanceRecord[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Instructor sessions dialog state
  const [instructorDialogOpen, setInstructorDialogOpen] = useState(false);
  const [instructorName, setInstructorName] = useState<string>("");

  // Form states
  const [createForm, setCreateForm] = useState({
    class_id: "",
    date: getTodayISO(),
    start_time: "",
    end_time: "",
    days_of_week: [] as string[], // Array of weekdays for multiple selection
    recurring: false,
    recurrence_end_date: "", // End date for recurring schedules
  });

  const [editForm, setEditForm] = useState({
    class_id: "",
    date: "",
    start_time: "",
    end_time: "",
    days_of_week: [] as string[], // Array of weekdays for multiple selection
    recurring: false,
    recurrence_end_date: "", // End date for recurring schedules
    status: "scheduled", // For session-level status updates
    notes: "", // For session-level notes
    instructor: "", // For session-level instructor override
  });

  const daysOfWeek = DAYS_OF_WEEK;

  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      fetchSchedules();
      fetchClasses();
    } else if (status === 'unauthenticated') {
      setLoading(false);
      setError('Not authenticated');
    }
  }, [status, session, startDate, endDate]);

  async function fetchSchedules() {
    if (!session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const api = createApiClient((session as any)?.accessToken);
      // Always expand recurring schedules to show individual instances
      const data = await api.get(`/api/schedules?startDate=${startDate}&endDate=${endDate}&expandRecurring=true`);
      const schedulesList = data.data || [];
      setSchedules(schedulesList);
      
      // Fetch attendance counts for each schedule
      const counts: Record<string, number> = {};
      for (const schedule of schedulesList) {
        try {
          const attendanceData = await api.get(`/api/attendance/class/${schedule._id}`);
          const attendanceList: AttendanceRecord[] = attendanceData.data || [];
          
          // Filter attendance for this specific date (important for recurring classes)
          const scheduleDate = isoDatePart(schedule.date);
          const dateAttendance = filterAttendanceForScheduleDate(attendanceList, scheduleDate);
          
          // Count present students only
          const presentCount = countPresentAttendance(dateAttendance);
          counts[attendanceCountKey(schedule._id, scheduleDate)] = presentCount;
        } catch {
          counts[attendanceCountKey(schedule._id, isoDatePart(schedule.date))] = 0;
        }
      }
      setAttendanceCounts(counts);
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("Failed to fetch schedules");
    } finally {
      setLoading(false);
    }
  }

  async function fetchClasses() {
    if (!session?.accessToken) return;
    try {
      const api = createApiClient((session as any)?.accessToken);
      const data = await api.get("/api/classes");
      setClasses(data.data || []);
    } catch (e: unknown) {
      logger.error('CalendarPage.fetchClasses_failed', {
        message: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  }

  async function handleCreateSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;
    
    // Validate required fields
    if (!createForm.class_id || !createForm.date || !createForm.start_time || !createForm.end_time) {
      setError("Please fill in all required fields: Class, Date, Start Time, and End Time");
      return;
    }
    if (createForm.recurring && createForm.days_of_week.length === 0) {
      setError("Please select at least one day of the week for recurring schedules");
      return;
    }
    if (createForm.recurring && !createForm.recurrence_end_date) {
      setError("Please specify an end date for recurring schedule");
      return;
    }
    
    setError(null);
    try {
      const api = createApiClient((session as any)?.accessToken);
      // Convert day strings to numbers (only if recurring)
      const daysAsNumbers = dayValuesToNumbers(
        createForm.days_of_week,
        createForm.date,
        createForm.recurring,
        daysOfWeek
      );
      
      // Prepare payload - remove empty recurrence_end_date if not recurring
      const payload: any = {
        class_id: createForm.class_id,
        date: createForm.date,
        start_time: createForm.start_time,
        end_time: createForm.end_time,
        days_of_week: daysAsNumbers,
        recurring: createForm.recurring,
      };
      if (createForm.recurring && createForm.recurrence_end_date) {
        payload.recurrence_end_date = createForm.recurrence_end_date;
      }
      const data = await api.post("/api/schedules", payload);
      setSchedules((prev) => [...prev, data.data]);
      setCreateDialogOpen(false);
      setCreateForm({
        class_id: "",
        date: getTodayISO(),
        start_time: "",
        end_time: "",
        days_of_week: [],
        recurring: false,
        recurrence_end_date: "",
      });
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("Failed to create schedule");
    }
  }

  async function handleEditSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSchedule || !session?.accessToken) return;
    
    // Validate required fields
    if (!editForm.date || !editForm.start_time || !editForm.end_time) {
      setError("Please fill in all required fields: Date, Start Time, and End Time");
      return;
    }
    if (editForm.recurring && editForm.days_of_week.length === 0) {
      setError("Please select at least one day of the week for recurring schedules");
      return;
    }
    if (editForm.recurring && !editForm.recurrence_end_date) {
      setError("Please specify an end date for recurring schedule");
      return;
    }
    
    setError(null);
    try {
      const api = createApiClient((session as any)?.accessToken);
      
      // Check if this is a recurring instance - if so, update only the session
      if ((selectedSchedule as any)._isRecurringInstance && (selectedSchedule as any)._originalScheduleId) {
        const instanceDate = editForm.date;
        
        // Build session update with the changes
        const sessionUpdate = {
          date: new Date(instanceDate).toISOString(),
          status: editForm.status || 'scheduled',
          notes: editForm.notes || '',
          'S-instructor': editForm.instructor || '',
        };
        
        // Fetch current schedule to get all sessions
        const currentSchedule = await api.get(`/api/schedules/${(selectedSchedule as any)._originalScheduleId}`);
        const existingSessions = currentSchedule.data?.sessions || [];
        
        // Find and update the specific session
        const updatedSessions = existingSessions.map((s: any) => {
          if (s.date && new Date(s.date).toISOString().split('T')[0] === instanceDate) {
            return sessionUpdate;
          }
          return s;
        });
        
        // If session doesn't exist, add it
        if (!updatedSessions.some((s: any) => s.date && new Date(s.date).toISOString().split('T')[0] === instanceDate)) {
          updatedSessions.push(sessionUpdate);
        }
        
        // Update only the sessions array
        const payload = { sessions: updatedSessions };
        const data = await api.put(`/api/schedules/${(selectedSchedule as any)._originalScheduleId}`, payload);
        
        // Update local state
        setSchedules((prev) =>
          prev.map((s) => s._id === (selectedSchedule as any)._originalScheduleId ? data.data : s)
        );
      } else {
        // For non-recurring schedules, update normally
        const { class_id: _classId, ...updateData } = editForm;
        const daysAsNumbers = dayValuesToNumbers(
          editForm.days_of_week,
          editForm.date,
          editForm.recurring,
          daysOfWeek
        );
        
        const payload = { ...updateData, days_of_week: daysAsNumbers };
        const data = await api.put(`/api/schedules/${selectedSchedule._id}`, payload);
        setSchedules((prev) =>
          prev.map((s) => (s._id === selectedSchedule._id ? data.data : s))
        );
      }
      
      setEditDialogOpen(false);
      setSelectedSchedule(null);
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("Failed to update schedule");
    }
  }

  async function handleDeleteSchedule() {
    if (!selectedSchedule || !session?.accessToken) return;
    setError(null);
    try {
      const api = createApiClient((session as any)?.accessToken);
      
      // Check if this is a recurring instance - if so, delete only the session
      if ((selectedSchedule as any)._isRecurringInstance && (selectedSchedule as any)._originalScheduleId) {
        const instanceDate = selectedSchedule.date.split('T')[0];
        
        // Fetch current schedule to get all sessions
        const currentSchedule = await api.get(`/api/schedules/${(selectedSchedule as any)._originalScheduleId}`);
        const existingSessions = currentSchedule.data?.sessions || [];
        
        // Filter out the session for this date
        const updatedSessions = existingSessions.filter((s: any) => 
          !s.date || new Date(s.date).toISOString().split('T')[0] !== instanceDate
        );
        
        // Update the sessions array (removes the session without deleting the whole schedule)
        const payload = { sessions: updatedSessions };
        await api.put(`/api/schedules/${(selectedSchedule as any)._originalScheduleId}`, payload);
        
        // Update local state - remove this instance from display
        setSchedules((prev) => prev.filter((s) => 
          !(s._id === selectedSchedule._id && (s as any)._instanceDate === instanceDate)
        ));
      } else {
        // For non-recurring schedules, delete normally
        await api.delete(`/api/schedules/${selectedSchedule._id}`);
        setSchedules((prev) => prev.filter((s) => s._id !== selectedSchedule._id));
      }
      
      setDeleteDialogOpen(false);
      setSelectedSchedule(null);
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("Failed to delete schedule");
    }
  }

  function openEditDialog(schedule: Schedule) {
    setError(null); // Clear any previous errors
    setSelectedSchedule(schedule);
    // Convert number days back to string values for form
    const daysAsStrings = daysOfWeekToValues(
      schedule.days_of_week,
      schedule.day_of_week,
      daysOfWeek
    );
    
    // If this is a recurring instance, look for the session data
    const instanceDate = schedule.date ? schedule.date.split('T')[0] : "";
    let sessionData = { status: "scheduled", notes: "", instructor: "" };
    
    if ((schedule as any)._isRecurringInstance && schedule.sessions) {
      const matchingSession = schedule.sessions.find(
        (s: ClassScheduleSession) => s.date && new Date(s.date).toISOString().split('T')[0] === instanceDate
      );
      if (matchingSession) {
        sessionData = {
          status: matchingSession.status || "scheduled",
          notes: matchingSession.notes || "",
          instructor: matchingSession['S-instructor'] || "",
        };
      }
    }
    
    setEditForm({
      class_id: typeof schedule.class_id === 'string' ? schedule.class_id : schedule.class_id._id,
      date: instanceDate,
      start_time: schedule.start_time || "",
      end_time: schedule.end_time || "",
      days_of_week: daysAsStrings,
      recurring: schedule.recurring || false,
      recurrence_end_date: schedule.recurrence_end_date ? schedule.recurrence_end_date.split('T')[0] : "",
      ...sessionData,
    });
    setEditDialogOpen(true);
  }

  function openDeleteDialog(schedule: Schedule) {
    setSelectedSchedule(schedule);
    setDeleteDialogOpen(true);
  }

  async function openSummaryDialog(schedule: Schedule) {
    setSummarySchedule(schedule);
    setSummaryDialogOpen(true);
    setSummaryAttendance([]);
    setSummaryLoading(true);
    try {
      const api = createApiClient((session as any)?.accessToken);
      const attendanceData = await api.get(`/api/attendance/class/${schedule._id}`);
      const attendanceList: AttendanceRecord[] = attendanceData.data || [];
      const scheduleDate = isoDatePart(schedule.date);
      const filtered = filterAttendanceForScheduleDate(attendanceList, scheduleDate);
      setSummaryAttendance(filtered);
    } catch {
      setSummaryAttendance([]);
    } finally {
      setSummaryLoading(false);
    }
  }

  function openInstructorDialog(name: string) {
    setInstructorName(name);
    setInstructorDialogOpen(true);
  }

  function getClassName(classId: ClassInfo | string): string {
    if (typeof classId === 'object') return classId.name;
    const cls = classes.find(c => c._id === classId);
    return cls?.name || classId;
  }

  function getInstructorName(classId: ClassInfo | string, schedule: Schedule): string {
    // Check if there's a session-specific S-instructor for this date
    const scheduleDate = schedule.date.split('T')[0];
    const session = schedule.sessions?.find(s => s.date.split('T')[0] === scheduleDate);
    
    const sInstructor = session?.['S-instructor']?.trim();
    if (sInstructor) {
      return sInstructor;
    }
    
    // Fall back to class instructor
    if (typeof classId === 'object') return classId.instructor || 'N/A';
    const cls = classes.find(c => c._id === classId);
    return cls?.instructor || 'N/A';
  }

  function getDayOfWeekName(dateString: string): string {
    const date = new Date(dateString);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[date.getDay()];
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-muted-foreground mt-1">View and manage class schedules</p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Schedule Class</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleCreateSchedule}>
              <DialogHeader>
                <DialogTitle>Schedule New Class</DialogTitle>
                <DialogDescription>Schedule a class session.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Class *</label>
                  <Select value={createForm.class_id} onValueChange={(value) => setCreateForm({ ...createForm, class_id: value })}>
                    <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls._id} value={cls._id}>{cls.name} - {cls.instructor}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date *</label>
                  <Input type="date" value={createForm.date} onChange={(e) => setCreateForm({ ...createForm, date: e.target.value })} required />
                </div>
                
                {/* Start Time and End Time on same row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Start Time *</label>
                    <Input type="time" value={createForm.start_time} onChange={(e) => setCreateForm({ ...createForm, start_time: e.target.value })} required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">End Time *</label>
                    <Input type="time" value={createForm.end_time} onChange={(e) => setCreateForm({ ...createForm, end_time: e.target.value })} required />
                  </div>
                </div>

                {/* Recurring checkbox */}
                <div>
                  <label className="flex items-center">
                    <input type="checkbox" checked={createForm.recurring} onChange={(e) => setCreateForm({ ...createForm, recurring: e.target.checked })} className="mr-2" />
                    Recurring Weekly
                  </label>
                </div>

                {/* Days of Week - only show if recurring */}
                {createForm.recurring && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Days of Week *</label>
                    <div className="grid grid-cols-2 gap-2 border rounded-md p-3 bg-gray-50">
                      {daysOfWeek.map((day) => (
                        <div key={day.value} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`create-day-${day.value}`}
                            checked={createForm.days_of_week.includes(day.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCreateForm({
                                  ...createForm,
                                  days_of_week: [...createForm.days_of_week, day.value],
                                });
                              } else {
                                setCreateForm({
                                  ...createForm,
                                  days_of_week: createForm.days_of_week.filter((d) => d !== day.value),
                                });
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <label htmlFor={`create-day-${day.value}`} className="text-sm cursor-pointer">
                            {day.label}
                          </label>
                        </div>
                      ))}
                    </div>
                    {createForm.days_of_week.length > 0 ? (
                      <p className="text-sm text-gray-600 mt-1">
                        Selected: {createForm.days_of_week.map(d => daysOfWeek.find(day => day.value === d)?.label).join(", ")}
                      </p>
                    ) : (
                      <p className="text-sm text-red-500 mt-1">
                        Please select at least one day
                      </p>
                    )}
                  </div>
                )}

                {/* Show date range when recurring is checked */}
                {createForm.recurring && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Recurrence End Date *</label>
                    <Input 
                      type="date" 
                      value={createForm.recurrence_end_date} 
                      onChange={(e) => setCreateForm({ ...createForm, recurrence_end_date: e.target.value })} 
                      required 
                      min={createForm.date}
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Classes will repeat weekly from {createForm.date} to {createForm.recurrence_end_date || '...'}
                    </p>
                  </div>
                )}
              </div>
              {error && (
                <div className="px-6 py-2">
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Schedule Class</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && <Card className="p-4 bg-red-50 border-red-200"><p className="text-red-600">{error}</p></Card>}

      <Card className="p-4">
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

      {loading ? (
        <Card className="p-8 text-center"><div className="text-muted-foreground">Loading schedules...</div></Card>
      ) : schedules.length === 0 ? (
        <Card className="p-8 text-center">
          <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <div className="text-muted-foreground">No classes scheduled in this date range.</div>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Attendees</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule, index) => {
                const scheduleDate = schedule.date.split('T')[0];
                const attendanceKey = `${schedule._id}-${scheduleDate}`;
                return (
                  <TableRow key={`${schedule._id}-${scheduleDate}-${index}`}>
                    <TableCell
                      className="cursor-pointer hover:text-primary hover:underline"
                      onClick={() => openSummaryDialog(schedule)}
                    >
                      {new Date(schedule.date).toLocaleDateString('sv-SE')}
                    </TableCell>
                    <TableCell
                      className="cursor-pointer hover:text-primary hover:underline"
                      onClick={() => openSummaryDialog(schedule)}
                    >
                      {getDayOfWeekName(schedule.date)}
                    </TableCell>
                    <TableCell
                      className="font-medium cursor-pointer hover:text-primary hover:underline"
                      onClick={() => openSummaryDialog(schedule)}
                    >
                      {schedule.start_time} - {schedule.end_time}
                    </TableCell>
                    <TableCell>{getClassName(schedule.class_id)}</TableCell>
                    <TableCell
                      className="cursor-pointer hover:text-primary hover:underline"
                      onClick={() => openInstructorDialog(getInstructorName(schedule.class_id, schedule))}
                    >
                      {getInstructorName(schedule.class_id, schedule)}
                    </TableCell>
                    <TableCell className="text-center">{attendanceCounts[attendanceKey] || 0}</TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/attendance/${schedule._id}?date=${scheduleDate}`}
                        className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium hover:opacity-80 transition-opacity ${
                          schedule.status === 'completed' ? 'bg-green-100 text-green-800' :
                          schedule.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          schedule.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {schedule.status}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(schedule)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(schedule)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleEditSchedule}>
            <DialogHeader>
              <DialogTitle>Edit Schedule</DialogTitle>
              <DialogDescription>
                {(selectedSchedule as any)?._isRecurringInstance 
                  ? "Update this session only (not the entire recurring schedule)"
                  : "Update schedule information."}
              </DialogDescription>
            </DialogHeader>
            
            {/* Message for recurring instances */}
            {(selectedSchedule as any)?._isRecurringInstance && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Single Session Edit:</strong> Changes made here will only affect this individual occurrence, not the entire recurring series.
                </p>
              </div>
            )}
            
            <div className="space-y-4 py-4">
              <div>
                <label className="block text-sm font-medium mb-1">Class *</label>
                <Select value={editForm.class_id} onValueChange={(value) => setEditForm({ ...editForm, class_id: value })} disabled={(selectedSchedule as any)?._isRecurringInstance}>
                  <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => <SelectItem key={cls._id} value={cls._id}>{cls.name} - {cls.instructor}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date *</label>
                <Input 
                  type="date" 
                  value={editForm.date} 
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} 
                  disabled={(selectedSchedule as any)?._isRecurringInstance}
                  required 
                />
              </div>
              
              {/* Start Time and End Time on same row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Time *</label>
                  <Input 
                    type="time" 
                    value={editForm.start_time} 
                    onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })} 
                    disabled={(selectedSchedule as any)?._isRecurringInstance}
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Time *</label>
                  <Input 
                    type="time" 
                    value={editForm.end_time} 
                    onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })} 
                    disabled={(selectedSchedule as any)?._isRecurringInstance}
                    required 
                  />
                </div>
              </div>

              {/* For recurring instances, show session-specific fields */}
              {(selectedSchedule as any)?._isRecurringInstance ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Session Status</label>
                    <Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}>
                      <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Session Notes</label>
                    <Input 
                      type="text" 
                      value={editForm.notes} 
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="Add notes for this session"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Session Instructor (Override)</label>
                    <Input 
                      type="text" 
                      value={editForm.instructor} 
                      onChange={(e) => setEditForm({ ...editForm, instructor: e.target.value })}
                      placeholder="Leave empty to use default"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Recurring checkbox */}
                  <div>
                    <label className="flex items-center">
                      <input type="checkbox" checked={editForm.recurring} onChange={(e) => setEditForm({ ...editForm, recurring: e.target.checked })} className="mr-2" />
                      Recurring Weekly
                    </label>
                  </div>

                  {/* Days of Week - only show if recurring */}
                  {editForm.recurring && (
                   <div>
                     <label className="block text-sm font-medium mb-2">Days of Week *</label>
                     <div className="grid grid-cols-2 gap-2 border rounded-md p-3 bg-gray-50">
                       {daysOfWeek.map((day) => (
                         <div key={day.value} className="flex items-center space-x-2">
                           <input
                             type="checkbox"
                             id={`edit-day-${day.value}`}
                             checked={editForm.days_of_week.includes(day.value)}
                             onChange={(e) => {
                               if (e.target.checked) {
                                 setEditForm({
                                   ...editForm,
                                   days_of_week: [...editForm.days_of_week, day.value],
                                 });
                               } else {
                                 setEditForm({
                                   ...editForm,
                                   days_of_week: editForm.days_of_week.filter((d) => d !== day.value),
                                 });
                               }
                             }}
                             className="w-4 h-4 rounded border-gray-300"
                           />
                           <label htmlFor={`edit-day-${day.value}`} className="text-sm cursor-pointer">
                             {day.label}
                           </label>
                         </div>
                       ))}
                     </div>
                     {editForm.days_of_week.length > 0 ? (
                       <p className="text-sm text-gray-600 mt-1">
                         Selected: {editForm.days_of_week.map(d => daysOfWeek.find(day => day.value === d)?.label).join(", ")}
                       </p>
                     ) : (
                       <p className="text-sm text-red-500 mt-1">
                         Please select at least one day
                       </p>
                     )}
                   </div>
                 )}

                 {/* Note about status management */}
                 {editForm.recurring && (
                   <div className="bg-blue-50 border border-blue-200 rounded p-3">
                     <p className="text-sm text-blue-800">
                       <strong>Note:</strong> For recurring schedules, status is managed per session when taking attendance. 
                       Each occurrence can have its own status (scheduled, completed, cancelled).
                     </p>
                   </div>
                 )}

                 {/* Show date range when recurring is checked */}
                 {editForm.recurring && (
                   <div>
                     <label className="block text-sm font-medium mb-1">Recurrence End Date *</label>
                     <Input 
                       type="date" 
                       value={editForm.recurrence_end_date} 
                       onChange={(e) => setEditForm({ ...editForm, recurrence_end_date: e.target.value })} 
                       required 
                       min={editForm.date}
                     />
                     <p className="text-sm text-gray-500 mt-1">
                       Classes will repeat weekly from {editForm.date} to {editForm.recurrence_end_date || '...'}
                     </p>
                   </div>
                 )}
               </>
              )}
            </div>
            {error && (
              <div className="px-6 py-2">
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Schedule</DialogTitle>
            <DialogDescription>
              {(selectedSchedule as any)?._isRecurringInstance
                ? "Delete this session only (not the entire recurring schedule)"
                : "Are you sure you want to delete this scheduled class? This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          {(selectedSchedule as any)?._isRecurringInstance && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
              <p className="text-sm text-blue-800">
                <strong>Single Session Deletion:</strong> Only this individual occurrence will be removed from the recurring series.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteSchedule}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session Summary Dialog */}
      <Dialog open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Sessionssammanfattning
            </DialogTitle>
            {summarySchedule && (
              <DialogDescription>
                {getClassName(summarySchedule.class_id)} &mdash; {new Date(summarySchedule.date).toLocaleDateString('sv-SE')}
              </DialogDescription>
            )}
          </DialogHeader>
          {summarySchedule && (
            <div className="space-y-4 py-2">
              {/* Basic info grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-2">
                  <CalendarIcon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Datum</p>
                    <p className="font-medium">{new Date(summarySchedule.date).toLocaleDateString('sv-SE')}</p>
                    <p className="text-muted-foreground">{getDayOfWeekName(summarySchedule.date)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Tid</p>
                    <p className="font-medium">{summarySchedule.start_time} &ndash; {summarySchedule.end_time}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Klass</p>
                    <p className="font-medium">{getClassName(summarySchedule.class_id)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Instruktör</p>
                    <p className="font-medium">{getInstructorName(summarySchedule.class_id, summarySchedule)}</p>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                  summarySchedule.status === 'completed' ? 'bg-green-100 text-green-800' :
                  summarySchedule.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                  summarySchedule.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>{summarySchedule.status}</span>
              </div>

              {/* Session notes */}
              {(() => {
                const sd = summarySchedule.date.split('T')[0];
                const sess = summarySchedule.sessions?.find(s => s.date.split('T')[0] === sd);
                return sess?.notes ? (
                  <div className="rounded-md border p-3 bg-muted/40 text-sm">
                    <p className="text-xs text-muted-foreground mb-1">Anteckningar</p>
                    <p>{sess.notes}</p>
                  </div>
                ) : null;
              })()}

              {/* Attendance list */}
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  Närvaro
                </p>
                {summaryLoading ? (
                  <p className="text-sm text-muted-foreground">Hämtar närvaro...</p>
                ) : summaryAttendance.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ingen närvaro registrerad.</p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Elev</th>
                          <th className="text-left px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...summaryAttendance].sort((a, b) => {
                            const order: Record<string, number> = { present: 0, late: 1, excused: 2, absent: 3 };
                            return (order[a.status] ?? 4) - (order[b.status] ?? 4);
                          }).map((a) => (
                          <tr key={a._id} className="border-t">
                            <td className="px-3 py-2">{a.student?.name || '—'}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                a.status === 'present' ? 'bg-green-100 text-green-800' :
                                a.status === 'absent' ? 'bg-red-100 text-red-800' :
                                a.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                                a.status === 'excused' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>{a.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-3 py-2 bg-muted/30 text-xs text-muted-foreground border-t">
                      {summaryAttendance.filter(a => a.status === 'present').length} av {summaryAttendance.length} närvarande
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSummaryDialogOpen(false)}>Stäng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Instructor Sessions Dialog */}
      <Dialog open={instructorDialogOpen} onOpenChange={setInstructorDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Sessions för {instructorName}
            </DialogTitle>
            <DialogDescription>
              Alla sessioner inom valt datumintervall för denna instruktör.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {(() => {
              const instructorSessions = schedules.filter(
                (s) => getInstructorName(s.class_id, s) === instructorName
              ).sort((a, b) => a.date.localeCompare(b.date));

              if (instructorSessions.length === 0) {
                return <p className="text-sm text-muted-foreground">Inga sessioner hittades.</p>;
              }

              return (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Datum</th>
                        <th className="text-left px-3 py-2 font-medium">Dag</th>
                        <th className="text-left px-3 py-2 font-medium">Tid</th>
                        <th className="text-left px-3 py-2 font-medium">Klass</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {instructorSessions.map((s, i) => {
                        const sd = s.date.split('T')[0];
                        return (
                          <tr key={`${s._id}-${sd}-${i}`} className="border-t">
                            <td
                              className="px-3 py-2 cursor-pointer hover:text-primary hover:underline"
                              onClick={() => { setInstructorDialogOpen(false); openSummaryDialog(s); }}
                            >
                              {new Date(s.date).toLocaleDateString('sv-SE')}
                            </td>
                            <td
                              className="px-3 py-2 cursor-pointer hover:text-primary hover:underline"
                              onClick={() => { setInstructorDialogOpen(false); openSummaryDialog(s); }}
                            >
                              {getDayOfWeekName(s.date)}
                            </td>
                            <td
                              className="px-3 py-2 cursor-pointer hover:text-primary hover:underline"
                              onClick={() => { setInstructorDialogOpen(false); openSummaryDialog(s); }}
                            >
                              {s.start_time} – {s.end_time}
                            </td>
                            <td className="px-3 py-2">{getClassName(s.class_id)}</td>
                            <td className="px-3 py-2">
                              <Link
                                href={`/dashboard/attendance/${s._id}?date=${sd}`}
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium hover:opacity-80 transition-opacity ${
                                  s.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  s.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                  s.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}
                                onClick={() => setInstructorDialogOpen(false)}
                              >
                                {s.status}
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 bg-muted/30 text-xs text-muted-foreground border-t">
                    {instructorSessions.length} session{instructorSessions.length !== 1 ? 'er' : ''}
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstructorDialogOpen(false)}>Stäng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
