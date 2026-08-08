<script lang="ts">
  import AccountsPage from '$components/AccountsPage.svelte';
  import AuthPanel from '$components/AuthPanel.svelte';
  import BucketsPage from '$components/BucketsPage.svelte';
  import BudgetPage from '$components/BudgetPage.svelte';
  import Dashboard from '$components/Dashboard.svelte';
  import LandingPage from '$components/LandingPage.svelte';
  import ProfilePage from '$components/ProfilePage.svelte';
  import RecurringPage from '$components/RecurringPage.svelte';
  import RulesPage from '$components/RulesPage.svelte';
  import Sidebar from '$components/Sidebar.svelte';
  import TransactionList from '$components/TransactionList.svelte';
  import { authStore, currentViewStore, darkModeStore, fetchCurrentUser, persistTheme, transactionsStore } from '$lib/stores';
  import { consumeOAuthSession } from '$lib/api';
  import type { View } from '$lib/stores';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';

  let currentView: View = 'landing';
  let authenticated = false;

  const unsubscribeView = currentViewStore.subscribe(value => {
    currentView = value;
  });

  const unsubscribeAuth = authStore.subscribe(value => {
    authenticated = Boolean(value.isLoggedIn || value.token);
  });

  const unsubscribeTheme = darkModeStore.subscribe(value => {
    persistTheme(value);
  });

  onMount(() => {
    const storedTheme = get(darkModeStore);
    persistTheme(storedTheme);

    consumeOAuthSession();

    const { isLoggedIn, token } = get(authStore);
    if (isLoggedIn || token) {
      fetchCurrentUser().then(user => {
        if (user || isLoggedIn) {
          currentViewStore.set('dashboard');
          transactionsStore.fetchTransactions();
        } else {
          currentViewStore.set('landing');
        }
      });
    } else if (currentView !== 'login' && currentView !== 'signup' && currentView !== 'forgot') {
      currentViewStore.set('landing');
    }

    return () => {
      unsubscribeView();
      unsubscribeAuth();
      unsubscribeTheme();
    };
  });
</script>

<svelte:head>
  <title>Finyo</title>
  <meta name="description" content="Finyo is a polished finance workspace for tracking transactions, budgets, and profiles." />
</svelte:head>

<div class="relative min-h-screen overflow-hidden bg-transparent text-slate-100">
  <button
    type="button"
    class="fixed right-3 top-3 z-[60] rounded-full border border-white/10 bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-2xl shadow-slate-950/30 backdrop-blur transition hover:bg-slate-900 sm:right-4 sm:top-4 sm:px-4 sm:py-2 sm:text-sm"
    on:click={() => darkModeStore.update(value => !value)}
  >
    {#if $darkModeStore}
      Light mode
    {:else}
      Dark mode
    {/if}
  </button>

  {#if !authenticated}
    {#if currentView === 'landing'}
      <LandingPage />
    {:else}
      <AuthPanel mode={currentView === 'signup' ? 'signup' : currentView === 'forgot' ? 'forgot' : 'login'} />
    {/if}
  {:else}
    <div class="flex min-h-screen">
      <Sidebar />
      <main class="flex-1 overflow-y-auto px-4 pb-24 pt-16 sm:px-6 sm:pt-20 md:pb-8 md:pt-8 lg:px-10">
        <div class="mx-auto max-w-7xl space-y-8">
          {#if currentView === 'dashboard'}
            <Dashboard />
          {:else if currentView === 'transactions'}
            <TransactionList />
          {:else if currentView === 'budgets'}
            <BudgetPage />
          {:else if currentView === 'accounts'}
            <AccountsPage />
          {:else if currentView === 'buckets'}
            <BucketsPage />
          {:else if currentView === 'recurring'}
            <RecurringPage />
          {:else if currentView === 'rules'}
            <RulesPage />
          {:else if currentView === 'profile'}
            <ProfilePage />
          {:else}
            <Dashboard />
          {/if}
        </div>
      </main>
    </div>
  {/if}
</div>
