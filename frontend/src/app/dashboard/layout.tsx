"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { name: "Today", href: "/dashboard" },
  { name: "Classes", href: "/dashboard/classes" },
  { name: "Teachers", href: "/dashboard/teachers" },
  { name: "Students", href: "/dashboard/students" },
  { name: "Calendar", href: "/dashboard/calendar" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-gray-100 dark:bg-gray-900 px-4 py-3 flex gap-4 border-b">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition ${
              pathname === item.href ? "bg-gray-300 dark:bg-gray-700 font-bold" : ""
            }`}
          >
            {item.name}
          </Link>
        ))}
      </nav>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
