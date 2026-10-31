import { useAuth, useClerk, useUser } from '@clerk/react';
import { Bookmark, LogOut, ShieldCheck, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  getOwner as checklistOwner,
  clearLocal as clearChecklist,
} from '../features/checklist/checklistStore';
import { setTokenGetter } from '../shared/api';
import { cleanSaved, LAST_KEY, type SavedItem, sameItem } from './savedFlights';

// Clerk glue for the app: hands the session token to API calls, draws the account menu and sign-out, keeps saved flights in the
// user's profile, and clears an account's data from a shared device after sign-out.
export function TokenBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    setTokenGetter(() => getToken());
    return () => setTokenGetter(null);
  }, [getToken]);
  return null;
}
// Initials and a short name for the account button, from the Clerk profile. Nothing invented: no name, no initials.
function useAccount() {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress || '';
  const name =
    user?.fullName || user?.firstName || user?.username || (email ? email.split('@')[0] : '');
  const initials = (user?.firstName?.[0] || '') + (user?.lastName?.[0] || '') || name.slice(0, 2);
  const google = !!user?.externalAccounts?.some((a) => /google/i.test(String(a.provider)));
  return {
    name,
    email,
    initials: initials.toUpperCase(),
    via: user ? (google ? 'Signed in with Google' : 'Signed in by email') : '',
  };
}
// The account menu in the top bar: who is signed in, saved flights, account and data (Clerk's profile), owner console, sign out.
export function AuthBar({ isAdmin, onConsole }: { isAdmin: boolean; onConsole: () => void }) {
  const { openUserProfile, signOut } = useClerk();
  const a = useAccount();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const close = () => setOpen(false);
  return (
    <div className="rel auth-bar" ref={box}>
      <button
        ref={btn}
        type="button"
        className="me"
        aria-expanded={open}
        aria-controls="me-pop"
        aria-label={a.name ? `Account menu for ${a.name}` : 'Account menu'}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="avatar" aria-hidden="true">
          {a.initials || <User size={18} />}
        </span>
        <span className="me-text">
          <b title={a.email || a.name}>{a.name || 'Your account'}</b>
          <small>{a.via}</small>
        </span>
      </button>
      {open && (
        <div className="pop me-pop" id="me-pop">
          <a href="#/saved" onClick={close}>
            <Bookmark size={20} aria-hidden="true" />
            Saved flights
          </a>
          <button
            type="button"
            className="item"
            onClick={() => {
              close();
              openUserProfile();
            }}
          >
            <User size={20} aria-hidden="true" />
            Account and data
          </button>
          {isAdmin && (
            <button
              type="button"
              className="item"
              onClick={() => {
                close();
                onConsole();
              }}
            >
              <ShieldCheck size={20} aria-hidden="true" />
              Owner console
            </button>
          )}
          <button
            type="button"
            className="item danger"
            onClick={() => {
              close();
              void signOut();
            }}
          >
            <LogOut size={20} aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
// Sign out at the bottom of the sidebar.
export function SignOutItem() {
  const { signOut } = useClerk();
  return (
    <button
      type="button"
      className="signout"
      aria-label="Sign out"
      title="Sign out"
      onClick={() => void signOut()}
    >
      <LogOut size={20} aria-hidden="true" />
      <span className="nav-text">Sign out</span>
    </button>
  );
}
// "Account and data" on the help page opens Clerk's own profile, where the account (and with it the saved flights) can be deleted.
export function AccountButton({ className = 'btn btn-ghost btn-sm' }: { className?: string }) {
  const { openUserProfile } = useClerk();
  return (
    <button type="button" className={className} onClick={() => openUserProfile()}>
      Account and data
    </button>
  );
}
// Keeps the saved-flights list in the signed-in user's Clerk profile (unsafeMetadata, editable only by that user) so it follows them across devices.
export function SavedSync({
  saved,
  setSaved,
  setSignedIn,
  setUserId,
}: {
  saved: SavedItem[];
  setSaved: (v: SavedItem[]) => void;
  setSignedIn: (v: boolean) => void;
  setUserId: (v: string | null) => void;
}) {
  const { isLoaded, isSignedIn, user } = useUser();
  const hydrated = useRef<string | null>(null);
  const owner = (v?: string) => {
    try {
      if (v === undefined) return localStorage.getItem('flightdeck-saved-owner');
      if (v) localStorage.setItem('flightdeck-saved-owner', v);
      else localStorage.removeItem('flightdeck-saved-owner');
    } catch {}
    return null;
  };
  useEffect(() => {
    if (!isLoaded) return;
    setSignedIn(!!isSignedIn);
    setUserId(user?.id ?? null);
    // Signed out (including after the page reload that signing out causes) while this device still holds an account's list: wipe it, so the next person on a shared device does not see it.
    if (!isSignedIn || !user) {
      hydrated.current = null;
      if (owner()) {
        setSaved([]);
        owner('');
      }
      return;
    }
    if (hydrated.current === user.id) return;
    hydrated.current = user.id;
    const cloud = cleanSaved(user.unsafeMetadata?.savedFlights);
    const mine = owner() === user.id || !owner() ? saved : [];
    const merged = [...cloud, ...mine.filter((l) => !cloud.some((c) => sameItem(c, l)))].slice(
      0,
      12,
    );
    owner(user.id);
    setSaved(merged);
  }, [isLoaded, isSignedIn, user?.id]);
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || hydrated.current !== user.id) return;
    const cloud = cleanSaved(user.unsafeMetadata?.savedFlights);
    if (JSON.stringify(cloud) === JSON.stringify(saved)) return;
    const t = setTimeout(() => {
      user
        .update({ unsafeMetadata: { ...user.unsafeMetadata, savedFlights: saved } })
        .catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [saved, isLoaded, isSignedIn, user?.id]);
  return null;
}
export // Signing out reloads onto the landing page, where the dashboard (and its own clean-up) is not mounted. Anything an account left on this
// device is wiped here so the next person on a shared computer does not see it. A guest's own list (no owner mark) is left alone.
function SignedOutCleanup() {
  useEffect(() => {
    try {
      if (localStorage.getItem('flightdeck-saved-owner')) {
        localStorage.removeItem('flightdeck-saved');
        localStorage.removeItem('flightdeck-saved-owner');
      }
    } catch {}
    try {
      localStorage.removeItem(LAST_KEY);
    } catch {}
    if (checklistOwner()) clearChecklist();
  }, []);
  return null;
}
