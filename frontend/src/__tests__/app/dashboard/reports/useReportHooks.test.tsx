import { act, renderHook, waitFor } from "@testing-library/react";

jest.mock("@/lib/api", () => ({
  createApiClient: jest.fn(),
}));

import { createApiClient } from "@/lib/api";
import { useReportPresets } from "@/app/dashboard/reports/useReportPresets";
import { useReportSchedules } from "@/app/dashboard/reports/useReportSchedules";
import { useReportStudents } from "@/app/dashboard/reports/useReportStudents";

describe("reports hooks", () => {
  const mockGet = jest.fn();
  const mockPost = jest.fn();

  beforeEach(() => {
    (createApiClient as jest.Mock).mockReset();
    mockGet.mockReset();
    mockPost.mockReset();

    (createApiClient as jest.Mock).mockReturnValue({
      get: mockGet,
      post: mockPost,
    });
  });

  describe("useReportStudents", () => {
    it("does nothing when disabled", async () => {
      const onError = jest.fn();

      renderHook(() =>
        useReportStudents({
          enabled: false,
          accessToken: "tok",
          onError,
        })
      );

      await act(async () => {});

      expect(mockGet).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it("loads students and clears error", async () => {
      mockGet.mockResolvedValueOnce({
        data: [{ _id: "s1", name: "Alice" }],
      });

      const onError = jest.fn();
      const { result } = renderHook(() =>
        useReportStudents({
          enabled: true,
          accessToken: "tok",
          onError,
        })
      );

      await waitFor(() => expect(result.current.students).toHaveLength(1));

      expect(mockGet).toHaveBeenCalledWith("/api/students");
      expect(onError).toHaveBeenCalledWith(null);
      expect(result.current.students[0]).toEqual({ _id: "s1", name: "Alice" });
    });

    it("reports normalized error message on failure", async () => {
      mockGet.mockRejectedValueOnce(new Error("<html>fail</html>"));

      const onError = jest.fn();
      renderHook(() =>
        useReportStudents({
          enabled: true,
          accessToken: "tok",
          onError,
        })
      );

      await waitFor(() => expect(onError).toHaveBeenCalledTimes(2));

      expect(onError).toHaveBeenNthCalledWith(1, null);
      expect(onError.mock.calls[1][0]).toContain("API returned HTML instead of JSON");
    });
  });

  describe("useReportSchedules", () => {
    it("loads schedules with date range query params", async () => {
      mockGet.mockResolvedValueOnce({
        data: [{ _id: "sch1", class_id: { _id: "c1", name: "Class" } }],
      });

      const onError = jest.fn();
      const { result } = renderHook(() =>
        useReportSchedules({
          enabled: true,
          accessToken: "tok",
          from: "2026-01-01",
          to: "2026-01-31",
          onError,
        })
      );

      await waitFor(() => expect(result.current.schedules).toHaveLength(1));

      const calledEndpoint = mockGet.mock.calls[0][0] as string;
      expect(calledEndpoint.startsWith("/api/schedules?")).toBe(true);

      const qs = calledEndpoint.split("?")[1];
      const params = new URLSearchParams(qs);
      expect(params.get("startDate")).toBe("2026-01-01");
      expect(params.get("endDate")).toBe("2026-01-31");
      expect(params.get("expandRecurring")).toBe("true");

      expect(onError).toHaveBeenCalledWith(null);
    });
  });

  describe("useReportPresets", () => {
    it("loads presets and supports reload with nextSelectedId", async () => {
      mockGet
        .mockResolvedValueOnce({
          data: [
            {
              _id: "p1",
              name: "Preset 1",
              shared: false,
              schemaVersion: 1,
              state: { mode: "raw", from: "2026-01-01", to: "2026-01-31" },
            },
          ],
        })
        .mockResolvedValueOnce({
          data: [
            {
              _id: "p2",
              name: "Preset 2",
              shared: false,
              schemaVersion: 1,
              state: { mode: "raw", from: "2026-01-01", to: "2026-01-31" },
            },
          ],
        });

      const onPresetError = jest.fn();
      const onSetSelectedPresetId = jest.fn();

      const { result } = renderHook(() =>
        useReportPresets({
          enabled: true,
          accessToken: "tok",
          onPresetError,
          onSetSelectedPresetId,
        })
      );

      await waitFor(() => expect(result.current.presets).toHaveLength(1));
      expect(onPresetError).toHaveBeenCalledWith(null);

      await act(async () => {
        await result.current.reloadPresets("p2");
      });

      await waitFor(() => expect(result.current.presets[0]?._id).toBe("p2"));
      expect(onSetSelectedPresetId).toHaveBeenCalledWith("p2");
    });
  });
});
