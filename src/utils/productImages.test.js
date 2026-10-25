import { describe, it, expect } from 'vitest';
import { sortGallery, buildProductThumbs, moveImage, nextSortOrder } from './productImages';

const g = (id, sort_order, image_url = `${id}.jpg`) => ({ id, sort_order, image_url });

describe('productImages', () => {
  it('sorts gallery rows and drops empty ones', () => {
    expect(sortGallery([g('b', 2), g('a', 0), { id: 'x', sort_order: 1 }, null]).map((i) => i.id)).toEqual(['a', 'b']);
    expect(sortGallery(null)).toEqual([]);
  });

  it('orders thumbnails front, back, gallery, then variant images', () => {
    const product = { image_front_url: 'f.jpg', image_back_url: 'bk.jpg' };
    const variants = [{ name: 'ชาย', images: [{ image_url: 'v1.jpg' }, { image_url: 'v2.jpg' }] }];
    const thumbs = buildProductThumbs(product, [g('b', 1), g('a', 0)], variants);
    expect(thumbs.map((t) => t.url)).toEqual(['f.jpg', 'bk.jpg', 'a.jpg', 'b.jpg', 'v1.jpg', 'v2.jpg']);
    expect(thumbs.map((t) => t.label)).toEqual(['หน้า', 'หลัง', 'รูปที่ 1', 'รูปที่ 2', 'ชาย', 'ชาย 2']);
  });

  it('skips missing covers and tolerates missing gallery/variants', () => {
    expect(buildProductThumbs({ image_front_url: 'f.jpg' }, undefined, undefined)).toEqual([{ url: 'f.jpg', label: 'หน้า' }]);
    expect(buildProductThumbs({}, [g('a', 0)], [])).toEqual([{ url: 'a.jpg', label: 'รูปที่ 1' }]);
  });

  it('moves an image up/down and renumbers sort_order', () => {
    const list = [g('a', 0), g('b', 5), g('c', 9)];
    expect(moveImage(list, 1, -1).map((i) => [i.id, i.sort_order])).toEqual([['b', 0], ['a', 1], ['c', 2]]);
    expect(moveImage(list, 1, 1).map((i) => i.id)).toEqual(['a', 'c', 'b']);
    expect(moveImage(list, 0, -1).map((i) => [i.id, i.sort_order])).toEqual([['a', 0], ['b', 1], ['c', 2]]);
    expect(moveImage(list, 2, 1).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(list[1].sort_order).toBe(5); // input not mutated
  });

  it('computes the next sort order', () => {
    expect(nextSortOrder([])).toBe(0);
    expect(nextSortOrder([g('a', 0), g('b', 4)])).toBe(5);
  });
});
