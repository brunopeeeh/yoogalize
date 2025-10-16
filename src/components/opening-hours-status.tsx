import { Clock } from "lucide-react";

type HourRange = {
  start: string;
  end: string;
};

type DailyHours = {
  day_of_week: number;
  hours: HourRange[];
};

type OpeningHoursStatusProps = {
  operatingHours?: DailyHours[];
};

const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

export const OpeningHoursStatus = ({ operatingHours }: OpeningHoursStatusProps) => {
  if (!operatingHours || operatingHours.length === 0) {
    return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
            <Clock className="w-4 h-4" />
            <span>Horário não informado</span>
        </div>
    );
  }

  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const todaySchedule = operatingHours.find(d => d.day_of_week === dayOfWeek);

  let status: 'open' | 'closed' = 'closed';
  let message = 'Fechado';

  if (todaySchedule && todaySchedule.hours.length > 0) {
    const nowTime = now.getTime();
    
    // We need to construct today's date with the hour from the schedule
    // because the date in the JSON is from 2022.
    for (const slot of todaySchedule.hours) {
      // Adicionado para ignorar entradas de horÃ¡rio invÃ¡lidas do JSON
      if (!slot.start || !slot.end || slot.start.includes("Data invÃ¡lida") || slot.end.includes("Data invÃ¡lida")) {
        continue;
      }

      const startTime = new Date(slot.start);
      const endTime = new Date(slot.end);

      // Adicionado para pular se a conversÃ£o da data falhar
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        continue;
      }

      const todayStart = new Date(now.toISOString().slice(0, 10) + 'T' + startTime.toISOString().slice(11, 23) + 'Z');
      const todayEnd = new Date(now.toISOString().slice(0, 10) + 'T' + endTime.toISOString().slice(11, 23) + 'Z');

      if (nowTime >= todayStart.getTime() && nowTime <= todayEnd.getTime()) {
        status = 'open';
        message = `Aberto (fecha Ã s ${formatTime(endTime)})`;
        break;
      }
    }
    
    if (status === 'closed') {
        const nextOpening = todaySchedule.hours[0];
        if(nextOpening) {
            const nextOpeningTime = new Date(nextOpening.start);
            message = `Fechado (abre às ${formatTime(nextOpeningTime)})`;
        } else {
            message = 'Fechado hoje';
        }
    }
  } else {
    message = 'Fechado hoje';
  }

  return (
    <div className="flex items-center gap-2 text-sm mt-2">
        <Clock className={`w-4 h-4 flex-shrink-0 ${status === 'open' ? 'text-green-600' : 'text-red-600'}`} />
        <span className={`${status === 'open' ? 'text-green-600' : 'text-red-600'} font-medium`}>
            {message}
        </span>
    </div>
  );
};
