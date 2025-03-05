import { events } from '@dropins/tools/event-bus.js';
import * as cartApi from '@dropins/storefront-cart/api.js';
import * as checkoutApi from '@dropins/storefront-checkout/api.js';
import { getUserTokenCookie } from '../../../initializers/index.js';
// Scripts
import {
  estimateShippingCost,
  getCartAddress,
  isCartEmpty,
  isCheckoutEmpty,
  scrollToElement,
  setAddressOnCart,
} from '../../../../scripts/checkout.js';

// Auth Dropin
import * as authApi from '@dropins/storefront-auth/api.js';
import AuthCombine from '@dropins/storefront-auth/containers/AuthCombine.js';
import SignUp from '@dropins/storefront-auth/containers/SignUp.js';
import { render as AuthProvider } from '@dropins/storefront-auth/render.js';

// Account Dropin
import Addresses from '@dropins/storefront-account/containers/Addresses.js';
import AddressForm from '@dropins/storefront-account/containers/AddressForm.js';
import { render as AccountProvider } from '@dropins/storefront-account/render.js';

// Block-level
import createModal from '../../../../blocks/modal/modal.js';

const DEBOUNCE_TIME = 1000;
const LOGIN_FORM_NAME = 'login-form';
const SHIPPING_FORM_NAME = 'selectedShippingAddress';
const BILLING_FORM_NAME = 'selectedBillingAddress';
const SHIPPING_ADDRESS_DATA_KEY = `${SHIPPING_FORM_NAME}_addressData`;
const BILLING_ADDRESS_DATA_KEY = `${BILLING_FORM_NAME}_addressData`;

  // Container and component references
  let loader;
  let modal;
  let emptyCart;
  const shippingFormRef = { current: null };
  const billingFormRef = { current: null };
  const creditCardFormRef = { current: null };
  let shippingForm;
  let billingForm;
  let shippingAddresses;
  let billingAddresses;


