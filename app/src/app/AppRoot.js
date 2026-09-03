import { $w, Af, Ny, Po, Yb, c, kf, ky, w, yb } from '../shared.js';
import { HC } from './AndroidBridge.js';
import { ak, ck, dk } from '../_slice_shell.js';
import { mk } from '../_slice_onboarding.js';
import { HomeScreen } from '../screens/Home.js';
import { LifeHubScreen } from '../screens/LifeHub.js';
import { JournalScreen } from '../screens/Journal.js';
import { SettingsScreen } from '../screens/Settings.js';

const yh = new $w({
  defaultOptions: {
    queries: {
      retry: !1,
      refetchOnWindowFocus: !1
    }
  }
});

function VC({
  profile: e
}) {
  return c.jsxs(ak, {
    children: [c.jsx(HC, {}), c.jsxs(Yb, {
      children: [c.jsx(Po, {
        path: "/",
        component: () => c.jsx(HomeScreen, {
          profile: e
        })
      }), c.jsx(Po, {
        path: "/timeline",
        component: () => c.jsx(LifeHubScreen, {
          profile: e
        })
      }), c.jsx(Po, {
        path: "/journal",
        component: JournalScreen
      }), c.jsx(Po, {
        path: "/settings",
        component: SettingsScreen
      }), c.jsx(Po, {
        component: dk
      })]
    })]
  })
}

export function QC() {
  console.log("APPROOT: Rendering QC component");
  const [e, t] = w.useState(() => {
    const profile = Ny();
    console.log("APPROOT: Initial profile check:", profile);
    return profile;
  });
  console.log("APPROOT: Current profile state:", e);
  return e ? (console.log("APPROOT: Rendering authenticated app with profile"), c.jsx(kf, {
    client: yh,
    children: c.jsxs(yb, {
      children: [c.jsx(ky, {
        children: c.jsx(VC, {
          profile: e
        })
      }), c.jsx(Af, {})]
    })
  })) : (console.log("APPROOT: Rendering onboarding (no profile)"), c.jsxs(kf, {
    client: yh,
    children: [c.jsx(mk, {
      onComplete: t
    }), c.jsx(Af, {})]
  }))
}
