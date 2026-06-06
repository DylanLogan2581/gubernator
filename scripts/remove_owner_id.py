#!/usr/bin/env python3
"""
Remove owner_id from public.worlds INSERT statements in pgTAP test SQL files.

Strategy: parse the file text, find each INSERT INTO public.worlds block,
determine the position of owner_id in the column list, then remove that
positional value from every VALUES row in that block.

Handles both single-line and multi-line column lists, and both single-line
and multi-line value rows.
"""

import re
import os
import glob

TESTS_DIR = "/home/dylan/Projects/gubernator/supabase/tests"

SKIP_FILES = {
    "worlds_update_world_admin_test.sql",
    "worlds_owner_write_restrictions_test.sql",
}

UUID_RE = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.IGNORECASE,
)


def find_worlds_insert_blocks(text):
    """
    Find all INSERT INTO public.worlds blocks, returning a list of dicts:
      {
        'col_start': int,    # start char of column list (the '(')
        'col_end': int,      # end char of column list (past closing ')')
        'cols': list[str],   # column names in order
        'owner_idx': int,    # 0-based index of owner_id (-1 if absent)
        'vals_start': int,   # char offset where VALUES keyword starts
        'stmt_end': int,     # char offset of the last char of the INSERT statement
                             # This is the ';' for regular statements, or the last ')'
                             # of the final values row for dollar-quoted contexts.
      }
    """
    blocks = []

    # Find all INSERT INTO public.worlds occurrences
    insert_re = re.compile(r'\binsert\s+into\s+public\.worlds\s*\(', re.IGNORECASE)

    for m in insert_re.finditer(text):
        col_open = m.end() - 1  # position of '('

        # Walk forward to find the matching ')' for the column list
        # Skip over single-quoted strings
        depth = 0
        i = col_open
        in_string = False
        string_char = None
        col_close = None
        while i < len(text):
            ch = text[i]
            if in_string:
                if ch == string_char:
                    if i + 1 < len(text) and text[i + 1] == string_char:
                        i += 2
                        continue
                    in_string = False
            else:
                if ch in ("'", '"'):
                    in_string = True
                    string_char = ch
                elif ch == '(':
                    depth += 1
                elif ch == ')':
                    depth -= 1
                    if depth == 0:
                        col_close = i
                        break
            i += 1

        if col_close is None:
            continue  # malformed

        cols_str = text[col_open + 1:col_close]
        cols = [c.strip() for c in cols_str.split(',') if c.strip()]

        if 'owner_id' not in cols:
            continue

        owner_idx = cols.index('owner_id')

        # Find VALUES keyword after the column list
        vals_m = re.search(r'\bvalues\b', text[col_close:], re.IGNORECASE)
        if not vals_m:
            continue
        vals_start = col_close + vals_m.start()

        # Find the end of the INSERT statement.
        # Walk from after VALUES, tracking paren depth.
        # Terminate at:
        #   - ';' at paren_depth == 0  (normal statement end)
        #   - A dollar-quote terminator like $test$ at paren_depth == 0
        #     (the INSERT is inside a pgTAP dollar-quoted string)
        # In the dollar-quote case, we stop at the last ')' of the values clause.
        stmt_end = None
        i = vals_start + len(vals_m.group())
        paren_depth = 0
        last_close_paren = None
        in_string2 = False
        string_char2 = None

        while i < len(text):
            c = text[i]
            if in_string2:
                if c == string_char2:
                    if i + 1 < len(text) and text[i + 1] == string_char2:
                        i += 2
                        continue
                    in_string2 = False
            else:
                if c in ("'", '"'):
                    in_string2 = True
                    string_char2 = c
                elif c == '(':
                    paren_depth += 1
                elif c == ')':
                    paren_depth -= 1
                    if paren_depth == 0:
                        last_close_paren = i
                elif c == ';' and paren_depth == 0:
                    stmt_end = i
                    break
                elif c == '$' and paren_depth == 0:
                    # Dollar-quote boundary - INSERT is inside a pgTAP string
                    # Use the last close paren as the statement end
                    if last_close_paren is not None:
                        stmt_end = last_close_paren
                    break
            i += 1

        if stmt_end is None and last_close_paren is not None:
            stmt_end = last_close_paren

        if stmt_end is None:
            continue

        blocks.append({
            'col_start': col_open,
            'col_end': col_close,
            'cols': cols,
            'owner_idx': owner_idx,
            'vals_start': vals_start,
            'stmt_end': stmt_end,
        })

    return blocks


