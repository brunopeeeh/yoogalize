import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type HourRange = {
  start: string;
  end: string;
};

type DailyHours = {
  day_of_week: number; // 0 = Sunday
  hours: HourRange[];
};

const TIMEZONE_OFFSET_MINUTES = -3 * 60; // UTC-3 (Brasília)

/**
 * Gets the current time's total minutes from the beginning of the week (Sunday) in UTC-3.
 */
function getCurrentMinutesIntoWeekUTC3(): number {
  const now = new Date();
  // Get current UTC time in ms, then apply the timezone offset
  const nowInUTC3ms = now.getTime() + now.getTimezoneOffset() * 60000 + TIMEZONE_OFFSET_MINUTES * 60000;
  const nowInUTC3 = new Date(nowInUTC3ms);
  
  const dayOfWeek = nowInUTC3.getUTCDay(); // 0=Sun
  const minutesIntoDay = nowInUTC3.getUTCHours() * 60 + nowInUTC3.getUTCMinutes();
  
  return dayOfWeek * 24 * 60 + minutesIntoDay;
}

/**
 * Parses a time string from the JSON (ignoring date) into minutes from the start of the day (UTC).
 */
function parseTime(timeString: string): number {
  if (!timeString || typeof timeString !== "string" || timeString.includes("inválida")) {
    return -1;
  }
  try {
    const date = new Date(timeString);
    if (isNaN(date.getTime())) return -1;
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  } catch {
    return -1;
  }
}

/**
 * Formats minutes from the start of the day into HH:MM string.
 */
function formatMinutes(minutes: number): string {
  if (minutes < 0 || minutes >= 1440) return "";
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export type OpeningHoursInfo = {
  status: "open" | "closed";
  message: string;
};

/**
 * Checks if an establishment is open based on its operating hours, considering UTC-3.
 * @param operatingHours The array of operating hours.
 * @returns True if open, false otherwise.
 */
export function isEstablishmentOpen(operatingHours?: DailyHours[]): boolean {
  const { status } = getOpeningHoursInfo(operatingHours);
  return status === "open";
}

/**
 * Returns detailed opening hours info (status and message), adjusted for UTC-3.
 * @param operatingHours The array of operating hours.
 * @returns An object with the status and a formatted message.
 */
export function getOpeningHoursInfo(operatingHours?: DailyHours[]): OpeningHoursInfo {
  if (!operatingHours || !Array.isArray(operatingHours) || operatingHours.length === 0) {
    return { status: "closed", message: "Horário não informado" };
  }

  const allSlots = operatingHours
    .flatMap(daySchedule => {
      if (!daySchedule.hours || !Array.isArray(daySchedule.hours)) return [];
      return daySchedule.hours
        .map(hourRange => {
          const startMin = parseTime(hourRange.start);
          const endMin = parseTime(hourRange.end);

          if (startMin === -1 || endMin === -1) return null;

          let startMinutesIntoWeek = daySchedule.day_of_week * 24 * 60 + startMin;
          let endMinutesIntoWeek = daySchedule.day_of_week * 24 * 60 + endMin;

          // Handle overnight schedules
          if (endMinutesIntoWeek < startMinutesIntoWeek) {
            endMinutesIntoWeek += 24 * 60;
          }
          return { start: startMinutesIntoWeek, end: endMinutesIntoWeek };
        })
        .filter((slot): slot is { start: number; end: number } => slot !== null);
    });

  if (allSlots.length === 0) {
    return { status: "closed", message: "Horário não informado" };
  }

  const nowMinutes = getCurrentMinutesIntoWeekUTC3();

  // Check if currently open
  for (const slot of allSlots) {
    // Case 1: Standard check within the week
    if (nowMinutes >= slot.start && nowMinutes < slot.end) {
      return { status: "open", message: `Aberto (fecha às ${formatMinutes(slot.end % 1440)})` };
    }
    // Case 2: Handle overnight from Saturday to Sunday (week rollover)
    // If it's early Sunday, check if we are in a slot that started late Saturday.
    if (slot.end >= 7 * 24 * 60) { // Slot crosses the week boundary
      if (nowMinutes < (slot.end % (7 * 24 * 60))) {
        return { status: "open", message: `Aberto (fecha às ${formatMinutes(slot.end % 1440)})` };
      }
    }
  }

  // If closed, find the next opening time
  const sortedSlots = allSlots.sort((a, b) => a.start - b.start);
  let nextOpeningSlot = sortedSlots.find(slot => slot.start > nowMinutes);

  // If no upcoming slot this week, the next one is the first one next week
  if (!nextOpeningSlot) {
    nextOpeningSlot = sortedSlots[0];
  }

  if (nextOpeningSlot) {
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const dayIndex = Math.floor(nextOpeningSlot.start / (24 * 60)) % 7;
    const time = formatMinutes(nextOpeningSlot.start % 1440);
    const dayName = dayNames[dayIndex];

    const currentDayIndex = Math.floor(nowMinutes / (24 * 60));

    if (dayIndex === currentDayIndex) {
      return { status: "closed", message: `Fechado (abre às ${time})` };
    }
    return { status: "closed", message: `Fechado (abre ${dayName} às ${time})` };
  }

  return { status: "closed", message: "Fechado permanentemente" };
}
