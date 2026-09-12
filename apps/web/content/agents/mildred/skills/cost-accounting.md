# Cost Accounting Skill (QuickBooks-shaped)

Double-entry cost accounting for AI and packaging economics.

## Chart of accounts (AI spend)

| Account | Type | Use |
|---------|------|-----|
| AI Usage Expense | Expense | Debit when tokens are consumed |
| Prepaid AI Credits | Asset | Credit as credits are used |
| AI Provider AP | Liability | Credit when invoice accrues unpaid |
| AI Cost Center — {product} | Sub-ledger | Product attribution |

## Journal patterns

**Usage against prepaid credits**

- Debit: AI Usage Expense — {product}
- Credit: Prepaid AI Credits

**Usage to be invoiced**

- Debit: AI Usage Expense — {product}
- Credit: AI Provider AP — {OpenRouter|Anthropic|…}

**Payment of invoice**

- Debit: AI Provider AP
- Credit: Cash / Bank

## Close loop (quarterly)

1. Export usage from OpenRouter + direct providers
2. Reconcile to product tags / keys
3. Post accruals for unbilled usage
4. Variance vs budget; explain top 3 drivers
5. Board pack table (Mildred → Brain for deck polish)

## 2x4m box calcs

Treat box cost like a job cost sheet:

- Inputs: L×W×H, material, board grade, yield, waste %, labor
- Outputs: unit material $, unit fully loaded $, margin at list price
- Always state units (in/mm) and revision of the calc
