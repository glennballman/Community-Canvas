# V3.5 E2E Golden Paths Tests

End-to-end tests for core user flows using Playwright.

## Prerequisites

- Demo data seeded (use Demo Launcher: `/app/dev/demo`)
- Environment variables configured:
  - `ALLOW_TEST_AUTH=true`
  - `TEST_AUTH_SECRET=<your-secret>`

## Running Tests

```bash
# Run all E2E tests
ALLOW_TEST_AUTH=true TEST_AUTH_SECRET=cc-test-auth-secret-dev-only-2024 npx playwright test

# Run with headed browser (debug mode)
ALLOW_TEST_AUTH=true TEST_AUTH_SECRET=cc-test-auth-secret-dev-only-2024 npx playwright test --headed

# Run specific test file
ALLOW_TEST_AUTH=true TEST_AUTH_SECRET=cc-test-auth-secret-dev-only-2024 npx playwright test golden-paths.spec.ts
```

## Test Scenarios

### TEST 1: Targeted Request → Accept
1. Ellen creates a TARGETED work request for a service provider
2. Tester (provider) views and accepts the request
3. Status shows ACCEPTED

### TEST 2: Targeted → Decline → Open to Responses
1. Ellen creates another TARGETED request
2. Tester declines
3. Ellen opens request to all responses
4. Status shows OPEN

### TEST 3: Service Run Create → Publish → Monitor
1. Service provider creates a new service run
2. Publishes to a portal
3. Monitor page loads correctly

## Notes

- Tests use `/api/test/auth/login` endpoint (no UI login)
- Each test creates fresh data to avoid conflicts
- Tests run sequentially (not parallel) for stability
