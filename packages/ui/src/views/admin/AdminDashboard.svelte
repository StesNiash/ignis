<script>
  import { onMount } from "svelte";
  import { Users, Shield, Settings, ListChecks } from "lucide-svelte";
  import Modal from "../../components/layout/Modal.svelte";
  import Button from "../../components/input/Button.svelte";
  import UserList from "./UserList.svelte";
  import VaultPermissions from "./VaultPermissions.svelte";
  import RoleList from "./RoleList.svelte";
  import RoleEditor from "./RoleEditor.svelte";

  let modalRef;
  let activeTab = "users";
  let users = [];
  let vaults = [];
  let permissions = {};
  let roles = [];
  let editingRole = null;
  let error = "";

  const tabs = [
    { id: "users", label: "Users", icon: Users },
    { id: "roles", label: "Roles", icon: Shield },
    { id: "permissions", label: "Vault Access", icon: ListChecks },
  ];

  async function fetchUsers() {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      users = await res.json();
    } catch (e) {
      error = e.message;
    }
  }

  async function fetchVaults() {
    try {
      const res = await fetch("/api/vault/list");
      if (!res.ok) throw new Error("Failed to fetch vaults");
      vaults = await res.json();
    } catch (e) {
      error = e.message;
    }
  }

  async function fetchPermissions() {
    try {
      const res = await fetch("/api/admin/permissions");
      if (!res.ok) throw new Error("Failed to fetch permissions");
      permissions = await res.json();
    } catch (e) {
      error = e.message;
    }
  }

  async function fetchRoles() {
    try {
      const res = await fetch("/api/admin/roles");
      if (!res.ok) throw new Error("Failed to fetch roles");
      roles = await res.json();
    } catch (e) {
      error = e.message;
    }
  }

  async function refresh() {
    await Promise.all([fetchUsers(), fetchVaults(), fetchPermissions(), fetchRoles()]);
  }

  onMount(refresh);
</script>

<Modal
  title="Admin Dashboard"
  width="780px"
  bind:this={modalRef}
  closeOnOverlayClick={false}
  on:escape={editingRole ? () => (editingRole = null) : undefined}
>
  <svelte:fragment slot="icon">
    <Settings size="1.25rem" />
  </svelte:fragment>

  <div class="admin-layout">
    <div class="tab-bar">
      {#each tabs as tab}
        <button
          class="tab"
          class:active={activeTab === tab.id}
          on:click={() => (activeTab = tab.id)}
        >
          <svelte:component this={tab.icon} size="1rem" />
          <span>{tab.label}</span>
        </button>
      {/each}
    </div>

    <div class="tab-content">
      {#if error}
        <div class="error">{error}</div>
      {/if}

      {#if activeTab === "users"}
        <UserList {users} {roles} {refresh} />
      {:else if activeTab === "roles"}
        {#if editingRole}
          <RoleEditor
            role={editingRole}
            onSave={() => { editingRole = null; refresh(); }}
            onClose={() => (editingRole = null)}
          />
        {/if}
        <RoleList {roles} {refresh} onEditRole={(r) => (editingRole = r)} />
      {:else if activeTab === "permissions"}
        <VaultPermissions {vaults} {permissions} {users} {refresh} />
      {/if}
    </div>
  </div>

  <svelte:fragment slot="footer">
    <div class="footer">
      <Button variant="ghost" on:click={() => modalRef.dismiss()}>Close</Button>
    </div>
  </svelte:fragment>
</Modal>

<style>
  .admin-layout {
    display: flex;
    flex-direction: column;
    min-height: 400px;
  }

  .tab-bar {
    display: flex;
    border-bottom: 1px solid var(--background-modifier-border);
    padding: 0 1.5rem;
    gap: 0;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-size: 0.875rem;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  .tab:hover {
    color: var(--text-normal);
  }

  .tab.active {
    color: var(--interactive-accent);
    border-bottom-color: var(--interactive-accent);
  }

  .tab-content {
    flex: 1;
    padding: 1.25rem 1.5rem;
    overflow-y: auto;
  }

  .error {
    color: var(--text-error);
    background: rgba(255, 0, 0, 0.1);
    padding: 0.75rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .footer {
    display: flex;
    justify-content: flex-end;
  }
</style>
