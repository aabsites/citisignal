/**
 * loads and decorates the hero
 * @param {Element} block The hero block element
 */

export default async function decorate(block) {
  const [_, contentOne, contentTwo] = block.children;

  contentOne?.classList.add('overlay');
  contentTwo?.classList.add('overlay');
}
