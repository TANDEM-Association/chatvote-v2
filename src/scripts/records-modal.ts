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

  // Charge le PV augmenté d'une séance (HTML déjà nettoyé par le serveur) à sa
  // première ouverture. En cas d'échec, un bouton permet de réessayer.
  const loadBody = async (detail: HTMLElement) => {
    const body = detail.querySelector<HTMLElement>("[data-pv-body]");
    const status = detail.querySelector<HTMLElement>("[data-pv-status]");
    const message = status?.querySelector<HTMLElement>("[data-pv-message]");
    const retry = status?.querySelector<HTMLButtonElement>("[data-pv-retry]");
    const src = body?.dataset.pvSrc;
    if (!body || !status || !message || !retry || !src) return;
    if (body.dataset.state === "loading" || body.dataset.state === "loaded") {
      return;
    }

    body.dataset.state = "loading";
    body.setAttribute("aria-busy", "true");
    status.hidden = false;
    retry.hidden = true;
    message.textContent = "Chargement du compte rendu…";
    try {
      const response = await fetch(src, { credentials: "same-origin" });
      if (!response.ok) throw new Error(String(response.status));
      body.innerHTML = await response.text();
      // Les liens du PV (sources officielles) sortent du site.
      for (const link of body.querySelectorAll<HTMLAnchorElement>("a[href]")) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      body.dataset.state = "loaded";
      status.hidden = true;
    } catch {
      body.dataset.state = "error";
      message.textContent = "Impossible de charger ce compte rendu.";
      retry.hidden = false;
    } finally {
      body.removeAttribute("aria-busy");
    }
  };

  for (const detail of details) {
    detail
      .querySelector("[data-pv-retry]")
      ?.addEventListener("click", () => loadBody(detail));
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
    void loadBody(target);
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
