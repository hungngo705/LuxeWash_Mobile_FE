import { bookingService } from "./bookingService";
import { branchService, type BranchDTO } from "./branchService";
import { ApiError, apiClient } from "./client";
import { vehicleService } from "./vehicleService";

export interface IncidentAlternative {
  branchId: number;
  branchName: string;
  slotId: number;
  startAt: string;
  endAt: string;
  distanceKm: number | null;
  availableWeight: number;
  priceDifferenceCharged: number;
}

export interface IncidentRefundPreview {
  amount: number;
  destination: string;
  pointsRestored: number;
  originalVoucherRestored: boolean;
}

export interface IncidentVoucherTerms {
  discountPercent: number;
  code: string;
}

export interface IncidentOptions {
  caseId: number;
  incidentId: number;
  caseStatus: string;
  originalBooking: {
    bookingId: number;
    scheduledTime: string;
    licensePlate: string | null;
  } | null;
  reason: string;
  eta: string;
  responseDeadlineAt: string;
  allowedActions: string[];
  alternatives?: IncidentAlternative[];
  refundPreview: IncidentRefundPreview;
  voucherTerms: IncidentVoucherTerms;
  version: number;
}

export interface IncidentAvailabilityContext {
  targetDate: string;
  originalStartAt: string;
  vehicleTypeId: number;
  serviceNames: string[];
  serviceIds: number[];
  branches: BranchDTO[];
}

export interface IncidentAvailableSlot {
  branchId: number;
  branchName: string;
  slotId: number;
  startAt: string;
  endAt: string;
}

const normalizePlate = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
const normalizeServiceName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const pad2 = (value: string) => value.padStart(2, "0");

const parseTimeRange = (value: string) => {
  const match = value.match(/^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/);
  if (!match) return null;
  return { startAt: `${pad2(match[1])}:${match[2]}`, endAt: `${pad2(match[3])}:${match[4]}` };
};

function matchServiceIds(serviceNames: string[], services: { serviceId: number; serviceName: string }[]) {
  const serviceByName = new Map(
    services.map((service) => [normalizeServiceName(service.serviceName), service]),
  );
  const missing: string[] = [];
  const ids = serviceNames
    .map((name) => {
      const service = serviceByName.get(normalizeServiceName(name));
      if (!service) {
        missing.push(name);
        return null;
      }
      return service.serviceId;
    })
    .filter((id): id is number => typeof id === "number");
  return { ids, missing };
}

export type IncidentDecision =
  | { decision: "Cancel" }
  | { decision: "Transfer"; targetBranchId: number; targetSlotId: number };

export interface IncidentDecisionResult {
  decision: string;
  booking: unknown;
  refund: IncidentRefundPreview | null;
  compensationVoucher: {
    voucherId: number;
    discountPercent: number;
    expiresAt: string;
  } | null;
  caseStatus: string;
}

