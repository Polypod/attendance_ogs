"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Class = {
  _id: string;
  name: string;
  category: string[];
  instructor: string;
  startTime: string;
  endTime: string;
  isNext: boolean;
};

export default function DashboardPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClasses() {
      setLoading(true);
      try {
        // Replace with your API base URL as needed
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
        const res = await fetch(`${baseUrl}/api/attendance/today`);
        const data = await res.json();
        // Optionally fetch next class and mark it
        const nextRes = await fetch(`${baseUrl}/api/attendance/next-class`);
        const nextData = await nextRes.json();
        const nextId = nextData?.class?._id;
        type ApiClass = {
          _id: string;
          name: string;
          category: string[];
          instructor: string;
          startTime: string;
          endTime: string;
        };
        setClasses(
          data.classes.map((cls: ApiClass) => ({
            ...cls,
            isNext: cls._id === nextId,
          }))
        );
      } catch (e) {
        setClasses([]);
      }
      setLoading(false);
    }
    fetchClasses();
  }, []);

  return (
    <div className="max-w-4xl mx-auto w-full">
      <h1 className="text-2xl font-bold mb-6">Today&#39;s Classes</h1>
      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : classes.length === 0 ? (
        <div className="text-muted-foreground">No classes scheduled for today.</div>
      ) : (
        <Tabs defaultValue="all" className="mb-6">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="next">Next Class</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <div className="flex flex-col gap-4">
              {classes.map((cls) => (
                <Card
                  key={cls._id}
                  className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 border ${
                    cls.isNext ? "border-primary shadow-lg" : ""
                  }`}
                >
                  <div>
                    <div className="font-semibold text-lg">{cls.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {cls.category.join(", ")} &middot; {cls.instructor}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {cls.startTime} - {cls.endTime}
                    </div>
                  </div>
                  <Button
                    className="mt-3 md:mt-0"
                    asChild
                  >
                    <a href={`/attendance?classId=${cls._id}`}>Take Attendance</a>
                  </Button>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="next">
            {classes.filter((cls) => cls.isNext).length === 0 ? (
              <div className="text-muted-foreground">No upcoming class.</div>
            ) : (
              classes
                .filter((cls) => cls.isNext)
                .map((cls) => (
                  <Card
                    key={cls._id}
                    className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border border-primary shadow-lg"
                  >
                    <div>
                      <div className="font-semibold text-lg">{cls.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {cls.category.join(", ")} &middot; {cls.instructor}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {cls.startTime} - {cls.endTime}
                      </div>
                    </div>
                    <Button
                      className="mt-3 md:mt-0"
                      asChild
                    >
                      <a href={`/attendance?classId=${cls._id}`}>Take Attendance</a>
                    </Button>
                  </Card>
                ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
