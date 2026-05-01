import axios from "axios";

const api = axios.create({
  baseURL: "https://enterprise-crm-backend-hyb0.onrender.com/api",
});

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("crm_token") || sessionStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log("API ERROR:", error);
    if (error?.response?.status === 401) {
      localStorage.removeItem("crm_token");
      localStorage.removeItem("token");
      localStorage.removeItem("crm_user");
      sessionStorage.clear();
      delete api.defaults.headers.common.Authorization;
      window.location.assign("/login");
    }
    return Promise.reject(error);
  }
);

export default api;