"use client";

import { ReactNode } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu } from "lucide-react";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/attendance", label: "Take Attendance" },
  { href: "/past-classes", label: "Past Classes" },
  { href: "/students", label: "Students" },
  { href: "/classes", label: "Classes" },
  { href: "/reports", label: "Reports" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-muted">
      {/* Sidebar for desktop/tablet */}
      <aside className="hidden md:flex flex-col w-64 bg-background border-r border-border p-4">
        <div className="mb-8 flex items-center gap-2">
          <span className="font-bold text-xl tracking-tight">Karate Attendance</span>
        </div>
        <nav className="flex-1 flex flex-col gap-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-base font-medium transition-colors ${
                pathname === link.href
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3">
          <Avatar>
            <span className="sr-only">User avatar</span>
          </Avatar>
          <span className="text-sm font-medium">Teacher</span>
        </div>
      </aside>

      {/* Mobile navigation */}
      <div className="md:hidden fixed top-0 left-0 w-full z-20 bg-background border-b border-border flex items-center h-14 px-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-2">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <div className="p-4">
              <span className="font-bold text-xl tracking-tight">Karate Attendance</span>
            </div>
            <nav className="flex flex-col gap-2 px-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-2 text-base font-medium transition-colors ${
                    pathname === link.href
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
        <span className="ml-2 font-bold text-lg">Karate Attendance</span>
        <div className="ml-auto flex items-center gap-2">
          <Avatar>
            <span className="sr-only">User avatar</span>
          </Avatar>
        </div>
      </div>

      {/* Main content area */}
      <main className="flex-1 flex flex-col p-4 md:ml-64 mt-14 md:mt-0">
        {children}
      </main>
    </div>
  );
}
