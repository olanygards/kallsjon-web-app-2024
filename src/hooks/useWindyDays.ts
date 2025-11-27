// Legacy useWindyDays för DailyView
// Denna är en stub för att inte bryta befintlig funktionalitet
export function useWindyDays(_params: { minForce?: number; year?: number }) {
  // Returnera ett objekt med windSpeedMap (tom för nu)
  // Detta kan implementeras senare om DailyView ska användas
  return {
    windSpeedMap: new Map<string, number>()
  };
}
