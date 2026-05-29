import type {
  ASSIGNMENT_ACTIVITY_TYPES,
  ASSIGNMENT_STATUSES,
  DAYS_OF_WEEK,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  NOTIFICATION_TYPES,
  RESPONSE_STATUSES,
  TIME_SLOTS,
  USER_ROLES,
  VOLUNTEER_POSITIONS
} from "@/lib/constants/domain";

export type UserRole = (typeof USER_ROLES)[number];
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];
export type TimeSlot = (typeof TIME_SLOTS)[number];
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];
export type VolunteerPosition = (typeof VOLUNTEER_POSITIONS)[number];
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];
export type AssignmentActivityType = (typeof ASSIGNMENT_ACTIVITY_TYPES)[number];

export type BasicUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  active: boolean;
};

export type VolunteerSummary = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string | null;
  active: boolean;
  transportationNotes?: string | null;
  preferredAreas: string[];
  reliabilityScore: number;
  confirmationCount: number;
  declineCount: number;
  noResponseCount: number;
  temporaryUnavailable: boolean;
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
  timeline: AssignmentTimelineEntry[];
  warnings: string[];
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
    declinedAssignments: number;
    openSlots: number;
  };
  todaysAssignments: AssignmentDetailDto[];
  pendingConfirmations: AssignmentDetailDto[];
  urgentReplacements: OpenSlotDto[];
};

export type VolunteerDashboardData = {
  volunteer: VolunteerSummary;
  upcomingAssignments: AssignmentDetailDto[];
  pendingConfirmations: AssignmentDetailDto[];
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
  notificationChannels: NotificationChannel[];
};
