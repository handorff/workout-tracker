import { QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route, Routes } from "react-router-dom";

import { queryClient } from "./lib/query-client";
import { LoginPage } from "./features/auth/LoginPage";
import { AuthProvider } from "./features/auth/auth-context";
import { ProtectedRoute } from "./features/auth/ProtectedRoute";
import { ActiveWorkoutPage } from "./routes/ActiveWorkoutPage";
import { ExerciseDetailPage } from "./routes/ExerciseDetailPage";
import { ExerciseHelpPage } from "./routes/ExerciseHelpPage";
import { HistoryPage } from "./routes/HistoryPage";
import { TodayPage } from "./routes/TodayPage";
import { WorkoutCompletePage } from "./routes/WorkoutCompletePage";

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate replace to="/today" />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/today" element={<TodayPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/exercises/:exerciseId" element={<ExerciseDetailPage />} />
            <Route path="/workout/:sessionId" element={<ActiveWorkoutPage />} />
            <Route
              path="/workout/:sessionId/help/:exerciseId"
              element={<ExerciseHelpPage />}
            />
            <Route path="/workout/:sessionId/complete" element={<WorkoutCompletePage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
}
