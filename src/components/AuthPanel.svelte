<script lang="ts">
  import { authStore, currentViewStore } from '$lib/stores';
  import { persistAuthTokens } from '$lib/api';
  import type { User } from '$lib/types';


  export let mode: 'login' | 'signup' | 'forgot' = 'login';
  const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
  let loginEmail = '';
  let loginPassword = '';
  let loginError = '';
  let loginBusy = false;

  let signupUsername = '';
  let signupEmail = '';
  let signupPassword = '';
  let signupError = '';
  let signupBusy = false;

  let resetEmail = '';
  let resetMessage = '';
  let resetBusy = false;
  let resetError = '';

  function navigate(view: 'login' | 'signup' | 'forgot' | 'landing') {
    currentViewStore.set(view);
  }

  async function fetchOAuth(provider: 'google') {
    try {
      const response = await fetch(`${backendUrl}/api/auth/oauth/${provider}`);
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to start OAuth flow', error);
    }
  }

  async function login(event: SubmitEvent) {
    event.preventDefault();
    loginBusy = true;
    loginError = '';

    try {
      const response = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      persistAuthTokens(data.token, data.refreshToken || null);
      authStore.set({ token: data.token, user: data.user, isLoggedIn: true });
      loginEmail = '';
      loginPassword = '';
      currentViewStore.set('dashboard');
    } catch (error) {
      loginError = error instanceof Error ? error.message : 'Login failed';
    } finally {
      loginBusy = false;
    }
  }

  async function signup(event: SubmitEvent) {
    event.preventDefault();
    signupBusy = true;
    signupError = '';

    try {
      const response = await fetch(`${backendUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: signupEmail,
          password: signupPassword,
          username: signupUsername || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Signup failed');
      }

      if (data.token) {
        persistAuthTokens(data.token, data.refreshToken || null);
        authStore.set({ token: data.token, user: data.user as User, isLoggedIn: true });
        currentViewStore.set('dashboard');
      } else {
        currentViewStore.set('login');
      }
    } catch (error) {
      signupError = error instanceof Error ? error.message : 'Signup failed';
    } finally {
      signupBusy = false;
    }
  }

  async function requestReset(event: SubmitEvent) {
    event.preventDefault();
    resetBusy = true;
    resetError = '';
    resetMessage = '';

    try {
      const response = await fetch(`${backendUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Password reset request failed');
      }
      resetMessage = data.message || 'If the address exists, a reset link has been sent.';
    } catch (error) {
      resetError = error instanceof Error ? error.message : 'Password reset request failed';
    } finally {
      resetBusy = false;
    }
  }
</script>

<section class="min-h-screen overflow-y-auto px-6 py-10 text-slate-100 lg:px-10">
  <div class="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
    <div class="grid w-full gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <div class="surface relative overflow-hidden p-8 shadow-2xl shadow-indigo-950/40">
        <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-transparent to-violet-500/20"></div>
        <div class="relative space-y-4">
          <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
            <span class="h-2 w-2 rounded-full bg-emerald-400"></span>
            Finyo secure account access
          </div>
          <h1 class="text-4xl font-black tracking-tight text-white sm:text-5xl">
            Manage money with fewer clicks and a better view.
          </h1>
          <p class="max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
            Sign in, create an account, recover access, or continue with Google. Everything stays aligned
            with the same clean Finyo dashboard and transaction flow.
          </p>
          <div class="grid gap-3 pt-2 text-sm text-slate-300">
            <div class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">Fast login and signup</div>
            <div class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">Forgot password workflow</div>
            <div class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">Google sign in ready</div>
          </div>
        </div>
      </div>

      <div class="surface p-8 shadow-2xl shadow-slate-950/40">
        <div class="mb-6 flex items-center justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-slate-400">Welcome to</p>
            <h2 class="text-3xl font-bold text-white">Finyo</h2>
          </div>
          <button class="btn-secondary px-4 py-2 text-sm" on:click={() => navigate('landing')}>Home</button>
        </div>

        {#if mode === 'login'}
          <form class="space-y-4" on:submit={login}>
            {#if loginError}
              <div class="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{loginError}</div>
            {/if}
            <input class="input-field" placeholder="Email" bind:value={loginEmail} type="email" required />
            <input class="input-field" placeholder="Password" bind:value={loginPassword} type="password" required />
            <button class="btn-primary w-full" type="submit" disabled={loginBusy}>{loginBusy ? 'Logging in...' : 'Login'}</button>
            <button class="btn-secondary w-full" type="button" on:click={() => fetchOAuth('google')}>Continue with Google</button>
          </form>
          <div class="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
            <button class="text-indigo-300 hover:text-indigo-200" type="button" on:click={() => navigate('forgot')}>Forgot password?</button>
            <button class="text-indigo-300 hover:text-indigo-200" type="button" on:click={() => navigate('signup')}>Create account</button>
          </div>
        {:else if mode === 'signup'}
          <form class="space-y-4" on:submit={signup}>
            {#if signupError}
              <div class="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{signupError}</div>
            {/if}
            <input class="input-field" placeholder="Username" bind:value={signupUsername} type="text" />
            <input class="input-field" placeholder="Email" bind:value={signupEmail} type="email" required />
            <input class="input-field" placeholder="Password" bind:value={signupPassword} type="password" required />
            <button class="btn-primary w-full" type="submit" disabled={signupBusy}>{signupBusy ? 'Creating account...' : 'Sign up'}</button>
            <button class="btn-secondary w-full" type="button" on:click={() => fetchOAuth('google')}>Sign up with Google</button>
          </form>
          <div class="mt-6 text-sm text-slate-300">
            Already have an account?
            <button class="ml-2 text-indigo-300 hover:text-indigo-200" type="button" on:click={() => navigate('login')}>Sign in</button>
          </div>
        {:else}
          <form class="space-y-4" on:submit={requestReset}>
            {#if resetError}
              <div class="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{resetError}</div>
            {/if}
            {#if resetMessage}
              <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{resetMessage}</div>
            {/if}
            <p class="text-sm leading-6 text-slate-300">Enter your email and we’ll try to send a reset link.</p>
            <input class="input-field" placeholder="Email" bind:value={resetEmail} type="email" required />
            <button class="btn-primary w-full" type="submit" disabled={resetBusy}>{resetBusy ? 'Sending...' : 'Send reset link'}</button>
          </form>
          <div class="mt-6 text-sm text-slate-300">
            Remembered your password?
            <button class="ml-2 text-indigo-300 hover:text-indigo-200" type="button" on:click={() => navigate('login')}>Back to login</button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</section>
