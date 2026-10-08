import { EvalsView } from "@/components/app/EvalsView";
import { QualityStatus } from "@/components/app/QualityStatus";

export default function QualityPage() {
  return (
    <div>
      <QualityStatus />
      <EvalsView />
    </div>
  );
}
