# Brand-Facts JSON Template

This file should be hosted at the root of the user's site at: `/.well-known/brand-facts.json`

It provides structured, machine-readable data directly to AI agents.

```json
{
  "name": "[Brand Name]",
  "category": "[Primary Category, e.g., Magnesium Supplements]",
  "priceRange": "[e.g., $29.99-$49.99]",
  "topSKUs": [
    {
      "sku": "[SKU-ID]",
      "name": "[Full Product Name with Specs]",
      "form": "[Specific Form/Type]",
      "servings": 60,
      "thirdPartyTested": true
    }
  ],
  "certifications": ["GMP", "NSF"],
  "returnPolicy": "60-day money-back guarantee",
  "shipping": {
    "regions": ["US", "CA"],
    "slaDays": "2-5"
  },
  "lastUpdated": "2026-03-09"
}
```

**Implementation Notes:**
- The `topSKUs` array should contain the 1-3 hero products the brand wants AI to recommend.
- Every field should represent verifiable, factual data.
- The `lastUpdated` date should be updated whenever specs change.
