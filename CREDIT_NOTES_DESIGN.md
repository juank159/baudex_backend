# Credit Notes - Design & Implementation Plan

## Research Summary

### International Standards & Best Practices

Based on research from industry standards and accounting best practices for 2025:

**Sources:**
- [The quick and easy guide to credit note for 2025](https://www.zenskar.com/blog/credit-note)
- [Credit Memo in Accounting - Meaning, Examples & Best Practices](https://www.iwoca.co.uk/trade-credit/credit-memo)
- [Understanding Credit Notes: A Guide to Simplifying Business Transactions](https://aspireapp.com/blog/what-is-a-credit-note)
- [Credit Note - Meaning, Example, What Is It In Accounting?](https://www.wallstreetmojo.com/credit-note/)
- [Credit note | E-Invoice Vendor Interface | Google for Developers](https://developers.google.com/invoice-vendor-interface/schema/invoice-request/credit-note-schema)
- [Database design for invoices, invoice lines & revisions - Stack Overflow](https://stackoverflow.com/questions/2679333/database-design-for-invoices-invoice-lines-revisions)
- [Credit Notes - Chargebee Docs](https://www.chargebee.com/docs/billing/2.0/invoices-credit-notes-and-quotes/credit-notes)
- [Credit Note: Meaning, Types, & How Does It Work?](https://razorpay.com/blog/what-is-credit-note/)

### Key Findings

#### 1. Definition
- **Credit Note (UK/EU/Asia)** / **Credit Memo (US)**: A document issued by a seller to a customer to notify them of a credit applied to their account
- Used to reverse all or part of an invoice amount
- Must reference the original invoice

#### 2. Fundamental Business Rules
- **Immutability**: Once an invoice is sent/posted, it CANNOT be altered
- **Reversal Mechanism**: Changes require issuing a credit note + new invoice if needed
- **Audit Trail**: Keep original invoice + credit note together for complete audit trail

#### 3. Types of Credit Notes

| Type | Description | Use Case |
|------|-------------|----------|
| **Full Credit Note** | Reverses entire invoice amount | Complete order cancellation, full return |
| **Partial Credit Note** | Reverses part of invoice amount | Partial return, price adjustment, discount |

#### 4. Common Reasons for Issuing

1. **Returned Goods**: Customer returns products (damaged, defective, dissatisfaction)
2. **Overcharges/Billing Errors**: Incorrect pricing, calculation errors
3. **Price Adjustments**: Negotiated discounts, loyalty programs, market changes
4. **Cancellations**: Order cancelled before delivery
5. **Damaged Goods**: Items damaged in transit or storage
6. **Inventory Adjustments**: Stock corrections requiring customer reimbursement

#### 5. Accounting Treatment (Double-Entry)

When issuing credit note:
```
DEBIT:  Sales Returns / Revenue Account
CREDIT: Accounts Receivable
```

#### 6. Required Fields (Based on UBL 2.4 Schema)

**Core Fields:**
- Credit Note Number (unique identifier)
- Issue Date
- Reference to Original Invoice (invoice_id, invoice_number)
- Customer Information
- Line Items (products/services being credited)
- Amounts (subtotal, tax, total)
- Reason for Credit
- Status

**Best Practices:**
- Every credit note should include a unique reference number
- Must clearly state reason for credit
- Should be linked to original invoice in database

---

## Database Schema Design

### Entity: `CreditNote`

```typescript
@Entity('credit_notes')
@Index('IDX_credit_notes_organization_number_unique', ['organizationId', 'number'], { unique: true })
@Index('IDX_credit_notes_invoice', ['invoiceId'])
@Index('IDX_credit_notes_customer', ['customerId'])
@Index('IDX_credit_notes_date', ['date'])
@Index('IDX_credit_notes_status', ['status'])
export class CreditNote extends BaseEntity {
  @Column({ type: 'varchar', length: 50 })
  number: string; // CN-001, CN-002, etc.

  @Column({ type: 'timestamp' })
  date: Date;

  // ========== REFERENCES ==========

  @Column({ type: 'uuid' })
  @Index()
  invoiceId: string; // Original invoice being credited

  @ManyToOne(() => Invoice, { nullable: false })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ type: 'uuid' })
  customerId: string;

  @ManyToOne(() => Customer, { nullable: false })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { nullable: false })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  // ========== TYPE & REASON ==========

  @Column({
    type: 'enum',
    enum: CreditNoteType,
    default: CreditNoteType.PARTIAL,
  })
  type: CreditNoteType; // FULL or PARTIAL

  @Column({
    type: 'enum',
    enum: CreditNoteReason,
  })
  reason: CreditNoteReason; // Why credit note was issued

  @Column({ type: 'text', nullable: true })
  reasonDescription: string; // Additional details

  // ========== LINE ITEMS ==========

  @OneToMany(() => CreditNoteItem, (item) => item.creditNote, {
    cascade: true,
  })
  items: CreditNoteItem[];

  // ========== AMOUNTS ==========

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 19 })
  taxPercentage: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  // ========== STATUS ==========

  @Column({
    type: 'enum',
    enum: CreditNoteStatus,
    default: CreditNoteStatus.DRAFT,
  })
  status: CreditNoteStatus;

  @Column({ type: 'timestamp', nullable: true })
  appliedAt: Date; // When credit was applied to customer balance

  // ========== INVENTORY IMPACT ==========

  @Column({ type: 'boolean', default: false })
  restoreInventory: boolean; // Should returned items be added back to inventory?

  @Column({ type: 'boolean', default: false })
  inventoryRestored: boolean; // Has inventory been restored?

  // ========== NOTES & METADATA ==========

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;
}
```

### Entity: `CreditNoteItem`

```typescript
@Entity('credit_note_items')
export class CreditNoteItem extends BaseEntity {
  @Column({ type: 'uuid' })
  creditNoteId: string;

  @ManyToOne(() => CreditNote, (cn) => cn.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'credit_note_id' })
  creditNote: CreditNote;

  // Reference to original invoice item (optional but recommended)
  @Column({ type: 'uuid', nullable: true })
  invoiceItemId: string;

  @ManyToOne(() => InvoiceItem, { nullable: true })
  @JoinColumn({ name: 'invoice_item_id' })
  invoiceItem: InvoiceItem;

  // Product reference (if applicable)
  @Column({ type: 'uuid', nullable: true })
  productId: string;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit: string;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
```

### Enums

```typescript
export enum CreditNoteType {
  FULL = 'full',       // Complete reversal of invoice
  PARTIAL = 'partial', // Partial reversal
}

export enum CreditNoteReason {
  RETURNED_GOODS = 'returned_goods',
  DAMAGED_GOODS = 'damaged_goods',
  BILLING_ERROR = 'billing_error',
  PRICE_ADJUSTMENT = 'price_adjustment',
  ORDER_CANCELLATION = 'order_cancellation',
  CUSTOMER_DISSATISFACTION = 'customer_dissatisfaction',
  INVENTORY_ADJUSTMENT = 'inventory_adjustment',
  OTHER = 'other',
}

export enum CreditNoteStatus {
  DRAFT = 'draft',       // Created but not yet confirmed
  CONFIRMED = 'confirmed', // Confirmed and applied to customer balance
  CANCELLED = 'cancelled', // Cancelled (shouldn't happen often)
}
```

---

## Business Logic & Service Methods

### CreditNoteService

```typescript
class CreditNoteService {

  /**
   * Create a credit note from an invoice
   *
   * @param invoiceId - ID of invoice to credit
   * @param type - FULL or PARTIAL
   * @param reason - Why credit note is being issued
   * @param items - Array of items to credit (for partial credit notes)
   * @param restoreInventory - Should inventory be restored?
   * @param notes - Additional notes
   */
  async createCreditNote({
    invoiceId,
    type,
    reason,
    reasonDescription,
    items, // Optional for FULL credit notes
    restoreInventory = true,
    notes,
  }): Promise<CreditNote>

  /**
   * Confirm a credit note (apply credit to customer)
   *
   * - Updates customer balance
   * - Restores inventory if requested
   * - Marks credit note as CONFIRMED
   * - Creates accounting entries
   */
  async confirmCreditNote(creditNoteId: string): Promise<CreditNote>

  /**
   * Get credit notes by invoice
   */
  async getCreditNotesByInvoice(invoiceId: string): Promise<CreditNote[]>

  /**
   * Get credit notes by customer
   */
  async getCreditNotesByCustomer(customerId: string): Promise<CreditNote[]>

  /**
   * Calculate remaining creditable amount for invoice
   * (Original invoice total - sum of all confirmed credit notes)
   */
  async getRemainingCreditableAmount(invoiceId: string): Promise<number>

  /**
   * Generate PDF for credit note
   */
  async generateCreditNotePdf(creditNoteId: string): Promise<Buffer>
}
```

---

## Key Implementation Rules

### 1. Validation Rules

- ✅ Can only create credit note for invoices with status `PAID`, `PARTIALLY_PAID`, or `PENDING`
- ✅ Cannot credit more than remaining creditable amount
- ✅ For FULL credit note: credit entire invoice amount
- ✅ For PARTIAL credit note: must specify items and quantities
- ✅ Credit note items must reference valid invoice items
- ✅ Quantity in credit note item cannot exceed quantity in original invoice item

### 2. Status Transitions

```
DRAFT → CONFIRMED → (CANCELLED - rare)
```

- `DRAFT`: Created but not yet applied
- `CONFIRMED`: Applied to customer balance and inventory restored (if applicable)
- `CANCELLED`: Should rarely happen, but available for corrections

### 3. Customer Balance Impact

When credit note is CONFIRMED:
```typescript
customer.balance -= creditNote.total; // Reduce amount customer owes
```

### 4. Inventory Impact

If `restoreInventory = true`:
- For each item in credit note:
  - Call `inventoryService.registerSaleReturn()`
  - Creates new inventory batch with returned products
  - Uses FIFO for inventory tracking

### 5. Accounting Entries

When credit note is CONFIRMED, create journal entries:
```
DEBIT:  Sales Returns ($total)
CREDIT: Accounts Receivable ($total)
```

### 6. Invoice Relationship

- Invoice entity should have relation: `@OneToMany(() => CreditNote, cn => cn.invoice)`
- Invoice should expose computed property: `totalCredited` (sum of all confirmed credit notes)
- Invoice should expose computed property: `remainingCreditableAmount` (total - totalCredited)

---

## API Endpoints

### REST Endpoints

```typescript
// Create credit note
POST /credit-notes
Body: {
  invoiceId: string,
  type: 'full' | 'partial',
  reason: CreditNoteReason,
  reasonDescription?: string,
  items?: CreditNoteItemInput[], // Required for partial
  restoreInventory: boolean,
  notes?: string
}

// Confirm credit note (apply to customer)
POST /credit-notes/:id/confirm

// Get credit note by ID
GET /credit-notes/:id

// Get all credit notes (with filters)
GET /credit-notes?
  page=1&
  limit=10&
  customerId=uuid&
  invoiceId=uuid&
  status=confirmed&
  startDate=2025-01-01&
  endDate=2025-12-31

// Get credit notes by invoice
GET /invoices/:id/credit-notes

// Download PDF
GET /credit-notes/:id/pdf

// Cancel credit note (only if DRAFT)
POST /credit-notes/:id/cancel

// Update credit note (only if DRAFT)
PATCH /credit-notes/:id
Body: {
  reason?: CreditNoteReason,
  reasonDescription?: string,
  notes?: string
}

// Delete credit note (only if DRAFT)
DELETE /credit-notes/:id
```

---

## Frontend Implementation

### Domain Layer (Clean Architecture)

```dart
// Entity
class CreditNote {
  final String id;
  final String number;
  final DateTime date;
  final String invoiceId;
  final String invoiceNumber;
  final String customerId;
  final String customerName;
  final CreditNoteType type;
  final CreditNoteReason reason;
  final String? reasonDescription;
  final List<CreditNoteItem> items;
  final double subtotal;
  final double taxPercentage;
  final double taxAmount;
  final double total;
  final CreditNoteStatus status;
  final DateTime? appliedAt;
  final bool restoreInventory;
  final bool inventoryRestored;
  final String? notes;
  final DateTime createdAt;
}

// Repository
abstract class CreditNoteRepository {
  Future<Either<Failure, CreditNote>> createCreditNote({...});
  Future<Either<Failure, CreditNote>> confirmCreditNote(String id);
  Future<Either<Failure, CreditNote>> getCreditNoteById(String id);
  Future<Either<Failure, List<CreditNote>>> getCreditNotesByInvoice(String invoiceId);
  Future<Either<Failure, PaginatedResult<CreditNote>>> getCreditNotes({...});
  Future<Either<Failure, List<int>>> downloadCreditNotePdf(String id);
}

// Use Cases
class CreateCreditNoteUseCase { ... }
class ConfirmCreditNoteUseCase { ... }
class GetCreditNoteByIdUseCase { ... }
class GetCreditNotesByInvoiceUseCase { ... }
```

### UI Screens

1. **Credit Note List Screen**: View all credit notes with filters
2. **Credit Note Detail Screen**: View single credit note with PDF export
3. **Create Credit Note Form**: Select invoice, reason, items (for partial)
4. **Credit Notes Tab in Invoice Detail**: Show all credit notes for an invoice

---

## Migration Plan

### Phase 1: Database Setup
1. Create `credit_notes` table with all fields and indexes
2. Create `credit_note_items` table
3. Add relation from `invoices` to `credit_notes`
4. Run migration

### Phase 2: Backend Implementation
1. Create entities (`CreditNote`, `CreditNoteItem`)
2. Create DTOs (CreateCreditNoteDto, UpdateCreditNoteDto, etc.)
3. Create service with all business logic
4. Create controller with REST endpoints
5. Create PDF generation service for credit notes
6. Add unit tests

### Phase 3: Frontend Implementation
1. Create domain layer (entities, repositories, use cases)
2. Create data layer (models, datasources, repository implementation)
3. Create presentation layer (controllers, screens, widgets)
4. Add credit note UI to invoice detail screen

### Phase 4: Testing & Validation
1. Test credit note creation (full and partial)
2. Test inventory restoration
3. Test customer balance updates
4. Test PDF generation
5. Test multitenancy isolation

---

## Security Considerations

- ✅ Always filter by `organizationId` (multitenancy)
- ✅ Only allow creating credit notes for own organization's invoices
- ✅ Validate user permissions (roles: ADMIN, MANAGER can create credit notes)
- ✅ Audit trail: track who created, who confirmed credit notes
- ✅ Prevent SQL injection with parameterized queries
- ✅ Validate all amounts and quantities

---

## Performance Considerations

- ✅ Index on `(organizationId, number)` for fast lookups
- ✅ Index on `invoiceId` for invoice-to-credit-note queries
- ✅ Index on `customerId` for customer credit note history
- ✅ Index on `date` and `status` for filtering
- ✅ Use lazy loading for items relation (don't eager load)
- ✅ Cache PDF generation results

---

## Future Enhancements (Phase 2)

1. **Bulk Credit Notes**: Create multiple credit notes at once
2. **Credit Note Templates**: Pre-defined reasons and amounts
3. **Automatic Credit Notes**: Auto-create for returns processed through RMA system
4. **Credit Note Approval Workflow**: Require manager approval for large amounts
5. **Credit Note Alerts**: Notify customers via email when credit note is issued
6. **Analytics**: Dashboard showing credit note trends, top reasons, etc.
7. **Integration with Accounting Software**: Export to QuickBooks, Xero, etc.

---

## Conclusion

This design follows international accounting standards and best practices for 2025, ensuring:
- ✅ Immutable invoices with proper reversal mechanism
- ✅ Complete audit trail
- ✅ Proper inventory and customer balance management
- ✅ Clean Architecture for maintainability
- ✅ Multitenancy data isolation
- ✅ Professional PDF generation

The implementation prioritizes data integrity, compliance with accounting standards, and user experience.
