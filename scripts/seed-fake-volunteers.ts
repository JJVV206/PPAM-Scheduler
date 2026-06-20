import bcrypt from "bcryptjs";
import {
  DayOfWeek,
  PrismaClient,
  TimeSlot,
  UserRole
} from "@prisma/client";

const db = new PrismaClient();

const COUNT = Number(process.env.FAKE_USER_COUNT ?? "100");
const EMAIL_PREFIX = process.env.FAKE_USER_PREFIX ?? "qa.volunteer";
const EMAIL_DOMAIN = process.env.FAKE_USER_DOMAIN ?? "ppam.local";
const DEFAULT_PASSWORD = process.env.FAKE_USER_PASSWORD ?? "Volunteer123!";

const firstNames = [
  "Andres",
  "Brenda",
  "Carlos",
  "Daniela",
  "Eduardo",
  "Fernanda",
  "Gabriel",
  "Hilda",
  "Ivan",
  "Jessica"
];

const lastNames = [
  "Alvarez",
  "Barrera",
  "Castillo",
  "Dominguez",
  "Espinoza",
  "Flores",
  "Garcia",
  "Herrera",
  "Lopez",
  "Mendoza"
];

const areas = ["Hospital", "Centro", "Parque", "Terminal", "Universidad"];
const days = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY
];
const timeSlots = [
  TimeSlot.SLOT_07_09,
  TimeSlot.SLOT_09_11,
  TimeSlot.SLOT_11_13,
  TimeSlot.SLOT_13_15,
  TimeSlot.SLOT_15_17
];

function padIndex(index: number) {
  return String(index).padStart(3, "0");
}

function buildVolunteer(index: number) {
  const firstName = firstNames[(index - 1) % firstNames.length];
  const lastName =
    lastNames[Math.floor((index - 1) / firstNames.length) % lastNames.length];
  const paddedIndex = padIndex(index);

  return {
    name: `${firstName} ${lastName} ${paddedIndex}`,
    email: `${EMAIL_PREFIX}.${paddedIndex}@${EMAIL_DOMAIN}`,
    phone: `+52 555 ${String(1000 + index).padStart(4, "0")}`,
    area: areas[(index - 1) % areas.length],
    reliabilityScore: 82 + ((index * 7) % 19),
    confirmationCount: 4 + ((index * 3) % 24),
    declineCount: index % 4,
    noResponseCount: index % 3,
    dayOfWeek: days[(index - 1) % days.length],
    timeSlot: timeSlots[(index - 1) % timeSlots.length]
  };
}

async function main() {
  if (!Number.isInteger(COUNT) || COUNT <= 0) {
    throw new Error("FAKE_USER_COUNT must be a positive integer.");
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  for (let index = 1; index <= COUNT; index += 1) {
    const volunteer = buildVolunteer(index);

    const user = await db.user.upsert({
      where: { email: volunteer.email },
      create: {
        name: volunteer.name,
        email: volunteer.email,
        passwordHash,
        role: UserRole.VOLUNTEER,
        phone: volunteer.phone,
        active: true,
        accessStatus: "APPROVED"
      },
      update: {
        name: volunteer.name,
        passwordHash,
        role: UserRole.VOLUNTEER,
        phone: volunteer.phone,
        active: true,
        accessStatus: "APPROVED"
      }
    });

    const profile = await db.volunteerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        notes: "Usuario ficticio para QA local.",
        transportationNotes: "Disponible para traslado local.",
        preferredAreas: [volunteer.area],
        reliabilityScore: volunteer.reliabilityScore,
        confirmationCount: volunteer.confirmationCount,
        declineCount: volunteer.declineCount,
        noResponseCount: volunteer.noResponseCount,
        active: true
      },
      update: {
        notes: "Usuario ficticio para QA local.",
        transportationNotes: "Disponible para traslado local.",
        preferredAreas: [volunteer.area],
        reliabilityScore: volunteer.reliabilityScore,
        confirmationCount: volunteer.confirmationCount,
        declineCount: volunteer.declineCount,
        noResponseCount: volunteer.noResponseCount,
        active: true,
        temporaryUnavailable: false
      }
    });

    await db.volunteerAvailability.upsert({
      where: {
        volunteerId_dayOfWeek_timeSlot: {
          volunteerId: profile.id,
          dayOfWeek: volunteer.dayOfWeek,
          timeSlot: volunteer.timeSlot
        }
      },
      create: {
        volunteerId: profile.id,
        dayOfWeek: volunteer.dayOfWeek,
        timeSlot: volunteer.timeSlot,
        areaPreference: volunteer.area,
        available: true,
        recurring: true
      },
      update: {
        areaPreference: volunteer.area,
        available: true,
        recurring: true
      }
    });
  }

  const createdUsers = await db.user.count({
    where: {
      email: {
        startsWith: `${EMAIL_PREFIX}.`,
        endsWith: `@${EMAIL_DOMAIN}`
      }
    }
  });

  console.log(
    `Seeded ${COUNT} fake volunteers. Matching fake volunteer users in this database: ${createdUsers}.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
