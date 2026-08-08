<script lang="ts">
  import RecurringForm from './RecurringForm.svelte';
  import { fetchRecurringUpcoming, recurringStore, recurringUpcomingStore, runAutoFund } from '$lib/stores';
  import type { RecurringPlan, RecurringUpcoming } from '$lib/types';
  import { onMount } from 'svelte';

  let plans: RecurringPlan[] = [];
  let upcoming: RecurringUpcoming[] = [];
  let loading = true;
  let error = '';
  let showCreateModal = false;
  let funding = false;
  let fundingMessage = '';

  const unsubscribePlans = recurringStore.subscribe(value => {
    plans = value;
  });

  const unsubscribeUpcoming = recurringUpcomingStore.subscribe(value => {
    upcoming = value;
  });

  onMount(() => {
    loadPlans();
    return () => {
      unsubscribePlans();
      unsubscribeUpcoming();
    };
  });

  async function loadPlans() {
    loading = true;
    error = '';
    try {
      await recurringStore.fetchAll();
      await fetchRecurringUpcoming();
    } catch (loadError) {
      error = loadError instanceof Error ? loadError.message : 'Unable to load recurring plans';
    } finally {
      loading = false;
    }
  }

  async function handleCreated() {
    showCreateModal = false;
    await loadPlans();
  }

  async function handleAutoFund() {
    funding = true;
    fundingMessage = '';
    try {
      const funded = await runAutoFund();
      fundingMessage = `Auto-fund complete: ${funded} allocation(s) created.`;
      await loadPlans();
    } catch (fundError) {
      fundingMessage = fundError instanceof Error ? fundError.message : 'Auto-fund failed';
    } finally {
      funding = false;
    }
  }

  async function deletePlan(plan: RecurringPlan) {
    if (!confirm(`Delete recurring plan "${plan.name}"?`)) {
      return;
    }

    await recurringStore.remove(plan.id);
    await loadPlans();
  }

  function togglePlan(plan: RecurringPlan) {
    recurringStore.updateItem(plan.id, { isActive: !plan.isActive });
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
  }
</script>

<section class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Sinking funds</p>
      <h1 class="text-3xl font-bold text-white sm:text-4xl">Recurring plans</h1>
      <p class="mt-2 text-sm text-slate-400">Upcoming obligations with optional auto-funding into buckets.</p>
    </div>
    <div class="flex gap-3">
      <button class="btn-secondary" on:click={handleAutoFund} disabled={funding}>{funding ? 'Funding...' : 'Run auto-fund'}</button>
      <button class="btn-primary" on:click={() => (showCreateModal = true)}>+ New Plan</button>
    </div>
  </div>

  {#if fundingMessage}
    <div class="card border-emerald-500/20 bg-emerald-500/10 text-emerald-200">{fundingMessage}</div>
  {/if}

  {#if error}
    <div class="card border-rose-500/20 bg-rose-500/10 text-rose-100">{error}</div>
  {/if}

  {#if loading}
    <div class="card">Loading plans...</div>
  {:else if plans.length === 0}
    <div class="card py-16 text-center text-slate-300">
      <p class="text-lg font-medium text-white">No recurring plans yet.</p>
      <p class="mt-2 text-sm text-slate-400">Create one for obligations like rent, subscriptions, or insurance.</p>
    </div>
  {:else}
    <div class="grid gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
      {#each plans as plan}
        <article class="card space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-slate-400">{plan.frequency}</p>
              <h2 class="text-xl font-bold text-white">{plan.name}</h2>
            </div>
            <span class="badge">₹{plan.amount}</span>
          </div>
          <div class="space-y-1 text-sm text-slate-300">
            <p>Next due: <span class="font-medium text-white">{formatDate(plan.nextDueDate)}</span></p>
            {#if plan.autoFundAmount}
              <p>Auto-fund ₹{plan.autoFundAmount} {plan.fundingFrequency}{plan.bucketId ? ' → bucket' : ''}</p>
            {/if}
            {#if plan.lastFundingDate}
              <p>Last funded: {formatDate(plan.lastFundingDate)}</p>
            {/if}
          </div>
          <div class="flex gap-2">
            <button
              class="btn-sm flex-1 border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              type="button"
              on:click={() => togglePlan(plan)}
            >
              {plan.isActive ? 'Pause' : 'Resume'}
            </button>
            <button class="btn-sm flex-1 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20" type="button" on:click={() => deletePlan(plan)}>Delete</button>
          </div>
        </article>
      {/each}
    </div>
  {/if}

  {#if upcoming.length > 0}
    <div class="card space-y-3">
      <h2 class="text-xl font-bold text-white">Upcoming due</h2>
      {#each upcoming as item}
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-950/40 p-4">
          <div>
            <p class="font-semibold text-white">{item.name}</p>
            <p class="text-xs text-slate-400">Due {formatDate(item.dueDate)}</p>
          </div>
          <div class="text-right">
            <p class="font-bold text-white">₹{item.amount}</p>
            <p class="text-xs text-slate-400">Funded ₹{item.funded} · Remaining ₹{item.remainingFunding}</p>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if showCreateModal}
    <RecurringForm on:close={() => (showCreateModal = false)} on:save={handleCreated} />
  {/if}
</section>
