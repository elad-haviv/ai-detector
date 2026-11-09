'use client';

/** Minimal Paddle.js v2 loader and overlay checkout. Loaded only when the user starts a checkout. */

export interface CheckoutSetup {
  env: 'sandbox' | 'production';
  clientToken: string;
  locale: string;
}

interface PaddleGlobal {
  Environment: { set: (env: string) => void };
  Initialize: (opts: { token: string; eventCallback?: (e: { name?: string }) => void }) => void;
  Checkout: {
    open: (opts: {
      items: { priceId: string; quantity: number }[];
      customer?: { email: string };
      customData?: Record<string, string>;
      settings?: { locale?: string; successUrl?: string; displayMode?: 'overlay'; allowLogout?: boolean; theme?: 'light' | 'dark' };
    }) => void;
  };
}

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

const SRC = 'https://cdn.paddle.com/paddle/v2/paddle.js';
let loading: Promise<PaddleGlobal> | null = null;
let initialized = false;
let onCompleted: (() => void) | null = null;

function load(): Promise<PaddleGlobal> {
  if (window.Paddle) return Promise.resolve(window.Paddle);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.onload = () => (window.Paddle ? resolve(window.Paddle) : reject(new Error('paddle missing')));
    s.onerror = () => {
      loading = null;
      reject(new Error('paddle load failed'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export async function openCheckout(setup: CheckoutSetup, args: { priceId: string; email: string; successUrl: string; onCompleted?: () => void }) {
  const Paddle = await load();
  onCompleted = args.onCompleted || null;
  if (!initialized) {
    if (setup.env === 'sandbox') Paddle.Environment.set('sandbox');
    Paddle.Initialize({
      token: setup.clientToken,
      eventCallback: (e) => {
        if (e?.name === 'checkout.completed') onCompleted?.();
      },
    });
    initialized = true;
  }
  Paddle.Checkout.open({
    items: [{ priceId: args.priceId, quantity: 1 }],
    // The Paddle customer email must equal the Google email: that is how we find the subscription.
    customer: { email: args.email },
    settings: {
      displayMode: 'overlay',
      locale: setup.locale,
      successUrl: args.successUrl,
      allowLogout: false,
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    },
  });
}
