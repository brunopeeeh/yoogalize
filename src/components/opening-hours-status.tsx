import { Clock } from "lucide-react";
import { getOpeningHoursInfo } from "@/lib/utils";

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

export const OpeningHoursStatus = ({ operatingHours }: OpeningHoursStatusProps) => {
  const { status, message } = getOpeningHoursInfo(operatingHours);

  if (message === 'Horário não informado') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
        <Clock className="w-4 h-4" />
        <span>{message}</span>
      </div>
    );
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
