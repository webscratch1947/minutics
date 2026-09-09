/**
 * profile.js — Profile CRUD
 * 
 * Replaces mangled exports: Ny (getProfile), fk (saveProfile), hk (clearProfile)
 * localStorage keys: "lifetime_profile", "lifetime_local_db_v1"
 */

import { getStore, setStore } from './storage.js';

const PROFILE_KEY = "lifetime_profile";

/**
 * @typedef {{ name: string, dob: string, lifespanYears: number }} Profile
 */

/** Read profile from localStorage, returns null if missing/invalid (was: Ny) */
export function getProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const profile = JSON.parse(raw);
    if (!profile.name || !profile.dob || typeof profile.lifespanYears !== "number") return null;
    return profile;
  } catch {
    return null;
  }
}

/** Save profile to localStorage + set install date (was: fk) */
export function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  if (!localStorage.getItem("lifetime_install_date")) {
    localStorage.setItem("lifetime_install_date", new Date().toISOString());
  }
}

/** Remove profile + local DB from localStorage (was: hk) */
export function clearProfile() {
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem("lifetime_local_db_v1");
}
