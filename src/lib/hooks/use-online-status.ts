"use client";

import { useSyncExternalStore } from "react";

function subscribeToOnlineStatus(callback: () => void) {
  window.addEventListener("offline", callback);
  window.addEventListener("online", callback);
  window.addEventListener("focus", callback);
  document.addEventListener("visibilitychange", callback);

  return () => {
    window.removeEventListener("offline", callback);
    window.removeEventListener("online", callback);
    window.removeEventListener("focus", callback);
    document.removeEventListener("visibilitychange", callback);
  };
}

function getOnlineStatus() {
  return window.navigator.onLine;
}

function getServerOnlineStatus() {
  return true;
}

export function useOnlineStatus() {
  return useSyncExternalStore(subscribeToOnlineStatus, getOnlineStatus, getServerOnlineStatus);
}
