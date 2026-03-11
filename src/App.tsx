import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Shell } from "@/components/layout/Shell";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { XPPopup } from "@/components/gamification/XPPopup";
import { useSettings } from "@/hooks/useSettings";
import { useGamification } from "@/hooks/useGamification";
import Dashboard from "@/routes/Dashboard";
import Lesson from "@/routes/Lesson";
import Quiz from "@/routes/Quiz";
import Project from "@/routes/Project";
import Progress from "@/routes/Progress";
import Settings from "@/routes/Settings";
import Diagnostic from "@/routes/Diagnostic";
import LearningPath from "@/routes/LearningPath";

export default function App() {
  const { initialize } = useSettings();
  const { pendingPopup, dismissPopup } = useGamification();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <ErrorBoundary>
      <OfflineBanner />
      <Shell>
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/lesson" element={<Lesson />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/projects" element={<Project />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/diagnostic" element={<Diagnostic />} />
            <Route path="/path/:domainId" element={<LearningPath />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </Shell>
      {pendingPopup && (
        <XPPopup event={pendingPopup} onComplete={dismissPopup} />
      )}
    </ErrorBoundary>
  );
}
