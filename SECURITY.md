# Security

Please report vulnerabilities privately through GitHub's "Report a vulnerability" button on the Security tab of this repository, not in a public issue. You will get a reply within a few days.

## What Colorshot guarantees

Colorshot only reads and emits plain CSS colors and gradients. Values with anything else in them (markup, quotes, semicolons, braces, `url()`, `image-set()` and other non-color functions, or text over 4 KB) are treated as unreadable: they are never echoed back through `onChange`, never stored as recent colors and never written into a `style`.

If your app stores picker values and writes them into HTML or CSS, check them again on your side, since stored data may not have come from the picker. `isSafeCssValue(value)` from `@orshot/colorshot` is the same check the picker uses.
