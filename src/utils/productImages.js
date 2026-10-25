// Pure helpers for the product image gallery (product_images rows).

const byOrder = (a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0);

// Gallery rows sorted by sort_order, without rows that have no image.
export function sortGallery(images) {
  return (Array.isArray(images) ? images : []).filter((img) => img && img.image_url).slice().sort(byOrder);
}

// Thumbnails for the product modal: front, back, gallery…, then each variant's images.
export function buildProductThumbs(product, gallery, variants) {
  const thumbs = [
    product?.image_front_url && { url: product.image_front_url, label: 'หน้า' },
    product?.image_back_url && { url: product.image_back_url, label: 'หลัง' },
    ...sortGallery(gallery).map((img, i) => ({ url: img.image_url, label: `รูปที่ ${i + 1}` })),
    ...(Array.isArray(variants) ? variants : []).flatMap((v) =>
      (v.images || []).map((img, i) => ({ url: img.image_url, label: i === 0 ? v.name : `${v.name} ${i + 1}` }))
    )
  ];
  return thumbs.filter((th) => th && th.url);
}

// Move the item at `index` by `delta` (-1 up, +1 down) and renumber sort_order 0..n-1.
// Returns a new array; out-of-range moves return the list renumbered but unchanged in order.
export function moveImage(images, index, delta) {
  const list = sortGallery(images);
  const target = index + delta;
  if (index >= 0 && index < list.length && target >= 0 && target < list.length) {
    [list[index], list[target]] = [list[target], list[index]];
  }
  return list.map((img, i) => ({ ...img, sort_order: i }));
}

// Next sort_order to append after the existing rows.
export function nextSortOrder(images) {
  const list = Array.isArray(images) ? images : [];
  return list.reduce((max, img) => Math.max(max, (Number(img?.sort_order) || 0) + 1), 0);
}
