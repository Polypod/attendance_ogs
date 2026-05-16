export type ClassLike = {
  _id: string;
  name: string;
  description: string;
  categories: unknown;
  instructor: string;
  max_capacity: number;
  duration_minutes: number;
};

export type ClassWithCategories = Omit<ClassLike, "categories"> & {
  categories: string[];
};

export type ClassForm = {
  name: string;
  description: string;
  categories: string[];
  instructor: string;
  max_capacity: number;
  duration_minutes: number;
};

export function extractClassesFromApiResponse(payload: unknown): ClassWithCategories[] {
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as { classes?: unknown; data?: unknown };

  const classesValue = obj.classes ?? obj.data;
  if (!Array.isArray(classesValue)) return [];

  return (classesValue as ClassLike[]).map((cls) => ({
    ...cls,
    categories: Array.isArray(cls.categories) ? (cls.categories as string[]) : [],
  }));
}

export function buildClassFormFromClass(cls: Partial<ClassLike>): ClassForm {
  return {
    name: cls.name || "",
    description: cls.description || "",
    categories: Array.isArray(cls.categories) ? (cls.categories as string[]) : [],
    instructor: cls.instructor || "",
    max_capacity: cls.max_capacity || 20,
    duration_minutes: cls.duration_minutes || 60,
  };
}

export function toggleCategorySelection(
  categories: string[],
  value: string,
  checked: boolean
): string[] {
  if (checked) {
    return categories.includes(value) ? categories : [...categories, value];
  }
  return categories.filter((c) => c !== value);
}

export function formatCategoriesForDisplay(categories: unknown): string {
  if (Array.isArray(categories)) {
    return categories.join(", ");
  }
  if (typeof categories === "string" && categories) {
    return categories;
  }
  return "N/A";
}
