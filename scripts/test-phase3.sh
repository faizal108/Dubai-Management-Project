#!/usr/bin/env bash
# Phase 3 smoke test: Donor + Donation CRUD, scoping, conditional validation,
# state transitions, soft-delete/restore, and audit trail.
#
# Usage:
#   chmod +x scripts/test-phase3.sh
#   ./scripts/test-phase3.sh
#
# Override defaults via env vars:
#   BASE_URL, EMAIL, PASSWORD, FOUNDATION_ID, DONOR_PAN, DONOR_NAME

set -u

BASE_URL="${BASE_URL:-http://localhost:4000/api/v1}"
EMAIL="${EMAIL:-superadmin@example.com}"
PASSWORD="${PASSWORD:-ChangeMe@123}"
FOUNDATION_ID="${FOUNDATION_ID:-}"
DONOR_PAN="${DONOR_PAN:-ABCDE1234F}"
DONOR_NAME="${DONOR_NAME:-Ravi Kumar}"

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
blue()  { printf "\033[34m%s\033[0m\n" "$1"; }
hr()    { printf '%.0s-' {1..70}; echo; }

req() {
  # req METHOD PATH [JSON_BODY] -> writes status to $STATUS, body to $BODY
  local method="$1" path="$2" body="${3:-}"
  local args=(-s -o /tmp/p3body.txt -w "%{http_code}" -X "$method" "$BASE_URL$path"
              -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")
  if [ -n "$body" ]; then args+=(-d "$body"); fi
  STATUS=$(curl "${args[@]}")
  BODY=$(cat /tmp/p3body.txt)
}

expect() {
  # expect STEP EXPECTED_STATUS
  if [ "$STATUS" = "$2" ]; then
    green "[OK]    $1  -> $STATUS"
  else
    red   "[FAIL]  $1  -> $STATUS (expected $2)"
  fi
  echo "$BODY" | head -c 400; echo; hr
}

extract_id() {
  # extract_id KEY  (reads from $BODY)
  echo "$BODY" | grep -oE "\"$1\":\"[^\"]+\"" | head -n1 | sed -E "s/\"$1\":\"([^\"]+)\"/\1/"
}

[ -z "$FOUNDATION_ID" ] && { red "Set FOUNDATION_ID env var first."; exit 1; }

blue "==> 1. Login"
LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN=$(echo "$LOGIN" | grep -oE '"(accessToken|token)":"[^"]+"' | head -n1 | sed 's/.*:"\(.*\)"/\1/')
[ -z "$TOKEN" ] && { red "Login failed: $LOGIN"; exit 1; }
green "[OK]    login"; hr

blue "==> 2. Create donor"
req POST "/donors" "{\"foundationId\":\"$FOUNDATION_ID\",\"fullName\":\"$DONOR_NAME\",\"pan\":\"$DONOR_PAN\",\"email\":\"ravi@example.com\",\"phone\":\"+91-9876543210\",\"city\":\"Mumbai\"}"
expect "create donor" 201
DONOR_ID=$(extract_id "id")

blue "==> 3. Duplicate PAN should 409"
req POST "/donors" "{\"foundationId\":\"$FOUNDATION_ID\",\"fullName\":\"Other\",\"pan\":\"$DONOR_PAN\"}"
expect "duplicate donor PAN" 409

blue "==> 4. List donors"
req GET "/donors?foundationId=$FOUNDATION_ID"
expect "list donors" 200

blue "==> 5. Get donor"
req GET "/donors/$DONOR_ID"
expect "get donor" 200

blue "==> 6. Create CASH donation"
req POST "/donations" "{\"foundationId\":\"$FOUNDATION_ID\",\"donorId\":\"$DONOR_ID\",\"amount\":\"5000.00\",\"type\":\"CASH\"}"
expect "create CASH donation" 201
DON_ID=$(extract_id "id")

blue "==> 7. CHEQUE without chequeNumber/bankName should 400"
req POST "/donations" "{\"foundationId\":\"$FOUNDATION_ID\",\"donorId\":\"$DONOR_ID\",\"amount\":\"2500\",\"type\":\"CHEQUE\"}"
expect "CHEQUE missing fields" 422

blue "==> 8. ONLINE without utr should 400"
req POST "/donations" "{\"foundationId\":\"$FOUNDATION_ID\",\"donorId\":\"$DONOR_ID\",\"amount\":\"1500\",\"type\":\"ONLINE\"}"
expect "ONLINE missing utr" 422

blue "==> 9. Valid CHEQUE donation"
req POST "/donations" "{\"foundationId\":\"$FOUNDATION_ID\",\"donorId\":\"$DONOR_ID\",\"amount\":\"7500\",\"type\":\"CHEQUE\",\"chequeNumber\":\"123456\",\"bankName\":\"HDFC\"}"
expect "create CHEQUE donation" 201

blue "==> 10. Patch PENDING donation"
req PATCH "/donations/$DON_ID" "{\"notes\":\"updated before receipt\"}"
expect "patch PENDING" 200

blue "==> 11. Mark received"
req POST "/donations/$DON_ID/mark-received"
expect "mark-received" 200

blue "==> 12. Patch RECEIVED should 409"
req PATCH "/donations/$DON_ID" "{\"notes\":\"too late\"}"
expect "patch RECEIVED rejected" 409

blue "==> 13. Mark printed"
req POST "/donations/$DON_ID/mark-printed"
expect "mark-printed" 200

blue "==> 14. List donations (filter)"
req GET "/donations?foundationId=$FOUNDATION_ID&type=CASH&status=RECEIVED"
expect "filter donations" 200

blue "==> 15. Soft-delete donation"
req DELETE "/donations/$DON_ID"
expect "delete donation" 204

blue "==> 16. List with includeDeleted=true"
req GET "/donations?foundationId=$FOUNDATION_ID&includeDeleted=true"
expect "list incl deleted" 200

blue "==> 17. Restore donation"
req POST "/donations/$DON_ID/restore"
expect "restore donation" 200

blue "==> 18. Soft-delete donor"
req DELETE "/donors/$DONOR_ID"
expect "delete donor" 204

blue "==> 19. Restore donor"
req POST "/donors/$DONOR_ID/restore"
expect "restore donor" 200

hr
green "Done. Recent audit rows:"
docker compose exec -T postgres psql -U postgres -d donation_platform \
  -c "SELECT action, entity, \"entityId\", \"createdAt\" FROM \"AuditLog\" ORDER BY \"createdAt\" DESC LIMIT 10;" \
  2>/dev/null || echo "(skip audit dump — adjust DB creds if needed)"
