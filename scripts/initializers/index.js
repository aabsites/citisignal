/* eslint-disable import/no-cycle */
// Drop-in Tools
import { events } from '@dropins/tools/event-bus.js';
import {
  removeFetchGraphQlHeader,
  setEndpoint,
  setFetchGraphQlHeader,
  setFetchGraphQlHeaders,
} from '@dropins/tools/fetch-graphql.js';
import * as authApi from '@dropins/storefront-auth/api.js';

// Libs
import { getConfigValue, getCookie, getHeaders } from '../configs.js';

export const getUserTokenCookie = () => getCookie('auth_dropin_user_token');

// Event Bus Logger
events.enableLogger(true);

// Update auth headers
const setAuthHeaders = (state) => {
  if (state) {
    const token = getUserTokenCookie();
    setFetchGraphQlHeader('Authorization', `Bearer ${token}`);
  } else {
    removeFetchGraphQlHeader('Authorization');
    authApi.removeFetchGraphQlHeader('Authorization');
  }
};

const persistCartDataInSession = (data) => {
  if (data?.id) {
    sessionStorage.setItem('DROPINS_CART_ID', data.id);
  } else {
    sessionStorage.removeItem('DROPINS_CART_ID');
  }
};

export default async function initializeDropins() {
  const init = async () => {
    // Set auth headers on authenticated event
    events.on('authenticated', setAuthHeaders);

    // Cache cart data in session storage
    events.on('cart/data', persistCartDataInSession, { eager: true });

    // on page load, check if user is authenticated
    const token = getUserTokenCookie();
    events.emit('authenticated', !!token);

    // Set Fetch Endpoint (Global)
    setEndpoint(await getConfigValue('commerce-core-endpoint'));

    // Set Fetch Headers
    setFetchGraphQlHeaders(await getHeaders('all'));

    // Set Auth Headers
    setAuthHeaders(!!token);

    // Initialize Global Drop-ins
    await import('./auth.js');

    // 💥 HOT FIX: Validate authentication token is still valid
    if (token) {
      await authApi.fetchGraphQl('query VALIDATE_TOKEN{ customerCart { id } }')
        .then((res) => {
          const unauthenticated = !!res.errors?.find((error) => error.extensions?.category === 'graphql-authentication' || error.extensions?.category === 'graphql-authorization');
          if (unauthenticated) throw new Error('Unauthenticated');
        })
        .catch(() => {
          // remove auth token if it's invalid
          document.cookie = 'auth_dropin_user_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          setAuthHeaders(false);
          events.emit('authenticated', false);
        });
    }

    import('./cart.js');

    events.on('eds/lcp', async () => {
      // Recaptcha
      await import('@dropins/tools/recaptcha.js').then(({ setConfig }) => {
        setConfig();
      });
    });
  };

  // re-initialize on prerendering changes
  document.addEventListener('prerenderingchange', initializeDropins);

  return init();
}

export function initializeDropin(cb) {
  let initialized = false;

  const init = async (force = false) => {
    // prevent re-initialization
    if (initialized && !force) return;
    // initialize drop-in
    await cb();
    initialized = true;
  };

  // re-initialize on prerendering changes
  document.addEventListener('prerenderingchange', () => init(true));
  return init;
}
