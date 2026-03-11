import { useEffect, useRef } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { Shell } from "@/components/layout/Shell";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { XPPopup } from "@/components/gamification/XPPopup";
import { useSettings } from "@/hooks/useSettings";
import { useGamification } from "@/hooks/useGamification";
import { useSaveProgress } from "@/hooks/useSaveProgress";
import { useSession } from "@/hooks/useSession";
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
  const { load } = useSaveProgress();
  const { selectConcept } = useSession();
  const navigate = useNavigate();
  const hasRestored = useRef(false);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  // Restore saved progress on first load
  useEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;
    void (async () => {
      try {
        const saved = await load();
        if (saved && saved.route !== "/") {
          // If user was on a lesson/quiz, restore the concept via curriculum
          if (saved.conceptId && (saved.route === "/lesson" || saved.route === "/quiz")) {
            const { getCurriculumState } = await import("@/lib/ipc");
            const curriculum = await getCurriculumState();
            const concept = curriculum?.concepts.find((c) => c.id === saved.conceptId);
            if (concept) {
              selectConcept(concept);
            }
          }
          navigate(saved.route);
          // Restore scroll position after navigation
          if (saved.scrollY > 0) {
            requestAnimationFrame(() => {
              const main = document.querySelector("main");
              if (main) main.scrollTop = saved.scrollY;
            });
          }
        }
      } catch {
        // Silently fail — just start on dashboard
      }
    })();
  }, [load, navigate, selectConcept]);

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
