import React, { useState } from "react";
import { Route, Bus, BusTrip } from "../../types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/Tabs";
import { RouteSettings } from "./RouteSettings";
import { BusSettings } from "./BusSettings";
import { SystemMaintenance } from "./SystemMaintenance";
import { PaymentConfig } from "./PaymentConfig";

interface SettingsViewProps {
  routes: Route[];
  setRoutes: (routes: Route[]) => void;
  buses: Bus[];
  setBuses: (buses: Bus[]) => void;
  trips: BusTrip[];
  setTrips: (trips: BusTrip[]) => void;
  onDataChange: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  routes,
  buses,
  trips,
  onDataChange,
}) => {
  // PERSISTENCE: Active Tab
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem("settings_tab") || "routes",
  );

  React.useEffect(() => {
    localStorage.setItem("settings_tab", activeTab);
  }, [activeTab]);

  return (
    <div className="mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex-col md:flex">
        <div className="flex-1 space-y-4">
          <Tabs
            defaultValue="routes"
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-4"
          >
            {/* Tabs List */}
            <TabsList>
              <TabsTrigger value="routes">Tuyến đường</TabsTrigger>
              <TabsTrigger value="buses">Đội xe</TabsTrigger>
              <TabsTrigger value="system">Hệ thống</TabsTrigger>
              <TabsTrigger value="qr-bank">QR / Ngân hàng</TabsTrigger>
            </TabsList>

            <TabsContent value="routes" className="space-y-4">
              <RouteSettings routes={routes} onDataChange={onDataChange} />
            </TabsContent>

            <TabsContent
              value="buses"
              className="space-y-4 focus-visible:outline-none"
            >
              <BusSettings
                buses={buses}
                routes={routes}
                onDataChange={onDataChange}
              />
            </TabsContent>

            <TabsContent
              value="system"
              className="space-y-6 focus-visible:outline-none"
            >
              <SystemMaintenance
                buses={buses}
                trips={trips}
                onDataChange={onDataChange}
              />
            </TabsContent>

            <TabsContent value="qr-bank" className="space-y-6">
              <PaymentConfig />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
