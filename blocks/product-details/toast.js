/* eslint-disable import/no-unresolved */
/* eslint-disable import/no-extraneous-dependencies */

export default function initToast(quantity, productMetaDescription) {
  // Create the toast container if it doesn't exist
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  // Create the toast element
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div class="toast-wrapper">
      <span class="close-icon"><img src="/icons/close-x.svg" title="close"></span>
      <div class="toast-content">
        <img src="/icons/checkmark.svg" title="checkmark">
        <div>Success</div>
      </div>
      <p><strong>(${quantity}) ${productMetaDescription}</strong> was added to your cart</p>
    </div>
  `;

  // Append the toast to the container
  toastContainer.appendChild(toast);

  // Show the toast
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);

  // Hide the toast after 5 seconds
  const hideToast = () => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toastContainer.contains(toast)) {
        toastContainer.removeChild(toast);
      }
    }, 400); // Match this to the CSS transition duration
  };

  // Hide toast on close icon click
  const closeIcon = toast.querySelector('.close-icon');
  closeIcon.addEventListener('click', hideToast);

  // Automatically hide the toast after 5 seconds
  setTimeout(hideToast, 5000);
}
