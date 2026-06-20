import type {
  ASSIGNMENT_ACTIVITY_TYPES,
  ASSIGNMENT_INVITATION_STATUSES,
  ASSIGNMENT_INVITATION_TYPES,
  ASSIGNMENT_STATUSES,
  DAYS_OF_WEEK,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  NOTIFICATION_TYPES,
  RESPONSE_STATUSES,
  TIME_SLOTS,
  USER_ACCESS_STATUSES,
  USER_ROLES,
  VOLUNTEER_POSITIONS,
  VOLUNTEER_SERVICE_TYPES
} from "@/lib/constants/domain";

export type UserRole = (typeof USER_ROLES)[number];
export type UserAccessStatus = (typeof USER_ACCESS_STATUSES)[number];
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];
export type TimeSlot = (typeof TIME_SLOTS)[number];
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];
export type VolunteerPosition = (typeof VOLUNTEER_POSITIONS)[number];
export type VolunteerServiceType = (typeof VOLUNTEER_SERVICE_TYPES)[number];
export type AssignmentInvitationType =
  (typeof ASSIGNMENT_INVITATION_TYPES)[number];
export type AssignmentInvitationStatus =
  (typeof ASSIGNMENT_INVITATION_STATUSES)[number];
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];
export type AssignmentActivityType = (typeof ASSIGNMENT_ACTIVITY_TYPES)[number];

export type BasicUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  active: boolean;
  accessStatus: UserAccessStatus;
};

export type VolunteerSummary = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  transportationNotes?: string | null;
  preferredAreas: string[];
  reliabilityScore: number;
  confirmationCount: number;
  declineCount: number;
  noResponseCount: number;
  temporaryUnavailable: boolean;
  canServeAsPrimary: boolean;
  canServeAsReplacement: boolean;
  serviceType: VolunteerServiceType;
};

export type PreachingPointSummary = {
  id: string;
  name: string;
  area: string;
  notes?: string | null;
  active: boolean;
  activeSlots: Array<{
    id: string;
    dayOfWeek: DayOfWeek;
    timeSlot: TimeSlot;
  }>;
};

export type AssignmentVolunteerDto = {
  volunteerId: string;
  assignmentVolunteerId: string;
  responseId?: string | null;
  position: VolunteerPosition;
  isReplacement: boolean;
  responseStatus: ResponseStatus;
  respondedAt?: Date | null;
  responseNote?: string | null;
  volunteer: VolunteerSummary;
};

