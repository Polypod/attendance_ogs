"use client";

import { ReactNode } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "next-auth/react";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "instructor", "staff", "student"] },
  { href: "/dashboard/students", label: "Students", roles: ["admin", "instructor", "staff"] },
  { href: "/dashboard/classes", label: "Classes", roles: ["admin", "instructor", "staff", "student"] },
  { href: "/dashboard/calendar", label: "Calendar", roles: ["admin", "instructor", "staff", "student"] },
  { href: "/dashboard/users", label: "Users", roles: ["admin"] },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, isAdmin, isInstructor, isStaff, isStudent } = useAuth();

  // Filter nav links based on user role
  const filteredNavLinks = navLinks.filter(link =>
    user && link.roles.includes(user.role)
  );

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="flex min-h-screen bg-muted">
      {/* Sidebar for desktop/tablet */}
      <aside className="hidden md:flex flex-col w-64 bg-background border-r border-border p-4">
        <div className="mb-8 flex items-center gap-2">
          <span className="font-bold text-xl tracking-tight">Karate Attendance</span>
        </div>
        <nav className="flex-1 flex flex-col gap-2">
          {filteredNavLinks.map((link) => (
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
        <div className="mt-auto border-t border-border pt-4 space-y-2">
          <div className="flex items-center gap-3 px-3">
            <Avatar>
              <span className="text-xs">{user?.name?.[0]?.toUpperCase() || "U"}</span>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || "User"}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role || "Role"}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
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
              {filteredNavLinks.map((link) => (
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
            <div className="mt-auto border-t border-border pt-4 px-4 space-y-2">
              <div className="flex items-center gap-3">
                <Avatar>
                  <span className="text-xs">{user?.name?.[0]?.toUpperCase() || "U"}</span>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name || "User"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role || "Role"}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="w-full justify-start"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        <span className="ml-2 font-bold text-lg">Karate Attendance</span>
        <div className="ml-auto flex items-center gap-2">
          <Avatar>
            <span className="text-xs">{user?.name?.[0]?.toUpperCase() || "U"}</span>
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
