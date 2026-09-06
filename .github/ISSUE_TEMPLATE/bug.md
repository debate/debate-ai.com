---
name: Bug
about: Describe this issue template's purpose here.
title: ''
labels: ''
assignees: ''

---

name: Bug report
description: Report a reproducible problem
title: "[Bug]: "
labels:
  - bug
body:
  - type: markdown
    attributes:
      value: |
        Thanks for reporting a bug. Please include enough detail for us to reproduce it.

  - type: textarea
    id: what-happened
    attributes:
      label: What happened?
      description: Describe the observed behavior and what you expected instead.
      placeholder: Tell us what you saw.
    validations:
      required: true

  - type: textarea
    id: reproduce
    attributes:
      label: Steps to reproduce
      description: Provide the smallest reliable reproduction.
      placeholder: |
        1. Go to ...
        2. Click ...
        3. Observe ...
    validations:
      required: true

  - type: textarea
    id: environment
    attributes:
      label: Environment
      description: Include app version, OS, browser/runtime, deployment type, etc.
      placeholder: |
        App version:
        OS:
        Browser/runtime:
        Node version:
    validations:
      required: false

  - type: textarea
    id: logs
    attributes:
      label: Relevant logs
      description: Paste sanitized logs, stack traces, or screenshots.
      render: shell
    validations:
      required: false
