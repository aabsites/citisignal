import { createMachine } from 'xstate';
import { events } from '@dropins/tools/event-bus.js';
import * as cartApi from '@dropins/storefront-cart/api.js';
import * as checkoutApi from '@dropins/storefront-checkout/api.js';
import * as authApi from '@dropins/storefront-auth/api.js';
import { isCartEmpty, isCheckoutEmpty } from '../../scripts/checkout.js';

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
    activeStep: 1, // Track the active step in the checkout flow
    stepsCompleted: {
      step1: false,
      step2: false,
      step3: false,
      step4: false,
    },
    validationErrors: {},
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
          target: 'displayingStep1',
          actions: 'handleAuthenticated',
        },
        'step/change': {
          actions: 'handleStepChange',
        },
        'form/validate': {
          actions: 'validateForm',
        },
        'shipping/address-updated': {
          actions: ['handleShippingAddressUpdated', 'markStep1Complete'],
        },
      },
      always: [
        {
          target: 'displayingStep1',
        }
      ],
    },
    displayingStep1: {
      entry: ['displayLoginForm', 'displayShippingAddress'],
      on: {
        'authenticated': {
          actions: 'handleAuthenticated',
        },
        'step/change': {
          actions: 'handleStepChange',
        },
        'form/validate': {
          actions: 'validateForm',
        },
        'shipping/address-updated': {
          target: 'displayingStep2',
          actions: ['handleShippingAddressUpdated', 'markStep1Complete'],
        },
        'step/continue': {
          target: 'displayingStep2',
          guard: 'isStep1Valid',
          actions: 'markStep1Complete',
        },
      },
    },
    displayingStep2: {
      entry: 'displayShippingMethods',
      on: {
        'step/change': {
          actions: 'handleStepChange',
        },
        'form/validate': {
          actions: 'validateForm',
        },
        'shipping/method-selected': {
          actions: 'markStep2Complete',
        },
        'step/continue': {
          target: 'displayingStep3',
          guard: 'isStep2Valid',
          actions: 'markStep2Complete',
        },
      },
    },
    displayingStep3: {
      entry: 'displayPaymentMethods',
      on: {
        'step/change': {
          actions: 'handleStepChange',
        },
        'form/validate': {
          actions: 'validateForm',
        },
        'payment/method-selected': {
          actions: 'markStep3Complete',
        },
        'step/continue': {
          target: 'displayingStep4',
          guard: 'isStep3Valid',
          actions: 'markStep3Complete',
        },
      },
    },
    displayingStep4: {
      entry: ['displayBillToShipping', 'displayPlaceOrder'],
      on: {
        'step/change': {
          actions: 'handleStepChange',
        },
        'form/validate': {
          actions: 'validateForm',
        },
        'billing/address-updated': {
          actions: 'markStep4Complete',
        },
        'step/continue': {
          target: 'placingOrder',
          guard: 'isStep4Valid',
          actions: 'markStep4Complete',
        },
      },
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
    isLoggedIn: ({ context }) => {
      return !context.isGuest;
    },
    isStep1Valid: ({ context }) => {
      return !context.validationErrors.step1;
    },
    isStep2Valid: ({ context }) => {
      return !context.validationErrors.step2;
    },
    isStep3Valid: ({ context }) => {
      return !context.validationErrors.step3;
    },
    isStep4Valid: ({ context }) => {
      return !context.validationErrors.step4;
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
      if (event?.data) {
        context.isGuest = event.data.isGuest;
        context.isVirtual = event.data.isVirtual;
      }
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
    handleStepChange: ({ context, event }) => {
      if (event?.data?.step) {
        context.activeStep = event.data.step;
      }
    },
    validateForm: ({ context, event }) => {
      if (event?.data?.step && event?.data?.isValid !== undefined) {
        context.validationErrors[`step${event.data.step}`] = !event.data.isValid;
      }
    },
    markStep1Complete: ({ context }) => {
      context.stepsCompleted.step1 = true;
      context.activeStep = 2;
    },
    markStep2Complete: ({ context }) => {
      context.stepsCompleted.step2 = true;
      context.activeStep = 3;
    },
    markStep3Complete: ({ context }) => {
      context.stepsCompleted.step3 = true;
      context.activeStep = 4;
    },
    markStep4Complete: ({ context }) => {
      context.stepsCompleted.step4 = true;
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
    displayShippingAddress: ({ context }) => {
      events.emit('checkout/display-guest-forms', {
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