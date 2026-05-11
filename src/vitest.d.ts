/**
 * Minimal vitest type shim for TypeScript.
 * Allows test files to import from 'vitest' without the package installed.
 * The actual vitest runtime resolves these at test execution time.
 */
declare module 'vitest' {
  export interface MockFn<T = unknown> {
    (...args: unknown[]): T;
    mockReturnValue(val: T): this;
    mockResolvedValue(val: T): this;
    mockRejectedValue(err: unknown): this;
    mockImplementation(fn: (...args: unknown[]) => T): this;
    mockReset(): void;
    mockClear(): void;
  }

  export interface Matchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toStrictEqual(expected: unknown): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeNull(): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeGreaterThan(n: number): void;
    toBeGreaterThanOrEqual(n: number): void;
    toBeLessThan(n: number): void;
    toBeLessThanOrEqual(n: number): void;
    toHaveLength(n: number): void;
    toContain(value: unknown): void;
    toThrow(msg?: string | RegExp): void;
    toBeCloseTo(n: number, d?: number): void;
    toMatchObject(obj: object): void;
    toBeInstanceOf(cls: unknown): void;
    toHaveBeenCalledOnce(): void;
    toHaveBeenCalledWith(...args: unknown[]): void;
    toHaveBeenCalled(): void;
    toHaveBeenCalledTimes(n: number): void;
    resolves: Matchers;
    rejects: Matchers;
    not: Matchers;
  }

  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function expect(value: unknown): Matchers;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;

  export const vi: {
    fn<T = unknown>(): MockFn<T>;
    spyOn<T extends object>(obj: T, method: keyof T): MockFn;
    mock(mod: string): void;
    resetAllMocks(): void;
    clearAllMocks(): void;
  };
}
