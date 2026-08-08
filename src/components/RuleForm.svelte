<script lang="ts">
  import { bucketsStore, categoriesStore, rulesStore } from '$lib/stores';
  import type { Bucket, Category, RuleActionType, RuleMatchOperator, RuleMatchType } from '$lib/types';
  import { createEventDispatcher, onMount } from 'svelte';

  const dispatch = createEventDispatcher();

  let buckets: Bucket[] = [];
  let categories: Category[] = [];

  let priority = '100';
  let matchType: RuleMatchType = 'merchant';
  let matchOperator: RuleMatchOperator = 'equals';
  let matchValue = '';
  let actionType: RuleActionType = 'category';
  let actionValue = '';
  let isSaving = false;
  let error = '';

  const matchTypes: RuleMatchType[] = ['merchant', 'description', 'amount', 'account', 'mode'];
  const matchOperators: RuleMatchOperator[] = ['equals', 'contains', 'starts_with', 'regex'];
  const actionTypes: RuleActionType[] = ['category', 'bucket', 'ignore'];

  onMount(async () => {
    try {
      const [cats, bcks] = await Promise.all([categoriesStore.fetchAll(), bucketsStore.fetchAll()]);
      categories = cats;
      buckets = bcks;
    } catch (fetchError) {
      console.error('Failed to load reference data', fetchError);
    }
  });

  $: actionNeedsValue = actionType !== 'ignore';
  $: matchIsAmount = matchType === 'amount';

  async function submitRule() {
    if (!matchValue) {
      error = 'Please provide a match value';
      return;
    }

    if (actionType !== 'ignore' && !actionValue) {
      error = 'Please pick a category or bucket for this action';
      return;
    }

    isSaving = true;
    error = '';

    try {
      await rulesStore.create({
        priority: Number(priority),
        matchType,
        matchOperator: matchIsAmount ? 'equals' : matchOperator,
        matchValue,
        actionType,
        actionValue: actionType === 'ignore' ? undefined : actionValue,
      });
      dispatch('save');
    } catch (saveError) {
      error = saveError instanceof Error ? saveError.message : 'Unable to save rule';
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
  <div class="surface w-full max-w-md p-6 shadow-2xl shadow-slate-950/60">
    <div class="mb-5 flex items-center justify-between gap-4">
      <div>
        <p class="text-sm uppercase tracking-[0.25em] text-slate-400">Rule</p>
        <h2 class="text-2xl font-bold text-white">Create rule</h2>
      </div>
      <button class="text-2xl text-slate-400 hover:text-white" aria-label="Close" on:click={() => dispatch('close')}>×</button>
    </div>

    <div class="space-y-4">
      {#if error}
        <div class="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
      {/if}

      <div class="grid grid-cols-2 gap-3">
        <select class="input-field" bind:value={matchType}>
          {#each matchTypes as type}
            <option value={type}>{type}</option>
          {/each}
        </select>
        <select class="input-field" bind:value={matchOperator} disabled={matchIsAmount}>
          {#each matchOperators as operator}
            <option value={operator}>{operator.replace('_', ' ')}</option>
          {/each}
        </select>
      </div>
      <input
        class="input-field"
        type="text"
        inputmode={matchIsAmount ? 'decimal' : 'text'}
        bind:value={matchValue}
        placeholder={matchIsAmount ? 'e.g. 450' : 'e.g. swiggy'}
      />

      <div class="grid grid-cols-2 gap-3">
        <select class="input-field" bind:value={actionType}>
          {#each actionTypes as type}
            <option value={type}>{type}</option>
          {/each}
        </select>
        {#if actionNeedsValue}
          <select class="input-field" bind:value={actionValue}>
            <option value="">Pick {actionType}...</option>
            {#if actionType === 'category'}
              {#each categories as category}
                <option value={category.id}>{category.name}</option>
              {/each}
            {:else}
              {#each buckets as bucket}
                <option value={bucket.id}>{bucket.name}</option>
              {/each}
            {/if}
          </select>
        {:else}
          <div></div>
        {/if}
      </div>

      <input class="input-field" type="number" bind:value={priority} placeholder="Priority (lower runs first)" />

      <div class="flex gap-3">
        <button class="btn-secondary flex-1" type="button" on:click={() => dispatch('close')}>Cancel</button>
        <button class="btn-primary flex-1" type="button" on:click={submitRule} disabled={isSaving}>{isSaving ? 'Saving...' : 'Create rule'}</button>
      </div>
    </div>
  </div>
</div>
