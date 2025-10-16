import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- Nova Função Adicionada ---

type HourRange = {
  start: string;
  end: string;
};

type DailyHours = {
  day_of_week: number;
  hours: HourRange[];
};

/**
 * Verifica se um estabelecimento está aberto com base no horário de funcionamento e na hora atual.
 * @param operatingHours O array de horários de funcionamento do estabelecimento.
 * @returns `true` se estiver aberto, `false` caso contrário.
 */
export function isEstablishmentOpen(operatingHours?: DailyHours[]): boolean {
  if (!operatingHours || operatingHours.length === 0) {
    return false; // Considera-se fechado se não houver horário.
  }

  const now = new Date();
  // O getUTCDay() é usado para ser consistente com a lógica em opening-hours-status.tsx
  const dayOfWeek = now.getUTCDay(); 
  const todaySchedule = operatingHours.find(d => d.day_of_week === dayOfWeek);

  if (todaySchedule && todaySchedule.hours.length > 0) {
    const nowTime = now.getTime();

    for (const slot of todaySchedule.hours) {
      // Ignora entradas de horário inválidas
      if (!slot.start || !slot.end || slot.start.includes("Data invÃ¡lida") || slot.end.includes("Data invÃ¡lida")) {
        continue;
      }

      const startTime = new Date(slot.start);
      const endTime = new Date(slot.end);

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        continue;
      }
      
      // Constrói as datas de hoje com os horários do agendamento para comparação
      const todayStart = new Date(now.toISOString().slice(0, 10) + 'T' + startTime.toISOString().slice(11, 23) + 'Z');
      const todayEnd = new Date(now.toISOString().slice(0, 10) + 'T' + endTime.toISOString().slice(11, 23) + 'Z');

      if (nowTime >= todayStart.getTime() && nowTime <= todayEnd.getTime()) {
        return true; // Está aberto
      }
    }
  }

  return false; // Está fechado
}

// --- Nova Função Adicionada ---

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

type OpeningHoursInfo = {
  status: 'open' | 'closed';
  message: string;
}

/**
 * Retorna informações detalhadas sobre o horário de funcionamento de um estabelecimento.
 * @param operatingHours O array de horários de funcionamento.
 * @returns Um objeto com o status (`open` ou `closed`) e uma mensagem formatada.
 */
export function getOpeningHoursInfo(operatingHours?: DailyHours[]): OpeningHoursInfo {
  if (!operatingHours || operatingHours.length === 0) {
    return { status: 'closed', message: 'Horário não informado' };
  }

  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const todaySchedule = operatingHours.find(d => d.day_of_week === dayOfWeek);

  if (todaySchedule && todaySchedule.hours.length > 0) {
    const nowTime = now.getTime();

    for (const slot of todaySchedule.hours) {
      if (!slot.start || !slot.end || slot.start.includes("Data invÃ¡lida") || slot.end.includes("Data invÃ¡lida")) {
        continue;
      }

      const startTime = new Date(slot.start);
      const endTime = new Date(slot.end);

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        continue;
      }

      const todayStart = new Date(now.toISOString().slice(0, 10) + 'T' + startTime.toISOString().slice(11, 23) + 'Z');
      const todayEnd = new Date(now.toISOString().slice(0, 10) + 'T' + endTime.toISOString().slice(11, 23) + 'Z');

      if (nowTime >= todayStart.getTime() && nowTime <= todayEnd.getTime()) {
        return { status: 'open', message: `Aberto (fecha às ${formatTime(todayEnd)})` };
      }
    }
    
    // Se passou por todos os slots e não está aberto, procura o próximo horário
    const nextOpening = todaySchedule.hours
      .map(slot => new Date(now.toISOString().slice(0, 10) + 'T' + new Date(slot.start).toISOString().slice(11, 23) + 'Z'))
      .find(startDate => startDate.getTime() > nowTime);

    if (nextOpening) {
      return { status: 'closed', message: `Fechado (abre às ${formatTime(nextOpening)})` };
    }
  }

  return { status: 'closed', message: 'Fechado hoje' };
}
