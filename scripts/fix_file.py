import re

with open('shared/chamber-members.ts', 'r') as f:
    content = f.read()

lines = content.split('\n')
result = []
i = 0

while i < len(lines):
    line = lines[i]
    
    # Pattern: after `    },` (inner close), if followed by blank/comment then `  {`
    # We need to add `  },` right after `    },` if it's not already there
    
    if line.strip() == '},' and line.startswith('    '):
        result.append(line)
        
        # Look ahead for pattern: blank/comments followed by  {
        j = i + 1
        buffer = []
        found_array_start = False
        
        while j < len(lines):
            next_line = lines[j]
            stripped = next_line.strip()
            
            if stripped == '' or stripped.startswith('//'):
                buffer.append(next_line)
                j += 1
            elif next_line == '  {':
                found_array_start = True
                break
            elif next_line == '  },':
                # Already has outer close
                break
            else:
                break
        
        if found_array_start:
            # Check if we already have  },
            has_close = any(l == '  },' for l in buffer)
            if not has_close:
                result.append('  },')
            # Add buffer and continue from  {
            result.extend(buffer)
            i = j - 1  # Will be incremented
        else:
            # No special handling needed
            pass
    else:
        # Check if this is a misplaced  }, (after comments, before  {)
        if line == '  },':
            # Look ahead to see if  { follows
            if i + 1 < len(lines) and lines[i + 1] == '  {':
                # This is fine - keep it
                result.append(line)
            elif i + 1 < len(lines) and lines[i + 1].strip() == '':
                # Check further
                j = i + 1
                while j < len(lines) and (lines[j].strip() == '' or lines[j].strip().startswith('//')):
                    j += 1
                if j < len(lines) and lines[j] == '  {':
                    # This is misplaced - it's after comments but should be before
                    # Skip it here, we'll add it in the right place
                    i += 1
                    continue
                else:
                    result.append(line)
            else:
                result.append(line)
        else:
            result.append(line)
    
    i += 1

with open('shared/chamber-members.ts', 'w') as f:
    f.write('\n'.join(result))

print("Fixed file")
