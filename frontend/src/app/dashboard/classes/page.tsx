"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Class = {
  _id: string;
  name: string;
  category: string[];
  instructor: string;
  startTime: string;
  endTime: string;
};

export default function ClassesPage() {
  const { data: session, status } = useSession();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [instructor, setInstructor] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

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
          category: category.split(",").map((c) => c.trim()),
          instructor,
          startTime,
          endTime,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to add class");
      }
      // Refresh class list
      const data = await res.json();
      setClasses((prev) => [...prev, data.class]);
      setName("");
      setCategory("");
      setInstructor("");
      setStartTime("");
      setEndTime("");
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
          <label htmlFor="class-name" className="block font-medium">Name</label>
          <input id="class-name" className="border rounded px-2 py-1 w-full" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="class-category" className="block font-medium">Category (comma separated)</label>
          <input id="class-category" className="border rounded px-2 py-1 w-full" value={category} onChange={e => setCategory(e.target.value)} />
        </div>
        <div>
          <label htmlFor="class-instructor" className="block font-medium">Instructor</label>
          <input id="class-instructor" className="border rounded px-2 py-1 w-full" value={instructor} onChange={e => setInstructor(e.target.value)} />
        </div>
        <div>
          <label htmlFor="class-start-time" className="block font-medium">Start Time</label>
          <input id="class-start-time" className="border rounded px-2 py-1 w-full" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
        </div>
        <div>
          <label htmlFor="class-end-time" className="block font-medium">End Time</label>
          <input id="class-end-time" className="border rounded px-2 py-1 w-full" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded mt-2" type="submit">Add Class</button>
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
              <th className="border px-2 py-1">Instructor</th>
              <th className="border px-2 py-1">Start</th>
              <th className="border px-2 py-1">End</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((cls) => (
              <tr key={cls._id}>
                <td className="border px-2 py-1">{cls.name}</td>
                <td className="border px-2 py-1">{cls.category.join(", ")}</td>
                <td className="border px-2 py-1">{cls.instructor}</td>
                <td className="border px-2 py-1">{cls.startTime}</td>
                <td className="border px-2 py-1">{cls.endTime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
