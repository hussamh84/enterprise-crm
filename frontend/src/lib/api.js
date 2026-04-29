import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api/v1",
});

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
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
      // localStorage.removeItem("crm_token");
      // localStorage.removeItem("token");
      // localStorage.removeItem("crm_user");
      // delete api.defaults.headers.common.Authorization;
      // window.location.assign("/login");
    }
    return Promise.reject(error);
  }
);

export default api;