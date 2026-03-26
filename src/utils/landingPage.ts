interface LandingCompany {
  companyId: string;
  companyName: string;
  birthdaysOnCalendar: number;
  activeEmployeeCount: number;
  fetchedUserCount: number;
  icsUrl: string;
  webcalUrl: string;
  qrUrl: string;
}

interface LandingMissingBirthdayPerson {
  companyId: string;
  companyName: string;
  userId: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

interface LandingPageData {
  lastSyncedAt: string | null;
  totalBirthdays: number;
  totalActiveEmployees: number;
  totalUsersFetched: number;
  totalMissingBirthdays: number;
  missingBirthdayPeople: LandingMissingBirthdayPerson[];
  companies: LandingCompany[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatLastSynced(value: string | null): string {
  if (!value) {
    return "Not synced yet";
  }

  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function renderSubscriptionRows(companies: LandingCompany[]): string {
  return companies
    .map((company, index) => {
      const escapedName = escapeHtml(company.companyName);
      const escapedIcsUrl = escapeHtml(company.icsUrl);
      const escapedWebcalUrl = escapeHtml(company.webcalUrl);

      return `<article class="feed-row">
  <div class="feed-head">
    <div>
      <p class="eyebrow">Calendar Feed</p>
      <h3>${escapedName}</h3>
    </div>
    <p class="feed-meta">${formatNumber(company.birthdaysOnCalendar)} birthdays · ${formatNumber(
        company.activeEmployeeCount
      )} active 7shifters</p>
  </div>
  <div class="url-row">
    <input id="ics-url-${index}" class="url-input" type="text" value="${escapedIcsUrl}" readonly />
    <button class="copy-button" type="button" data-copy-target="ics-url-${index}">Copy URL</button>
  </div>
  <div class="feed-actions">
    <a class="button button-secondary" href="${escapedWebcalUrl}">Open in Apple Calendar</a>
    <a class="button button-ghost" href="${escapedIcsUrl}">Open Raw ICS</a>
  </div>
</article>`;
    })
    .join("\n");
}

function renderMissingBirthdayRows(people: LandingMissingBirthdayPerson[]): string {
  return people
    .map((person) => {
      const checkboxKey = escapeHtml(`missing:${person.companyId}:${person.userId}`);
      const escapedName = escapeHtml(person.fullName);
      const escapedCompanyName = escapeHtml(person.companyName);

      return `<label class="missing-row">
  <input class="missing-checkbox" type="checkbox" data-check-key="${checkboxKey}" />
  <span class="missing-checkmark" aria-hidden="true"></span>
  <span class="missing-name">${escapedName}</span>
  <span class="missing-company">${escapedCompanyName}</span>
</label>`;
    })
    .join("\n");
}

export function renderLandingPage(data: LandingPageData): string {
  const firstCompany = data.companies[0];
  const subscriptionRows = data.companies.length
    ? renderSubscriptionRows(data.companies)
    : `<p class="empty-state">No calendar feeds yet. Run a refresh after adding a valid 7shifts token.</p>`;

  const appleQuickSubscribe = firstCompany
    ? `<section class="card qr-card">
  <p class="eyebrow">Apple Calendar on iPhone</p>
  <h2>iPhone Quick Subscribe</h2>
  <p class="body-copy">Scan this QR code with your iPhone camera. It opens the subscription flow in the Apple Calendar app using the same live calendar feed.</p>
  <img src="${escapeHtml(firstCompany.qrUrl)}" alt="QR code for Apple Calendar iPhone subscription" />
  <a class="button button-secondary" href="${escapeHtml(firstCompany.webcalUrl)}">Open in Apple Calendar</a>
</section>`
    : "";

  const escapedLastSynced = escapeHtml(formatLastSynced(data.lastSyncedAt));
  const missingBirthdaySection = data.totalMissingBirthdays
    ? `<div id="missing-birthdays-modal" class="modal-shell" hidden>
  <div class="modal-backdrop" data-close-missing-modal></div>
  <section class="card missing-modal" role="dialog" aria-modal="true" aria-labelledby="missing-birthdays-title">
    <div class="section-head">
      <div>
        <p class="eyebrow">Admin Review</p>
        <h2 id="missing-birthdays-title">Active 7shifters Missing Birthdays</h2>
      </div>
      <div class="modal-head-actions">
        <p class="section-meta">${formatNumber(data.totalMissingBirthdays)} missing birthdays</p>
        <button id="close-missing-button" class="button button-ghost" type="button">Close</button>
      </div>
    </div>
    <p class="body-copy">Use the checkmarks to keep your place while you work through the list. They are only saved in this browser.</p>
    <div class="missing-list">
      ${renderMissingBirthdayRows(data.missingBirthdayPeople)}
    </div>
  </section>
</div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>birthdaycalendar.me 🎈</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #081019;
      --bg-2: #0f1824;
      --panel: rgba(13, 22, 33, 0.92);
      --panel-2: rgba(20, 32, 47, 0.95);
      --border: rgba(120, 158, 188, 0.2);
      --text: #edf6ff;
      --muted: #8ea6be;
      --accent: #f7a531;
      --accent-2: #49c5b6;
      --button-text: #071019;
      --shadow: 0 24px 80px rgba(0, 0, 0, 0.38);
    }

    html {
      min-height: 100%;
      background: var(--bg-2);
      overscroll-behavior-y: none;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      color: var(--text);
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      position: relative;
      isolation: isolate;
      background: transparent;
      line-height: 1.5;
      min-height: 100vh;
      overscroll-behavior-y: none;
    }

    body::before {
      content: "";
      position: fixed;
      inset: 0;
      z-index: -1;
      pointer-events: none;
      background:
        radial-gradient(900px 500px at -5% -10%, rgba(73, 197, 182, 0.18), transparent 55%),
        radial-gradient(900px 500px at 110% 10%, rgba(247, 165, 49, 0.16), transparent 52%),
        linear-gradient(180deg, var(--bg) 0%, var(--bg-2) 100%);
      background-repeat: no-repeat;
      background-size: cover;
    }

    .wrap {
      max-width: 1120px;
      margin: 0 auto;
      padding: 2rem 1rem 3.5rem;
    }

    .hero {
      display: grid;
      gap: 1.25rem;
      grid-template-columns: 1.4fr 0.9fr;
      align-items: start;
    }

    .hero-copy {
      background: linear-gradient(160deg, rgba(16, 25, 37, 0.94), rgba(9, 16, 26, 0.94));
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 1.5rem;
      box-shadow: var(--shadow);
    }

    .eyebrow {
      margin: 0 0 0.4rem;
      color: var(--accent-2);
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      font-size: clamp(2.4rem, 6vw, 4.4rem);
      line-height: 0.96;
      letter-spacing: -0.04em;
    }

    .sub {
      max-width: 46rem;
      margin: 0.85rem 0 0;
      color: var(--muted);
      font-size: 1.03rem;
    }

    .hero-controls {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      margin-top: 1.2rem;
      flex-wrap: wrap;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      min-height: 44px;
      padding: 0.72rem 0.95rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.02);
      font-size: 0.92rem;
    }

    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0.72rem 1rem;
      border: 0;
      border-radius: 999px;
      font: inherit;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      transition: transform 160ms ease, opacity 160ms ease, background 160ms ease;
    }

    .button:hover { transform: translateY(-1px); }
    .button:disabled { opacity: 0.6; cursor: wait; transform: none; }

    .button-primary {
      color: var(--button-text);
      background: linear-gradient(135deg, var(--accent) 0%, #ffc86f 100%);
    }

    .button-secondary {
      color: var(--text);
      background: linear-gradient(135deg, rgba(73, 197, 182, 0.22), rgba(73, 197, 182, 0.1));
      border: 1px solid rgba(73, 197, 182, 0.28);
    }

    .button-ghost {
      color: var(--text);
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border);
    }

    .stats {
      margin-top: 1rem;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.8rem;
    }

    .stat {
      padding: 1rem;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border);
      border-radius: 18px;
    }

    .stat strong {
      display: block;
      color: var(--accent);
      font-size: 1.75rem;
      letter-spacing: -0.03em;
    }

    .stat span {
      display: block;
      margin-top: 0.18rem;
      color: var(--muted);
      font-size: 0.92rem;
    }

    .hero-grid {
      margin-top: 1rem;
      display: grid;
      gap: 1rem;
      grid-template-columns: 1.2fr 0.9fr;
    }

    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 1.25rem;
      box-shadow: var(--shadow);
    }

    .card h2 {
      margin: 0 0 0.55rem;
      font-size: 1.4rem;
      letter-spacing: -0.02em;
    }

    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 1rem;
      flex-wrap: wrap;
      margin-bottom: 0.55rem;
    }

    .section-meta {
      margin: 0;
      color: var(--muted);
      font-size: 0.92rem;
    }

    .body-copy {
      margin: 0;
      color: var(--muted);
    }

    .feed-list {
      display: grid;
      gap: 0.95rem;
      margin-top: 1rem;
    }

    .feed-row {
      padding: 1rem;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.02));
      border: 1px solid var(--border);
      border-radius: 18px;
    }

    .feed-head {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 1rem;
      margin-bottom: 0.8rem;
      flex-wrap: wrap;
    }

    .feed-head h3 {
      margin: 0;
      font-size: 1.1rem;
    }

    .feed-meta {
      margin: 0;
      color: var(--muted);
      font-size: 0.92rem;
    }

    .url-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.65rem;
      align-items: center;
    }

    .url-input {
      width: 100%;
      min-height: 46px;
      padding: 0.8rem 0.95rem;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: rgba(1, 6, 14, 0.68);
      color: var(--text);
      font: inherit;
      font-family: "SFMono-Regular", "Monaco", monospace;
    }

    .feed-actions {
      display: flex;
      gap: 0.65rem;
      margin-top: 0.8rem;
      flex-wrap: wrap;
    }

    .instructions {
      display: grid;
      gap: 0.8rem;
      margin-top: 1rem;
    }

    .steps {
      margin: 0;
      padding-left: 1.2rem;
    }

    .steps li {
      margin: 0.42rem 0;
      color: var(--muted);
    }

    .qr-card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.9rem;
      background: linear-gradient(180deg, rgba(73, 197, 182, 0.08), rgba(255, 255, 255, 0.03));
    }

    .qr-card img {
      width: 240px;
      max-width: 100%;
      padding: 0.5rem;
      background: #fff;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.18);
    }

    .note {
      margin-top: 1rem;
      color: var(--muted);
      font-size: 0.92rem;
    }

    .modal-shell {
      position: fixed;
      inset: 0;
      z-index: 40;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .modal-shell[hidden] {
      display: none;
    }

    .modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(2, 6, 12, 0.72);
      backdrop-filter: blur(8px);
    }

    .missing-modal {
      position: relative;
      z-index: 1;
      width: min(960px, 100%);
      max-height: min(82vh, 920px);
      overflow: hidden;
    }

    .missing-list {
      display: grid;
      gap: 0.7rem;
      margin-top: 1rem;
      max-height: calc(min(82vh, 920px) - 170px);
      overflow: auto;
      padding-right: 0.15rem;
    }

    .modal-head-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .missing-row {
      display: grid;
      grid-template-columns: auto auto 1fr auto;
      gap: 0.8rem;
      align-items: center;
      padding: 0.85rem 0.95rem;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.03);
      cursor: pointer;
    }

    .missing-checkbox {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    .missing-checkmark {
      width: 22px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      border: 1px solid rgba(73, 197, 182, 0.32);
      background: rgba(255, 255, 255, 0.02);
      color: transparent;
      transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
    }

    .missing-checkbox:checked + .missing-checkmark {
      color: #041218;
      background: var(--accent-2);
      border-color: var(--accent-2);
    }

    .missing-checkbox:checked + .missing-checkmark::before {
      content: "✓";
      font-size: 0.82rem;
      font-weight: 800;
    }

    .missing-name {
      font-weight: 700;
    }

    .missing-company {
      color: var(--muted);
      font-size: 0.92rem;
      text-align: right;
    }

    .empty-state {
      margin: 0;
      color: var(--muted);
    }

    @media (max-width: 920px) {
      .hero,
      .hero-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .url-row {
        grid-template-columns: 1fr;
      }

      .missing-row {
        grid-template-columns: auto auto 1fr;
      }

      .missing-company {
        grid-column: 1 / -1;
        padding-left: calc(22px + 0.8rem);
        text-align: left;
      }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <div class="hero-copy">
        <h1>birthdaycalendar.me 🎈</h1>
        <p class="sub">Subscribe the live birthday calendar in Apple Calendar or Google Calendar. Use the copy button for the exact feed URL, use the iPhone quick subscribe tools to open the Apple Calendar app directly, and review active 7shifters missing birthdays from the admin view.</p>

        <div class="hero-controls">
          <button id="manual-refresh-button" class="button button-primary" type="button">Manual Refresh</button>
          ${
            data.totalMissingBirthdays
              ? `<button id="toggle-missing-button" class="button button-secondary" type="button">Show Missing Birthdays (${formatNumber(
                  data.totalMissingBirthdays
                )})</button>`
              : ""
          }
          <div id="refresh-status" class="status-pill">Last sync: ${escapedLastSynced}</div>
        </div>

        <section class="stats">
          <div class="stat"><strong>${formatNumber(data.totalBirthdays)}</strong><span>Birthdays on Calendar</span></div>
          <div class="stat"><strong>${formatNumber(data.totalActiveEmployees)}</strong><span>Active 7shifters</span></div>
          <div class="stat"><strong>${formatNumber(data.totalUsersFetched)}</strong><span>Users Fetched</span></div>
          <div class="stat"><strong>${escapeHtml(String(data.companies.length))}</strong><span>Calendar Feeds</span></div>
        </section>
      </div>

      ${appleQuickSubscribe}
    </section>

    <section class="hero-grid">
      <article class="card">
        <p class="eyebrow">Copyable Feed URL</p>
        <h2>Subscription URL</h2>
        <p class="body-copy">Use this exact URL in Google Calendar. Apple Calendar can also accept this URL directly, but the Apple button and QR code above are faster on iPhone.</p>
        <div class="feed-list">
          ${subscriptionRows}
        </div>
      </article>

      <article class="card">
        <p class="eyebrow">Setup Guide</p>
        <h2>How to Add It</h2>
        <div class="instructions">
          <div>
            <p class="eyebrow">Apple Calendar</p>
            <ol class="steps">
              <li>On iPhone, scan the QR code above or tap <strong>Open in Apple Calendar</strong>.</li>
              <li>On Mac, open Calendar and add a subscribed calendar from URL.</li>
              <li>If you prefer, copy the HTTPS URL above and paste it into Apple Calendar.</li>
            </ol>
          </div>
          <div>
            <p class="eyebrow">Google Calendar</p>
            <ol class="steps">
              <li>Open Google Calendar in your browser.</li>
              <li>Click the <strong>+</strong> next to <strong>Other calendars</strong>.</li>
              <li>Choose <strong>From URL</strong> and paste the copied subscription URL.</li>
            </ol>
          </div>
        </div>
        <p class="note">Manual refresh pulls the latest birthday data from 7shifts immediately and reloads this page when it completes.</p>
      </article>
    </section>

  </main>

  ${missingBirthdaySection}

  <script>
    const refreshButton = document.getElementById("manual-refresh-button");
    const refreshStatus = document.getElementById("refresh-status");
    const toggleMissingButton = document.getElementById("toggle-missing-button");
    const missingBirthdaysModal = document.getElementById("missing-birthdays-modal");
    const closeMissingButton = document.getElementById("close-missing-button");
    const missingCheckboxes = Array.from(document.querySelectorAll("[data-check-key]"));
    const missingBirthdayStorageKey = "birthdaycalendar-missing-birthday-checks";

    async function copyText(targetId, button) {
      const input = document.getElementById(targetId);
      if (!input) {
        return;
      }

      try {
        await navigator.clipboard.writeText(input.value);
        const previous = button.textContent;
        button.textContent = "Copied";
        setTimeout(() => {
          button.textContent = previous;
        }, 1400);
      } catch {
        input.focus();
        input.select();
      }
    }

    document.querySelectorAll("[data-copy-target]").forEach((button) => {
      button.addEventListener("click", () => {
        copyText(button.getAttribute("data-copy-target"), button);
      });
    });

    function loadMissingBirthdayChecks() {
      try {
        const raw = window.localStorage.getItem(missingBirthdayStorageKey);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }

    function saveMissingBirthdayChecks(values) {
      try {
        window.localStorage.setItem(missingBirthdayStorageKey, JSON.stringify(values));
      } catch {
        // ignore storage failures and keep the UI usable
      }
    }

    const missingBirthdayChecks = loadMissingBirthdayChecks();
    missingCheckboxes.forEach((checkbox) => {
      const key = checkbox.getAttribute("data-check-key");
      checkbox.checked = Boolean(key && missingBirthdayChecks[key]);

      checkbox.addEventListener("change", () => {
        if (!key) {
          return;
        }
        missingBirthdayChecks[key] = checkbox.checked;
        saveMissingBirthdayChecks(missingBirthdayChecks);
      });
    });

    function setMissingModalOpen(isOpen) {
      if (!toggleMissingButton || !missingBirthdaysModal) {
        return;
      }

      if (isOpen) {
        missingBirthdaysModal.removeAttribute("hidden");
        toggleMissingButton.textContent = "Hide Missing Birthdays";
        document.body.style.overflow = "hidden";
        return;
      }

      missingBirthdaysModal.setAttribute("hidden", "");
      toggleMissingButton.textContent = "Show Missing Birthdays (${formatNumber(data.totalMissingBirthdays)})";
      document.body.style.overflow = "";
    }

    if (toggleMissingButton && missingBirthdaysModal) {
      toggleMissingButton.addEventListener("click", () => {
        setMissingModalOpen(missingBirthdaysModal.hasAttribute("hidden"));
      });

      missingBirthdaysModal.querySelectorAll("[data-close-missing-modal]").forEach((node) => {
        node.addEventListener("click", () => {
          setMissingModalOpen(false);
        });
      });

      if (closeMissingButton) {
        closeMissingButton.addEventListener("click", () => {
          setMissingModalOpen(false);
        });
      }

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !missingBirthdaysModal.hasAttribute("hidden")) {
          setMissingModalOpen(false);
        }
      });
    }

    refreshButton.addEventListener("click", async () => {
      refreshButton.disabled = true;
      refreshStatus.textContent = "Refreshing from 7shifts...";

      try {
        const response = await fetch("/refresh", { method: "POST" });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.message || "Refresh failed.");
        }

        refreshStatus.textContent = "Refresh complete. Reloading...";
        window.setTimeout(() => window.location.reload(), 800);
      } catch (error) {
        refreshStatus.textContent = error instanceof Error ? error.message : "Refresh failed.";
        refreshButton.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}
