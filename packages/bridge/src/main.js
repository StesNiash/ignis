import { Plugin, TFile, TFolder, Menu } from "obsidian";
import {
  showFilePicker,
  addFileMenuItems,
  addFolderMenuItems,
} from "./file-actions.js";
import {
  patchSettingsModal,
  unpatchSettingsModal,
} from "./settings/inject.js";
import * as pluginRegistry from "./plugin-registry.js";
import { initStatusBar } from "./status-bar.js";
import { WorkspacePickerModal } from "./workspace-picker.js";
import { startDemoGuards, stopDemoGuards } from "./demo-guards.js";

let currentUser = null;
let readOnlyObserver = null;
let readOnlyStyle = null;

async function fetchCurrentUser() {
  try {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      currentUser = await res.json();
      window.__ignisUserRole = currentUser.role;
    }
  } catch {}
}

function makeAllEditorsReadOnly() {
  document.querySelectorAll(".cm-editor .cm-content").forEach((el) => {
    el.setAttribute("contenteditable", "false");
  });
}

function injectReadOnlyStyles() {
  if (readOnlyStyle) return;
  readOnlyStyle = document.createElement("style");
  readOnlyStyle.textContent = `
    body.ignis-readonly .nav-header .nav-action-button[aria-label="New note"],
    body.ignis-readonly .nav-header .nav-action-button[aria-label="New folder"],
    body.ignis-readonly .nav-header .nav-action-button[aria-label="Sort"] {
      display: none !important;
    }
  `;
  document.head.appendChild(readOnlyStyle);
}

function removeReadOnlyStyles() {
  if (readOnlyStyle) {
    readOnlyStyle.remove();
    readOnlyStyle = null;
  }
}

function hideCreateActions() {
  // Hide ribbon actions that create content
  const createLabels = /create|new|insert|template|canvas|database|note|folder|drawing/i;
  document.querySelectorAll(".side-dock-ribbon-action").forEach((el) => {
    const label = el.getAttribute("aria-label") || "";
    if (createLabels.test(label)) {
      el.style.display = "none";
    }
  });

  // Hide file explorer create buttons
  document.querySelectorAll('.nav-header .nav-action-button').forEach((el) => {
    const label = el.getAttribute("aria-label") || "";
    if (/new note|new folder/i.test(label)) {
      el.style.display = "none";
    }
  });

  // Hide dangerous context menu items
  const hideMenuLabels = /delete|rename|move|make a copy|reveal/i;
  document.querySelectorAll(".menu-item").forEach((el) => {
    const title = el.getAttribute("aria-label") || el.textContent || "";
    if (hideMenuLabels.test(title)) {
      el.style.display = "none";
    }
  });
}

function enforceReadOnly() {
  document.body.classList.add("ignis-readonly");
  injectReadOnlyStyles();

  // Run immediately and retry as Obsidian renders progressively
  function sweep() {
    makeAllEditorsReadOnly();
    hideCreateActions();
  }

  sweep();
  setTimeout(sweep, 100);
  setTimeout(sweep, 500);
  setTimeout(sweep, 1500);
  setTimeout(sweep, 3000);

  readOnlyObserver = new MutationObserver(() => {
    makeAllEditorsReadOnly();
    hideCreateActions();
  });

  readOnlyObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function stopEnforceReadOnly() {
  if (readOnlyObserver) {
    readOnlyObserver.disconnect();
    readOnlyObserver = null;
  }
  removeReadOnlyStyles();
  document.body.classList.remove("ignis-readonly");
  document.querySelectorAll(".cm-editor .cm-content").forEach((el) => {
    el.setAttribute("contenteditable", "true");
  });
}

function showAdminDashboard() {
  if (window.IgnisUI?.AdminDashboard) {
    new window.IgnisUI.AdminDashboard({ target: document.body });
  }
}

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  document.cookie = "token=;path=/;max-age=0";
  window.location.href = "/login";
}

class IgnisBridgePlugin extends Plugin {
  async onload() {
    if (!window.__ignis) {
      console.log("[ignis-bridge] Not running in Ignis - plugin is a no-op.");
      return;
    }

    console.log("[ignis-bridge] Plugin loaded");

    await pluginRegistry.refresh();
    patchSettingsModal(this);
    startDemoGuards();
    this._statusBarInterval = initStatusBar(this);
    await fetchCurrentUser();

    if (currentUser?.role === "reader") {
      enforceReadOnly();
    }

    if (currentUser?.role !== "reader") {
      this.addRibbonIcon("upload", "Upload file", () => {
        showFilePicker(this.app);
      });
    }

    this.addCommand({
      id: "open-workspace-in-new-tab",
      name: "Open workspace in new tab",
      callback: () => {
        new WorkspacePickerModal(this.app).open();
      },
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFile) {
          addFileMenuItems(menu, file);
        } else if (file instanceof TFolder) {
          addFolderMenuItems(menu, file, this.app);
        }
      }),
    );

    // Profile ribbon icon with dropdown menu
    if (currentUser) {
      this.addRibbonIcon("user", `Signed in as ${currentUser.username}`, (evt) => {
        const menu = new Menu();

        menu.addItem((item) =>
          item
            .setTitle(`User: ${currentUser.username}`)
            .setIcon("user")
            .setDisabled(true),
        );

        menu.addItem((item) =>
          item
            .setTitle(`Role: ${currentUser.role}`)
            .setIcon("shield")
            .setDisabled(true),
        );

        menu.addSeparator();

        if (currentUser.role === "admin") {
          menu.addItem((item) =>
            item
              .setTitle("Admin Dashboard")
              .setIcon("settings")
              .onClick(() => showAdminDashboard()),
          );

          menu.addSeparator();
        }

        menu.addItem((item) =>
          item
            .setTitle("Logout")
            .setIcon("log-out")
            .onClick(() => logout()),
        );

        menu.showAtMouseEvent(evt);
      });
    }
  }

  onunload() {
    if (!window.__ignis) {
      return;
    }

    if (this._statusBarInterval) {
      clearInterval(this._statusBarInterval);
    }

    stopEnforceReadOnly();
    unpatchSettingsModal(this);
    stopDemoGuards();
    console.log("[ignis-bridge] Plugin unloaded");
  }
}

export default IgnisBridgePlugin;
