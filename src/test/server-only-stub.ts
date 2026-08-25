// Vitest runs outside Next's bundler, which is what normally makes the
// real "server-only" package throw when imported from client code. Aliased
// to this no-op in vitest.config.mts so modules that import "server-only"
// (a correctness guard for app code, not a testing concern) are still
// unit-testable directly.
export {};
