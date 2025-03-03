import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

export default function decorate(block) {
  const wrapTeaserWithLink = block.classList.contains('teaser-link-true');
  const link = block.querySelector('a');

  [...block.children].forEach((row) => {
    setupImageTeaser(row);

    if (wrapTeaserWithLink && link) {
      wrapRowWithLink(row, link.href);
      link.remove();
    } else {
      row.classList.add('wrapper');
    }

    row.querySelectorAll('picture > img').forEach((img) => {
      const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '375' }]);
      moveInstrumentation(img, optimizedPic.querySelector('img'));
      img.closest('picture').replaceWith(optimizedPic);
    });
  });
}

function setupImageTeaser(row) {
  const pic = row.querySelector('picture');
  if (pic) {
    const picWrapper = pic.parentElement;
    if (picWrapper && picWrapper.children.length === 1) {
      picWrapper.classList.add('teaser-img-col');
    }
  }
}

function wrapRowWithLink(row, href) {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.classList.add('link-wrapper');

  while (row.firstChild) {
    anchor.appendChild(row.firstChild);
  }
  row.replaceWith(anchor);
}
