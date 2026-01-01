import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import QueueManagement from "./pages/QueueManagement";
import StoreSettings from "./pages/StoreSettings";
import MenuManagement from "./pages/MenuManagement";
import KitchenDisplay from "./pages/KitchenDisplay";
import Analytics from "./pages/Analytics";
import DataExport from "./pages/DataExport";
import GuestRegister from "./pages/GuestRegister";
import GuestStatus from "./pages/GuestStatus";
import GuestMenu from "./pages/GuestMenu";
import Cashier from "./pages/Cashier";
import About from "./pages/About";
import Pricing from "./pages/Pricing";

function Router() {
  return (
    <Switch>
      {/* 公開ページ */}
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/pricing" component={Pricing} />
      
      {/* ゲスト用ページ（インストール不要） */}
      <Route path="/guest/register/:storeId" component={GuestRegister} />
      <Route path="/guest/status/:accessToken" component={GuestStatus} />
      <Route path="/guest/menu/:accessToken" component={GuestMenu} />
      
      {/* 管理者用ページ */}
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/queue/:storeId">
        {() => (
          <DashboardLayout>
            <QueueManagement />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/settings/:storeId">
        {() => (
          <DashboardLayout>
            <StoreSettings />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/menu/:storeId">
        {() => (
          <DashboardLayout>
            <MenuManagement />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/cashier/:storeId">
        {() => (
          <DashboardLayout>
            <Cashier />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/kitchen/:storeId">
        {() => (
          <DashboardLayout>
            <KitchenDisplay />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/analytics/:storeId">
        {() => (
          <DashboardLayout>
            <Analytics />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/export/:storeId">
        {() => (
          <DashboardLayout>
            <DataExport />
          </DashboardLayout>
        )}
      </Route>
      
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