export type AssignmentTimelineEntry = {
  id: string;
  actionType: AssignmentActivityType;
  createdAt: Date;
  actorName?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AssignmentAutomationStateKey =
  | "INVITATION_PENDING"
  | "EMAIL_SENT"
  | "AWAITING_RESPONSE"
  | "CONFIRMED"
  | "DECLINED"
  | "EXPIRED"
  | "LOOKING_FOR_REPLACEMENT"
  | "REPLACEMENT_INVITED"
  | "REQUIRES_INTERVENTION"
  | "CANCELLED";

export type AssignmentAutomationState = {
  key: AssignmentAutomationStateKey;
  label: string;
  description: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
};

export type AssignmentInvitationDto = {
  id: string;
  volunteerId: string;
  volunteerName: string;
  type: AssignmentInvitationType;
  status: AssignmentInvitationStatus;
  sentAt?: Date | null;
  respondedAt?: Date | null;
  expiresAt: Date;
  emailAttempts: number;
  createdAt: Date;
};

export type AssignmentDetailDto = {
  id: string;
  scheduleWeekId: string;
  date: Date;
  dayOfWeek: DayOfWeek;
  timeSlot: TimeSlot;
  pairNumber: number;
  status: AssignmentStatus;
  notes?: string | null;
  preachingPoint: PreachingPointSummary;
  volunteers: AssignmentVolunteerDto[];
  invitations: AssignmentInvitationDto[];
  automationState: AssignmentAutomationState;
  timeline: AssignmentTimelineEntry[];
  warnings: string[];
  requiresAttention: boolean;
};

export type WeeklySchedulePair = {
  id: string;
  pairNumber: number;
  status: AssignmentStatus;
  volunteerNames: string[];
  warnings: string[];
  notes?: string | null;
};

export type WeeklySchedulePointCell = {
  date: Date;
  dayOfWeek: DayOfWeek;
  timeSlot: TimeSlot;
  preachingPointName: string;
  preachingPointId: string;
  area: string;
  pairs: WeeklySchedulePair[];
};

export type WeeklyScheduleMatrix = {
  weekLabel: string;
  startDate: Date;
  endDate: Date;
  days: Array<{
    date: Date;
    dayOfWeek: DayOfWeek;
    items: Record<TimeSlot, WeeklySchedulePointCell[]>;
  }>;
};

export type DashboardStat = {
  label: string;
  value: number;
  changeLabel?: string;
};

export type AdminDashboardStats = {
  weekLabel: string;
  stats: {
    totalAssignments: number;
    confirmedAssignments: number;
    pendingConfirmations: number;
    needsReplacement: number;
    declinedAssignments: number;
    openSlots: number;
    requiresAttention: number;
  };
  census: {
    status: string;
    closesAt?: Date | null;
    totalResponses: number;
    submittedResponses: number;
    pendingResponses: number;
    declinedResponses: number;
    responseRate: number;
  };
  alerts: {
    failedEmails: number;
    expiredPrimaryInvitations: number;
    expiredReplacementInvitations: number;
    uncoveredAssignments: number;
  };
  todaysAssignments: AssignmentDetailDto[];
  upcomingAssignments: AssignmentDetailDto[];
  pendingConfirmations: AssignmentDetailDto[];
  requiresAttention: AssignmentDetailDto[];
  urgentReplacements: OpenSlotDto[];
};

export type VolunteerAssignmentReminderDto = {
  id: string;
  assignmentId: string;
  type: Extract<NotificationType, "REMINDER" | "FINAL_REMINDER">;
  status: NotificationStatus;
  sentAt?: Date | null;
  createdAt: Date;
};

export type VolunteerDashboardData = {
  volunteer: VolunteerSummary;
  upcomingAssignments: AssignmentDetailDto[];
  pendingConfirmations: AssignmentDetailDto[];
  confirmedAssignments: AssignmentDetailDto[];
  assignmentHistory: AssignmentDetailDto[];
  remindersByAssignmentId: Record<string, VolunteerAssignmentReminderDto[]>;
  openSlots: OpenSlotDto[];
  weeklyAvailabilitySummary: Array<{
    dayOfWeek: DayOfWeek;
    slots: TimeSlot[];
  }>;
};

export type OpenSlotDto = {
  assignmentId: string;
  date: Date;
  dayOfWeek: DayOfWeek;
  timeSlot: TimeSlot;
  preachingPointId: string;
  preachingPointName: string;
  area: string;
  status: AssignmentStatus;
  missingPositions: VolunteerPosition[];
  urgencyLabel: string;
  suggestedVolunteers: VolunteerSummary[];
  notes?: string | null;
};

export type VolunteerReliabilityStats = {
  volunteerId: string;
  confirmationRate: number;
  declineRate: number;
  noResponseRate: number;
};

export type ReportSummaryDto = {
  totalAssignments: number;
  confirmationRate: number;
  declineRate: number;
  openSlotRate: number;
  pointCoverageRate: number;
  volunteerParticipation: Array<{
    volunteerName: string;
    count: number;
  }>;
};

export type ScheduleFilters = {
  day?: DayOfWeek;
  pointId?: string;
  status?: AssignmentStatus;
};

export type AssignmentFilters = {
  volunteerId?: string;
  pointId?: string;
  date?: string;
  status?: AssignmentStatus;
  search?: string;
};

export type SettingsDto = {
  confirmationLeadDays: number;
  reminderTimingDays: number[];
  finalReminderHours: number;
  primaryResponseTimeoutHours: number;
  primaryReminderOffsetsHours: number[];
  replacementResponseTimeoutHours: number;
  replacementReminderOffsetsHours: number[];
  censusResponseTimeoutHours: number;
  censusReminderOffsetsHours: number[];
  urgentThresholdHours: number;
  adminAlertEmail: string;
  notificationChannels: NotificationChannel[];
};
