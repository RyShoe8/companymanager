# Referral & Catalog Behavior

## Referral code validation (Section 5)

- **Invalid or unknown codes:** Silently ignore and proceed with registration, or show a non-blocking warning. No blocking validation.
- Do not prevent signup or block the user when the referral code is missing or invalid.

## Categories / product types

- **Default enum:** engineering, marketing, sales, operations (for UI presets and filters).
- **Admin-defined custom:** Use PartnerCatalog `productTypes` (and any org-level config) for custom categories. Soft validation: allow values not in the default enum when they come from admin-defined list.
- Catalog (PartnerCatalog) shares this product-type taxonomy with the referral system; keep them in sync where both reference "product type".
