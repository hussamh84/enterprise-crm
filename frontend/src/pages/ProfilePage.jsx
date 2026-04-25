import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const updateSessionUser = useAuthStore((s) => s.updateUser);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["/users/me"],
    queryFn: async () => (await api.get("/users/me")).data,
  });

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName || profile.name || "");
    setEmail(profile.email || "");
  }, [profile]);

  const updateProfile = useMutation({
    mutationFn: async () => api.put("/users/me", { fullName, email }),
    onSuccess: ({ data }) => {
      setProfileError("");
      setProfileMessage("Profile updated successfully.");
      updateSessionUser({
        fullName: data.fullName,
        name: data.name || data.fullName,
        email: data.email,
        role: data.role,
      });
      queryClient.invalidateQueries({ queryKey: ["/users/me"] });
    },
    onError: (err) => {
      setProfileMessage("");
      setProfileError(err?.response?.data?.message || "Could not update profile.");
    },
  });

  const onSaveProfile = (e) => {
    e.preventDefault();
    setProfileMessage("");
    setProfileError("");
    if (!fullName.trim() || !email.trim()) {
      setProfileError("Name and email are required.");
      return;
    }
    updateProfile.mutate();
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage("");
    setPasswordError("");
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError("Fill in all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    try {
      setIsChangingPassword(true);
      console.log("Sending request...");
      await api.put("/auth/change-password", { oldPassword, newPassword });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError("");
      setPasswordMessage("Password changed successfully.");
      alert("Password changed successfully");
    } catch (err) {
      console.error(err);
      setPasswordMessage("");
      setPasswordError(err?.response?.data?.message || "Error changing password");
      alert("Error changing password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading && !profile) {
    return (
      <div className="text-sm text-[#6b7c93]">Loading profile…</div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="section-title">My profile</h1>
        <p className="text-[#6b7c93] mt-1 text-sm">Update your name, email, and password without leaving the app.</p>
      </div>

      <form onSubmit={onSaveProfile} className="premium-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[#0a2540]">Account details</h2>
        <div>
          <label className="block text-xs font-medium text-[#6b7c93] mb-1">Full name</label>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#6b7c93] mb-1">Email</label>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        {profileError ? <p className="text-sm text-red-600">{profileError}</p> : null}
        {profileMessage ? <p className="text-sm text-emerald-600">{profileMessage}</p> : null}
        <button
          type="submit"
          disabled={updateProfile.isPending}
          className="rounded-md bg-[#635bff] text-white px-3 py-1.5 text-sm hover:opacity-90 transition disabled:opacity-60"
        >
          {updateProfile.isPending ? "Saving…" : "Save profile"}
        </button>
      </form>

      <form onSubmit={handleChangePassword} className="premium-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[#0a2540]">Change password</h2>
        <div>
          <label className="block text-xs font-medium text-[#6b7c93] mb-1">Current password</label>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#6b7c93] mb-1">New password</label>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#6b7c93] mb-1">Confirm new password</label>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {passwordError ? <p className="text-sm text-red-600">{passwordError}</p> : null}
        {passwordMessage ? <p className="text-sm text-emerald-600">{passwordMessage}</p> : null}
        <button
          type="submit"
          disabled={isChangingPassword}
          className="rounded-md bg-[#635bff] text-white px-3 py-1.5 text-sm hover:opacity-90 transition disabled:opacity-60"
        >
          {isChangingPassword ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
