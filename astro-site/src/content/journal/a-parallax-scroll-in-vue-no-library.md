---
title: A parallax scroll in Vue, no library
description: IntersectionObserver, CSS variables and a lot of restraint.
date: 2026-08-29
tags: [Code, Vue]
---

Most parallax code is a scroll listener doing too much. Mine is an `IntersectionObserver` that tells a section when it is on screen, and a CSS variable that moves things.

## The trick

Write the scroll progress to a custom property and let CSS do the maths. The browser handles the rest on the compositor, so the page stays smooth even with big photos.

```css title="parallax.css"
.layer {
  transform: translateY(calc(var(--progress) * var(--speed) * 1px));
}
```

The restraint matters more than the code. One layer moving a little reads as depth; three moving a lot reads as a mistake.
