"use client";

import { useEffect, useState } from "react";

type Class = {
  _id: string;
  name: string;
  instructor: string;
  category: string[];
  startTime: string; // e.g. "14:00"
  endTime: string;   // e.g. "15:00"
  date?: string;     // optional, if available
};

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayISO());

  useEffect(() => {
    async function fetchClasses() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("http://localhost:3000/api/classes");
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
  }, []);

  // Filter classes by selected date if date is available, otherwise show all
  const filteredClasses = classes.filter(
    (cls) => !cls.date || cls.date === selectedDate
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Calendar</h1>
      <div className="mb-4">
        <label className="font-medium mr-2">Select date:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="border rounded px-2 py-1"
        />
      </div>
      {error && <div className="text-red-600 mb-4">{error}</div>}
      {loading ? (
        <div>Loading...</div>
      ) : filteredClasses.length === 0 ? (
        <div>No classes scheduled for this date.</div>
      ) : (
        <table className="min-w-full border">
          <thead>
            <tr>
              <th className="border px-2 py-1">Time</th>
              <th className="border px-2 py-1">Class</th>
              <th className="border px-2 py-1">Instructor</th>
              <th className="border px-2 py-1">Category</th>
            </tr>
          </thead>
          <tbody>
            {filteredClasses.map((cls) => (
              <tr key={cls._id}>
                <td className="border px-2 py-1">
                  {cls.startTime} - {cls.endTime}
                </td>
                <td className="border px-2 py-1">{cls.name}</td>
                <td className="border px-2 py-1">{cls.instructor}</td>
                <td className="border px-2 py-1">{cls.category.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
