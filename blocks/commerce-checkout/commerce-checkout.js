/* eslint-disable import/no-unresolved */
/* eslint-disable no-unused-vars */
/* eslint-disable no-shadow */
/* eslint-disable no-use-before-define */
/* eslint-disable prefer-const */

import { createActor } from 'xstate';
import { checkoutMachine } from './checkoutMachine.js';
import { createCheckoutService } from './checkoutService.js';
import { events } from '@dropins/tools/event-bus.js';
import { initializers } from '@dropins/tools/initializer.js';
import { getConfigValue } from '../../scripts/configs.js';

// Dropin Components
import {
  Button,
  Header,
  ProgressSpinner,
  provider as UI,
} from '@dropins/tools/components.js';

// Auth Dropin
import * as authApi from '@dropins/storefront-auth/api.js';
import AuthCombine from '@dropins/storefront-auth/containers/AuthCombine.js';
import SignUp from '@dropins/storefront-auth/containers/SignUp.js';
import { render as AuthProvider } from '@dropins/storefront-auth/render.js';

// Account Dropin
import Addresses from '@dropins/storefront-account/containers/Addresses.js';
import AddressForm from '@dropins/storefront-account/containers/AddressForm.js';
import { render as AccountProvider } from '@dropins/storefront-account/render.js';

// Cart Dropin
import * as cartApi from '@dropins/storefront-cart/api.js';
import CartSummaryList from '@dropins/storefront-cart/containers/CartSummaryList.js';
import Coupons from '@dropins/storefront-cart/containers/Coupons.js';
import EmptyCart from '@dropins/storefront-cart/containers/EmptyCart.js';
import OrderSummary from '@dropins/storefront-cart/containers/OrderSummary.js';
import { render as CartProvider } from '@dropins/storefront-cart/render.js';

// Checkout Dropin
import * as checkoutApi from '@dropins/storefront-checkout/api.js';
import BillToShippingAddress from '@dropins/storefront-checkout/containers/BillToShippingAddress.js';
import EstimateShipping from '@dropins/storefront-checkout/containers/EstimateShipping.js';
import LoginForm from '@dropins/storefront-checkout/containers/LoginForm.js';
import MergedCartBanner from '@dropins/storefront-checkout/containers/MergedCartBanner.js';
import OutOfStock from '@dropins/storefront-checkout/containers/OutOfStock.js';
import PaymentMethods from '@dropins/storefront-checkout/containers/PaymentMethods.js';
import PlaceOrder from '@dropins/storefront-checkout/containers/PlaceOrder.js';
import ServerError from '@dropins/storefront-checkout/containers/ServerError.js';
import ShippingMethods from '@dropins/storefront-checkout/containers/ShippingMethods.js';

import { render as CheckoutProvider } from '@dropins/storefront-checkout/render.js';

// Order Dropin Modules
import * as orderApi from '@dropins/storefront-order/api.js';
import CustomerDetails from '@dropins/storefront-order/containers/CustomerDetails.js';
import OrderCostSummary from '@dropins/storefront-order/containers/OrderCostSummary.js';
import OrderHeader from '@dropins/storefront-order/containers/OrderHeader.js';
import OrderProductList from '@dropins/storefront-order/containers/OrderProductList.js';
import OrderStatus from '@dropins/storefront-order/containers/OrderStatus.js';
import ShippingStatus from '@dropins/storefront-order/containers/ShippingStatus.js';
import { render as OrderProvider } from '@dropins/storefront-order/render.js';

// Block-level
import createModal from '../modal/modal.js';

// Scripts
import {
  estimateShippingCost,
  getCartAddress,
  isCartEmpty,
  isCheckoutEmpty,
  scrollToElement,
  setAddressOnCart,
} from '../../scripts/checkout.js';
import { authPrivacyPolicyConsentSlot } from '../../scripts/constants.js';

function createMetaTag(property, content, type) {
  if (!property || !type) {
    return;
  }
  let meta = document.head.querySelector(`meta[${type}="${property}"]`);
  if (meta) {
    if (!content) {
      meta.remove();
      return;
    }
    meta.setAttribute(type, property);
    meta.setAttribute('content', content);
    return;
  }
  if (!content) {
    return;
  }
  meta = document.createElement('meta');
  meta.setAttribute(type, property);
  meta.setAttribute('content', content);
  document.head.appendChild(meta);
}

function setMetaTags(dropin) {
  createMetaTag('title', dropin);
  createMetaTag('description', dropin);
  createMetaTag('keywords', dropin);

  createMetaTag('og:description', dropin);
  createMetaTag('og:title', dropin);
  createMetaTag('og:url', window.location.href, 'property');
}

