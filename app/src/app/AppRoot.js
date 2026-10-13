import { useState, useEffect, useRef } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter } from 'react-router-dom';
import { getProfile } from '../lib/profile.js';
import { ak } from '../_slice_shell.js';
import { mk } from '../_slice_onboarding.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false
    }
  }
});

function AuthenticatedApp({ profile }) {
  return jsx(HashRouter, {
    children: jsx(ak, { profile })
  });
}

export function QC() {
  const [profile, setProfile] = useState(() => getProfile());
  // Bumped on account switch so onboarding + the whole app remount fresh
  const [userEpoch, setUserEpoch] = useState(0);
  // First render: check if profile exists
  const profileRef = useRef(profile);

  useEffect(() => {
    profileRef.current = getProfile();
    setProfile(profileRef.current);
  }, []);

  // auth.js dispatches this whenever the per-account storage is swapped
  useEffect(() => {
    function onUserChanged() {
      profileRef.current = getProfile();
      setProfile(profileRef.current);
      setUserEpoch(n => n + 1);
      queryClient.clear();
    }
    window.addEventListener("lt-user-changed", onUserChanged);
    return () => window.removeEventListener("lt-user-changed", onUserChanged);
  }, []);

  // profile.js saveProfile dispatches this on every Settings edit (dob,
  // lifespan, name) so the Timer countdown/retirement line updates live.
  useEffect(() => {
    function onProfileChanged() {
      profileRef.current = getProfile();
      setProfile(profileRef.current);
    }
    window.addEventListener("lt-profile-changed", onProfileChanged);
    return () => window.removeEventListener("lt-profile-changed", onProfileChanged);
  }, []);

  // Tell auth.js the remount has committed so it can safely drop the gate
  // (prevents a flash of stale UI while React is still swapping accounts).
  useEffect(() => {
    if (userEpoch === 0) return;
    try { window.dispatchEvent(new CustomEvent("lt-user-changed-applied")); } catch (e) {}
  }, [userEpoch]);

  // No profile → show onboarding
  if (!profile) {
    return jsx(mk, {
      key: "ob-" + userEpoch,
      onComplete: (newProfile) => {
        setProfile(newProfile);
      }
    });
  }

  // Has profile → show authenticated app with providers
  return jsx(QueryClientProvider, {
    client: queryClient,
    children: jsxs("div", {
      key: "app-" + userEpoch,
      children: [
        jsx(AuthenticatedApp, { profile })
      ]
    })
  });
}
