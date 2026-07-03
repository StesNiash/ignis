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

// Plugin IDs for internal plugins that create / modify content.
// These are language-independent and stable across Obsidian versions.
const DANGEROUS_PLUGIN_IDS = new Set([
  "daily-notes",
  "templates",
  "canvas",
  "note-composer",
  "audio-recorder",
  "bases",
]);

// English text for dangerous context-menu items (only place we still match text).
// We match against exact Obsidian internal labels – numbers are locale file line refs.
const HIDE_MENU_TEXTS_EN = new Set([
  "Delete",
  "Rename",
  "Make a copy",
]);

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

function hideDangerousRibbonItems() {
  const app = window.app;
  if (!app?.workspace?.leftRibbon?.items) return;

  for (const item of app.workspace.leftRibbon.items) {
    const pluginId = item.id?.split(":")[0];
    if (DANGEROUS_PLUGIN_IDS.has(pluginId) && item.buttonEl) {
      item.buttonEl.style.display = "none";
    }
  }
}

function hideDangerousMenuItems() {
  document.querySelectorAll(".menu-item").forEach((el) => {
    const text = (el.getAttribute("aria-label") || el.textContent || "").trim();
    if (HIDE_MENU_TEXTS_EN.has(text)) {
      el.style.display = "none";
    }
  });
}

function enforceReadOnly() {
  makeAllEditorsReadOnly();
  hideDangerousRibbonItems();

  readOnlyObserver = new MutationObserver(() => {
    makeAllEditorsReadOnly();
    hideDangerousRibbonItems();
    hideDangerousMenuItems();
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
