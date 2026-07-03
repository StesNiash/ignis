<script>
  import { createEventDispatcher } from "svelte";
  import { UserPlus, Trash2, Check, X } from "lucide-svelte";
  import Button from "../../components/input/Button.svelte";

  export let users = [];
  export let roles = [];
  export let refresh = () => {};

  let showCreate = false;
  let createUsername = "";
  let createPassword = "";
  let createRole = "reader";
  let createError = "";

  let editingUser = null;
  let editRole = "";
  let editPassword = "";
  let editError = "";

  $: roleOptions = roles.length > 0
    ? roles.map((r) => r.name)
    : ["admin", "editor", "reader"];

  async function handleCreate() {
    createError = "";
    if (!createUsername.trim() || !createPassword) {
      createError = "All fields required";
      return;
    }

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: createUsername.trim(),
          password: createPassword,
          role: createRole,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      showCreate = false;
      createUsername = "";
      createPassword = "";
      createRole = roleOptions[0] || "reader";
      refresh();
    } catch (e) {
      createError = e.message;
    }
  }

  function startEdit(user) {
    editingUser = user;
    editRole = user.role;
    editPassword = "";
    editError = "";
  }

  async function handleEdit() {
    editError = "";
    const body = {};
    if (editRole !== editingUser.role) body.role = editRole;
    if (editPassword) body.password = editPassword;

    if (Object.keys(body).length === 0) {
      editingUser = null;
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(editingUser.username)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      editingUser = null;
      refresh();
    } catch (e) {
      editError = e.message;
    }
  }

  async function handleDelete(username) {
    if (!confirm(`Delete user "${username}"?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      refresh();
    } catch (e) {
      alert(e.message);
    }
  }

  function roleBadge(role) {
    const r = roles.find((rr) => rr.name === role);
    return r?.displayName || role;
  }
</script>

<div class="user-list">
  <div class="list-header">
    <h3>Users ({users.length})</h3>
    <Button variant="ghost" on:click={() => (showCreate = !showCreate)}>
      <svelte:fragment slot="icon"><UserPlus size="0.875rem" /></svelte:fragment>
      Add User
    </Button>
  </div>

  {#if showCreate}
    <div class="create-form">
      <input type="text" placeholder="Username" bind:value={createUsername} />
      <input type="password" placeholder="Password" bind:value={createPassword} />
      <select bind:value={createRole}>
        {#each roleOptions as ro}
          <option value={ro}>{ro}</option>
        {/each}
      </select>
      <div class="form-actions">
        <Button variant="ghost" size="small" on:click={() => { showCreate = false; createError = ""; }}>
          <svelte:fragment slot="icon"><X size="0.875rem" /></svelte:fragment>
        </Button>
        <Button variant="primary" size="small" on:click={handleCreate}>
          <svelte:fragment slot="icon"><Check size="0.875rem" /></svelte:fragment>
          Create
        </Button>
      </div>
      {#if createError}
        <div class="form-error">{createError}</div>
      {/if}
    </div>
  {/if}

  <div class="table">
    <div class="table-row header">
      <span class="col-user">User</span>
      <span class="col-role">Role</span>
      <span class="col-actions"></span>
    </div>

    {#each users as user (user.username)}
      {#if editingUser && editingUser.username === user.username}
        <div class="table-row editing">
          <span class="col-user">{user.username}</span>
          <span class="col-role">
            <select bind:value={editRole}>
              {#each roleOptions as ro}
                <option value={ro}>{ro}</option>
              {/each}
            </select>
          </span>
          <span class="col-password">
            <input type="password" placeholder="New password" bind:value={editPassword} />
          </span>
          <span class="col-actions">
            <Button variant="ghost" size="small" on:click={() => (editingUser = null)}>
              <svelte:fragment slot="icon"><X size="0.875rem" /></svelte:fragment>
            </Button>
            <Button variant="primary" size="small" on:click={handleEdit}>
              <svelte:fragment slot="icon"><Check size="0.875rem" /></svelte:fragment>
              Save
            </Button>
          </span>
          {#if editError}
            <div class="form-error">{editError}</div>
          {/if}
        </div>
      {:else}
        <div class="table-row">
          <span class="col-user">
            <strong>{user.username}</strong>
            <span class="created">{new Date(user.createdAt).toLocaleDateString()}</span>
          </span>
          <span class="col-role">
            <span class="badge badge-{user.role}">{roleBadge(user.role)}</span>
          </span>
          <span class="col-actions">
            <Button variant="ghost" size="small" on:click={() => startEdit(user)}>Edit</Button>
            <Button variant="ghost-danger" size="small" on:click={() => handleDelete(user.username)}>
              <svelte:fragment slot="icon"><Trash2 size="0.875rem" /></svelte:fragment>
            </Button>
          </span>
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .user-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .list-header h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-normal);
  }

  .create-form {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
    padding: 0.75rem;
    background: var(--background-primary-alt);
    border-radius: 8px;
  }

  .create-form input,
  .create-form select,
  .table select,
  .table input {
    padding: 6px 10px;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    color: var(--text-normal);
    font-size: 0.8125rem;
    outline: none;
  }

  .create-form input { width: 140px; }
  .create-form select { width: 110px; }
  .table select { width: 110px; }
  .table input { width: 130px; }

  .form-actions {
    display: flex;
    gap: 0.25rem;
  }

  .form-error {
    width: 100%;
    color: var(--text-error);
    font-size: 0.75rem;
  }

  .table {
    display: flex;
    flex-direction: column;
  }

  .table-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.5rem;
    border-bottom: 1px solid var(--background-modifier-border-hover);
    font-size: 0.8125rem;
  }

  .table-row.header {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .table-row.editing {
    background: var(--background-primary-alt);
    border-radius: 6px;
    flex-wrap: wrap;
  }

  .col-user {
    flex: 2;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .created {
    font-size: 0.6875rem;
    color: var(--text-faint);
  }

  .col-role { flex: 1; }
  .col-password { flex: 1; }
  .col-actions {
    display: flex;
    gap: 0.25rem;
    justify-content: flex-end;
  }

  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .badge-admin { background: rgba(124, 58, 237, 0.2); color: #a78bfa; }
  .badge-editor { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }
  .badge-reader { background: rgba(107, 114, 128, 0.2); color: #9ca3af; }
</style>
