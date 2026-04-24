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
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Trash2, Edit, Plus } from "lucide-react";
import {
  buildClassFormFromClass,
  extractClassesFromApiResponse,
  formatCategoriesForDisplay,
  toggleCategorySelection,
} from "./classHelpers";

type Class = {
  _id: string;
  name: string;
  description: string;
  categories: string[];
  instructor: string;
  max_capacity: number;
  duration_minutes: number;
};

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const { config } = useConfig();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);

  // Form states for create class
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    categories: [] as string[],
    instructor: "",
    max_capacity: 20,
    duration_minutes: 60,
  });

  // Form states for edit class
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    categories: [] as string[],
    instructor: "",
    max_capacity: 20,
    duration_minutes: 60,
  });

  // Fetch classes
  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      fetchClasses();
    } else if (status === 'unauthenticated') {
      setLoading(false);
      setError('Not authenticated');
    }
  }, [status, session]);

  async function fetchClasses() {
    if (!session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const api = createApiClient((session as any)?.accessToken);
      const data = await api.get("/api/classes");
      setClasses(extractClassesFromApiResponse(data));
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("Failed to fetch classes");
    } finally {
      setLoading(false);
    }
  }

  // Create class
  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken) return;
    setError(null);
    try {
      const api = createApiClient((session as any)?.accessToken);
      const data = await api.post("/api/classes", createForm);
      setClasses((prev) => [...prev, data.data]);
      setCreateDialogOpen(false);
      setCreateForm({
        name: "",
        description: "",
        categories: [],
        instructor: "",
        max_capacity: 20,
        duration_minutes: 60,
      });
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("Failed to create class");
    }
  }

  // Edit class
  async function handleEditClass(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClass || !session?.accessToken) return;
    setError(null);
    try {
      const api = createApiClient((session as any)?.accessToken);
      const data = await api.put(`/api/classes/${selectedClass._id}`, editForm);
      setClasses((prev) =>
        prev.map((c) => (c._id === selectedClass._id ? data.data : c))
      );
      setEditDialogOpen(false);
      setSelectedClass(null);
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("Failed to update class");
    }
  }

  // Delete class
  async function handleDeleteClass() {
    if (!selectedClass || !session?.accessToken) return;
    setError(null);
    try {
      const api = createApiClient((session as any)?.accessToken);
      await api.delete(`/api/classes/${selectedClass._id}`);
      setClasses((prev) => prev.filter((c) => c._id !== selectedClass._id));
      setDeleteDialogOpen(false);
      setSelectedClass(null);
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("Failed to delete class");
    }
  }

  // Open edit dialog with class data
  function openEditDialog(cls: Class) {
    setSelectedClass(cls);
    setEditForm(buildClassFormFromClass(cls));
    setEditDialogOpen(true);
  }

  // Open delete dialog
  function openDeleteDialog(cls: Class) {
    setSelectedClass(cls);
    setDeleteDialogOpen(true);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Classes</h1>
          <p className="text-muted-foreground mt-1">
            View and manage class definitions
          </p>
        </div>

        {/* Create Class Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Class
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleCreateClass}>
              <DialogHeader>
                <DialogTitle>Create New Class</DialogTitle>
                <DialogDescription>
                  Add a new class definition.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label htmlFor="create-name" className="block text-sm font-medium mb-1">
                    Class Name *
                  </label>
                  <Input
                    id="create-name"
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, name: e.target.value })
                    }
                    required
                    placeholder="Beginner Karate"
                  />
                </div>
                <div>
                  <label htmlFor="create-description" className="block text-sm font-medium mb-1">
                    Description *
                  </label>
                  <Textarea
                    id="create-description"
                    value={createForm.description}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, description: e.target.value })
                    }
                    required
                    placeholder="Description of the class"
                    rows={3}
                  />
                </div>
                <div>
                  <label htmlFor="create-instructor" className="block text-sm font-medium mb-1">
                    Instructor *
                  </label>
                  <Input
                    id="create-instructor"
                    value={createForm.instructor}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, instructor: e.target.value })
                    }
                    required
                    placeholder="Sensei Name"
                  />
                </div>
                <div>
                  <label htmlFor="create-duration" className="block text-sm font-medium mb-1">
                    Duration (minutes) *
                  </label>
                  <Input
                    id="create-duration"
                    type="number"
                    value={createForm.duration_minutes}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, duration_minutes: parseInt(e.target.value) })
                    }
                    required
                    min="15"
                    max="240"
                  />
                </div>
                <div>
                  <label htmlFor="create-capacity" className="block text-sm font-medium mb-1">
                    Max Capacity *
                  </label>
                  <Input
                    id="create-capacity"
                    type="number"
                    value={createForm.max_capacity}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, max_capacity: parseInt(e.target.value) })
                    }
                    required
                    min="1"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Categories *
                  </label>
                  <div className="space-y-2">
                    {config?.categories.map((cat) => (
                      <label key={cat.value} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={createForm.categories.includes(cat.value)}
                          onChange={(e) => {
                            setCreateForm({
                              ...createForm,
                              categories: toggleCategorySelection(
                                createForm.categories,
                                cat.value,
                                e.target.checked
                              ),
                            });
                          }}
                          className="mr-2"
                        />
                        {cat.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Class</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </Card>
      )}

      {loading ? (
        <Card className="p-8 text-center">
          <div className="text-muted-foreground">Loading classes...</div>
        </Card>
      ) : classes.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-muted-foreground">
            No classes found. Create your first class to get started.
          </div>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class Name</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Categories</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((cls) => (
                <TableRow key={cls._id}>
                  <TableCell className="font-medium">{cls.name}</TableCell>
                  <TableCell>{cls.instructor}</TableCell>
                  <TableCell>
                    {formatCategoriesForDisplay(cls.categories)}
                  </TableCell>
                  <TableCell>{cls.duration_minutes} min</TableCell>
                  <TableCell>{cls.max_capacity}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(cls)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(cls)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Edit Class Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleEditClass}>
            <DialogHeader>
              <DialogTitle>Edit Class</DialogTitle>
              <DialogDescription>
                Update class information.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium mb-1">
                  Class Name *
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
                <label htmlFor="edit-description" className="block text-sm font-medium mb-1">
                  Description *
                </label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  required
                  rows={3}
                />
              </div>
              <div>
                <label htmlFor="edit-instructor" className="block text-sm font-medium mb-1">
                  Instructor *
                </label>
                <Input
                  id="edit-instructor"
                  value={editForm.instructor}
                  onChange={(e) =>
                    setEditForm({ ...editForm, instructor: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label htmlFor="edit-duration" className="block text-sm font-medium mb-1">
                  Duration (minutes) *
                </label>
                <Input
                  id="edit-duration"
                  type="number"
                  value={editForm.duration_minutes}
                  onChange={(e) =>
                    setEditForm({ ...editForm, duration_minutes: parseInt(e.target.value) })
                  }
                  required
                  min="15"
                  max="240"
                />
              </div>
              <div>
                <label htmlFor="edit-capacity" className="block text-sm font-medium mb-1">
                  Max Capacity *
                </label>
                <Input
                  id="edit-capacity"
                  type="number"
                  value={editForm.max_capacity}
                  onChange={(e) =>
                    setEditForm({ ...editForm, max_capacity: parseInt(e.target.value) })
                  }
                  required
                  min="1"
                  max="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Categories *
                </label>
                <div className="space-y-2">
                  {config?.categories.map((cat) => (
                    <label key={cat.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editForm.categories.includes(cat.value)}
                        onChange={(e) => {
                          setEditForm({
                            ...editForm,
                            categories: toggleCategorySelection(
                              editForm.categories,
                              cat.value,
                              e.target.checked
                            ),
                          });
                        }}
                        className="mr-2"
                      />
                      {cat.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Class</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedClass?.name}"? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteClass}>
              Delete Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
