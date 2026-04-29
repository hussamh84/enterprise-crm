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
