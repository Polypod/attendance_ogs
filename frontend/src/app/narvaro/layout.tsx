import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Närvarokiosk",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AttendanceKioskLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
