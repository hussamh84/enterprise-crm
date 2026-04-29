export const normalizeTasks = (tickets) => (Array.isArray(tickets) ? tickets : []);

export const getTaskTitle = (task) => task?.clientName || task?.subject || task?.title || "Client Name";

export const getTaskLocation = (task) =>
  task?.location?.address || task?.address || task?.siteAddress || task?.locationName || "Unknown location";

export const getTaskCoords = (task, index = 0) => {
  const lat = Number(task?.location?.lat ?? task?.latitude ?? task?.lat);
  const lng = Number(task?.location?.lng ?? task?.longitude ?? task?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  const baseLat = 25.2854;
  const baseLng = 51.531;
  return [baseLat + index * 0.003, baseLng + index * 0.003];
};

export const getTaskCoordsStrict = (task) => {
  const lat = Number(task?.location?.lat ?? task?.latitude ?? task?.lat);
  const lng = Number(task?.location?.lng ?? task?.longitude ?? task?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
};

export const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
