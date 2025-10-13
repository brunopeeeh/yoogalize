import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const ResultCardSkeleton = () => {
  return (
    <Card className="p-4 flex flex-col space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex-grow space-y-2 pt-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <div className="flex justify-end pt-2">
        <Skeleton className="h-5 w-1/4" />
      </div>
    </Card>
  );
};
