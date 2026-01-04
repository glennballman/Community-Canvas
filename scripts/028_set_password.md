# Secure Ops Step: Set cc_app Password

## Option 1: Via Replit Secrets (Recommended)

1. Go to **Secrets** tab in Replit (lock icon in left sidebar)
2. Add a new secret:
   - Key: `CC_APP_DB_PASSWORD`
   - Value: Generate a strong password (32+ chars, alphanumeric)

3. Then run this SQL (replace `YOUR_SECURE_PASSWORD`):

```sql
ALTER ROLE cc_app PASSWORD 'YOUR_SECURE_PASSWORD';
```

4. Update your DATABASE_URL or create a new secret:
   - Key: `CC_APP_DATABASE_URL`
   - Value: `postgresql://cc_app:YOUR_SECURE_PASSWORD@host:port/dbname`

## Option 2: Via psql (One-time)

Connect as postgres and run:

```sql
-- Generate password and set it
\set pwd `openssl rand -base64 32`
ALTER ROLE cc_app PASSWORD :'pwd';
\echo 'Password set to:' :pwd
```

Then copy the output password to your Replit secrets.

## Option 3: Via Replit Shell

```bash
# Generate a secure password
NEW_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=')

# Set it in the database
psql "$DATABASE_URL" -c "ALTER ROLE cc_app PASSWORD '$NEW_PASSWORD'"

# Display it (copy to secrets)
echo "cc_app password: $NEW_PASSWORD"
echo ""
echo "New DATABASE_URL for cc_app:"
echo "postgresql://cc_app:$NEW_PASSWORD@${PGHOST}:${PGPORT}/${PGDATABASE}"
```

## After Setting Password

1. Add `CC_APP_DATABASE_URL` secret with the new connection string
2. Update server code to use `CC_APP_DATABASE_URL` instead of `DATABASE_URL`
3. Restart the application
4. Run verification script

## Security Notes

- Never commit the password to git
- The cc_app role has NOBYPASSRLS - RLS policies always apply
- The cc_app role is NOT a superuser
- Sensitive tables (sessions, identity docs, payment methods) are SELECT-only
