"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { createApiClient } from "@/lib/api";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Trash2, Edit, Plus, Calendar as CalendarIcon } from "lucide-react";

type ClassInfo = {
  _id: string;
  name: string;
  instructor: string;
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
};

type Class = {
  _id: string;
  name: string;
  instructor: string;
};

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getTwoWeeksBack() {
  const date = new Date();
  date.setDate(date.getDate() - 14);
  return date.toISOString().slice(0, 10);
}

function getTwoWeeksForward() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(getTwoWeeksBack());
  const [endDate, setEndDate] = useState(getTwoWeeksForward());

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

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
  });

  const daysOfWeek = [
    { value: "monday", label: "Monday", number: 1 },
    { value: "tuesday", label: "Tuesday", number: 2 },
    { value: "wednesday", label: "Wednesday", number: 3 },
    { value: "thursday", label: "Thursday", number: 4 },
    { value: "friday", label: "Friday", number: 5 },
    { value: "saturday", label: "Saturday", number: 6 },
    { value: "sunday", label: "Sunday", number: 0 },
  ];

  const statusOptions = [
    { value: "scheduled", label: "Scheduled" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

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
      setSchedules(data.data || []);
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
      console.error("Failed to fetch classes:", e);
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
      const daysAsNumbers = createForm.recurring 
        ? createForm.days_of_week.map(day => 
            daysOfWeek.find(d => d.value === day)?.number ?? 0
          )
        : [new Date(createForm.date).getDay()]; // For non-recurring, use the actual day of the date
      
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
      // Remove class_id from update payload - it's not allowed in updates
      const { class_id, ...updateData } = editForm;
      // Convert day strings to numbers (only if recurring)
      const daysAsNumbers = editForm.recurring
        ? editForm.days_of_week.map(day => 
            daysOfWeek.find(d => d.value === day)?.number ?? 0
          )
        : [new Date(editForm.date).getDay()]; // For non-recurring, use the actual day of the date
      
      const payload = { ...updateData, days_of_week: daysAsNumbers };
      const data = await api.put(`/api/schedules/${selectedSchedule._id}`, payload);
      setSchedules((prev) =>
        prev.map((s) => (s._id === selectedSchedule._id ? data.data : s))
      );
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
      await api.delete(`/api/schedules/${selectedSchedule._id}`);
      setSchedules((prev) => prev.filter((s) => s._id !== selectedSchedule._id));
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
    let daysAsStrings: string[] = [];
    if (schedule.days_of_week) {
      daysAsStrings = schedule.days_of_week.map(day => {
        if (typeof day === 'number') {
          return daysOfWeek.find(d => d.number === day)?.value || '';
        }
        return day;
      }).filter(d => d);
    } else if (schedule.day_of_week) {
      daysAsStrings = [schedule.day_of_week];
    }
    
    setEditForm({
      class_id: typeof schedule.class_id === 'string' ? schedule.class_id : schedule.class_id._id,
      date: schedule.date ? schedule.date.split('T')[0] : "",
      start_time: schedule.start_time || "",
      end_time: schedule.end_time || "",
      days_of_week: daysAsStrings,
      recurring: schedule.recurring || false,
      recurrence_end_date: schedule.recurrence_end_date ? schedule.recurrence_end_date.split('T')[0] : "",
    });
    setEditDialogOpen(true);
  }

  function openDeleteDialog(schedule: Schedule) {
    setSelectedSchedule(schedule);
    setDeleteDialogOpen(true);
  }

  function getClassName(classId: ClassInfo | string): string {
    if (typeof classId === 'object') return classId.name;
    const cls = classes.find(c => c._id === classId);
    return cls?.name || classId;
  }

  function getInstructorName(classId: ClassInfo | string): string {
    if (typeof classId === 'object') return classId.instructor;
    const cls = classes.find(c => c._id === classId);
    return cls?.instructor || 'N/A';
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
                <TableHead>Time</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Day</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule, index) => (
                <TableRow key={`${schedule._id}-${schedule.date}-${index}`}>
                  <TableCell>{new Date(schedule.date).toLocaleDateString('sv-SE')}</TableCell>
                  <TableCell className="font-medium">{schedule.start_time} - {schedule.end_time}</TableCell>
                  <TableCell>{getClassName(schedule.class_id)}</TableCell>
                  <TableCell>{getInstructorName(schedule.class_id)}</TableCell>
                  <TableCell className="capitalize">
                    {schedule.days_of_week && schedule.days_of_week.length > 0
                      ? schedule.days_of_week.map(d => daysOfWeek.find(day => day.value === d)?.label || d).join(", ")
                      : schedule.day_of_week || "-"}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      schedule.status === 'completed' ? 'bg-green-100 text-green-800' :
                      schedule.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      schedule.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>{schedule.status}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(schedule)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(schedule)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleEditSchedule}>
            <DialogHeader>
              <DialogTitle>Edit Schedule</DialogTitle>
              <DialogDescription>Update schedule information.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="block text-sm font-medium mb-1">Class *</label>
                <Select value={editForm.class_id} onValueChange={(value) => setEditForm({ ...editForm, class_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => <SelectItem key={cls._id} value={cls._id}>{cls.name} - {cls.instructor}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date *</label>
                <Input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} required />
              </div>
              
              {/* Start Time and End Time on same row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Time *</label>
                  <Input type="time" value={editForm.start_time} onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Time *</label>
                  <Input type="time" value={editForm.end_time} onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })} required />
                </div>
              </div>

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
            <DialogDescription>Are you sure you want to delete this scheduled class? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteSchedule}>Delete Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
