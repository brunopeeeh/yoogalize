import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { OperatingHour } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Obtém informações da hora atual no fuso de Brasília (America/Sao_Paulo).
 * @returns Objeto com o dia da semana e os minutos totais desde o início da semana.
 */
function getBrasiliaTimeInfo(): { dayOfWeek: number; minutesIntoWeek: number } {
  const now = new Date();
  const timeZone = "America/Sao_Paulo";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short", // Sun, Mon, ...
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);

  const getPartValue = (type: string) => parts.find((p) => p.type === type)?.value || "0";

  const dayMap: { [key: string]: number } = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  const dayOfWeek = dayMap[getPartValue("weekday")]!;
  const hour = parseInt(getPartValue("hour"), 10) % 24;
  const minute = parseInt(getPartValue("minute"), 10);

  const minutesIntoDay = hour * 60 + minute;
  const minutesIntoWeek = dayOfWeek * 24 * 60 + minutesIntoDay;

  return { dayOfWeek, minutesIntoWeek };
}

/**
 * Converte uma string de tempo "HH:MM:SS" em minutos desde o início do dia.
 */
function parseTime(timeString: string): number {
  if (!timeString || typeof timeString !== "string") return -1;
  try {
    const parts = timeString.split(":");
    if (parts.length < 2) return -1;
    const hours = parseInt(parts[0]!, 10);
    const minutes = parseInt(parts[1]!, 10);
    if (isNaN(hours) || isNaN(minutes)) return -1;
    return hours * 60 + minutes;
  } catch {
    return -1;
  }
}

/**
 * Formata minutos desde o início do dia para uma string "HH:MM".
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

export function isEstablishmentOpen(operatingHours?: OperatingHour[]): boolean {
  const { status } = getOpeningHoursInfo(operatingHours);
  return status === "open";
}

export function getOpeningHoursInfo(operatingHours?: OperatingHour[]): OpeningHoursInfo {
  if (!operatingHours || !Array.isArray(operatingHours) || operatingHours.length === 0) {
    return { status: "closed", message: "Horário não informado" };
  }

  const allSlots = operatingHours.flatMap((daySchedule) => {
    if (!daySchedule.hours || !Array.isArray(daySchedule.hours)) return [];
    return daySchedule.hours
      .map((hourRange) => {
        const startMin = parseTime(hourRange.start);
        const endMin = parseTime(hourRange.end);

        if (startMin === -1 || endMin === -1) return null;

        const startMinutesIntoWeek = daySchedule.day_of_week * 24 * 60 + startMin;
        let endMinutesIntoWeek = daySchedule.day_of_week * 24 * 60 + endMin;

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

  const { dayOfWeek: currentDayIndex, minutesIntoWeek: nowMinutes } = getBrasiliaTimeInfo();
  const minutesInWeek = 7 * 24 * 60;

  for (const slot of allSlots) {
    // Verifica o tempo atual e o tempo atual na "próxima semana" para lidar com horários que cruzam de sábado para domingo
    const isCurrentlyInSlot = nowMinutes >= slot.start && nowMinutes < slot.end;
    const isCurrentlyInRolloverSlot = (nowMinutes + minutesInWeek) >= slot.start && (nowMinutes + minutesInWeek) < slot.end;

    if (isCurrentlyInSlot || isCurrentlyInRolloverSlot) {
      return { status: "open", message: `Aberto (fecha às ${formatMinutes(slot.end % 1440)})` };
    }
  }

  // Se fechado, encontra o próximo horário de abertura
  const sortedSlots = allSlots.sort((a, b) => a.start - b.start);
  let nextOpeningSlot = sortedSlots.find((slot) => slot.start > nowMinutes);

  // Se não encontrou um próximo horário nesta semana, pega o primeiro da semana seguinte
  if (!nextOpeningSlot) {
    nextOpeningSlot = { ...sortedSlots[0]!, start: sortedSlots[0]!.start + minutesInWeek };
  }

  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const dayIndex = Math.floor(nextOpeningSlot.start / (24 * 60)) % 7;
  const time = formatMinutes(nextOpeningSlot.start % 1440);
  const dayName = dayNames[dayIndex]!;

  if (dayIndex === currentDayIndex) {
    return { status: "closed", message: `Fechado (abre às ${time})` };
  }
  return { status: "closed", message: `Fechado (abre ${dayName} às ${time})` };
}
