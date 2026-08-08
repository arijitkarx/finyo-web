<script lang="ts">
  import { authStore, currentViewStore, darkModeStore, logout, persistTheme } from '$lib/stores';
  import type { View } from '$lib/stores';
  import { get } from 'svelte/store';

  const menuItems: Array<{ name: string; icon: string; view: View }> = [
    { name: 'Dashboard', icon: '📊', view: 'dashboard' },
    { name: 'Transactions', icon: '💳', view: 'transactions' },
    { name: 'Budgets', icon: '💰', view: 'budgets' },
    { name: 'Buckets', icon: '🪣', view: 'buckets' },
    { name: 'Sinking funds', icon: '⏳', view: 'recurring' },
    { name: 'Rules', icon: '⚙️', view: 'rules' },
    { name: 'Accounts', icon: '🏦', view: 'accounts' },
    { name: 'Profile', icon: '👤', view: 'profile' },
  ];

  function toggleTheme() {
    const nextValue = !get(darkModeStore);
    darkModeStore.set(nextValue);
    persistTheme(nextValue);
  }

  function navigateTo(view: View) {
    currentViewStore.set(view);
  }
</script>

<aside class="hidden h-screen w-64 flex-col border-r border-white/10 bg-slate-950/80 text-slate-100 shadow-2xl shadow-slate-950/30 backdrop-blur-xl md:flex">
  <!-- Logo -->
  <div class="border-b border-white/10 p-6">
    <h2 class="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-2xl font-bold text-transparent">Finyo</h2>
    <p class="text-sm text-slate-400">Financial Tracker</p>
  </div>

  <!-- Menu Items -->
  <nav class="flex-1 overflow-y-auto p-4">
    <ul class="space-y-2">
      {#each menuItems as item}
        <li>
          <button
            on:click={() => navigateTo(item.view)}
            class="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            <span class="text-xl">{item.icon}</span>
            {item.name}
          </button>
        </li>
      {/each}
    </ul>
  </nav>

  <!-- User Section -->
  <div class="border-t border-white/10 p-4">
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-white">
          {$authStore.user?.username?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        <div class="text-sm">
          <p class="font-medium text-white">{$authStore.user?.username || 'User'}</p>
          <p class="text-xs text-slate-400">{$authStore.user?.email}</p>
        </div>
      </div>
    </div>
    <button
      on:click={toggleTheme}
      class="mb-3 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/10"
    >
      <span>Dark mode</span>
      <span>{get(darkModeStore) ? 'On' : 'Off'}</span>
    </button>
    <button
      on:click={logout}
      class="w-full rounded-2xl bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-300 transition hover:bg-rose-500/20"
    >
      Logout
    </button>
  </div>
</aside>

<nav class="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-slate-950/95 px-2 py-2 text-slate-100 shadow-2xl shadow-slate-950/50 backdrop-blur-xl md:hidden">
  <ul class="grid grid-cols-4 gap-1">
    {#each menuItems.slice(0, 8) as item}
      <li>
        <button
          on:click={() => navigateTo(item.view)}
          class="flex w-full flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
        >
          <span class="text-lg leading-none">{item.icon}</span>
          <span class="truncate">{item.name}</span>
        </button>
      </li>
    {/each}
  </ul>
</nav>
