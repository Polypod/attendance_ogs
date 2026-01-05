"use client";

import { useEffect, useState } from "react";

type Student = {
  _id: string;
  name: string;
  category: string;
  email?: string;
};

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [email, setEmail] = useState("");

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
          category,
          email,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to add student");
      }
      // Refresh student list
      const data = await res.json();
      setStudents((prev) => [...prev, data.student]);
      setName("");
      setCategory("");
      setEmail("");
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
          <label htmlFor="student-name" className="block font-medium">Name</label>
          <input id="student-name" className="border rounded px-2 py-1 w-full" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="student-category" className="block font-medium">Category</label>
          <input id="student-category" className="border rounded px-2 py-1 w-full" value={category} onChange={e => setCategory(e.target.value)} />
        </div>
        <div>
          <label htmlFor="student-email" className="block font-medium">Email</label>
          <input id="student-email" className="border rounded px-2 py-1 w-full" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded mt-2" type="submit">Add Student</button>
      </form>
      {error && <div className="text-red-600 mb-4">{error}</div>}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table className="min-w-full border">
          <thead>
            <tr>
              <th className="border px-2 py-1">Name</th>
              <th className="border px-2 py-1">Category</th>
              <th className="border px-2 py-1">Email</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student._id}>
                <td className="border px-2 py-1">{student.name}</td>
                <td className="border px-2 py-1">{student.category}</td>
                <td className="border px-2 py-1">{student.email || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
