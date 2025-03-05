import { createMachine } from 'xstate';
import { events } from '@dropins/tools/event-bus.js';
import * as cartApi from '@dropins/storefront-cart/api.js';
import * as checkoutApi from '@dropins/storefront-checkout/api.js';
import * as authApi from '@dropins/storefront-auth/api.js';
import { isCartEmpty, isCheckoutEmpty } from '../../../checkout.js';

const DEBOUNCE_TIME = 1000;
const LOGIN_FORM_NAME = 'login-form';
const SHIPPING_FORM_NAME = 'selectedShippingAddress';
const BILLING_FORM_NAME = 'selectedBillingAddress';
const SHIPPING_ADDRESS_DATA_KEY = `${SHIPPING_FORM_NAME}_addressData`;
const BILLING_ADDRESS_DATA_KEY = `${BILLING_FORM_NAME}_addressData`;

export const checkoutMachine = createMachine({
  id: 'checkout',
  initial: 'idle',
  context: {
    cartId: null,
    initialized: false,
    isGuest: false,
    isVirtual: false,
    shippingAddress: null,
    billingAddress: null,
    error: null,
  },
  states: {
    idle: {
      on: {
        'cart/initialized': {
          target: 'checkingCart',
          actions: 'handleCartInitialized',
        },
        'checkout/initialized': {
          target: 'checkingCheckout',
          actions: 'handleCheckoutInitialized',
        },
        'checkout/updated': {
          target: 'checkingCheckout',
          actions: 'handleCheckoutUpdated',
        },
      },
    },
    checkingCart: {
      always: [
        {
          target: 'emptyCart',
          guard: 'isCartEmpty',
        },
        {
          target: 'idle',
        },
      ],
    },
    checkingCheckout: {
      always: [
        {
          target: 'emptyCart',
          guard: 'isCheckoutEmpty',
        },
        {
          target: 'initializingCheckout',
          actions: ['initializeCheckout', 'displayOrderSummary'],
        },
      ],
    },
    emptyCart: {
      type: 'final',
      entry: 'displayEmptyCart',
    },
    initializingCheckout: {
      entry: ['initializeCheckout'],
      on: {
        'authenticated': {
          target: 'displayingCustomerForms',
          actions: 'handleAuthenticated',
        },
      },
      always: {
        target: 'displayingGuestForms',
      },
    },
    displayingGuestForms: {
      entry: 'displayGuestAddressForms',
      on: {
        'authenticated': {
          target: 'displayingCustomerForms',
          actions: 'handleAuthenticated',
        },
        'shipping/address-updated': {
          target: 'displayingBillToShipping',
          actions: 'handleShippingAddressUpdated',
        },
      },
      always: {
        target: 'displayingLoginForm',
      },
    },
    displayingCustomerForms: {
      entry: 'displayCustomerAddressForms',
      always: {
        target: 'displayingLoginForm',
      },
    },
    displayingLoginForm: {
      entry: 'displayLoginForm',
      on: {
        'authenticated': {
          target: 'displayingBillToShipping',
          actions: 'handleAuthenticated',
        },
      },
      always: {
        target: 'displayingBillToShipping',
      },
    },
    displayingBillToShipping: {
      entry: 'displayBillToShipping',
      always: {
        target: 'displayingShippingMethods',
      },
    },
    displayingShippingMethods: {
      entry: 'displayShippingMethods',
      always: {
        target: 'displayingPaymentMethods',
      },
    },
    displayingPaymentMethods: {
      entry: 'displayPaymentMethods',
      always: {
        target: 'displayingPlaceOrder',
      },
    },
    displayingPlaceOrder: {
      entry: 'displayPlaceOrder',
    },
    placingOrder: {
      entry: 'placeOrder',
      on: {
        'order/placed': {
          target: 'orderConfirmation',
          actions: 'handleOrderPlaced',
        },
      },
    },
    orderConfirmation: {
      type: 'final',
      entry: 'displayOrderConfirmation',
    },
  },
}, {
  guards: {
    isCartEmpty: ({ context, event }) => {
      // If no event data, check context
      if (!event?.data) {
        return !context.cartId || context.cartId === null;
      }
      return isCartEmpty(event.data);
    },
    isCheckoutEmpty: ({ context, event }) => {
      // If no event data, check context
      if (!event?.data) {
        return !context.cartId || context.cartId === null;
      }
      return isCheckoutEmpty(event.data);
    },
  },
  actions: {
    handleCartInitialized: ({ context, event }) => {
      if (!event?.data) {
        context.cartId = null;
        return;
      }
      context.cartId = event.data.id;
    },
    handleCheckoutInitialized: ({ context, event }) => {
      context.isGuest = event.data.isGuest;
      context.isVirtual = event.data.isVirtual;
    },
    handleCheckoutUpdated: ({ context, event }) => {
      // Handle checkout updates
    },
    handleAuthenticated: ({ context, event }) => {
      context.isGuest = false;
    },
    handleOrderPlaced: ({ context, event }) => {
      // Handle order placement
    },
    displayEmptyCart: ({ context }) => {
      events.emit('checkout/empty-cart');
    },
    initializeCheckout: ({ context }) => {
      events.emit('checkout/initialize');
    },
    displayOrderSummary: ({ context }) => {
      events.emit('checkout/display-order-summary');
    },
    displayGuestAddressForms: ({ context }) => {
      events.emit('checkout/display-guest-forms', {
        isVirtual: context.isVirtual
      });
    },
    displayCustomerAddressForms: ({ context }) => {
      events.emit('checkout/display-customer-forms', {
        isVirtual: context.isVirtual
      });
    },
    placeOrder: ({ context }) => {
      events.emit('checkout/place-order');
    },
    displayOrderConfirmation: ({ context }) => {
      events.emit('checkout/display-confirmation');
    },
    displayLoginForm: ({ context }) => {
      events.emit('checkout/display-login-form');
    },
    displayBillToShipping: ({ context }) => {
      events.emit('checkout/display-bill-to-shipping');
    },
    displayShippingMethods: ({ context }) => {
      events.emit('checkout/display-shipping-methods');
    },
    displayPaymentMethods: ({ context }) => {
      events.emit('checkout/display-payment-methods');
    },
    displayPlaceOrder: ({ context }) => {
      events.emit('checkout/display-place-order');
    },
    handleShippingAddressUpdated: ({ context, event }) => {
      context.shippingAddress = event.data;
    },
  },
}); 