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

async function fetchCurrentUser() {
  try {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      currentUser = await res.json();
    }
  } catch {}
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

    this.addRibbonIcon("upload", "Upload file", () => {
      showFilePicker(this.app);
    });

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

    unpatchSettingsModal(this);
    stopDemoGuards();
    console.log("[ignis-bridge] Plugin unloaded");
  }
}

export default IgnisBridgePlugin;
