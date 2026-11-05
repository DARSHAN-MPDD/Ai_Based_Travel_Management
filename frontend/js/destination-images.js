/**
 * TravelMind AI - Shared destination image mapping.
 *
 * Single source of truth for the destination-to-photo assignments used across
 * the entire site. The mapping is keyed by the destination's normalized name
 * (lowercase, non-alphanumeric chars removed) so it works regardless of the
 * database ID order, which intentionally differs from the image number order.
 *
 * Image layout per destination (4 photos in /images/<n>.<idx>.jpg):
 *   idx 1 -> primary card/thumbnail image
 *   idx 2,3,4 -> gallery / detail page extras
 *
 * Fallbacks: if a destination has no mapping or a specific image fails to
 * load, a stable Unsplash stock photo is used so pages never break.
 */

(function (global) {
  'use strict';

  // Canonical destination name -> image number (1..12).
  const DEST_IMAGE_NUM = {
    coorg: 1,
    chikmagalur: 2,
    mysuru: 3,
    mysore: 3,
    gokarna: 4,
    wayanad: 5,
    munnar: 6,
    ooty: 7,
    alleppey: 8,
    goa: 9,
    jaipur: 10,
    udaipur: 11,
    manali: 12
  };

  // Stable fallback images used when a destination has no local mapping.
  const FALLBACK_PRIMARY =
    'https://images.unsplash.com/photo-1526525108745-5f7e7a9c1f7e?w=800&q=80';
  const FALLBACK_GALLERY = [
    'https://images.pexels.com/photos/3267664/pexels-photo-3267664.jpeg?w=800',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80'
  ];

  function normalize(name) {
    return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function imageNumber(name) {
    return DEST_IMAGE_NUM[normalize(name)] || null;
  }

  // Returns the full array of 4 image URLs for a destination (or fallbacks).
  function getImageChain(name) {
    const n = imageNumber(name);
    if (!n) {
      return [FALLBACK_PRIMARY].concat(FALLBACK_GALLERY);
    }
    return [
      '/images/' + n + '.1.jpg',
      '/images/' + n + '.2.jpg',
      '/images/' + n + '.3.jpg',
      '/images/' + n + '.4.jpg'
    ];
  }

  // Primary card/thumbnail image (idx 1).
  function getPrimaryImage(name) {
    return getImageChain(name)[0];
  }

  // Gallery/detail extras (idx 2,3,4).
  function getGalleryImages(name) {
    return getImageChain(name).slice(1, 4);
  }

  // Build a safe <img> tag with a working onerror fallback chain.
  // `primary` may be omitted to use the destination's local primary image.
  function imgTag(src, alt, options) {
    options = options || {};
    alt = alt == null ? '' : alt;
    const chain = getImageChain(options.destinationName || '');
    const fallbacks = chain.filter(function (u) { return u !== src; });
    const firstFallback = fallbacks[0] || FALLBACK_PRIMARY;
    const secondFallback = fallbacks[1] || FALLBACK_PRIMARY;

    let html = '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt) + '"';
    if (options.className) html += ' class="' + escapeHtml(options.className) + '"';
    if (options.style) html += ' style="' + escapeHtml(options.style) + '"';
    if (options.loading) html += ' loading="' + escapeHtml(options.loading) + '"';
    html += ' onerror="this.onerror=null;this.src=\'' + escapeAttr(firstFallback) + '\';this.onerror=function(){this.src=\'' + escapeAttr(secondFallback) + '\';}">';
    html += '>';
    return html;
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/'/g, '&#39;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  const API = {
    normalize: normalize,
    imageNumber: imageNumber,
    getImageChain: getImageChain,
    getPrimaryImage: getPrimaryImage,
    getGalleryImages: getGalleryImages,
    imgTag: imgTag,
    DEST_IMAGE_NUM: DEST_IMAGE_NUM,
    FALLBACK_PRIMARY: FALLBACK_PRIMARY
  };

  global.DestinationImages = API;
  // Backwards-compatible alias used by the Packages page helpers.
  global.DestinationImagesCompat = API;

})(typeof window !== 'undefined' ? window : this);