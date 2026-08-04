"use client";

import { useEffect } from "react";

function toAppleMapsLink(href: string) {
  try {
    const url = new URL(href, window.location.origin);
    if (!url.hostname.endsWith("google.com") || !url.pathname.includes("maps")) return href;

    const destination = url.searchParams.get("q") || url.searchParams.get("destination");
    if (!destination) return href;

    return `https://maps.apple.com/?daddr=${encodeURIComponent(destination)}&dirflg=d`;
  } catch {
    return href;
  }
}

export default function AppleMapsLinks() {
  useEffect(() => {
    const updateLinks = () => {
      document.querySelectorAll<HTMLAnchorElement>('a[href*="maps.google.com"], a[href*="google.com/maps"]').forEach((link) => {
        link.href = toAppleMapsLink(link.href);
        link.setAttribute("aria-label", "使用 Apple 地圖導航");
      });
    };

    updateLinks();
    const observer = new MutationObserver(updateLinks);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
