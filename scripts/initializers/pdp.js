/* eslint-disable import/prefer-default-export */
/* eslint import/no-cycle: [2, { maxDepth: 1 }] */

import { initializers } from '@dropins/tools/initializer.js';
import { Image, provider as UI } from '@dropins/tools/components.js';
import {
  initialize,
  setEndpoint,
  setFetchGraphQlHeaders,
  fetchProductData,
} from '@dropins/storefront-pdp/api.js';
import {
  commerceEndpointWithQueryParams,
  getOptionsUIDsFromUrl,
  getSkuFromUrl,
  loadErrorPage,
} from '../commerce.js';
import { getHeaders } from '../configs.js';
import { fetchPlaceholders, readBlockConfig } from '../aem.js';
import { initializeDropin } from './index.js';

export const IMAGES_SIZES = {
  width: 960,
  height: 1191,
};

await initializeDropin(async () => {
  setEndpoint(await commerceEndpointWithQueryParams());

  // Set Fetch Headers (Service)
  setFetchGraphQlHeaders({
    ...(await getHeaders('cs')),
    'Content-Type': 'application/json',
  });

  let sku = await getSkuFromUrl();
  const optionsUIDs = getOptionsUIDsFromUrl();
  const placeholders = await fetchPlaceholders();

  if (!sku) {
    const block = document.querySelector('.product-details');
    if (block) {
      sku = readBlockConfig(block).sku;
    }
  }

  const [product, labels] = await Promise.all([
    fetchProductData(sku, { optionsUIDs, skipTransform: true }).then(preloadImageMiddleware),
    placeholders,
  ]);

  if (!product?.sku) {
    return loadErrorPage();
  }

  const langDefinitions = {
    default: {
      ...labels,
    },
  };

  const models = {
    ProductDetails: {
      initialData: { ...product },
    },
  };

  // Initialize Dropins
  return initializers.mountImmediately(initialize, {
    sku,
    optionsUIDs,
    langDefinitions,
    models,
    acdl: true,
    persistURLParams: true,
  });
})();

async function preloadImageMiddleware(data) {
  const image = data?.images?.[0]?.url?.replace(/^https?:/, '');

  if (image) {
    await UI.render(Image, {
      src: image,
      ...IMAGES_SIZES.mobile,
      params: {
        ...IMAGES_SIZES,
      },
      loading: 'eager',
    })(document.createElement('div'));
  }
  return data;
}
