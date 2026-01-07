"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { createApiClient } from "@/lib/api";
import { useConfig } from "@/hooks/useConfig";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Edit, Plus } from "lucide-react";

type Student = {
  _id: string;
  name: string;
  categories: string[]; // Array of categories
  belt_level: string;
  email?: string;
  phone?: string;
  emergency_contact?: {
    name?: string;
    phone?: string;
  };
  active?: boolean;
};

export default function StudentsPage() {
  const { data: session, status } = useSession();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  // Fetch config for dropdowns
  const { config, loading: configLoading } = useConfig();

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Form state for create student
  const [createForm, setCreateForm] = useState({
    name: "",
    categories: [] as string[],
    belt_level: "",
    email: "",
    phone: "",
    emergency_contact: {
      name: "",
      phone: "",
    },
    active: true,
  });

  // Form state for edit student (email cannot be changed after creation)
  const [editForm, setEditForm] = useState({
    name: "",
    categories: [] as string[],
    belt_level: "",
    phone: "",
    emergency_contact: {
      name: "",
      phone: "",
    },
    active: true,
  });

  // Fetch students
  useEffect(() => {
    console.log('[Students] useEffect triggered, status:', status, 'session:', session, 'accessToken:', session?.accessToken);
    if (status === 'authenticated' && session?.accessToken) {
      fetchStudents();
    } else if (status === 'unauthenticated') {
      setLoading(false);
      setError('Not authenticated');
    }
  }, [status, session]);

  async function fetchStudents() {
    if (!session?.accessToken) {
      console.log('[Students] No access token, skipping fetch');
      return;
    }
    console.log('[Students] fetchStudents called with token:', (session as any)?.accessToken?.substring(0, 20) + '...');
    setLoading(true);
    setError(null);
    try {
      const api = createApiClient((session as any)?.accessToken);
      console.log('[Students] Calling API...');
      const data = await api.get("/api/students");
      console.log('[Students] API response:', data);
      setStudents(data.data || []);
    } catch (e: unknown) {
      console.error('[Students] Error fetching:', e);
      if (e instanceof Error) setError(e.message);
      else setError("Failed to fetch students");
    } finally {
      console.log('[Students] Fetch complete, setting loading=false');
      setLoading(false);
    }
  }

  // Create student
  async function handleCreateStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;
    setError(null);
    try {
      const api = createApiClient((session as any)?.accessToken);
      // Prepare data and remove empty phone if not provided
      const studentData: any = { ...createForm };
      if (!studentData.phone || studentData.phone.trim() === '') {
        delete studentData.phone;
      }
      // Handle emergency_contact - only send if at least one field is filled
      if (studentData.emergency_contact) {
        const hasName = studentData.emergency_contact.name && studentData.emergency_contact.name.trim() !== '';
        const hasPhone = studentData.emergency_contact.phone && studentData.emergency_contact.phone.trim() !== '';
        
        if (!hasName && !hasPhone) {
          // Both empty, don't send emergency_contact at all
          delete studentData.emergency_contact;
        } else {
          // At least one field has data, but remove empty fields
          if (!hasName) delete studentData.emergency_contact.name;
          if (!hasPhone) delete studentData.emergency_contact.phone;
        }
      }
      const data = await api.post("/api/students", studentData);
      setStudents((prev) => [...prev, data.data]);
      setCreateDialogOpen(false);
      setCreateForm({
        name: "",
        categories: [],
        belt_level: "",
        email: "",
        phone: "",
        emergency_contact: {
          name: "",
          phone: "",
        },
        active: true,
      });
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("Failed to create student");
    }
  }

  // Edit student
  async function handleEditStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent || !session?.accessToken) return;
    setError(null);
    try {
      const api = createApiClient((session as any)?.accessToken);
      // Set phone to null if empty to remove it from database
      const updateData: any = { ...editForm };
      if (!updateData.phone || updateData.phone.trim() === '') {
        updateData.phone = null;
      }
      // Handle emergency_contact - set to null if both fields are empty
      if (updateData.emergency_contact) {
        const hasName = updateData.emergency_contact.name && updateData.emergency_contact.name.trim() !== '';
        const hasPhone = updateData.emergency_contact.phone && updateData.emergency_contact.phone.trim() !== '';
        
        if (!hasName && !hasPhone) {
          // Both empty, set to null to remove from database
          updateData.emergency_contact = null;
        } else {
          // At least one field has data, but set empty fields to null
          if (!hasName) updateData.emergency_contact.name = null;
          if (!hasPhone) updateData.emergency_contact.phone = null;
        }
      }
      const data = await api.put(`/api/students/${selectedStudent._id}`, updateData);
      setStudents((prev) =>
        prev.map((s) => (s._id === selectedStudent._id ? data.data : s))
      );
      setEditDialogOpen(false);
      setSelectedStudent(null);
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("Failed to update student");
    }
  }

  // Delete student
  async function handleDeleteStudent() {
    if (!selectedStudent || !session?.accessToken) return;
    setError(null);
    try {
      const api = createApiClient((session as any)?.accessToken);
      await api.delete(`/api/students/${selectedStudent._id}`);
      setStudents((prev) => prev.filter((s) => s._id !== selectedStudent._id));
      setDeleteDialogOpen(false);
      setSelectedStudent(null);
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("Failed to delete student");
    }
  }

  // Open edit dialog with student data
  function openEditDialog(student: Student) {
    setSelectedStudent(student);
    setEditForm({
      name: student.name,
      categories: student.categories,
      belt_level: student.belt_level,
      phone: student.phone || "",
      emergency_contact: {
        name: student.emergency_contact?.name || "",
        phone: student.emergency_contact?.phone || "",
      },
      active: student.active !== undefined ? student.active : true,
    });
    setEditDialogOpen(true);
  }

  // Open delete dialog
  function openDeleteDialog(student: Student) {
    setSelectedStudent(student);
    setDeleteDialogOpen(true);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Student Management</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage students
          </p>
        </div>

        {/* Create Student Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Student
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleCreateStudent}>
              <DialogHeader>
                <DialogTitle>Create New Student</DialogTitle>
                <DialogDescription>
                  Add a new student to your system
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label htmlFor="create-name" className="block text-sm font-medium mb-1">
                    Name *
                  </label>
                  <Input
                    id="create-name"
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <label htmlFor="create-categories" className="block text-sm font-medium mb-1">
                    Categories * (hold Ctrl/Cmd to select multiple)
                  </label>
                  <select
                    id="create-categories"
                    className="w-full border rounded-md px-3 py-2"
                    multiple
                    size={4}
                    value={createForm.categories}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setCreateForm({ ...createForm, categories: selected });
                    }}
                    required
                    disabled={configLoading}
                  >
                    {config?.categories
                      .sort((a, b) => a.order - b.order)
                      .map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                  </select>
                  {createForm.categories.length > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      Selected: {createForm.categories.join(", ")}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="create-belt-level" className="block text-sm font-medium mb-1">
                    Belt Level *
                  </label>
                  <select
                    id="create-belt-level"
                    className="w-full border rounded-md px-3 py-2"
                    value={createForm.belt_level}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, belt_level: e.target.value })
                    }
                    required
                    disabled={configLoading}
                  >
                    <option value="">Select belt level...</option>
                    {config?.beltLevels
                      .sort((a, b) => a.rank - b.rank)
                      .map((belt) => (
                        <option key={belt.value} value={belt.value}>
                          {belt.label}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="create-email" className="block text-sm font-medium mb-1">
                    Email *
                  </label>
                  <Input
                    id="create-email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, email: e.target.value })
                    }
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">Email is required and cannot be changed later</p>
                </div>

                <div>
                  <label htmlFor="create-phone" className="block text-sm font-medium mb-1">
                    Phone
                  </label>
                  <Input
                    id="create-phone"
                    type="tel"
                    value={createForm.phone}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, phone: e.target.value })
                    }
                    placeholder="Optional"
                  />
                </div>

                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-semibold mb-3">Emergency Contact (Optional)</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="create-emergency-name" className="block text-sm font-medium mb-1">
                        Emergency Contact Name
                      </label>
                      <Input
                        id="create-emergency-name"
                        type="text"
                        value={createForm.emergency_contact.name}
                        onChange={(e) =>
                          setCreateForm({ 
                            ...createForm, 
                            emergency_contact: { 
                              ...createForm.emergency_contact, 
                              name: e.target.value 
                            } 
                          })
                        }
                        placeholder="Optional"
                      />
                    </div>

                    <div>
                      <label htmlFor="create-emergency-phone" className="block text-sm font-medium mb-1">
                        Emergency Contact Phone
                      </label>
                      <Input
                        id="create-emergency-phone"
                        type="tel"
                        value={createForm.emergency_contact.phone}
                        onChange={(e) =>
                          setCreateForm({ 
                            ...createForm, 
                            emergency_contact: { 
                              ...createForm.emergency_contact, 
                              phone: e.target.value 
                            } 
                          })
                        }
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="create-active"
                      checked={createForm.active}
                      onCheckedChange={(checked) =>
                        setCreateForm({ ...createForm, active: checked === true })
                      }
                    />
                    <label
                      htmlFor="create-active"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Active Student
                    </label>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 ml-6">
                    Check this box to mark the student as active (default is checked)
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={configLoading}>
                  Create Student
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </Card>
      )}

      {(loading || configLoading) ? (
        <Card className="p-6">
          <p className="text-center text-muted-foreground">Loading students...</p>
        </Card>
      ) : students.length === 0 ? (
        <Card className="p-6">
          <p className="text-center text-muted-foreground">
            No students found. Create your first student to get started.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="filter-active"
                checked={showOnlyActive}
                onCheckedChange={(checked) => setShowOnlyActive(checked === true)}
              />
              <label
                htmlFor="filter-active"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Show only active students
              </label>
            </div>
          </Card>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Categories</TableHead>
                  <TableHead>Belt Level</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students
                  .filter(student => !showOnlyActive || student.active !== false)
                  .map((student) => (
                <TableRow key={student._id}>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell>
                    {student.categories?.join(", ") || "N/A"}
                  </TableCell>
                  <TableCell>
                    {config?.beltLevels.find(b => b.value === student.belt_level)?.label || student.belt_level}
                  </TableCell>
                  <TableCell>{student.email || "N/A"}</TableCell>
                  <TableCell>{student.phone || "N/A"}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(student)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDeleteDialog(student)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        </div>
      )}

      {/* Edit Student Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleEditStudent}>
            <DialogHeader>
              <DialogTitle>Edit Student</DialogTitle>
              <DialogDescription>
                Update student information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium mb-1">
                  Name *
                </label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <label htmlFor="edit-categories" className="block text-sm font-medium mb-1">
                  Categories * (hold Ctrl/Cmd to select multiple)
                </label>
                <select
                  id="edit-categories"
                  className="w-full border rounded-md px-3 py-2"
                  multiple
                  size={4}
                  value={editForm.categories}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setEditForm({ ...editForm, categories: selected });
                  }}
                  required
                  disabled={configLoading}
                >
                  {config?.categories
                    .sort((a, b) => a.order - b.order)
                    .map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                </select>
                {editForm.categories.length > 0 && (
                  <p className="text-sm text-gray-600 mt-1">
                    Selected: {editForm.categories.join(", ")}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="edit-belt-level" className="block text-sm font-medium mb-1">
                  Belt Level *
                </label>
                <select
                  id="edit-belt-level"
                  className="w-full border rounded-md px-3 py-2"
                  value={editForm.belt_level}
                  onChange={(e) =>
                    setEditForm({ ...editForm, belt_level: e.target.value })
                  }
                  required
                  disabled={configLoading}
                >
                  <option value="">Select belt level...</option>
                  {config?.beltLevels
                    .sort((a, b) => a.rank - b.rank)
                    .map((belt) => (
                      <option key={belt.value} value={belt.value}>
                        {belt.label}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label htmlFor="edit-email" className="block text-sm font-medium mb-1">
                  Email (cannot be changed)
                </label>
                <Input
                  id="edit-email"
                  type="email"
                  value={selectedStudent?.email || ""}
                  disabled
                  className="bg-gray-100"
                />
              </div>

              <div>
                <label htmlFor="edit-phone" className="block text-sm font-medium mb-1">
                  Phone
                </label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={editForm.phone || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                  placeholder="Optional - clear to remove"
                />
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-semibold mb-3">Emergency Contact (Optional)</h3>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="edit-emergency-name" className="block text-sm font-medium mb-1">
                      Emergency Contact Name
                    </label>
                    <Input
                      id="edit-emergency-name"
                      type="text"
                      value={editForm.emergency_contact?.name || ""}
                      onChange={(e) =>
                        setEditForm({ 
                          ...editForm, 
                          emergency_contact: { 
                            name: e.target.value,
                            phone: editForm.emergency_contact?.phone || ""
                          } 
                        })
                      }
                      placeholder="Optional - clear to remove"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-emergency-phone" className="block text-sm font-medium mb-1">
                      Emergency Contact Phone
                    </label>
                    <Input
                      id="edit-emergency-phone"
                      type="tel"
                      value={editForm.emergency_contact?.phone || ""}
                      onChange={(e) =>
                        setEditForm({ 
                          ...editForm, 
                          emergency_contact: { 
                            name: editForm.emergency_contact?.name || "",
                            phone: e.target.value
                          } 
                        })
                      }
                      placeholder="Optional - clear to remove"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-active"
                    checked={editForm.active}
                    onCheckedChange={(checked) =>
                      setEditForm({ ...editForm, active: checked === true })
                    }
                  />
                  <label
                    htmlFor="edit-active"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Active Student
                  </label>
                </div>
                <p className="text-sm text-gray-500 mt-1 ml-6">
                  Uncheck this box to mark the student as inactive
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={configLoading}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Student Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Student</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedStudent?.name}&quot;? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteStudent}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
