"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Class = {
  _id: string;
  name: string;
  instructor: string;
  category: string[];
  startTime: string;
  endTime: string;
};

type Instructor = {
  name: string;
  classes: Class[];
};

export default function TeachersPage() {
  const { data: session, status } = useSession();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Aggregate instructors
  const instructors: Instructor[] = [];
  const seen = new Set<string>();
  for (const cls of classes) {
    if (cls.instructor && !seen.has(cls.instructor)) {
      instructors.push({
        name: cls.instructor,
        classes: classes.filter((c) => c.instructor === cls.instructor),
      });
      seen.add(cls.instructor);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Teachers</h1>
      {error && <div className="text-red-600 mb-4">{error}</div>}
      {loading ? (
        <div>Loading...</div>
      ) : instructors.length === 0 ? (
        <div>No teachers found. Add a class with an instructor to see teachers here.</div>
      ) : (
        <div className="flex flex-col gap-6">
          {instructors.map((instructor) => (
            <div key={instructor.name} className="border rounded p-4">
              <div className="font-semibold text-lg mb-2">{instructor.name}</div>
              <div>
                <span className="font-medium">Classes:</span>
                <ul className="list-disc ml-6">
                  {instructor.classes.map((cls) => (
                    <li key={cls._id}>
                      {cls.name} ({cls.startTime} - {cls.endTime})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
