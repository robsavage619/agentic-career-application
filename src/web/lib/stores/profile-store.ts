import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Profile } from "@/lib/api";

interface ProfileState {
  profileId: number | null;
  profile: Profile | null;
  setProfile: (profile: Profile) => void;
  clearProfile: () => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profileId: null,
      profile: null,
      setProfile: (profile) => set({ profileId: profile.id, profile }),
      clearProfile: () => set({ profileId: null, profile: null }),
    }),
    { name: "ccc-profile" }
  )
);
