import { Clock } from "lucide-react";
import { getOpeningHoursInfo } from "@/lib/utils";
import { OperatingHour } from "@/lib/types";

type OpeningHoursStatusProps = {
  operatingHours?: OperatingHour[];
};

export const OpeningHoursStatus = ({ operatingHours }: OpeningHoursStatusProps) => {
  let parsedOperatingHours = operatingHours;

  // Garante que o horário de funcionamento seja um objeto, não uma string JSON
  if (typeof operatingHours === 'string') {
    try {
      parsedOperatingHours = JSON.parse(operatingHours);
    } catch (error) {
      console.error("Erro ao fazer parse do horário de funcionamento:", error);
      parsedOperatingHours = undefined; // Reseta para um estado seguro em caso de erro
    }
  }

  const { status, message } = getOpeningHoursInfo(parsedOperatingHours);

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