def remove_col_from_col_list(cols_text, owner_idx):
    """
    Given the raw text inside the column list parens, remove the owner_id column.
    Handles both:
      - single-line: "id, name, owner_id, visibility, status"
      - multi-line:  "\n    id,\n    name,\n    owner_id,\n    visibility,\n    status\n  "
    """
    # Split by comma
    # For multi-line we need to preserve other indentation
    is_multiline = '\n' in cols_text

    if is_multiline:
        # Split into lines, remove the line containing "owner_id"
        lines = cols_text.split('\n')
        new_lines = []
        for line in lines:
            stripped = line.strip().rstrip(',')
            if stripped == 'owner_id':
                continue
            new_lines.append(line)
        return '\n'.join(new_lines)
    else:
        # Single-line: "id, name, owner_id, visibility, status"
        parts = [p.strip() for p in cols_text.split(',')]
        parts = [p for p in parts if p != 'owner_id']
        return ', '.join(parts)


def remove_value_at_position(values_text, owner_idx):
    """
    Given the raw text of the VALUES clause (everything after VALUES keyword
    up to and including the final semicolon), remove the value at owner_idx
    from every row.

    This handles both single-line and multi-line rows, including rows that
    span multiple lines with any value types (UUIDs, integers, strings, jsonb).
    """
    # We need to parse this carefully. The values section contains:
    #   (v1, v2, v3, ...), (v1, v2, v3, ...) ;
    # But values can themselves contain nested parens (jsonb) and strings with commas.

    result_parts = []
    i = 0
    text = values_text

    while i < len(text):
        c = text[i]

        if c == '(':
            # Start of a row - find its end
            row_start = i
            depth = 0
            j = i
            in_string = False
            string_char = None

            while j < len(text):
                ch = text[j]
                if in_string:
                    if ch == string_char:
                        # Check for escaped quote ('' in SQL)
                        if j + 1 < len(text) and text[j + 1] == string_char:
                            j += 2
                            continue
                        in_string = False
                else:
                    if ch in ("'", '"'):
                        in_string = True
                        string_char = ch
                    elif ch == '(':
                        depth += 1
                    elif ch == ')':
                        depth -= 1
                        if depth == 0:
                            row_end = j
                            break
                j += 1
            else:
                # No closing paren found - emit as-is
                result_parts.append(text[i:])
                break

            row_content = text[row_start + 1:row_end]  # inside the parens
            row_suffix = text[row_end + 1:row_end + 2]  # ',' or ';' or whitespace

            # Determine if this is a multi-line row
            is_multiline_row = '\n' in row_content

            if is_multiline_row:
                new_content = remove_nth_value_multiline(row_content, owner_idx)
            else:
                new_content = remove_nth_value_singleline(row_content, owner_idx)

            result_parts.append('(' + new_content + ')')
            i = row_end + 1
            continue

        result_parts.append(c)
        i += 1

    return ''.join(result_parts)


def remove_nth_value_singleline(content, n):
    """
    Remove the nth (0-based) value from a single-line comma-separated value list.
    Values may be quoted strings, numbers, or jsonb expressions.
    This tokenizer handles quoted strings with escaped quotes.
    """
    tokens = []
    separators = []  # the separators between tokens (commas + surrounding whitespace)
    i = 0
    current_token_start = None

    # Simple tokenizer: split by commas at depth 0 (not inside strings or parens)
    depth = 0
    in_string = False
    string_char = None
    tok_start = 0

    parts = []
    i = 0
    while i < len(content):
        ch = content[i]
        if in_string:
            if ch == string_char:
                if i + 1 < len(content) and content[i + 1] == string_char:
                    i += 2
                    continue
                in_string = False
        else:
            if ch in ("'", '"'):
                in_string = True
                string_char = ch
            elif ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
            elif ch == ',' and depth == 0:
                parts.append(content[tok_start:i])
                tok_start = i + 1
        i += 1

    parts.append(content[tok_start:])

    # Remove nth part
    if n < len(parts):
        # Remove leading/trailing spaces from the removed part to clean up separators
        del parts[n]

    # Re-join, preserving whitespace between tokens as ", "
    # We need to be careful: the original formatting may use ", " or ",\n  " etc.
    # For single-line, just use ", " separator
    return ', '.join(p.strip() for p in parts)


