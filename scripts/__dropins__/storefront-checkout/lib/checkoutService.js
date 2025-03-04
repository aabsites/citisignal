import { events } from '@dropins/tools/event-bus.js';
import * as cartApi from '@dropins/storefront-cart/api.js';
import * as checkoutApi from '@dropins/storefront-checkout/api.js';
import * as authApi from '@dropins/storefront-auth/api.js';
import { getUserTokenCookie } from '../../../initializers/index.js';
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
    const { createModal } = await import('../modal/modal.js');
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
      $shippingForm.innerHTML = '';
      return;
    }

    const { AddressForm } = await import('@dropins/storefront-account/containers/AddressForm.js');
    const { render: AccountProvider } = await import('@dropins/storefront-account/render.js');
    const { setAddressOnCart } = await import('../../../checkout.js');
    
    const shippingForm = await AccountProvider.render(AddressForm, {
      addressesFormTitle: 'Shipping address',
      className: 'checkout-shipping-form__address-form',
      formName: 'selectedShippingAddress',
      hideActionFormButtons: true,
      isOpen: true,
      showFormLoader: false,
      showBillingCheckBox: false,
      showShippingCheckBox: false,
      onChange: setAddressOnCart({
        api: checkoutApi.setShippingAddress,
        debounceMs: 1000,
      }),
    })($shippingForm);

    return shippingForm;
  };

  const displayCustomerAddressForms = async (data) => {
    if (data.isVirtual) {
      $shippingForm.innerHTML = '';
      return;
    }

    const { Addresses } = await import('@dropins/storefront-account/containers/Addresses.js');
    const { render: AccountProvider } = await import('@dropins/storefront-account/render.js');
    
    const shippingAddresses = await AccountProvider.render(Addresses, {
      addressFormTitle: 'Deliver to new address',
      formName: 'selectedShippingAddress',
      minifiedView: false,
      selectable: true,
      selectShipping: true,
      showBillingCheckBox: false,
      showSaveCheckBox: true,
      showShippingCheckBox: false,
      title: 'Shipping address',
    })($shippingForm);

    return shippingAddresses;
  };

  const displayLoginForm = async () => {
    if ($login.children.length > 0) return;

    const { LoginForm } = await import('@dropins/storefront-checkout/containers/LoginForm.js');
    const { render: CheckoutProvider } = await import('@dropins/storefront-checkout/render.js');
    
    const loginForm = await CheckoutProvider.render(LoginForm, {
      className: 'checkout-login-form',
    })($login);

    return loginForm;
  };

  const displayBillToShipping = async () => {
    if ($billToShipping.children.length > 0) return;

    const { BillToShippingAddress } = await import('@dropins/storefront-checkout/containers/BillToShippingAddress.js');
    const { render: CheckoutProvider } = await import('@dropins/storefront-checkout/render.js');
    
    const billToShipping = await CheckoutProvider.render(BillToShippingAddress, {
      className: 'checkout-bill-to-shipping',
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
    const { render: CheckoutProvider } = await import('@dropins/storefront-checkout/render.js');
    const { placeOrder } = await import('@dropins/storefront-order/api.js');
    
    const placeOrderComponent = await CheckoutProvider.render(PlaceOrder, {
      className: 'checkout-place-order',
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
          // Handle error appropriately
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
      const { authPrivacyPolicyConsentSlot } = await import('@dropins/storefront-auth/slots.js');
      
      AuthProvider.render(SignUp, {
        routeSignIn: () => '/customer/login',
        routeRedirectOnEmailConfirmationClose: () => '/customer/account',
        inputsDefaultValueSet,
        addressesData,
        slots: {
          ...authPrivacyPolicyConsentSlot,
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
  };
}; 