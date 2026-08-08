<script lang="ts">
  import { onMount } from 'svelte';
  import BudgetModal from './BudgetModal.svelte';
  import {
    budgetAlertsStore,
    budgetPlansStore,
    budgetSummariesStore,
    fetchBudgetSummaries,
  } from '$lib/stores';
  import type { BudgetAlert, BudgetPlan, BudgetSummary } from '$lib/types';

  let plans: BudgetPlan[] = [];
  let summaries: BudgetSummary[] = [];
  let alerts: BudgetAlert[] = [];
  let loading = true;
  let showBudgetModal = false;
  let showPlans = false;

  const unsubscribePlans = budgetPlansStore.subscribe(value => {
    plans = value;
  });

  const unsubscribeSummaries = budgetSummariesStore.subscribe(value => {
    summaries = value;
  });

  const unsubscribeAlerts = budgetAlertsStore.subscribe(value => {
    alerts = value;
  });

  async function loadBudgets() {
    loading = true;
    try {
      const [loadedSummaries, loadedAlerts] = await Promise.all([
        fetchBudgetSummaries(),
        budgetPlansStore.fetchAll(),
      ]);
      summaries = loadedSummaries.summaries;
      alerts = loadedSummaries.alerts;
    } catch (error) {
      console.error('Failed to load budgets', error);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadBudgets();
    return () => {
      unsubscribePlans();
      unsubscribeSummaries();
      unsubscribeAlerts();
    };
  });

  async function handleSave() {
    showBudgetModal = false;
    await loadBudgets();
  }

  async function deletePlan(plan: BudgetPlan) {
    if (!confirm(`Delete budget plan "${plan.name}"?`)) {
      return;
    }

    await budgetPlansStore.remove(plan.id);
    await loadBudgets();
  }

  function togglePlan(plan: BudgetPlan) {
    budgetPlansStore.updateItem(plan.id, { isActive: !plan.isActive });
  }
</script>

<section class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Budgets</p>
      <h1 class="text-3xl font-bold text-white sm:text-4xl">Budget plans</h1>
    </div>
    <div class="flex gap-3">
      <button class="btn-secondary" on:click={() => (showPlans = !showPlans)}>Manage plans</button>
      <button class="btn-primary" on:click={() => (showBudgetModal = true)}>+ New Budget</button>
    </div>
  </div>

  {#if loading}
    <div class="card">Loading budgets...</div>
  {:else}
    {#if showPlans}
      <div class="card space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold text-white">All plans</h2>
          <button class="btn-sm border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10" type="button" on:click={() => (showPlans = false)}>Hide</button>
        </div>
        {#if plans.length === 0}
          <p class="text-sm text-slate-400">No budget plans yet. Create your first one.</p>
        {:else}
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {#each plans as plan}
              <article class="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <h3 class="font-bold text-white">{plan.name}</h3>
                    <p class="text-xs text-slate-400">{plan.periodType}{plan.category ? ` · ${plan.category}` : ''}{plan.bucketId ? ' · bucket-based' : ''}</p>
                  </div>
                  <span class="badge">₹{plan.limitAmount}</span>
                </div>
                <p class="mt-2 text-xs text-slate-400">
                  {plan.rolloverEnabled ? 'Rollover enabled' : 'No rollover'} · {plan.isActive ? 'Active' : 'Paused'}
                </p>
                <div class="mt-3 flex gap-2">
                  <button class="btn-sm flex-1 border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10" type="button" on:click={() => togglePlan(plan)}>
                    {plan.isActive ? 'Pause' : 'Resume'}
                  </button>
                  <button class="btn-sm flex-1 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20" type="button" on:click={() => deletePlan(plan)}>Delete</button>
                </div>
              </article>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <div class="grid gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
      {#each summaries as summary}
        <article class="card space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-2xl font-bold text-white">{summary.name}</h2>
              <p class="text-sm text-slate-400">{summary.category || 'Overall'}</p>
            </div>
            <span class="badge">₹{summary.limit}</span>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between text-sm text-slate-300">
              <span>Spent · ₹{summary.spent}</span>
              <span class={summary.percentage >= 100 ? 'text-rose-400 font-semibold' : summary.percentage >= 80 ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                {summary.percentage}%
              </span>
            </div>
            <div class="h-2 rounded-full bg-slate-800">
              <div
                class="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                style="width: {Math.min(summary.percentage, 100)}%"
              ></div>
            </div>
            <p class="text-xs text-slate-400">₹{summary.remaining} remaining</p>
          </div>
        </article>
      {/each}
    </div>

    {#if alerts.length > 0}
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {#each alerts as alert}
          <div class="card border-amber-500/20 bg-amber-500/10 text-amber-100">
            <p class="text-sm uppercase tracking-[0.2em]">{alert.severity}</p>
            <h3 class="mt-2 text-xl font-bold">{alert.category}</h3>
            <p class="mt-2 text-sm">{alert.percentage}% used · ₹{alert.spent} of ₹{alert.limit}</p>
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  {#if showBudgetModal}
    <BudgetModal on:close={() => (showBudgetModal = false)} on:save={handleSave} />
  {/if}
</section>
