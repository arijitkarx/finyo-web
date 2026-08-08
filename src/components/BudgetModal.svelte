<script lang="ts">
  import { bucketsStore, budgetPlansStore, categoriesStore } from '$lib/stores';
  import type { Bucket, BudgetPlan, Category } from '$lib/types';
  import { createEventDispatcher, onMount } from 'svelte';

  const dispatch = createEventDispatcher();

  let categories: Category[] = [];
  let buckets: Bucket[] = [];

  let name = '';
  let categoryId = '';
  let bucketId = '';
  let periodType = 'monthly';
  let limitAmount = '';
  let rolloverEnabled = false;
  let isSaving = false;
  let error = '';

  onMount(async () => {
    try {
      const [cats, bcks] = await Promise.all([
        categoriesStore.fetchAll(),
        bucketsStore.fetchAll(),
      ]);
      categories = cats;
      buckets = bcks;
    } catch (fetchError) {
      console.error('Failed to load reference data', fetchError);
    }
  });

  async function submitBudget() {
    if (!name || !limitAmount) {
      error = 'Please provide a name and limit';
      return;
    }

    isSaving = true;
    error = '';

    try {
      await budgetPlansStore.create({
        name,
        categoryId: categoryId || undefined,
        bucketId: bucketId || undefined,
        periodType: periodType as BudgetPlan['periodType'],
        limitAmount: Number(limitAmount),
        rolloverEnabled,
      });
      dispatch('save');
    } catch (saveError) {
      error = saveError instanceof Error ? saveError.message : 'Unable to save budget plan';
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
  <div class="surface w-full max-w-md p-6 shadow-2xl shadow-slate-950/60">
    <div class="mb-5 flex items-center justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.25em] text-slate-400">Budget</p>
        <h2 class="text-2xl font-bold text-white">Create budget plan</h2>
      </div>
      <button class="text-2xl text-slate-400 hover:text-white" aria-label="Close" on:click={() => dispatch('close')}>×</button>
    </div>

    <div class="space-y-4">
      {#if error}
        <div class="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
      {/if}
      <input class="input-field" type="text" bind:value={name} placeholder="Plan name, e.g. Food budget" />
      <div class="grid grid-cols-2 gap-3">
        <select class="input-field" bind:value={categoryId}>
          <option value="">Category (any)</option>
          {#each categories as category}
            <option value={category.id}>{category.name}</option>
          {/each}
        </select>
        <select class="input-field" bind:value={bucketId}>
          <option value="">Bucket (any)</option>
          {#each buckets as bucket}
            <option value={bucket.id}>{bucket.name}</option>
          {/each}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <select class="input-field" bind:value={periodType}>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
          <option value="custom">Custom</option>
        </select>
        <input class="input-field" type="number" bind:value={limitAmount} placeholder="Limit amount" />
      </div>
      <label class="flex cursor-pointer items-center gap-3 text-sm text-slate-200">
        <input type="checkbox" bind:checked={rolloverEnabled} class="h-4 w-4 rounded border-slate-600 bg-slate-900" />
        Roll over unused limit to next period
      </label>
      <div class="flex gap-3">
        <button class="btn-secondary flex-1" type="button" on:click={() => dispatch('close')}>Cancel</button>
        <button class="btn-primary flex-1" type="button" on:click={submitBudget} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save plan'}</button>
      </div>
    </div>
  </div>
</div>
