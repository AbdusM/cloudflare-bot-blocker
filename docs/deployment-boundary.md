# Deployment Boundary

This repository is intended to stay public and generic.

## Keep Public

- worker runtime code
- config parsing and presets
- neutral examples
- generic documentation
- tests for generic behavior

## Keep Private

- route bindings and zone names
- custom domains and staging hosts
- upstream origin hosts
- deployment-specific cookie names
- product-specific path or module heuristics
- cutover runbooks and parity reports
- customer or first-party traffic review notes

## Operating Rule

Treat each deployment as private configuration layered onto the worker.

If a deployment needs a host name, upstream origin, cookie deletion domain, site-specific asset marker, or product-specific protected path, that data belongs in private infrastructure configuration or a private deployment repository, not in this public source tree.

## History Caveat

Removing tenant-specific files from the current tree does not remove them from existing public git history.

If tenant-specific operational material was previously pushed to a public remote, follow up with a history rewrite and remote force-push, then rotate any affected operational assumptions.
