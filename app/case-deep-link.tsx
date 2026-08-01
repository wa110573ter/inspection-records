"use client";

import { useEffect } from "react";

function normalize(value: string) {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

function formatDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${Number(match[1]) - 1911}/${match[2]}/${match[3]}`;
}

export default function CaseDeepLink() {
  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const waterNumber = parameters.get("caseWater") || "";
    if (!waterNumber) return;

    const customerName = parameters.get("caseName") || "";
    const receivedDate = parameters.get("receivedDate") || "";
    const recordDate = parameters.get("recordDate") || "";
    let stopped = false;
    let detailObserver: MutationObserver | null = null;

    function scrollToRecordDate() {
      if (!recordDate) return true;
      const expected = formatDate(recordDate);
      const divider = Array.from(document.querySelectorAll<HTMLElement>(".timeline-date-divider")).find(
        (element) => element.textContent?.includes(expected),
      );
      if (!divider) return false;
      divider.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    }

    function openMatchingCard() {
      const cards = Array.from(document.querySelectorAll<HTMLButtonElement>("button.case-card"));
      const expectedWater = normalize(waterNumber);
      const expectedName = customerName.trim();
      const expectedReceived = receivedDate ? `收件 ${formatDate(receivedDate)}` : "";
      const match = cards.find((card) => {
        const cardWater = normalize(card.querySelector<HTMLElement>(".water-no")?.textContent || "");
        const cardName = card.querySelector<HTMLElement>("h3")?.textContent?.trim() || "";
        const meta = card.querySelector<HTMLElement>(".case-meta")?.textContent || "";
        return (
          cardWater === expectedWater &&
          (!expectedName || cardName === expectedName) &&
          (!expectedReceived || meta.includes(expectedReceived))
        );
      });
      if (!match) return false;

      match.click();
      window.history.replaceState({}, "", "/");
      if (!scrollToRecordDate()) {
        detailObserver = new MutationObserver(() => {
          if (scrollToRecordDate()) detailObserver?.disconnect();
        });
        detailObserver.observe(document.body, { childList: true, subtree: true });
      }
      return true;
    }

    if (openMatchingCard()) return;

    const listObserver = new MutationObserver(() => {
      if (stopped) return;
      if (openMatchingCard()) listObserver.disconnect();
    });
    listObserver.observe(document.body, { childList: true, subtree: true });

    const timeout = window.setTimeout(() => listObserver.disconnect(), 12000);
    return () => {
      stopped = true;
      window.clearTimeout(timeout);
      listObserver.disconnect();
      detailObserver?.disconnect();
    };
  }, []);

  return null;
}
