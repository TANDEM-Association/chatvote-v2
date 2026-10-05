const modal = document.querySelector<HTMLElement>("[data-records-modal]");
const chat = document.querySelector<HTMLElement>("[data-chat-frame]");
const recordsTab = document.querySelector<HTMLButtonElement>(
  '[data-view-tab="records"]',
);
const chatTab = document.querySelector<HTMLButtonElement>(
  '[data-view-tab="chat"]',
);
const closeButton = modal?.querySelector<HTMLButtonElement>(
  "[data-records-close]",
);

if (modal && chat && recordsTab && chatTab && closeButton) {
  const setOpen = (open: boolean) => {
    modal.toggleAttribute("data-open", open);
    modal.inert = !open;
    // L'iframe reste montée dessous (conversation conservée) mais inactive.
    chat.inert = open;
    recordsTab.setAttribute("aria-pressed", String(open));
    chatTab.setAttribute("aria-pressed", String(!open));
  };

  recordsTab.addEventListener("click", () => {
    setOpen(true);
    closeButton.focus();
  });
  chatTab.addEventListener("click", () => setOpen(false));
  closeButton.addEventListener("click", () => {
    setOpen(false);
    recordsTab.focus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.hasAttribute("data-open")) {
      setOpen(false);
      recordsTab.focus();
    }
  });
}
