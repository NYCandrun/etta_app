import { motion } from "framer-motion";
import { MasteryChart } from "@/components/progress/MasteryChart";
import { ReviewForecast } from "@/components/progress/ReviewForecast";
import { BadgeGallery } from "@/components/progress/BadgeGallery";
import { ScienceJournal } from "@/components/progress/ScienceJournal";
import { useGamification } from "@/hooks/useGamification";

export default function Progress() {
  const { badges } = useGamification();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Top row: Chart + Review forecast */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <MasteryChart className="lg:col-span-2" />
        <ReviewForecast />
      </div>

      {/* Badge gallery */}
      <BadgeGallery badges={badges} />

      {/* Science journal */}
      <ScienceJournal />
    </motion.div>
  );
}
