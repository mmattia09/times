import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="mb-6 h-7 w-40" />
      <Skeleton className="h-72 w-full" />
      <Skeleton className="mt-8 h-64 w-full" />
    </div>
  );
}
