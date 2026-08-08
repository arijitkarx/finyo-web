<script lang="ts">
  import { dailyAllowanceStore, dashboardStore, fetchDashboard, fetchFinancialState, safeToSpendStore } from '$lib/stores';
  import { onMount } from 'svelte';

  onMount(() => {
    fetchDashboard();
    fetchFinancialState();
  });

  function formatMoney(value: number | null | undefined) {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  }
</script>

<div class="space-y-6">
  <h1 class="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">Dashboard</h1>

  <!-- Safe to Spend -->
  <div class="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
    <div class="card bg-gradient-to-br from-indigo-500/10 to-violet-500/10">
      <p class="text-sm uppercase tracking-[0.25em] text-slate-400">Safe to spend</p>
      <p class="mt-2 text-3xl font-black text-indigo-500 dark:text-indigo-300 sm:text-4xl">
        ₹{formatMoney($safeToSpendStore?.safeToSpend)}
      </p>
      <div class="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300">
        <div>
          <p class="text-slate-400">Available cash</p>
          <p class="font-semibold">₹{formatMoney($safeToSpendStore?.components?.availableCash)}</p>
        </div>
        <div>
          <p class="text-slate-400">Reserved</p>
          <p class="font-semibold">₹{formatMoney($safeToSpendStore?.components?.reservedMoney)}</p>
        </div>
        <div>
          <p class="text-slate-400">Earmarked</p>
          <p class="font-semibold">₹{formatMoney($safeToSpendStore?.components?.earmarkedMoney)}</p>
        </div>
        <div>
          <p class="text-slate-400">Protected savings</p>
          <p class="font-semibold">₹{formatMoney($safeToSpendStore?.components?.protectedSavings)}</p>
        </div>
        <div class="col-span-2">
          <p class="text-slate-400">Upcoming required expenses</p>
          <p class="font-semibold">₹{formatMoney($safeToSpendStore?.components?.upcomingRequiredExpenses)}</p>
        </div>
      </div>
    </div>

    <div class="card">
      <p class="text-sm uppercase tracking-[0.25em] text-slate-400">Daily allowance</p>
      <p class="mt-2 text-3xl font-black text-emerald-500 dark:text-emerald-300 sm:text-4xl">
        ₹{formatMoney($dailyAllowanceStore?.overall)}
      </p>
      <p class="mt-1 text-sm text-slate-400">per day across active budget plans</p>
      <div class="mt-4 space-y-2 text-sm">
        {#each Object.entries($dailyAllowanceStore?.categories || {}) as [planName, amount]}
          <div class="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-800">
            <span class="text-slate-600 dark:text-slate-300">{planName}</span>
            <span class="font-semibold text-slate-900 dark:text-white">₹{formatMoney(amount)}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Stats Grid -->
  <div class="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
    <div class="card">
      <p class="text-sm font-medium text-slate-400 mb-2">Total Spent</p>
      <p class="text-2xl font-bold text-red-500 dark:text-red-300 sm:text-3xl">₹{formatMoney($dashboardStore.totalSpent)}</p>
      <p class="text-xs text-slate-400 mt-2">{$dashboardStore.expenseCount || 0} expenses</p>
    </div>

    <div class="card">
      <p class="text-sm font-medium text-slate-400 mb-2">Total Income</p>
      <p class="text-2xl font-bold text-emerald-500 dark:text-emerald-300 sm:text-3xl">₹{formatMoney($dashboardStore.totalIncome)}</p>
      <p class="text-xs text-slate-400 mt-2">{$dashboardStore.incomeCount || 0} income</p>
    </div>

    <div class="card">
      <p class="text-sm font-medium text-slate-400 mb-2">Net Amount</p>
      <p class="text-2xl font-bold text-indigo-500 dark:text-indigo-300 sm:text-3xl">₹{formatMoney($dashboardStore.netAmount)}</p>
      <p class="text-xs text-slate-400 mt-2">This month</p>
    </div>

    <div class="card">
      <p class="text-sm font-medium text-slate-400 mb-2">Savings Rate</p>
      <p class="text-2xl font-bold text-sky-500 dark:text-sky-300 sm:text-3xl">{$dashboardStore.savingsRate?.toFixed(1) || '0'}%</p>
      <p class="text-xs text-slate-400 mt-2">Of income saved</p>
    </div>
  </div>

  <!-- Category Breakdown and Recent Transactions -->
  <div class="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
    <!-- Top Categories -->
    <div class="card">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Top Expense Categories</h2>
      <div class="space-y-3">
        {#each Object.entries($dashboardStore.expenseCategoryData || {}) as [category, amount]}
          <div>
            <div class="flex justify-between items-center mb-1">
              <span class="text-slate-600 dark:text-slate-300 font-medium">{category}</span>
              <span class="text-slate-900 dark:text-white font-bold">₹{formatMoney(amount)}</span>
            </div>
            <div class="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
              <div
                class="bg-gradient-to-r from-indigo-500 to-violet-500 h-2 rounded-full"
                style="width: {($dashboardStore.totalSpent ? (amount / $dashboardStore.totalSpent) * 100 : 0) || 0}%"
              ></div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Payment Methods -->
    <div class="card">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">Payment Methods</h2>
      <div class="space-y-3">
        {#each $dashboardStore.topPaymentMethods || [] as method}
          <div class="flex justify-between items-center p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <span class="text-slate-600 dark:text-slate-300 font-medium">{method}</span>
            <span class="badge">{$dashboardStore.paymentMethodData?.[method] || 0}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
