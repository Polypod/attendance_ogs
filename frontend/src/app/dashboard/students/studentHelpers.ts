export type EmergencyContactForm = {
  name?: string;
  phone?: string;
};

export type CreateStudentForm = {
  name: string;
  categories: string[];
  belt_level: string;
  email: string;
  phone?: string;
  emergency_contact?: EmergencyContactForm;
  active: boolean;
};

export type EditStudentForm = {
  name: string;
  categories: string[];
  belt_level: string;
  phone?: string;
  emergency_contact?: EmergencyContactForm;
  active: boolean;
};

export function buildCreateStudentPayload(form: CreateStudentForm): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...form };

  const phone = typeof form.phone === "string" ? form.phone.trim() : "";
  if (!phone) {
    delete payload.phone;
  } else {
    payload.phone = phone;
  }

  if (form.emergency_contact) {
    const name = typeof form.emergency_contact.name === "string" ? form.emergency_contact.name.trim() : "";
    const emergencyPhone =
      typeof form.emergency_contact.phone === "string" ? form.emergency_contact.phone.trim() : "";

    const hasName = Boolean(name);
    const hasPhone = Boolean(emergencyPhone);

    if (!hasName && !hasPhone) {
      delete payload.emergency_contact;
    } else {
      const ec: Record<string, unknown> = {};
      if (hasName) ec.name = name;
      if (hasPhone) ec.phone = emergencyPhone;
      payload.emergency_contact = ec;
    }
  }

  return payload;
}

export function buildUpdateStudentPayload(form: EditStudentForm): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...form };

  const phone = typeof form.phone === "string" ? form.phone.trim() : "";
  if (!phone) {
    payload.phone = null;
  } else {
    payload.phone = phone;
  }

  if (form.emergency_contact) {
    const name = typeof form.emergency_contact.name === "string" ? form.emergency_contact.name.trim() : "";
    const emergencyPhone =
      typeof form.emergency_contact.phone === "string" ? form.emergency_contact.phone.trim() : "";

    const hasName = Boolean(name);
    const hasPhone = Boolean(emergencyPhone);

    if (!hasName && !hasPhone) {
      payload.emergency_contact = null;
    } else {
      payload.emergency_contact = {
        name: hasName ? name : null,
        phone: hasPhone ? emergencyPhone : null,
      };
    }
  }

  return payload;
}

export function filterStudentsByActive<T extends { active?: boolean }>(
  students: T[],
  showOnlyActive: boolean
): T[] {
  return students.filter((student) => !showOnlyActive || student.active !== false);
}

export function computeAttendanceStats(records: Array<{ status: string }>): {
  total: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  pct: number;
} {
  const total = records.length;
  const present = records.filter((a) => a.status === "present").length;
  const late = records.filter((a) => a.status === "late").length;
  const excused = records.filter((a) => a.status === "excused").length;
  const absent = records.filter((a) => a.status === "absent").length;

  const pct = total > 0 ? Math.round(((present + excused + late * 0.5) / total) * 100) : 0;

  return { total, present, late, excused, absent, pct };
}
