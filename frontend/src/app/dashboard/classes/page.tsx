"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useConfig } from "@/hooks/useConfig";

type Class = {
  _id: string;
  name: string;
  categories: string[]; // Changed from category to categories
  description?: string;
  instructor: string;
  max_capacity?: number;
  duration_minutes?: number;
};

export default function ClassesPage() {
  const { data: session, status } = useSession();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch config for dropdowns
  const { config, loading: configLoading } = useConfig();

  // Form state
  const [name, setName] = useState("");
  const [categories, setCategories] = useState<string[]>([]); // Changed to array
  const [description, setDescription] = useState("");
  const [instructor, setInstructor] = useState("");
  const [maxCapacity, setMaxCapacity] = useState("20");
  const [durationMinutes, setDurationMinutes] = useState("60");

  // Helper function to make authenticated requests
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = (session as any)?.accessToken;
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
      ...(token && { Authorization: `Bearer ${token}` })
    };
    return fetch(url, { ...options, headers });
  };

  // Fetch classes
  useEffect(() => {
    if (status !== "authenticated") return;

    async function fetchClasses() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/classes`);
        if (!res.ok) throw new Error("Failed to fetch classes");
        const data = await res.json();
        setClasses(data.classes || []);
      } catch (e: unknown) {
        if (e instanceof Error) setError(e.message);
        else setError("Unknown error");
      }
      setLoading(false);
    }
    fetchClasses();
  }, [session, status]);

  // Add class
  async function handleAddClass(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetchWithAuth(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/classes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          categories, // Array of categories
          description: description || "Class description",
          instructor,
          max_capacity: parseInt(maxCapacity),
          duration_minutes: parseInt(durationMinutes),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to add class");
      }
      const data = await res.json();
      setClasses((prev) => [...prev, data.class]);
      setName("");
      setCategories([]);
      setDescription("");
      setInstructor("");
      setMaxCapacity("20");
      setDurationMinutes("60");
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("Unknown error");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Classes</h1>

      <form className="mb-6 flex flex-col gap-2 max-w-md" onSubmit={handleAddClass}>
        <div>
          <label htmlFor="class-name" className="block font-medium">
            Name
          </label>
          <input
            id="class-name"
            className="border rounded px-2 py-1 w-full"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="class-categories" className="block font-medium">
            Categories (hold Ctrl/Cmd to select multiple)
          </label>
          <select
            id="class-categories"
            className="border rounded px-2 py-1 w-full"
            multiple
            size={4}
            value={categories}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, option => option.value);
              setCategories(selected);
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
          {categories.length > 0 && (
            <p className="text-sm text-gray-600 mt-1">
              Selected: {categories.join(", ")}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="class-description" className="block font-medium">
            Description
          </label>
          <textarea
            id="class-description"
            className="border rounded px-2 py-1 w-full"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            placeholder="Optional"
          />
        </div>

        <div>
          <label htmlFor="class-instructor" className="block font-medium">
            Instructor
          </label>
          <input
            id="class-instructor"
            className="border rounded px-2 py-1 w-full"
            value={instructor}
            onChange={e => setInstructor(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="class-max-capacity" className="block font-medium">
              Max Capacity
            </label>
            <input
              id="class-max-capacity"
              className="border rounded px-2 py-1 w-full"
              type="number"
              min="1"
              max="100"
              value={maxCapacity}
              onChange={e => setMaxCapacity(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="class-duration" className="block font-medium">
              Duration (min)
            </label>
            <input
              id="class-duration"
              className="border rounded px-2 py-1 w-full"
              type="number"
              min="15"
              max="240"
              value={durationMinutes}
              onChange={e => setDurationMinutes(e.target.value)}
              required
            />
          </div>
        </div>

        <button
          className="bg-blue-600 text-white px-4 py-2 rounded mt-2 disabled:bg-gray-400"
          type="submit"
          disabled={configLoading}
        >
          Add Class
        </button>
      </form>

      {error && <div className="text-red-600 mb-4">{error}</div>}

      {(loading || configLoading) ? (
        <div>Loading...</div>
      ) : (
        <table className="min-w-full border">
          <thead>
            <tr>
              <th className="border px-2 py-1">Name</th>
              <th className="border px-2 py-1">Categories</th>
              <th className="border px-2 py-1">Instructor</th>
              <th className="border px-2 py-1">Capacity</th>
              <th className="border px-2 py-1">Duration</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((cls) => (
              <tr key={cls._id}>
                <td className="border px-2 py-1">{cls.name}</td>
                <td className="border px-2 py-1">
                  {cls.categories?.join(", ") || "N/A"}
                </td>
                <td className="border px-2 py-1">{cls.instructor}</td>
                <td className="border px-2 py-1">{cls.max_capacity || "N/A"}</td>
                <td className="border px-2 py-1">{cls.duration_minutes ? `${cls.duration_minutes} min` : "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
