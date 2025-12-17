# Supplier Reference Fix - Critical Bug Resolution

## Problem
Orders were being created without storing the `supplier_reference` (reference_id) returned by Code Craft Network API. This broke the entire automatic status polling system because:
- Code Craft returns a unique `reference_id` for each order (e.g., `AT-BULK-1765941930266-76`)
- Without this reference, the polling system cannot query Code Craft to check order status
- Users would see orders stuck in "PAID" or "PROCESSING" status even after successful delivery

## Evidence
- User order: `AT-BULK-1765941930266-76` was fulfilled by Code Craft ("Crediting successful")
- Polling logs showed: `⚠️ Order has no supplier reference, skipping`
- Orders never transitioned from PROCESSING → FULFILLED

## Root Cause
1. `storage.createAtOrder()` didn't accept `supplierReference` parameter
2. `storage.updateAtOrderStatus()` didn't handle `supplierReference` updates
3. Routes `/api/at/purchase` and `/api/telecel/purchase` didn't extract `reference_id` from Code Craft response
4. Same issues affected TELECEL orders

## Solution Implemented

### 1. Updated `server/storage.ts`
- **`createAtOrder()`**: Added optional `supplierReference?: string` parameter, saves to database
- **`updateAtOrderStatus()`**: Added optional `supplierReference?: string` parameter for updates
- **`createTelecelOrder()`**: Same changes as AT orders
- **`updateTelecelOrderStatus()`**: Same changes as AT order status updates

### 2. Updated `server/routes.ts`
- **`POST /api/at/purchase`**:
  - Extracts `reference_id` from Code Craft response: `fulfillmentResult.data?.reference_id`
  - Passes extracted reference when updating order status
  - Logs: `✅ AT Order {id} fulfilled with supplier reference: {ref}`
  
- **`POST /api/telecel/purchase`**:
  - Same extraction and saving logic as AT endpoint
  - Logs: `✅ TELECEL Order {id} fulfilled with supplier reference: {ref}`

## Data Flow (After Fix)
1. Customer creates order → `POST /api/at/purchase`
2. Order created with status=PROCESSING (no reference yet)
3. Code Craft API called → returns response with `reference_id`
4. Reference extracted from response and stored in database via `updateAtOrderStatus(id, status, supplier, response, reference_id)`
5. Background polling now finds the reference and can query Code Craft status
6. Status updates to FULFILLED when Code Craft confirms delivery

## Files Modified
- `server/storage.ts` - Added supplierReference support to all create/update methods
- `server/routes.ts` - Extract and save reference_id in both AT and TELECEL purchase endpoints

## Verification Steps
1. Create a new AT or TELECEL order
2. Check database: `at_orders` table should have `supplierReference` populated with Code Craft reference
3. Check polling logs: should show `✅ Order {id} fulfilled with supplier reference: {ref}`
4. Check status: after ~10 seconds, order status should update to FULFILLED (if Code Craft confirms delivery)
5. Manual refresh should now work: `POST /api/at/orders/{id}/refresh`

## Status Polling Now Works
- Automatic polling runs every 10 minutes
- Queries Code Craft using stored `supplierReference`
- Updates order status based on Code Craft response:
  - "Successful" / "Crediting successful" / code 200 → FULFILLED
  - codes 0, 100-103, 500, 555 → FAILED
  - Other responses → PROCESSING
- Manual refresh available via admin UI

## Testing
After deployment:
1. Create test order through storefront
2. Verify database has `supplierReference` populated
3. Check polling logs for successful status checks
4. Verify status transitions to FULFILLED within 10 minutes
