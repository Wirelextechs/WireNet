import { Router, Route } from "wouter";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Storefront from "@/pages/Storefront";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminLogin from "@/pages/AdminLogin";
import DataGodPage from "@/pages/DataGodPage";
import FastNetPage from "@/pages/FastNetPage";
import AtPage from "@/pages/AtPage";
import TelecelPage from "@/pages/TelecelPage";
import DataGodAdmin from "@/pages/DataGodAdmin";
import FastNetAdmin from "@/pages/FastNetAdmin";
import OrderSuccess from "@/pages/OrderSuccess";
import { useAuth } from "@/hooks/useAuth";

const queryClient = new QueryClient();

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Route path="/" component={Storefront} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/datagod" component={DataGodPage} />
      <Route path="/fastnet" component={FastNetPage} />
      <Route path="/at" component={AtPage} />
      <Route path="/telecel" component={TelecelPage} />
      <Route path="/admin/datagod" component={DataGodAdmin} />
      <Route path="/admin/fastnet" component={FastNetAdmin} />
      <Route path="/order/success/:orderId" component={OrderSuccess} />
    </Router>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <Toaster />
    </QueryClientProvider>
  );
}
