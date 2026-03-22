#!/usr/bin/env python3
import re

# Read the file
with open('/supabase/functions/server/customers_routes.tsx', 'r') as f:
    content = f.read()

# Replace all instances of JSON.stringify in kv.set() calls
# Pattern: kv.set(..., JSON.stringify(variable))
# Replace with: kv.set(..., variable)
content = re.sub(
    r'(await kv\.set\([^,]+,\s*)JSON\.stringify\(([^)]+)\)\)',
    r'\1\2)',
    content
)

# Also handle multiline cases with kv.set
content = re.sub(
    r'(kv\.set\(\s*`[^`]+`,\s*)JSON\.stringify\(([^)]+)\)',
    r'\1\2',
    content
)

# Write back
with open('/supabase/functions/server/customers_routes.tsx', 'w') as f:
    f.write(content)

print("Fixed all JSON.stringify() calls in kv.set()")
