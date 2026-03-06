import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ActiveCallsProvider } from "@/contexts/ActiveCallsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSyncProvider } from "@/components/ThemeSyncProvider";
import { MascotChatWidget } from "@/components/chat/MascotChatWidget";
import { GlobalCallListener } from "@/components/internal-chat/GlobalCallListener";
import { EventReminderMonitor } from "@/components/calendar/EventReminderMonitor";
import { VersionChecker } from "@/components/VersionChecker";
import { NotificationPopupStack } from "@/components/notifications/NotificationPopup";
import { useCustomNotifications } from "@/hooks/useCustomNotifications";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import WhatsAppTest from "./pages/WhatsAppTest";


import Install from "./pages/Install";
import AdminUsers from "./pages/AdminUsers";
import GeneralReminders from "./pages/GeneralReminders";

import SeoGenerator from "./pages/SeoGenerator";
import NotFound from "./pages/NotFound";
import DocumentEditorPage from "./pages/DocumentEditorPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 60s — avoids unnecessary refetches on tab focus/remount
      staleTime: 60_000,
      // Keep unused cache for 5 minutes
      gcTime: 5 * 60_000,
      // Don't retry on 4xx client errors
      retry: (failureCount, error: unknown) => {
        const status = (error as { status?: number })?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

function NotificationPopupLayer() {
  const { popupQueue, dismissPopup } = useCustomNotifications();
  return <NotificationPopupStack popups={popupQueue} onDismiss={dismissPopup} />;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <ActiveCallsProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Auth />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route
                  path="/install"
                  element={
                    <ProtectedRoute>
                      <Install />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/whatsapp-test"
                  element={
                    <ProtectedRoute>
                      <WhatsAppTest />
                    </ProtectedRoute>
                  }
                />
                
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <ThemeSyncProvider>
                        <Index />
                      </ThemeSyncProvider>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute>
                      <AdminUsers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reminders"
                  element={
                    <ProtectedRoute>
                      <GeneralReminders />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tools/seo"
                  element={
                    <ProtectedRoute>
                      <SeoGenerator />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tools/editor"
                  element={
                    <ProtectedRoute>
                      <DocumentEditorPage />
                    </ProtectedRoute>
                  }
                />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <VersionChecker />
            <MascotChatWidget />
            <GlobalCallListener />
            <EventReminderMonitor />
            <NotificationPopupLayer />
          </BrowserRouter>
          </TooltipProvider>
          </ActiveCallsProvider>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
