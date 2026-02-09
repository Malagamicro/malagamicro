import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSyncProvider } from "@/components/ThemeSyncProvider";
import { MascotChatWidget } from "@/components/chat/MascotChatWidget";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import WhatsAppTest from "./pages/WhatsAppTest";
import Scraper from "./pages/Scraper";
import FileManager from "./pages/FileManager";
import Install from "./pages/Install";
import AdminUsers from "./pages/AdminUsers";
import GeneralReminders from "./pages/GeneralReminders";
import Budgets from "./pages/Budgets";
import SeoGenerator from "./pages/SeoGenerator";
import NotFound from "./pages/NotFound";
const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
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
                  path="/tools/scraper"
                  element={
                    <ProtectedRoute>
                      <Scraper />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/tools/files"
                  element={
                    <ProtectedRoute>
                      <FileManager />
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
                  path="/budgets"
                  element={
                    <ProtectedRoute>
                      <Budgets />
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
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <MascotChatWidget />
          </BrowserRouter>
          </TooltipProvider>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