export const incidentService = {
  async getOptions(bookingId: number): Promise<IncidentOptions | null> {
    // This endpoint returns { data: DTO | null }, without the usual statusCode.
    // Bound a stalled request so it cannot leave the customer on a spinner forever.
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const response = await Promise.race([
      apiClient.get<IncidentOptions | null>(`/bookings/${bookingId}/incident-options`),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new ApiError(0, "Máy chủ xử lý quá lâu. Vui lòng thử lại sau.")), 120_000);
      }),
    ]).finally(() => { if (timeout) clearTimeout(timeout); });
    if (response.data === null) return null;
    if (!response.data || !Number.isInteger(response.data.caseId)) {
      throw new ApiError(500, "Backend trả dữ liệu sự cố không hợp lệ.");
    }
    return response.data;
  },

  async decide(bookingId: number, options: IncidentOptions, choice: IncidentDecision): Promise<IncidentDecisionResult> {
    const response = await apiClient.post<IncidentDecisionResult>(
      `/bookings/${bookingId}/incident-decision`,
      {
        incidentId: options.incidentId,
        caseId: options.caseId,
        expectedVersion: options.version,
        ...choice,
      },
    );
    // Decision currently returns the DTO directly, not { data: DTO }.
    const result = (response.data ?? response) as IncidentDecisionResult;
    if (!result || typeof result.caseStatus !== "string") {
      throw new ApiError(500, "Backend trả kết quả xử lý sự cố không hợp lệ.");
    }
    return result;
  },

  async getAvailabilityContext(bookingId: number, options: IncidentOptions): Promise<IncidentAvailabilityContext> {
    const [bookingResponse, myBookingsResponse, branchesResponse, vehiclesResponse] = await Promise.all([
      bookingService.getBookingDetail(bookingId),
      bookingService.getMyBookings(),
      branchService.getBranches(),
      vehicleService.getMyVehicles(),
    ]);
    const booking = bookingResponse.data;
    // Some backend versions leave BranchId at its DTO default (0) on the detail
    // endpoint. The customer's booking list includes the actual branch.
    const bookingInList = myBookingsResponse.data?.find((candidate) => candidate.bookingId === bookingId);
    const originalBranchId = booking?.branchId || bookingInList?.branchId;
    const licensePlate = booking?.licensePlate || bookingInList?.licensePlate || options.originalBooking?.licensePlate;
    const serviceNames = booking?.serviceNames?.length ? booking.serviceNames : bookingInList?.serviceNames;
    if (!originalBranchId || !licensePlate || !serviceNames?.length) {
      throw new ApiError(422, "Không đủ thông tin lịch hẹn để kiểm tra chi nhánh khác.");
    }
    const scheduledTime = options.originalBooking?.scheduledTime || booking?.scheduledTime || bookingInList?.scheduledTime;
    const dateMatch = scheduledTime?.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
    if (!dateMatch) throw new ApiError(422, "Không xác định được ngày giờ của lịch hẹn.");

    const vehicle = vehiclesResponse.data?.find(
      (candidate) => normalizePlate(candidate.licensePlate) === normalizePlate(licensePlate),
    );
    if (!vehicle?.vehicleTypeId) {
      throw new ApiError(422, "Không xác định được loại xe để kiểm tra chỗ trống.");
    }

    const originalServices = await bookingService.getServices(originalBranchId);
    const { ids: serviceIds, missing } = matchServiceIds(serviceNames, originalServices.data ?? []);
    if (missing.length) {
      throw new ApiError(422, "Không xác định được dịch vụ của lịch hẹn để kiểm tra chỗ trống.");
    }

    return {
      targetDate: dateMatch[1],
      originalStartAt: dateMatch[2],
      vehicleTypeId: vehicle.vehicleTypeId,
      serviceNames,
      serviceIds,
      branches: (branchesResponse.data ?? [])
        .filter((branch) => branch.isActive && branch.branchId !== originalBranchId)
        .sort((a, b) => a.name.localeCompare(b.name, "vi") || a.branchId - b.branchId),
    };
  },

  async getBranchSlots(context: IncidentAvailabilityContext, branch: BranchDTO): Promise<IncidentAvailableSlot[]> {
    // An incident transfer keeps the original BookingDetails and price. Use the
    // original service ids when asking for capacity; requiring an equivalent
    // branch-local catalog entry here made valid destination slots disappear even
    // though the backend transfer flow intentionally preserves those services.
    const response = await bookingService.getAvailableSlots(
      branch.branchId,
      context.targetDate,
      context.vehicleTypeId,
      context.serviceIds,
    );

    return (response.data ?? [])
      .filter((slot) => slot.isAvailable)
      .flatMap((slot) => {
        const time = parseTimeRange(slot.timeRange);
        return time ? [{
          branchId: branch.branchId,
          branchName: branch.name,
          slotId: slot.slotId,
          ...time,
        }] : [];
      })
      .sort((a, b) => a.startAt.localeCompare(b.startAt) || a.endAt.localeCompare(b.endAt));
  },

  async getSameTimeSuggestions(context: IncidentAvailabilityContext): Promise<{
    suggestions: IncidentAvailableSlot[];
    failedCount: number;
  }> {
    const results = await Promise.allSettled(context.branches.map(async (branch) => {
      const slots = await incidentService.getBranchSlots(context, branch);
      return slots.filter((slot) => slot.startAt === context.originalStartAt);
    }));
    const suggestions = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    return {
      suggestions,
      failedCount: results.filter((result) => result.status === "rejected").length,
    };
  },

  async findPendingBookingByCaseId(caseId: number): Promise<number | null> {
    const response = await bookingService.getMyBookings();
    const booking = response.data?.find((item) => item.incidentCaseId === caseId && item.hasPendingIncidentAction);
    return booking?.bookingId ?? null;
  },
};
