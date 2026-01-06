"use client";

import { useEffect, useState } from "react";
import { useConfig } from "@/hooks/useConfig";

type Student = {
  _id: string;
  name: string;
  categories: string[]; // Array of categories
  belt_level: string;
  email?: string;
  phone?: string;
};

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch config for dropdowns
  const { config, loading: configLoading } = useConfig();

  // Form state
  const [name, setName] = useState("");
  const [categories, setCategories] = useState<string[]>([]); // Changed to array
  const [beltLevel, setBeltLevel] = useState(""); // NEW
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Fetch students
  useEffect(() => {
    async function fetchStudents() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("http://localhost:3000/api/students");
        if (!res.ok) throw new Error("Failed to fetch students");
        const data = await res.json();
        setStudents(data.students || []);
      } catch (e: unknown) {
        if (e instanceof Error) setError(e.message);
        else setError("Unknown error");
      }
      setLoading(false);
    }
    fetchStudents();
  }, []);

  // Add student
  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("http://localhost:3000/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          categories, // Now an array
          belt_level: beltLevel,
          email,
          phone: phone || "000-000-0000", // Placeholder if not provided
          emergency_contact: {
            name: "Emergency Contact",
            phone: "000-000-0000"
          }
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to add student");
      }
      const data = await res.json();
      setStudents((prev) => [...prev, data.student]);
      setName("");
      setCategories([]);
      setBeltLevel("");
      setEmail("");
      setPhone("");
    } catch (e: unknown) {
      if (e instanceof Error) setError(e.message);
      else setError("Unknown error");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Students</h1>

      <form className="mb-6 flex flex-col gap-2 max-w-md" onSubmit={handleAddStudent}>
        <div>
          <label htmlFor="student-name" className="block font-medium">
            Name
          </label>
          <input
            id="student-name"
            className="border rounded px-2 py-1 w-full"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="student-categories" className="block font-medium">
            Categories (hold Ctrl/Cmd to select multiple)
          </label>
          <select
            id="student-categories"
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
          <label htmlFor="student-belt-level" className="block font-medium">
            Belt Level
          </label>
          <select
            id="student-belt-level"
            className="border rounded px-2 py-1 w-full"
            value={beltLevel}
            onChange={(e) => setBeltLevel(e.target.value)}
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
          <label htmlFor="student-email" className="block font-medium">
            Email
          </label>
          <input
            id="student-email"
            className="border rounded px-2 py-1 w-full"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="student-phone" className="block font-medium">
            Phone
          </label>
          <input
            id="student-phone"
            className="border rounded px-2 py-1 w-full"
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Optional"
          />
        </div>

        <button
          className="bg-blue-600 text-white px-4 py-2 rounded mt-2 disabled:bg-gray-400"
          type="submit"
          disabled={configLoading}
        >
          Add Student
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
              <th className="border px-2 py-1">Belt Level</th>
              <th className="border px-2 py-1">Email</th>
              <th className="border px-2 py-1">Phone</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student._id}>
                <td className="border px-2 py-1">{student.name}</td>
                <td className="border px-2 py-1">
                  {student.categories?.join(", ") || "N/A"}
                </td>
                <td className="border px-2 py-1">
                  {config?.beltLevels.find(b => b.value === student.belt_level)?.label || student.belt_level}
                </td>
                <td className="border px-2 py-1">{student.email || ""}</td>
                <td className="border px-2 py-1">{student.phone || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
