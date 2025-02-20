import { readBlockConfig } from '../../scripts/aem.js';
import { fetchIndex } from '../../scripts/scripts.js';
import { getSkuFromUrl } from '../../scripts/commerce.js';
import { loadFragment } from '../fragment/fragment.js';
import { getAemAuthorEnv } from '../../scripts/configs.js';

export default async function decorate(block) {
  const { type, position } = readBlockConfig(block);
  const isAemAuthor = getAemAuthorEnv();

  try {
    const filters = {};
    if (type === 'product') {
      const productSku = await getSkuFromUrl();
      if (!productSku) {
        throw new Error('No product SKU found in URL');
      }
      filters.products = productSku;
    }

    if (type === 'category') {
      const plpBlock = document.querySelector('.block.product-list-page');
      if (!plpBlock) {
        throw new Error('No product list page block found');
      }

      let categoryId = plpBlock.dataset?.category;
      if (!categoryId) {
        categoryId = readBlockConfig(plpBlock).category;
      }
      if (!categoryId) {
        throw new Error('No category ID found in product list page block');
      }
      filters.categories = categoryId;
    }

    if (position) {
      filters.positions = position;
    }

    const index = await fetchIndex('enrichment/enrichment');
    if (!isAemAuthor) {
      const matchingFragments = index.data
        .filter((fragment) => Object.keys(filters).every((filterKey) => {
          const values = JSON.parse(fragment[filterKey]);
          return values.includes(filters[filterKey]);
        }))
        .map((fragment) => fragment.path);

      (await Promise.all(matchingFragments.map((path) => loadFragment(path))))
        .filter((fragment) => fragment)
        .forEach((fragment) => {
          const sections = fragment.querySelectorAll(':scope .section');

          // If only single section, replace block with content of section
          if (sections.length === 1) {
            block.closest('.section').classList.add(...sections[0].classList);
            const wrapper = block.closest('.enrichment-wrapper');
            Array.from(sections[0].children)
              .forEach((child) => wrapper.parentNode.insertBefore(child, wrapper));
          } else if (sections.length > 1) {
          // If multiple sections, insert them after section of block
            const blockSection = block.closest('.section');
            Array.from(sections)
              .reverse()
              .forEach((section) => blockSection
                .parentNode.insertBefore(section, blockSection.nextSibling));
          }
        });
    }
  } catch (error) {
    console.error(error);
  } finally {
    if (!isAemAuthor) {
      block.closest('.enrichment-wrapper')?.remove();
    }
  }
}