export default async function decorate(block) {
  // Initializers
  import('../../scripts/initializers/account.js');
  import('../../scripts/initializers/checkout.js');

  setMetaTags('Checkout');
  document.title = 'Checkout';

  events.on('order/placed', () => {
    setMetaTags('Order Confirmation');
    document.title = 'Order Confirmation';
  });

  // Define the Layout for the Checkout
  const checkoutFragment = document.createRange().createContextualFragment(`
    <div class="checkout__wrapper">
      <div class="checkout__loader"></div>
      <div class="checkout__merged-cart-banner"></div>
      <div class="checkout__content">
        <div class="checkout__main">
          <div class="checkout__block checkout__heading"></div>
          <div class="checkout__block checkout__empty-cart"></div>
          <div class="checkout__block checkout__server-error"></div>
          <div class="checkout__block checkout__out-of-stock"></div>
          
          <div class="checkout__steps">
            <div class="checkout__step checkout__step-1 active" data-step="1">
              <div class="checkout__step-header">
                <h2 class="checkout__step-title">Login & Shipping Address</h2>
                <div class="checkout__step-indicator">1</div>
              </div>
              <div class="checkout__step-content">
                <div class="checkout__block checkout__login"></div>
                <div class="checkout__block checkout__shipping-form"></div>
                <div class="checkout__step-actions">
                  <button class="checkout__continue-btn" data-step="1">Continue</button>
                </div>
              </div>
            </div>
            
            <div class="checkout__step checkout__step-2" data-step="2">
              <div class="checkout__step-header">
                <h2 class="checkout__step-title">Shipping Methods</h2>
                <div class="checkout__step-indicator">2</div>
              </div>
              <div class="checkout__step-content">
                <div class="checkout__block checkout__delivery"></div>
                <div class="checkout__step-actions">
                  <button class="checkout__continue-btn" data-step="2">Continue</button>
                </div>
              </div>
            </div>
            
            <div class="checkout__step checkout__step-3" data-step="3">
              <div class="checkout__step-header">
                <h2 class="checkout__step-title">Payment Method</h2>
                <div class="checkout__step-indicator">3</div>
              </div>
              <div class="checkout__step-content">
                <div class="checkout__block checkout__payment-methods"></div>
                <div class="checkout__step-actions">
                  <button class="checkout__continue-btn" data-step="3">Continue</button>
                </div>
              </div>
            </div>
            
            <div class="checkout__step checkout__step-4" data-step="4">
              <div class="checkout__step-header">
                <h2 class="checkout__step-title">Billing Address</h2>
                <div class="checkout__step-indicator">4</div>
              </div>
              <div class="checkout__step-content">
                <div class="checkout__block checkout__bill-to-shipping"></div>
                <div class="checkout__block checkout__billing-form"></div>
                <div class="checkout__block checkout__place-order"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="checkout__aside">
          <div class="checkout__block checkout__order-summary"></div>
          <div class="checkout__block checkout__cart-summary"></div>
        </div>
      </div>
    </div>
  `);

  const elements = {
    $content: checkoutFragment.querySelector('.checkout__content'),
    $loader: checkoutFragment.querySelector('.checkout__loader'),
    $mergedCartBanner: checkoutFragment.querySelector('.checkout__merged-cart-banner'),
    $heading: checkoutFragment.querySelector('.checkout__heading'),
    $emptyCart: checkoutFragment.querySelector('.checkout__empty-cart'),
    $serverError: checkoutFragment.querySelector('.checkout__server-error'),
    $outOfStock: checkoutFragment.querySelector('.checkout__out-of-stock'),
    $login: checkoutFragment.querySelector('.checkout__login'),
    $shippingForm: checkoutFragment.querySelector('.checkout__shipping-form'),
    $billToShipping: checkoutFragment.querySelector('.checkout__bill-to-shipping'),
    $delivery: checkoutFragment.querySelector('.checkout__delivery'),
    $paymentMethods: checkoutFragment.querySelector('.checkout__payment-methods'),
    $billingForm: checkoutFragment.querySelector('.checkout__billing-form'),
    $orderSummary: checkoutFragment.querySelector('.checkout__order-summary'),
    $cartSummary: checkoutFragment.querySelector('.checkout__cart-summary'),
    $placeOrder: checkoutFragment.querySelector('.checkout__place-order'),
    $steps: checkoutFragment.querySelector('.checkout__steps'),
    $step1: checkoutFragment.querySelector('.checkout__step-1'),
    $step2: checkoutFragment.querySelector('.checkout__step-2'),
    $step3: checkoutFragment.querySelector('.checkout__step-3'),
    $step4: checkoutFragment.querySelector('.checkout__step-4'),
  };

  block.appendChild(checkoutFragment);

  // Create checkout service
  const checkoutService = createCheckoutService(block, elements);

  // Create state machine actor
  const actor = createActor(checkoutMachine, {
    input: {
      service: checkoutService,
    },
  });

  // Start the actor
  actor.start();

  // Add event handlers for the step navigation
  const setupStepNavigation = () => {
    // Step headers click event - expand/collapse
    const stepHeaders = block.querySelectorAll('.checkout__step-header');
    stepHeaders.forEach((header) => {
      header.addEventListener('click', (event) => {
        const step = event.currentTarget.closest('.checkout__step');
        const stepNumber = parseInt(step.dataset.step, 10);
        
        // Toggle active class to expand/collapse the step
        if (step.classList.contains('active')) {
          // If already active, do nothing (keep it open)
          return;
        }
        
        // Change active step
        const currentActive = block.querySelector('.checkout__step.active');
        if (currentActive) {
          currentActive.classList.remove('active');
        }
        step.classList.add('active');
        
        // Notify the state machine
        actor.send({ 
          type: 'step/change', 
          data: { step: stepNumber } 
        });
      });
    });
    
    // Continue buttons click event
    const continueButtons = block.querySelectorAll('.checkout__continue-btn');
    continueButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        const stepNumber = parseInt(event.target.dataset.step, 10);
        
        // Validate the current step before proceeding
        // For simplicity, we'll assume all steps are valid
        actor.send({
          type: 'form/validate',
          data: { step: stepNumber, isValid: true }
        });
        
        // Proceed to the next step
        actor.send({
          type: 'step/continue',
          data: { step: stepNumber }
        });
      });
    });
  };
  
  // Subscribe to machine state changes to update the UI
  actor.subscribe({
    next: (snapshot) => {
      console.log('Current state:', snapshot.value);
      
      // Update active step based on the machine state
      if (snapshot.context.activeStep) {
        const steps = block.querySelectorAll('.checkout__step');
        steps.forEach((step) => {
          const stepNumber = parseInt(step.dataset.step, 10);
          if (stepNumber === snapshot.context.activeStep) {
            step.classList.add('active');
          } else {
            step.classList.remove('active');
          }
        });
      }
    },
    error: (error) => {
      console.error('State machine error:', error);
    },
  });

  // Initialize step navigation
  setupStepNavigation();

  // Subscribe to events
  events.on('cart/initialized', (data) => {
    actor.send({ type: 'cart/initialized', data });
  });

  events.on('checkout/initialized', (data) => {
    actor.send({ type: 'checkout/initialized', data });
  });

  events.on('checkout/updated', (data) => {
    actor.send({ type: 'checkout/updated', data });
  });

  events.on('authenticated', (authenticated) => {
    actor.send({ type: 'authenticated', data: authenticated });
  });

  events.on('order/placed', (orderData) => {
    actor.send({ type: 'order/placed', data: orderData });
  });

  // Listen for checkout events
  events.on('checkout/empty-cart', () => {
    checkoutService.displayEmptyCart();
    checkoutService.removeOverlaySpinner();
  });

  events.on('checkout/initialize', () => {
    checkoutService.displayOverlaySpinner();
  });

  events.on('checkout/display-guest-forms', (data) => {
    checkoutService.displayGuestAddressForms(data);
  });

  events.on('checkout/display-customer-forms', (data) => {
    checkoutService.displayCustomerAddressForms(data);
  });

  events.on('checkout/display-login-form', () => {
    checkoutService.displayLoginForm();
  });

  events.on('checkout/display-bill-to-shipping', () => {
    checkoutService.displayBillToShipping();
  });

  events.on('checkout/display-shipping-methods', () => {
    checkoutService.displayShippingMethods();
  });

  events.on('checkout/display-payment-methods', () => {
    checkoutService.displayPaymentMethods();
  });

  events.on('checkout/display-place-order', () => {
    checkoutService.displayPlaceOrder();
    checkoutService.removeOverlaySpinner();
  });

  events.on('checkout/place-order', () => {
    checkoutService.displayOverlaySpinner();
  });

  events.on('checkout/display-confirmation', (orderData) => {
    checkoutService.displayOrderConfirmation(orderData);
    checkoutService.removeOverlaySpinner();
  });
}
