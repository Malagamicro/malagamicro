import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { toast } from "sonner";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ActiveCallsProvider } from "@/contexts/ActiveCallsContext";
import { ProtectedRoute } from "@/components/app/ProtectedRoute";
import { ThemeProvider } from "@/components/app/theme-provider";
import { ThemeSyncProvider } from "@/components/app/ThemeSyncProvider";
import { MascotChatWidget } from "@/components/chat/MascotChatWidget";
import { GlobalCallListener } from "@/components/internal-chat/GlobalCallListener";
import { EventReminderMonitor } from "@/components/calendar/EventReminderMonitor";
import { VersionChecker } from "@/components/app/VersionChecker";
import { NotificationPopupStack } from "@/components/notifications/NotificationPopup";
import { useCustomNotifications } from "@/hooks/useCustomNotifications";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const WhatsAppTest = lazy(() => import("./pages/WhatsAppTest"));
const Install = lazy(() => import("./pages/Install"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const GeneralReminders = lazy(() => import("./pages/GeneralReminders"));
const SeoGenerator = lazy(() => import("./pages/SeoGenerator"));
const NotFound = lazy(() => import("./pages/NotFound"));
const DocumentEditorPage = lazy(() => import("./pages/DocumentEditorPage"));

const PageLoader = () => (
  <div className="flex h-screen w-screen items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.errorMessage === false) return;
      // Logging para debug, y mostrar toast
      console.error('Global Query Error:', error);
      toast.error(`Error: ${error.message}`);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Si la mutación ya tiene su propio onError definido localmente, se evita el toast doble
      if (mutation.options.onError) return;
      console.error('Global Mutation Error:', error);
      toast.error(`Error en la operación: ${error.message}`);
    },
  }),
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
              <Suspense fallback={<PageLoader />}>
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
            </Suspense>
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
