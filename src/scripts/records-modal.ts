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

  const list = modal.querySelector<HTMLElement>("[data-records-list]");
  const details = modal.querySelectorAll<HTMLElement>("[data-record-detail]");
  const content = modal.querySelector<HTMLElement>("[data-records-content]");
  let openDetail: HTMLElement | null = null;
  let openRow: HTMLElement | null = null;

  // Le Markdown vient de contenus copiés tels quels : leurs liens sortent du site.
  for (const link of modal.querySelectorAll<HTMLAnchorElement>(
    "[data-record-detail] a[href^='http']",
  )) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  const showList = () => {
    if (!list || !openDetail) return;
    openDetail.hidden = true;
    list.hidden = false;
    openDetail = null;
    if (content) content.scrollTop = 0;
    openRow?.focus();
  };

  const showDetail = (id: string, row: HTMLElement) => {
    const target = [...details].find((el) => el.dataset.recordDetail === id);
    if (!list || !target) return;
    list.hidden = true;
    target.hidden = false;
    openDetail = target;
    openRow = row;
    if (content) content.scrollTop = 0;
    target.querySelector<HTMLElement>("[data-record-back]")?.focus();
  };

  list?.addEventListener("click", (event) => {
    const row = (event.target as Element).closest<HTMLElement>(
      "[data-record-id]",
    );
    if (row?.dataset.recordId) showDetail(row.dataset.recordId, row);
  });
  for (const detail of details) {
    detail
      .querySelector("[data-record-back]")
      ?.addEventListener("click", showList);
  }

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
      // Échap remonte d'un niveau : détail → liste → chat.
      if (openDetail) {
        showList();
        return;
      }
      setOpen(false);
      recordsTab.focus();
    }
  });
}
