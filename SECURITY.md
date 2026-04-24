# Security Policy

## Supported Versions

Security fixes are applied to the current `main` branch of Gubernator.

## Reporting a Vulnerability

Please do **not** open public GitHub issues for suspected security vulnerabilities.

If the repository Security tab shows a `Report a vulnerability` button, use GitHub private vulnerability reporting first.

If that option is not available, contact the maintainer privately through GitHub:

1. Contact the maintainer privately:
   <https://github.com/DylanLogan2581>
1. Include as much detail as possible so the issue can be reproduced and assessed quickly.

## What To Include

Please include:

- a short description of the issue
- affected files, routes, migrations, functions, or workflows
- steps to reproduce
- impact assessment
- any proof of concept, logs, screenshots, or payloads that help confirm the issue
- suggested remediation if you already have one

Good reports are specific and reproducible.

## What To Expect

The maintainer will try to:

- acknowledge the report within a reasonable time
- confirm whether the issue is valid and in scope
- work on a fix or mitigation when the report is accepted
- coordinate disclosure after a fix is available when appropriate

No formal SLA is guaranteed, but responsible private disclosure is appreciated.

## Scope

This policy covers vulnerabilities in the Gubernator repository, including:

- application code in `src`
- Supabase migrations and Edge Functions
- configuration committed to the repository
- workflows and automation in `.github`
- documented setup or example patterns that could lead to insecure usage

Issues that are only present in third-party dependencies may still be useful to report, but they may need to be fixed upstream or by updating dependency versions.

## Security Expectations For Contributors

Gubernator enforces Row Level Security on all application tables and uses Supabase Auth for session management. Privileged workflows run in Edge Functions, not in the browser. Review every change for:

- authentication and authorization flaws, including session and role checks
- missing or incorrect RLS policies on Gubernator domain tables (worlds, turns, settlements, citizens, resources, and related tables)
- input validation issues in Edge Functions and form submissions
- secret exposure — never commit service-role keys, real credentials, or `VITE_`-prefixed secrets that should stay server-side
- unsafe client-side data access or direct use of privileged Supabase APIs from the browser
- insecure webhook, Edge Function, or privileged workflow behavior

Do not commit secrets, service-role keys, or real credentials to the repository.