export const createCheckoutService = (block, elements) => {
  const {
    $content,
    $loader,
    $mergedCartBanner,
    $heading,
    $emptyCart,
    $serverError,
    $outOfStock,
    $login,
    $shippingForm,
    $billToShipping,
    $delivery,
    $paymentMethods,
    $billingForm,
    $orderSummary,
    $cartSummary,
    $placeOrder,
  } = elements;

  // Add event listeners
  events.on('checkout/display-order-summary', () => {
    console.log('Received checkout/display-order-summary event');
    displayOrderSummary();
  });

  const displayOverlaySpinner = async () => {
    if ($loader.children.length > 0) return;
    
    const { ProgressSpinner, provider: UI } = await import('@dropins/tools/components.js');
    const loader = await UI.render(ProgressSpinner, {
      className: 'checkout__overlay-spinner',
    })($loader);
    
    return loader;
  };

  const removeOverlaySpinner = () => {
    $loader.innerHTML = '';
  };

  const showModal = async (content) => {
    const modal = await createModal([content]);
    modal.showModal();
    return modal;
  };

  const removeModal = () => {
    const modal = document.querySelector('.modal');
    if (modal) {
      modal.remove();
    }
  };

  const displayEmptyCart = async () => {
    if ($emptyCart.children.length > 0) return;

    const { EmptyCart } = await import('@dropins/storefront-cart/containers/EmptyCart.js');
    const { render: CartProvider } = await import('@dropins/storefront-cart/render.js');
    
    const emptyCart = await CartProvider.render(EmptyCart, {
      routeCTA: () => '/',
    })($emptyCart);

    $content.classList.add('checkout__content--empty');
    return emptyCart;
  };

  const removeEmptyCart = () => {
    $emptyCart.innerHTML = '';
    $content.classList.remove('checkout__content--empty');
  };


  
  
  const displayGuestAddressForms = async (data) => {
    if (data.isVirtual) {
      shippingForm?.remove();
      shippingForm = null;
      $shippingForm.innerHTML = '';
    } else if (!shippingForm) {
      const cartShippingAddress = getCartAddress(data, 'shipping');

      const shippingAddressCache = sessionStorage.getItem(
        SHIPPING_ADDRESS_DATA_KEY,
      );

      if (cartShippingAddress && shippingAddressCache) {
        sessionStorage.removeItem(SHIPPING_ADDRESS_DATA_KEY);
      }

      // shippingFormSkeleton.remove();

      let isFirstRenderShipping = true;
      const hasCartShippingAddress = Boolean(data.shippingAddresses?.[0]);

      const setShippingAddressOnCart = setAddressOnCart({
        api: checkoutApi.setShippingAddress,
        debounceMs: DEBOUNCE_TIME,
        // placeOrderBtn: $placeOrder,
      });

      const estimateShippingCostOnCart = estimateShippingCost({
        api: checkoutApi.estimateShippingMethods,
        debounceMs: DEBOUNCE_TIME,
      });

      const storeConfig = checkoutApi.getStoreConfigCache();

      shippingForm = await AccountProvider.render(AddressForm, {
        addressesFormTitle: 'Shipping address',
        className: 'checkout-shipping-form__address-form',
        formName: SHIPPING_FORM_NAME,
        forwardFormRef: shippingFormRef,
        hideActionFormButtons: true,
        inputsDefaultValueSet: cartShippingAddress ?? {
          countryCode: storeConfig.defaultCountry,
        },
        isOpen: true,
        onChange: (values) => {
          const syncAddress = !isFirstRenderShipping || !hasCartShippingAddress;
          if (syncAddress) setShippingAddressOnCart(values);
          if (!hasCartShippingAddress) estimateShippingCostOnCart(values);
          if (isFirstRenderShipping) isFirstRenderShipping = false;
        },
        showBillingCheckBox: false,
        showFormLoader: false,
        showShippingCheckBox: false,
      })($shippingForm);
    }

    if (!billingForm) {
      const cartBillingAddress = getCartAddress(data, 'billing');

      const billingAddressCache = sessionStorage.getItem(
        BILLING_ADDRESS_DATA_KEY,
      );

      if (cartBillingAddress && billingAddressCache) {
        sessionStorage.removeItem(BILLING_ADDRESS_DATA_KEY);
      }

      // billingFormSkeleton.remove();

      let isFirstRenderBilling = true;
      const hasCartBillingAddress = Boolean(data.billingAddress);

      const setBillingAddressOnCart = setAddressOnCart({
        api: checkoutApi.setBillingAddress,
        debounceMs: DEBOUNCE_TIME,
        // placeOrderBtn: placeOrder,
      });

      const storeConfig = checkoutApi.getStoreConfigCache();

      billingForm = await AccountProvider.render(AddressForm, {
        addressesFormTitle: 'Billing address',
        className: 'checkout-billing-form__address-form',
        formName: BILLING_FORM_NAME,
        forwardFormRef: billingFormRef,
        hideActionFormButtons: true,
        inputsDefaultValueSet: cartBillingAddress ?? {
          countryCode: storeConfig.defaultCountry,
        },
        isOpen: true,
        onChange: (values) => {
          const canSetBillingAddressOnCart = !isFirstRenderBilling || !hasCartBillingAddress;
          if (canSetBillingAddressOnCart) setBillingAddressOnCart(values);
          if (isFirstRenderBilling) isFirstRenderBilling = false;
        },
        showBillingCheckBox: false,
        showFormLoader: false,
        showShippingCheckBox: false,
      })($billingForm);
    }
  };

  const displayCustomerAddressForms = async (data) => {
    if (data.isVirtual) {
      shippingAddresses?.remove();
      shippingAddresses = null;
      $shippingForm.innerHTML = '';
    } else if (!shippingAddresses) {
      shippingForm?.remove();
      shippingForm = null;
      shippingFormRef.current = null;

      const cartShippingAddress = getCartAddress(data, 'shipping');

      const shippingAddressId = cartShippingAddress
        ? cartShippingAddress?.id ?? 0
        : undefined;

      const shippingAddressCache = sessionStorage.getItem(
        SHIPPING_ADDRESS_DATA_KEY,
      );

      // clear persisted shipping address if cart has a shipping address
      if (cartShippingAddress && shippingAddressCache) {
        sessionStorage.removeItem(SHIPPING_ADDRESS_DATA_KEY);
      }

      const storeConfig = checkoutApi.getStoreConfigCache();

      const inputsDefaultValueSet = cartShippingAddress && cartShippingAddress.id === undefined
        ? cartShippingAddress
        : { countryCode: storeConfig.defaultCountry };

      const hasCartShippingAddress = Boolean(data.shippingAddresses?.[0]);
      let isFirstRenderShipping = true;

      const setShippingAddressOnCart = setAddressOnCart({
        api: checkoutApi.setShippingAddress,
        debounceMs: DEBOUNCE_TIME,
        // placeOrderBtn: placeOrder,
      });

      shippingAddresses = await AccountProvider.render(Addresses, {
        addressFormTitle: 'Deliver to new address',
        defaultSelectAddressId: shippingAddressId,
        formName: SHIPPING_FORM_NAME,
        forwardFormRef: shippingFormRef,
        inputsDefaultValueSet,
        minifiedView: false,
        onAddressData: (values) => {
          const canSetShippingAddressOnCart = !isFirstRenderShipping || !hasCartShippingAddress;
          if (canSetShippingAddressOnCart) setShippingAddressOnCart(values);
          if (isFirstRenderShipping) isFirstRenderShipping = false;
        },
        selectable: true,
        selectShipping: true,
        showBillingCheckBox: false,
        showSaveCheckBox: true,
        showShippingCheckBox: false,
        title: 'Shipping address',
      })($shippingForm);
    }

    if (!billingAddresses) {
      billingForm?.remove();
      billingForm = null;
      billingFormRef.current = null;

      const cartBillingAddress = getCartAddress(data, 'billing');

      const billingAddressId = cartBillingAddress
        ? cartBillingAddress?.id ?? 0
        : undefined;

      const billingAddressCache = sessionStorage.getItem(
        BILLING_ADDRESS_DATA_KEY,
      );

      // clear persisted billing address if cart has a billing address
      if (cartBillingAddress && billingAddressCache) {
        sessionStorage.removeItem(BILLING_ADDRESS_DATA_KEY);
      }

      const storeConfig = checkoutApi.getStoreConfigCache();

      const inputsDefaultValueSet = cartBillingAddress && cartBillingAddress.id === undefined
        ? cartBillingAddress
        : { countryCode: storeConfig.defaultCountry };

      const hasCartBillingAddress = Boolean(data.billingAddress);
      let isFirstRenderBilling = true;

      const setBillingAddressOnCart = setAddressOnCart({
        api: checkoutApi.setBillingAddress,
        debounceMs: DEBOUNCE_TIME,
        // placeOrderBtn: placeOrder,
      });

      billingAddresses = await AccountProvider.render(Addresses, {
        addressFormTitle: 'Bill to new address',
        defaultSelectAddressId: billingAddressId,
        formName: BILLING_FORM_NAME,
        forwardFormRef: billingFormRef,
        inputsDefaultValueSet,
        minifiedView: false,
        onAddressData: (values) => {
          const canSetBillingAddressOnCart = !isFirstRenderBilling || !hasCartBillingAddress;
          if (canSetBillingAddressOnCart) setBillingAddressOnCart(values);
          if (isFirstRenderBilling) isFirstRenderBilling = false;
        },
        selectable: true,
        selectBilling: true,
        showBillingCheckBox: false,
        showSaveCheckBox: true,
        showShippingCheckBox: false,
        title: 'Billing address',
      })($billingForm);
    }
  };

  const displayLoginForm = async () => {
    if ($login.children.length > 0) return;

    const { LoginForm } = await import('@dropins/storefront-checkout/containers/LoginForm.js');
    const { render: CheckoutProvider } = await import('@dropins/storefront-checkout/render.js');
    
    // const loginForm = await CheckoutProvider.render(LoginForm, {
    //   name: LOGIN_FORM_NAME,
    //   className: 'checkout-login-form',
    // })($login);

    const loginForm = CheckoutProvider.render(LoginForm, {
      name: LOGIN_FORM_NAME,
      onSignInClick: async (initialEmailValue) => {
        const signInForm = document.createElement('div');

        AuthProvider.render(AuthCombine, {
          signInFormConfig: {
            renderSignUpLink: true,
            initialEmailValue,
            onSuccessCallback: () => {
              displayOverlaySpinner();
            },
          },
          signUpFormConfig: {
            slots: {
              // ...authPrivacyPolicyConsentSlot,
            },
          },
          resetPasswordFormConfig: {},
        })(signInForm);

        showModal(signInForm);
      },
      onSignOutClick: () => {
        authApi.revokeCustomerToken();
      },
    })($login)

    return loginForm;
  };

  const displayBillToShipping = async () => {
    if ($billToShipping.children.length > 0) return;

    const { BillToShippingAddress } = await import('@dropins/storefront-checkout/containers/BillToShippingAddress.js');
    const { render: CheckoutProvider } = await import('@dropins/storefront-checkout/render.js');

    const billToShipping = CheckoutProvider.render(BillToShippingAddress, {
      hideOnVirtualCart: true,
      onChange: (checked) => {
        $billingForm.style.display = checked ? 'none' : 'block';
        if (!checked && billingFormRef?.current) {
          const { formData, isDataValid } = billingFormRef.current;

          setAddressOnCart({
            api: checkoutApi.setBillingAddress,
            debounceMs: DEBOUNCE_TIME,
            // placeOrderBtn: placeOrder,
          })({ data: formData, isDataValid });
        }
      },
    })($billToShipping);

    return billToShipping;
  };

  const displayShippingMethods = async () => {
    if ($delivery.children.length > 0) return;

    const { ShippingMethods } = await import('@dropins/storefront-checkout/containers/ShippingMethods.js');
    const { render: CheckoutProvider } = await import('@dropins/storefront-checkout/render.js');
    
    const shippingMethods = await CheckoutProvider.render(ShippingMethods, {
      className: 'checkout-shipping-methods',
    })($delivery);

    return shippingMethods;
  };

  const displayPaymentMethods = async () => {
    if ($paymentMethods.children.length > 0) return;

    const { PaymentMethods } = await import('@dropins/storefront-checkout/containers/PaymentMethods.js');
    const { render: CheckoutProvider } = await import('@dropins/storefront-checkout/render.js');
    
    const paymentMethods = await CheckoutProvider.render(PaymentMethods, {
      className: 'checkout-payment-methods',
    })($paymentMethods);

    return paymentMethods;
  };

  const displayPlaceOrder = async () => {
    if ($placeOrder.children.length > 0) return;

    const { PlaceOrder } = await import('@dropins/storefront-checkout/containers/PlaceOrder.js');
    const { ServerError } = await import('@dropins/storefront-checkout/containers/ServerError.js');
    const { render: CheckoutProvider } = await import('@dropins/storefront-checkout/render.js');
    const { placeOrder } = await import('@dropins/storefront-order/api.js');
    
    // Initialize server error handling
    await CheckoutProvider.render(ServerError, {
      autoScroll: true,
      onRetry: () => {
        $content.classList.remove('checkout__content--error');
      },
      onServerError: () => {
        $content.classList.add('checkout__content--error');
      },
    })($serverError);

    const placeOrderComponent = await CheckoutProvider.render(PlaceOrder, {
      className: 'checkout-place-order',
      handleValidation: () => {
        console.log('handleValidation');
        let success = true;
        const { forms } = document;

        const loginForm = forms[LOGIN_FORM_NAME];

        if (loginForm) {
          success = loginForm.checkValidity();
          if (!success) scrollToElement($login);
        }

        const shippingForm = forms[SHIPPING_FORM_NAME];

        if (
          success
          && shippingFormRef.current
          && shippingForm
          && shippingForm.checkVisibility()
        ) {
          success = shippingFormRef.current.handleValidationSubmit(false);
        }

        const billingForm = forms[BILLING_FORM_NAME];

        if (
          success
          && billingFormRef.current
          && billingForm
          && billingForm.checkVisibility()
        ) {
          success = billingFormRef.current.handleValidationSubmit(false);
        }
        console.log('success', success);

        return success;
      },
      handlePlaceOrder: async ({ cartId, code }) => {
        try {
          events.emit('checkout/place-order');
          if (!cartId) {
            throw new Error('No cart ID found');
          }
          const orderData = await placeOrder(cartId);
          if (orderData) {
            events.emit('order/placed', orderData);
            await displayOrderConfirmation(orderData);
          }
        } catch (error) {
          console.error('Error placing order:', error);
          throw error;
        } finally {
          removeOverlaySpinner();
        }
      },
    })($placeOrder);

    return placeOrderComponent;
  };

  const displayOrderConfirmation = async (orderData) => {
    window.scrollTo(0, 0);

    const orderConfirmationFragment = document.createRange().createContextualFragment(`
      <div class="order-confirmation">
        <div class="order-confirmation__main">
          <div class="order-confirmation__block order-confirmation__header"></div>
          <div class="order-confirmation__block order-confirmation__order-status"></div>
          <div class="order-confirmation__block order-confirmation__shipping-status"></div>
          <div class="order-confirmation__block order-confirmation__customer-details"></div>
        </div>
        <div class="order-confirmation__aside">
          <div class="order-confirmation__block order-confirmation__order-cost-summary"></div>
          <div class="order-confirmation__block order-confirmation__order-product-list"></div>
          <div class="order-confirmation__block order-confirmation__footer"></div>
        </div>
      </div>
    `);

    // Order confirmation elements
    const $orderConfirmationHeader = orderConfirmationFragment.querySelector('.order-confirmation__header');
    const $orderStatus = orderConfirmationFragment.querySelector('.order-confirmation__order-status');
    const $shippingStatus = orderConfirmationFragment.querySelector('.order-confirmation__shipping-status');
    const $customerDetails = orderConfirmationFragment.querySelector('.order-confirmation__customer-details');
    const $orderCostSummary = orderConfirmationFragment.querySelector('.order-confirmation__order-cost-summary');
    const $orderProductList = orderConfirmationFragment.querySelector('.order-confirmation__order-product-list');
    const $orderConfirmationFooter = orderConfirmationFragment.querySelector('.order-confirmation__footer');

    const { initializers } = await import('@dropins/tools/initializer.js');
    const orderApi = await import('@dropins/storefront-order/api.js');
    await initializers.mountImmediately(orderApi.initialize, { orderData });

    block.replaceChildren(orderConfirmationFragment);

    const handleSignUpClick = async ({ inputsDefaultValueSet, addressesData }) => {
      const signUpForm = document.createElement('div');
      const { render: AuthProvider } = await import('@dropins/storefront-auth/render.js');
      const { SignUp } = await import('@dropins/storefront-auth/containers/SignUp.js');
      // const { authPrivacyPolicyConsentSlot } = await import('@dropins/storefront-auth/slots.js');
      
      AuthProvider.render(SignUp, {
        routeSignIn: () => '/customer/login',
        routeRedirectOnEmailConfirmationClose: () => '/customer/account',
        inputsDefaultValueSet,
        addressesData,
        slots: {
          // ...authPrivacyPolicyConsentSlot,
        },
      })(signUpForm);

      await showModal(signUpForm);
    };

    const { render: OrderProvider } = await import('@dropins/storefront-order/render.js');
    const { OrderHeader } = await import('@dropins/storefront-order/containers/OrderHeader.js');
    const { OrderStatus } = await import('@dropins/storefront-order/containers/OrderStatus.js');
    const { ShippingStatus } = await import('@dropins/storefront-order/containers/ShippingStatus.js');
    const { CustomerDetails } = await import('@dropins/storefront-order/containers/CustomerDetails.js');
    const { OrderCostSummary } = await import('@dropins/storefront-order/containers/OrderCostSummary.js');
    const { OrderProductList } = await import('@dropins/storefront-order/containers/OrderProductList.js');


    await OrderProvider.render(OrderHeader, {
      handleEmailAvailability: checkoutApi.isEmailAvailable,
      handleSignUpClick,
      orderData,
    })($orderConfirmationHeader);

    await OrderProvider.render(OrderStatus, { slots: { OrderActions: () => null } })($orderStatus);
    await OrderProvider.render(ShippingStatus)($shippingStatus);
    await OrderProvider.render(CustomerDetails)($customerDetails);
    await OrderProvider.render(OrderCostSummary)($orderCostSummary);
    await OrderProvider.render(OrderProductList)($orderProductList);

    $orderConfirmationFooter.innerHTML = `
      <div class="order-confirmation-footer__continue-button"></div>
      <div class="order-confirmation-footer__contact-support">
        <p>
          Need help?
          <a href="/support" rel="noreferrer" class="order-confirmation-footer__contact-support-link">
            Contact us
          </a>
        </p>
      </div>
    `;

    const $orderConfirmationFooterContinueBtn = $orderConfirmationFooter.querySelector(
      '.order-confirmation-footer__continue-button',
    );

    const { Button, provider: UI } = await import('@dropins/tools/components.js');
    await UI.render(Button, {
      children: 'Continue shopping',
      className: 'order-confirmation-footer__continue-button',
      size: 'medium',
      variant: 'primary',
      type: 'submit',
      href: '/',
    })($orderConfirmationFooterContinueBtn);
  };

  const displayOrderSummary = async () => {
    if ($orderSummary.children.length > 0) return;
    const { OrderSummary } = await import('@dropins/storefront-cart/containers/OrderSummary.js');
    const { CartSummaryList } = await import('@dropins/storefront-cart/containers/CartSummaryList.js');
    const { Coupons } = await import('@dropins/storefront-cart/containers/Coupons.js');
    const { EstimateShipping } = await import('@dropins/storefront-checkout/containers/EstimateShipping.js');
    const { render: CartProvider } = await import('@dropins/storefront-cart/render.js');
    const { render: CheckoutProvider } = await import('@dropins/storefront-checkout/render.js');

    // Render OrderSummary with slots
    const orderSummary = await CartProvider.render(OrderSummary, {
      className: 'checkout-order-summary',
      slots: {
        EstimateShipping: (esCtx) => {
          const estimateShippingForm = document.createElement('div');
          estimateShippingForm.classList.add('checkout-estimate-shipping');
          CheckoutProvider.render(EstimateShipping)(estimateShippingForm);
          esCtx.appendChild(estimateShippingForm);
        },
        Coupons: (ctx) => {
          const coupons = document.createElement('div');
          coupons.classList.add('checkout-coupons');
          CartProvider.render(Coupons)(coupons);
          ctx.appendChild(coupons);
        },
      },
    })($orderSummary);

    // Render CartSummaryList with heading
    const cartSummary = await CartProvider.render(CartSummaryList, {
      className: 'checkout-cart-summary-list',
      variant: 'secondary',
      slots: {
        Heading: (headingCtx) => {
          const title = 'Your Cart ({count})';
          const cartSummaryListHeading = document.createElement('div');
          cartSummaryListHeading.classList.add('cart-summary-list__heading');

          const cartSummaryListHeadingText = document.createElement('div');
          cartSummaryListHeadingText.classList.add('cart-summary-list__heading-text');
          cartSummaryListHeadingText.innerText = title.replace(
            '({count})',
            headingCtx.count ? `(${headingCtx.count})` : '',
          );

          const editCartLink = document.createElement('a');
          editCartLink.classList.add('cart-summary-list__edit');
          editCartLink.href = '/cart';
          editCartLink.rel = 'noreferrer';
          editCartLink.innerText = 'Edit';

          cartSummaryListHeading.appendChild(cartSummaryListHeadingText);
          cartSummaryListHeading.appendChild(editCartLink);
          headingCtx.appendChild(cartSummaryListHeading);

          headingCtx.onChange((nextHeadingCtx) => {
            cartSummaryListHeadingText.innerText = title.replace(
              '({count})',
              nextHeadingCtx.count ? `(${nextHeadingCtx.count})` : '',
            );
          });
        },
      },
    })($cartSummary);

    return { orderSummary, cartSummary };
  };

  return {
    displayOverlaySpinner,
    removeOverlaySpinner,
    showModal,
    removeModal,
    displayEmptyCart,
    removeEmptyCart,
    displayGuestAddressForms,
    displayCustomerAddressForms,
    displayLoginForm,
    displayBillToShipping,
    displayShippingMethods,
    displayPaymentMethods,
    displayPlaceOrder,
    displayOrderConfirmation,
    displayOrderSummary,
  };
}; 