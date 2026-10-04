import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PortProvider } from "@/state/PortProvider";

import AppShell from "./pages/AppShell";
import Overview from "./pages/Overview";
import Vessels from "./pages/Vessels";
import VesselDetail from "./pages/VesselDetail";
import Yard from "./pages/Yard";
import Shipment from "./pages/Shipment";
import Logistics from "./pages/Logistics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster position="top-center" />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PortProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<Overview />} />
              <Route path="/vessels" element={<Vessels />} />
              <Route path="/vessels/:id" element={<VesselDetail />} />
              <Route path="/yard" element={<Yard />} />
              <Route path="/yard/:blockId" element={<Yard />} />
              <Route path="/shipments" element={<Navigate to="/shipments/SHP-20931" replace />} />
              <Route path="/shipments/:id" element={<Shipment />} />
              <Route path="/logistics" element={<Logistics />} />
              <Route path="/logistics/:id" element={<Logistics />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </PortProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
