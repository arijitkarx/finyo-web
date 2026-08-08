<script lang="ts">
  import { apiFetch } from '$lib/api';
  import { authStore, logout } from '$lib/stores';
  import type { User } from '$lib/types';
  import { onMount } from 'svelte';

  let profile: User | null = null;
  let loading = true;
  let error = '';

  onMount(async () => {
    try {
      const data = await apiFetch<{ user: User }>('/api/auth/me');
      profile = data.user;
      authStore.update(current => ({ ...current, user: data.user }));
    } catch (fetchError) {
      error = fetchError instanceof Error ? fetchError.message : 'Unable to load profile';
    } finally {
      loading = false;
    }
  });

  function handleLogout() {
    logout();
    window.location.reload();
  }
</script>

<section class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Profile</p>
      <h1 class="text-3xl font-bold text-white sm:text-4xl">Your account</h1>
    </div>
    <button class="btn-secondary" on:click={handleLogout}>Logout</button>
  </div>

  {#if loading}
    <div class="card">Loading profile...</div>
  {:else if error}
    <div class="card border-rose-500/20 bg-rose-500/10 text-rose-100">{error}</div>
  {:else}
    <div class="grid gap-4 sm:gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div class="card space-y-5">
        <div class="flex items-center gap-4">
          <div class="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-3xl font-black text-white">
            {(profile?.username || profile?.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <p class="text-sm text-slate-400">Signed in as</p>
            <h2 class="text-2xl font-bold text-white">{profile?.username || 'Finyo user'}</h2>
            <p class="text-slate-300">{profile?.email}</p>
          </div>
        </div>
        <div class="rounded-2xl bg-slate-950/50 p-4 text-sm text-slate-300">
          Use this page to review your identity and keep your session in sync with the backend.
        </div>
      </div>

      <div class="card grid gap-4 sm:grid-cols-2">
        <div>
          <p class="text-sm text-slate-400">User ID</p>
          <p class="mt-1 break-all font-mono text-sm text-white">{profile?.id}</p>
        </div>
        <div>
          <p class="text-sm text-slate-400">Email</p>
          <p class="mt-1 text-white">{profile?.email}</p>
        </div>
        <div>
          <p class="text-sm text-slate-400">Username</p>
          <p class="mt-1 text-white">{profile?.username || 'Not set'}</p>
        </div>
        <div>
          <p class="text-sm text-slate-400">Session</p>
          <p class="mt-1 text-white">Active</p>
        </div>
      </div>
    </div>
  {/if}
</section>