def remove_nth_value_multiline(content, n):
    """
    Remove the nth (0-based) value from a multi-line value list.

    In multi-line format, each value is typically on its own line:
      \n    'uuid1',       ← index 0
      \n    'World Name',  ← index 1
      \n    'owner-uuid',  ← index 2  ← REMOVE
      \n    3,             ← index 3 (or 'private')
      \n    'active'\n     ← index 4

    Strategy: parse lines into value tokens (handling multi-line values like jsonb).
    Each "value" in the comma-separated list maps to one or more lines.
    """
    # Split content (which is the raw text between the outer parens) into
    # comma-separated tokens at depth 0, preserving line structure.

    tokens = []  # list of (start_idx, end_idx) in content
    separators_before = []  # text before each token (whitespace/newlines)

    depth = 0
    in_string = False
    string_char = None

    tok_start = 0
    # Skip leading whitespace/newlines to find first token
    i = 0
    # We'll collect segments between commas (at depth 0)
    # Each segment is the full text including leading/trailing whitespace

    segs = []
    seg_start = 0
    i = 0

    while i < len(content):
        ch = content[i]
        if in_string:
            if ch == string_char:
                if i + 1 < len(content) and content[i + 1] == string_char:
                    i += 2
                    continue
                in_string = False
        else:
            if ch in ("'", '"'):
                in_string = True
                string_char = ch
            elif ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
            elif ch == ',' and depth == 0:
                segs.append(content[seg_start:i])
                seg_start = i + 1  # skip the comma
        i += 1

    segs.append(content[seg_start:])

    # Remove nth segment
    if n < len(segs):
        removed = segs[n]
        del segs[n]

        # We need to reconstruct with commas.
        # The removed segment's text includes its leading newline/indent.
        # After removal, the following segment will have an extra leading newline.
        # Strategy: reconstruct by joining segments with commas, but handle
        # the case where removing a segment might leave a trailing comma.

        # Re-join: put the comma back between all remaining segments.
        # The leading whitespace of each segment is preserved.
        result = ','.join(segs)
        return result
    else:
        return content


def process_file(filepath):
    """Process a single SQL file, removing owner_id from worlds inserts."""
    with open(filepath, 'r', encoding='utf-8') as f:
        original = f.read()

    if 'owner_id' not in original:
        return False

    text = original

    # Find all INSERT INTO public.worlds blocks (process in reverse order to
    # preserve offsets when we splice)
    blocks = find_worlds_insert_blocks(text)
    if not blocks:
        return False

    # Process blocks in reverse order (last first) so splicing doesn't shift earlier positions
    for block in reversed(blocks):
        owner_idx = block['owner_idx']
        col_start = block['col_start']
        col_end = block['col_end']
        vals_start = block['vals_start']
        stmt_end = block['stmt_end']

        # 1. Remove owner_id from column list
        cols_inner = text[col_start + 1:col_end]
        new_cols_inner = remove_col_from_col_list(cols_inner, owner_idx)
        text = text[:col_start + 1] + new_cols_inner + text[col_end:]

        # Recalculate offsets after column list edit
        offset_delta = len(new_cols_inner) - len(cols_inner)
        vals_start += offset_delta
        stmt_end += offset_delta

        # 2. Remove the owner_id value from VALUES
        # The values section is from after "values" keyword to (and including) the ";"
        # We get the text of the VALUES keyword
        vals_keyword_end = vals_start + len(re.match(r'\bvalues\b', text[vals_start:], re.IGNORECASE).group())
        vals_content = text[vals_keyword_end:stmt_end + 1]

        new_vals_content = remove_value_at_position(vals_content, owner_idx)
        text = text[:vals_keyword_end] + new_vals_content + text[stmt_end + 1:]

    if text != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(text)
        return True
    return False


def main():
    all_files = sorted(glob.glob(os.path.join(TESTS_DIR, "*.sql")))

    files_with_owner_id = []
    for f in all_files:
        basename = os.path.basename(f)
        if basename in SKIP_FILES:
            continue
        with open(f, 'r', encoding='utf-8') as fh:
            content = fh.read()
        if 'owner_id' in content:
            files_with_owner_id.append(f)

    print(f"Found {len(files_with_owner_id)} files with owner_id (excluding skipped files)")
    print()

    changed = []
    unchanged = []

    for filepath in files_with_owner_id:
        basename = os.path.basename(filepath)
        try:
            modified = process_file(filepath)
        except Exception as e:
            print(f"  ERROR in {basename}: {e}")
            import traceback
            traceback.print_exc()
            continue

        if modified:
            changed.append(basename)
            print(f"  CHANGED: {basename}")
        else:
            unchanged.append(basename)
            print(f"  unchanged: {basename}")

    print()
    print(f"Summary: {len(changed)} files changed, {len(unchanged)} files unchanged")

    if unchanged:
        print()
        print("Files with owner_id that were NOT changed (may need manual review):")
        for f in unchanged:
            print(f"  {f}")


if __name__ == '__main__':
    main()
