import {
  buildClassFormFromClass,
  extractClassesFromApiResponse,
  formatCategoriesForDisplay,
  toggleCategorySelection,
  type ClassLike,
} from "../../../../app/dashboard/classes/classHelpers";

describe("classHelpers", () => {
  describe("extractClassesFromApiResponse", () => {
    const sample: ClassLike = {
      _id: "c1",
      name: "Class",
      description: "Desc",
      categories: ["kids"],
      instructor: "Sensei",
      max_capacity: 10,
      duration_minutes: 60,
    };

    it("prefers payload.classes when present", () => {
      expect(extractClassesFromApiResponse({ classes: [sample] })).toEqual([sample]);
    });

    it("falls back to payload.data", () => {
      expect(extractClassesFromApiResponse({ data: [sample] })).toEqual([sample]);
    });

    it("returns empty array for unexpected shapes", () => {
      expect(extractClassesFromApiResponse(null)).toEqual([]);
      expect(extractClassesFromApiResponse({})).toEqual([]);
      expect(extractClassesFromApiResponse({ classes: {} })).toEqual([]);
    });
  });

  describe("buildClassFormFromClass", () => {
    it("fills defaults for missing values", () => {
      const form = buildClassFormFromClass({ name: "", categories: undefined as any });
      expect(form).toEqual({
        name: "",
        description: "",
        categories: [],
        instructor: "",
        max_capacity: 20,
        duration_minutes: 60,
      });
    });

    it("keeps provided values", () => {
      const form = buildClassFormFromClass({
        name: "Beginner",
        description: "Intro",
        categories: ["adult"],
        instructor: "A",
        max_capacity: 25,
        duration_minutes: 75,
      });
      expect(form).toEqual({
        name: "Beginner",
        description: "Intro",
        categories: ["adult"],
        instructor: "A",
        max_capacity: 25,
        duration_minutes: 75,
      });
    });
  });

  describe("toggleCategorySelection", () => {
    it("adds category when checked", () => {
      expect(toggleCategorySelection(["kids"], "adult", true)).toEqual(["kids", "adult"]);
    });

    it("does not add duplicates", () => {
      expect(toggleCategorySelection(["kids"], "kids", true)).toEqual(["kids"]);
    });

    it("removes category when unchecked", () => {
      expect(toggleCategorySelection(["kids", "adult"], "kids", false)).toEqual(["adult"]);
    });
  });

  describe("formatCategoriesForDisplay", () => {
    it("joins arrays", () => {
      expect(formatCategoriesForDisplay(["kids", "adult"])).toBe("kids, adult");
    });

    it("returns string when given a non-empty string", () => {
      expect(formatCategoriesForDisplay("kids")).toBe("kids");
    });

    it("returns N/A for other values", () => {
      expect(formatCategoriesForDisplay("")).toBe("N/A");
      expect(formatCategoriesForDisplay(null)).toBe("N/A");
      expect(formatCategoriesForDisplay(undefined)).toBe("N/A");
    });
  });
});
