<script lang="ts">
  import RuleForm from './RuleForm.svelte';
  import { categoriesStore, rulesStore, testRule } from '$lib/stores';
  import type { Category, Rule } from '$lib/types';
  import { onMount } from 'svelte';

  let rules: Rule[] = [];
  let categories: Category[] = [];
  let loading = true;
  let error = '';
  let showCreateModal = false;
  let testState: { ruleId: string; result: boolean | null; error: string } = { ruleId: '', result: null, error: '' };

  const unsubscribeRules = rulesStore.subscribe(value => {
    rules = value;
  });

  onMount(() => {
    loadRules();
    return unsubscribeRules;
  });

  async function loadRules() {
    loading = true;
    error = '';
    try {
      const loaded = await rulesStore.fetchAll();
      categories = await categoriesStore.fetchAll();
      testState = { ruleId: testState.ruleId, result: null, error: '' };
      void loaded;
    } catch (loadError) {
      error = loadError instanceof Error ? loadError.message : 'Unable to load rules';
    } finally {
      loading = false;
    }
  }

  async function handleCreated() {
    showCreateModal = false;
    await loadRules();
  }

  async function deleteRule(rule: Rule) {
    if (!confirm('Delete this rule?')) {
      return;
    }

    await rulesStore.remove(rule.id);
    if (testState.ruleId === rule.id) {
      testState = { ruleId: '', result: null, error: '' };
    }
  }

  function toggleRule(rule: Rule) {
    rulesStore.updateItem(rule.id, { enabled: !rule.enabled });
  }

  function runTest(rule: Rule) {
    testState = { ruleId: rule.id, result: null, error: '' };
    const description = window.prompt('Test description text (e.g. "Rs 147 debited via UPI-RAPIDO")', rule.matchValue);
    if (description === null) {
      return;
    }

    testRule(rule.id, { description, merchantName: description })
      .then(matches => {
        testState = { ruleId: rule.id, result: matches, error: '' };
      })
      .catch(testError => {
        testState = { ruleId: rule.id, result: null, error: testError instanceof Error ? testError.message : 'Test failed' };
      });
  }

  function actionLabel(rule: Rule) {
    if (rule.actionType === 'ignore') {
      return 'Ignore';
    }
    const value = rule.actionValue || '';
    if (rule.actionType === 'category') {
      const category = categories.find(c => c.id === value);
      return category ? `Set category: ${category.name}` : `Set category: ${value}`;
    }
    return `Set bucket: ${value}`;
  }
</script>

<section class="space-y-6">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <p class="text-sm uppercase tracking-[0.3em] text-slate-400">Rules</p>
      <h1 class="text-3xl font-bold text-white sm:text-4xl">Auto-classification rules</h1>
      <p class="mt-2 text-sm text-slate-400">Rules match transactions and set category, bucket, or ignore them. Applied by priority.</p>
    </div>
    <button class="btn-primary" on:click={() => (showCreateModal = true)}>+ New Rule</button>
  </div>

  {#if error}
    <div class="card border-rose-500/20 bg-rose-500/10 text-rose-100">{error}</div>
  {/if}

  {#if loading}
    <div class="card">Loading rules...</div>
  {:else if rules.length === 0}
    <div class="card py-16 text-center text-slate-300">
      <p class="text-lg font-medium text-white">No rules yet.</p>
      <p class="mt-2 text-sm text-slate-400">Create rules so transactions are classified automatically, or use corrections in transactions.</p>
    </div>
  {:else}
    <div class="grid gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
      {#each rules as rule}
        <article class="card space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Priority {rule.priority} · {rule.matchType} {rule.matchOperator}</p>
              <h2 class="mt-1 text-lg font-bold text-white">{rule.matchValue}</h2>
              <p class="text-sm text-slate-300">{actionLabel(rule)}</p>
            </div>
            <span class={'badge ' + (rule.enabled ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/15 text-slate-400')}>
              {rule.enabled ? 'enabled' : 'disabled'}
            </span>
          </div>

          {#if testState.ruleId === rule.id}
            <div class={'rounded-xl p-3 text-sm ' + (testState.error ? 'bg-rose-500/10 text-rose-300' : testState.result === null ? 'bg-slate-950/40 text-slate-300' : testState.result ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300')}>
              {testState.error || (testState.result === null ? 'Testing...' : testState.result ? 'Matches — this rule would apply.' : 'No match.')}
            </div>
          {/if}

          <div class="flex gap-2">
            <button class="btn-sm flex-1 border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10" type="button" on:click={() => toggleRule(rule)}>
              {rule.enabled ? 'Disable' : 'Enable'}
            </button>
            <button class="btn-sm flex-1 border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10" type="button" on:click={() => runTest(rule)}>Test</button>
            <button class="btn-sm flex-1 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20" type="button" on:click={() => deleteRule(rule)}>Delete</button>
          </div>
        </article>
      {/each}
    </div>
  {/if}

  {#if showCreateModal}
    <RuleForm on:close={() => (showCreateModal = false)} on:save={handleCreated} />
  {/if}
</section>
