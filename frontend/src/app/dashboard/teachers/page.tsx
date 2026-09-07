"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { createApiClient } from "@/lib/api";

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
  const { data: session } = useSession();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.accessToken) return;

    async function fetchClasses() {
      setLoading(true);
      setError(null);
      try {
        const api = createApiClient((session as any)?.accessToken);
        const data = await api.get("/api/classes");
        setClasses(data.classes || data.data || []);
      } catch (e: unknown) {
        if (e instanceof Error) setError(e.message);
        else setError("Failed to fetch classes");
      }
      setLoading(false);
    }
    fetchClasses();
  }, [session]);

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
